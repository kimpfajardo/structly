// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Select } from '../Select';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

describe('Select', () => {
  it('opens its popover and selects an option with the keyboard', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let selected = 'all';

    act(() => {
      root.render(
        <Select
          id="test-select"
          label="Category"
          value={selected}
          options={[
            { value: 'all', label: 'All categories' },
            { value: 'metadata', label: 'Metadata' },
          ]}
          onChange={(value) => { selected = value; }}
        />,
      );
    });

    const trigger = container.querySelector<HTMLButtonElement>('[role="combobox"]');
    if (!trigger) throw new Error('Select trigger not found.');

    act(() => trigger.click());
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    act(() => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    act(() => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));

    expect(selected).toBe('metadata');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    act(() => root.unmount());
    container.remove();
  });
});
