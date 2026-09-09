// Resting display rounds lengths to whole numbers; the exact source value is
// what you get when you focus the field, and what non-length units keep.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ToolInput, { roundLengthForDisplay } from './ToolInput';

describe('roundLengthForDisplay', () => {
  it('rounds px / % / vh / vw, leaves integers, unitless, deg and fr alone', () => {
    expect(roundLengthForDisplay('30.8353%')).toBe('31%');
    expect(roundLengthForDisplay('414.131px')).toBe('414px');
    expect(roundLengthForDisplay('-0.4px')).toBe('0px');
    expect(roundLengthForDisplay('18px')).toBe('18px');
    expect(roundLengthForDisplay('1.6')).toBe('1.6');
    expect(roundLengthForDisplay('12.5deg')).toBe('12.5deg');
    expect(roundLengthForDisplay('auto')).toBe('auto');
  });
});

describe('ToolInput resting display', () => {
  it('shows the rounded length at rest and the exact value while focused', () => {
    render(<ToolInput value="46.6443%" onChange={() => {}} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('47%');
    fireEvent.focus(input);
    expect(input.value).toBe('46.6443%');
    fireEvent.blur(input);
    expect(input.value).toBe('47%');
  });
});
