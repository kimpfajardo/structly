import { useEffect, useRef, useState } from 'react';
import styles from '../panel.module.css';

export function Select<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  function close(focusTrigger = false): void {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }

  function openPopover(): void {
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function select(index: number): void {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    close(true);
  }

  const selected = options[selectedIndex];

  return (
    <div className={styles.selectControl} ref={rootRef}>
      <span id={`${id}-label`} className={styles.label}>{label}</span>
      <div className={styles.selectPicker}>
        <button
          ref={triggerRef}
          id={id}
          className={styles.selectTrigger}
          type="button"
          role="combobox"
          aria-labelledby={`${id}-label ${id}-value`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-activedescendant={open ? `${id}-option-${options[activeIndex]?.value}` : undefined}
          onClick={() => (open ? close() : openPopover())}
          onKeyDown={(event) => {
            if (!open) {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                openPopover();
              }
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              close();
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) =>
                (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length,
              );
            } else if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault();
              setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
            } else if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              select(activeIndex);
            } else if (event.key === 'Tab') {
              setOpen(false);
            }
          }}
        >
          <span id={`${id}-value`}>{selected?.label}</span>
          <span className={styles.selectChevron} aria-hidden="true" />
        </button>
        {open && (
          <ul
            id={`${id}-options`}
            className={styles.selectPopover}
            role="listbox"
            aria-labelledby={`${id}-label`}
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-option-${option.value}`}
                className={styles.selectOption}
                role="option"
                aria-selected={option.value === value}
                data-active={index === activeIndex}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => select(index)}
              >
                <span>{option.label}</span>
                {option.value === value && <span aria-hidden="true">✓</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
