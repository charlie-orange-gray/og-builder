// mirrorNegative: a scrub/step past 0 emits the SIGNED value (the consumer
// mirrors the box) but the field shows the magnitude — what will be written.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ToolInput from './ToolInput';

describe('ToolInput — mirrorNegative', () => {
  it('ArrowDown from 0px emits -1px but displays 1px', () => {
    const onChange = vi.fn();
    render(<ToolInput value="0px" onChange={onChange} mirrorNegative />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith('-1px');
    expect(input.value).toBe('1px');
  });
  it('without the flag the field shows the signed value (radius etc. rely on min instead)', () => {
    const onChange = vi.fn();
    render(<ToolInput value="0px" onChange={onChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith('-1px');
    expect(input.value).toBe('-1px');
  });
});
