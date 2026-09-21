import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import SmoothScrollPopup from './SmoothScrollPopup';
import { createDefaultSmoothScroll } from '@/code/project/smooth-scroll-config';

afterEach(() => { cleanup(); vi.useRealTimers(); });
// jsdom has no ResizeObserver; the segmented control measures its tabs with one.
if (!('ResizeObserver' in globalThis)) {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}

// Every change used to write the project file and re-render the panel, so the
// intensity slider stuttered and the Yes/No tabs switched late. The popup now
// edits a local draft instantly and writes once, debounced.
describe('SmoothScrollPopup', () => {
  it('updates its controls instantly and writes once after a burst of changes', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { container, getAllByText } = render(<SmoothScrollPopup config={createDefaultSmoothScroll()} onChange={onChange} />);
    const input = container.querySelector('input[type="range"]') as HTMLInputElement | null;
    if (input) for (const v of [13, 20, 31, 43]) fireEvent.change(input, { target: { value: String(v) } });
    // Direction is two arrow icons: vertical first, horizontal second.
    const horizontal = container.querySelector('button svg path[d="M5 12h14M13 6l6 6-6 6"]')?.closest('button') as HTMLElement;
    expect(horizontal).toBeTruthy();
    fireEvent.click(horizontal);
    expect(onChange).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(300); });
    expect(onChange).toHaveBeenCalledTimes(1);
    const saved = onChange.mock.calls[0][0];
    expect(saved.orientation).toBe('horizontal');
    if (input) expect(saved.intensity).toBe(43);
  });

  it('saves the last value when closed before the write fires', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { getAllByText, unmount } = render(<SmoothScrollPopup config={createDefaultSmoothScroll()} onChange={onChange} />);
    fireEvent.click(getAllByText('Yes')[2]);   // Touch → Yes
    unmount();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].smoothTouch).toBe(true);
  });

  it('a value typed in the Intensity box is kept and written right away', () => {
    const onChange = vi.fn();
    const { container } = render(<SmoothScrollPopup config={createDefaultSmoothScroll()} onChange={onChange} />);
    const box = [...container.querySelectorAll('input')].find((i) => (i as HTMLInputElement).value === '12') as HTMLInputElement;
    expect(box).toBeTruthy();
    fireEvent.change(box, { target: { value: '30' } });
    fireEvent.blur(box);
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0].intensity).toBe(30);
  });

  it('the Intensity chevrons step the draft live and write once on release', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { container } = render(<SmoothScrollPopup config={createDefaultSmoothScroll()} onChange={onChange} />);
    const up = container.querySelectorAll('.group\\/chevron')[0] as HTMLElement;
    expect(up).toBeTruthy();
    // Hold: one step on press, then a repeat every 50ms after 200ms.
    fireEvent.mouseDown(up, { clientY: 100 });
    act(() => { vi.advanceTimersByTime(210); });
    expect(onChange).not.toHaveBeenCalled();
    const box = [...container.querySelectorAll('input')].find((i) => /^\d+$/.test((i as HTMLInputElement).value)) as HTMLInputElement;
    const during = Number(box.value);
    expect(during).toBeGreaterThan(12);
    fireEvent.mouseUp(document, { clientY: 100 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].intensity).toBe(during);
  });

  it('has no Scope row', () => {
    const { queryByText } = render(<SmoothScrollPopup config={createDefaultSmoothScroll()} onChange={() => {}} />);
    expect(queryByText('Scope')).toBeNull();
    expect(queryByText('All pages')).toBeNull();
  });
});
