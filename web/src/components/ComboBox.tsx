import { useEffect, useId, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';

export interface ComboBoxOption {
  id: number;
  label: string;
}

function filterOptions(
  options: readonly ComboBoxOption[],
  query: string,
): ComboBoxOption[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') return [...options];
  return options.filter((option) =>
    option.label.toLowerCase().includes(normalized),
  );
}

export function ComboBox({
  label,
  placeholder,
  options,
  value,
  onChange,
  emptyText = 'No matches.',
  disabled = false,
  className = '',
}: {
  label: string;
  placeholder?: string;
  options: readonly ComboBoxOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const listId = useId();
  const selected = options.find((option) => option.id === value);
  const [query, setQuery] = useState(selected?.label ?? '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = useMemo(
    () => filterOptions(options, query),
    [options, query],
  );

  useEffect(() => {
    if (!open) setQuery(selected?.label ?? '');
  }, [open, selected?.label]);

  const select = (option: ComboBoxOption) => {
    onChange(option.id);
    setQuery(option.label);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleInput = (text: string) => {
    const matches = filterOptions(options, text);
    setQuery(text);
    setOpen(true);
    setActiveIndex(matches.length > 0 ? 0 : -1);
    if (text === '' || (value !== null && text !== selected?.label)) {
      onChange(null);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      if (filtered.length > 0) {
        setActiveIndex((current) =>
          Math.min(current + 1, filtered.length - 1),
        );
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filtered.length > 0) {
        setActiveIndex((current) => Math.max(current - 1, 0));
      }
      return;
    }

    if (event.key === 'Enter') {
      if (open && activeIndex >= 0) {
        event.preventDefault();
        const option = filtered[activeIndex];
        if (option) select(option);
      }
      return;
    }

    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        setQuery(selected?.label ?? '');
        setActiveIndex(-1);
      }
      return;
    }

    if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        className="input"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 && filtered[activeIndex]
            ? `${listId}-option-${filtered[activeIndex]!.id}`
            : undefined
        }
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => handleInput(event.target.value)}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setActiveIndex(filtered.length > 0 ? 0 : -1);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      />

      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} options`}
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              {emptyText}
            </li>
          ) : (
            filtered.map((option, index) => (
              <li
                key={option.id}
                id={`${listId}-option-${option.id}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  index === activeIndex
                    ? 'bg-indigo-100 text-indigo-950 dark:bg-indigo-900 dark:text-indigo-50'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(option)}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
