// The modal hands the TYPED name to onSubmit and only then calls onClose. A
// consumer that stashed the name in state and confirmed on a setTimeout read
// a stale closure (onClose had reset the state in the same batch) and created
// the component under its fallback name ("Frame", 2026-09-08). Consumers must
// act on the `name` argument synchronously — this pins the contract.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NameInputModal from './NameInputModal';

describe('NameInputModal — submit contract', () => {
  it('passes the typed (trimmed) name to onSubmit, then closes', () => {
    const calls: string[] = [];
    const onSubmit = vi.fn((name: string) => calls.push(`submit:${name}`));
    const onClose = vi.fn(() => calls.push('close'));
    render(<NameInputModal isOpen onClose={onClose} onSubmit={onSubmit} title="Name Component" defaultValue="Frame" submitLabel="Create Component" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  Header ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(calls).toEqual(['submit:Header', 'close']);
  });
  it('the Enter path and the button path submit the same typed value, not the defaultValue', () => {
    const onSubmit = vi.fn();
    render(<NameInputModal isOpen onClose={() => {}} onSubmit={onSubmit} title="Name Component" defaultValue="Frame" submitLabel="Create Component" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Header' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Component' }));
    expect(onSubmit).toHaveBeenCalledWith('Header');
    expect(onSubmit).not.toHaveBeenCalledWith('Frame');
  });
});
