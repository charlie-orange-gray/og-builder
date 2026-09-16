// Right-click on a section title row opens the same menu as the `+` action.
import { describe, test, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
vi.mock('@/shared/debug-trace', () => ({ trace: { action: vi.fn(), fn: vi.fn(), dom: vi.fn(), error: vi.fn() } }));
import ToolSection from './ToolSection';

describe('ToolSection header context menu', () => {
  test('contextmenu on the title row clicks the action button and suppresses the native menu', () => {
    const onAdd = vi.fn();
    const { getByText } = render(
      <ToolSection title="Animation" action={<button type="button" onClick={onAdd}>+</button>}>
        <div>row</div>
      </ToolSection>,
    );
    const ev = fireEvent.contextMenu(getByText('Animation'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(ev).toBe(false); // preventDefault called
  });
  test('no action → native context menu untouched', () => {
    const { getByText } = render(<ToolSection title="Styles"><div>row</div></ToolSection>);
    expect(fireEvent.contextMenu(getByText('Styles'))).toBe(true);
  });
});
