// PlansSection.test.tsx — verify the section reads the new
// /api/stripe/website-subscription shape correctly: shows the right
// "Current plan" label, hides the Upgrade button for the current
// tier, surfaces 402 errors inline (no alert).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlansSection from './PlansSection';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Route the fetch stub by URL substring — the section issues several
// independent requests (subscription, forms usage, checkout), so a positional
// mock would hand one request another's body. Unlisted URLs get `{}`; the
// forms-usage call defaults to "not configured" (`usage: null`).
function stubFetch(routes: Record<string, () => Response>) {
  const all: Record<string, () => Response> = { '/forms/usage': () => jsonResponse({ usage: null }), ...routes };
  (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
    const key = Object.keys(all).find((k) => url.includes(k));
    return key ? all[key]() : jsonResponse({});
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlansSection — current plan rendering', () => {
  it('shows "Free plan" card when planType=free', async () => {
    stubFetch({ '/website-subscription': () => jsonResponse({
        planType: 'free',
        isActive: false,
        name: 'Free',
      }) });
    render(<PlansSection websiteId="w1" />);
    // The banner heading is now just the plan name ("Free"), under a
    // "Current plan" label — not the old "<name> plan" card title.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Free' })).toBeTruthy());
    expect(screen.getByText('Current plan')).toBeTruthy();
  });

  it('shows "Lite plan" card with renewal date when active', async () => {
    const periodEnd = new Date('2026-06-15').toISOString();
    stubFetch({ '/website-subscription': () => jsonResponse({
        planType: 'lite',
        isActive: true,
        status: 'active',
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        billingPeriod: 'monthly',
        name: 'Lite',
      }) });
    render(<PlansSection websiteId="w1" />);
    // Banner heading renders subscription.name ("Lite") — same markup change
    // as the free-plan test above.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Lite' })).toBeTruthy());
    expect(screen.getByText(/Renews on/i)).toBeTruthy();
  });

  it('shows "Cancels on" when cancelAtPeriodEnd=true', async () => {
    stubFetch({ '/website-subscription': () => jsonResponse({
        planType: 'lite',
        isActive: true,
        status: 'active',
        currentPeriodEnd: new Date('2026-07-01').toISOString(),
        cancelAtPeriodEnd: true,
        name: 'Lite',
      }) });
    render(<PlansSection websiteId="w1" />);
    await waitFor(() => expect(screen.getByText(/Cancels on/i)).toBeTruthy());
    expect(screen.getByText(/Canceled/i)).toBeTruthy();
  });
});

describe('PlansSection — checkout flow', () => {
  it('redirects to Stripe URL on successful create-checkout', async () => {
    stubFetch({
      '/website-subscription': () => jsonResponse({ planType: 'free', isActive: false, name: 'Free' }),
      '/create-checkout': () => jsonResponse({ url: 'https://checkout.stripe.com/abc' }),
    });

    // Stub window.location.href assignment.
    const originalLocation = window.location;
    delete (window as { location?: Location }).location;
    (window as { location: { href: string } }).location = { href: '' } as Location;

    render(<PlansSection websiteId="w1" />);
    await waitFor(() => screen.getByText(/Choose your plan/i));

    const upgradeBtn = screen.getByRole('button', { name: /Upgrade to Lite/i });
    await userEvent.click(upgradeBtn);

    await waitFor(() =>
      expect(window.location.href).toBe('https://checkout.stripe.com/abc'),
    );

    (window as { location: Location }).location = originalLocation;
  });

  it('shows inline error banner on 402 response', async () => {
    stubFetch({
      '/website-subscription': () => jsonResponse({ planType: 'free', isActive: false, name: 'Free' }),
      '/create-checkout': () => jsonResponse({ error: { code: 'PAYMENT_REQUIRED', message: 'Custom domain requires the Lite plan or higher' } }, 402),
    });

    render(<PlansSection websiteId="w1" />);
    await waitFor(() => screen.getByText(/Choose your plan/i));

    await userEvent.click(screen.getByRole('button', { name: /Upgrade to Lite/i }));

    await waitFor(() =>
      expect(screen.getByText(/Custom domain requires the Lite plan/i)).toBeTruthy(),
    );
  });
});

describe('PlansSection — Free form-submission quota', () => {
  it("lists the cap with the other Free limits and shows this month's usage", async () => {
    stubFetch({
      '/website-subscription': () => jsonResponse({ planType: 'free', isActive: false, name: 'Free' }),
      '/forms/usage': () => jsonResponse({ usage: { plan: 'free', cap: 50, used: 23, heldThisMonth: 0, held: 0, monthStart: 0 } }),
    });
    render(<PlansSection websiteId="w1" />);
    await waitFor(() => expect(screen.getByTestId('forms-usage').textContent).toBe('23 / 50 form submissions this month'));
    expect(screen.getByText(/50 form submissions \/ month/)).toBeTruthy();
    expect(screen.getByText('Unlimited form submissions')).toBeTruthy();
  });
  it('surfaces held submissions as the upgrade reason', async () => {
    stubFetch({
      '/website-subscription': () => jsonResponse({ planType: 'free', isActive: false, name: 'Free' }),
      '/forms/usage': () => jsonResponse({ usage: { plan: 'free', cap: 50, used: 62, heldThisMonth: 12, held: 12, monthStart: 0 } }),
    });
    render(<PlansSection websiteId="w1" />);
    await waitFor(() => expect(screen.getByTestId('forms-usage').textContent).toContain('12 held — upgrade to receive them'));
  });
  it('shows no usage line when forms are not configured', async () => {
    stubFetch({ '/website-subscription': () => jsonResponse({ planType: 'free', isActive: false, name: 'Free' }) });
    render(<PlansSection websiteId="w1" />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Free' })).toBeTruthy());
    expect(screen.queryByTestId('forms-usage')).toBeNull();
  });
});
