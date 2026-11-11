'use client';

import { useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './searchable-combobox.css';

export type SearchableOption = {
  value: string;
  label: string;
  detail?: string;
  searchText?: string;
};

type Props = {
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder: string;
  emptyText?: string;
  allowCustom?: boolean;
  disabled?: boolean;
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-VE').trim();
}

export default function SearchableCombobox({
  value, options, onChange, ariaLabel, placeholder,
  emptyText = 'No hay coincidencias', allowCustom = false, disabled = false,
}: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find(option => option.value === value);
  const text = query ?? (allowCustom ? value : selected?.label ?? '');
  const needle = query === null ? '' : normalize(query);
  const matches = needle
    ? options.filter(option => normalize(`${option.label} ${option.detail ?? ''} ${option.searchText ?? ''}`).includes(needle))
    : options;
  const visible = matches.slice(0, 60);

  function choose(option: SearchableOption) {
    onChange(option.value);
    setQuery(null);
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  return <div className="searchable-combobox">
    <div className="searchable-combobox-input-wrap">
      <input
        ref={inputRef}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open && !disabled}
        aria-controls={open && !disabled ? listId : undefined}
        aria-activedescendant={open && visible[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={event => {
          setOpen(true);
          setQuery(null);
          setActiveIndex(0);
          event.currentTarget.select();
        }}
        onChange={event => {
          const next = event.target.value;
          setQuery(next);
          setOpen(true);
          setActiveIndex(0);
          if (allowCustom) onChange(next);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            setQuery(null);
          }, 120);
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(index => event.key === 'ArrowDown'
              ? Math.min(index + (open ? 1 : 0), Math.max(visible.length - 1, 0))
              : Math.max(index - 1, 0));
          } else if (event.key === 'Enter' && open && visible[activeIndex]) {
            event.preventDefault();
            choose(visible[activeIndex]);
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false);
            setQuery(null);
          }
        }}
      />
      <ChevronDown aria-hidden="true" />
    </div>
    {open && !disabled && <div className="searchable-combobox-list" role="listbox" id={listId} aria-label={ariaLabel}>
      {visible.length ? visible.map((option, index) => <div
        key={option.value}
        role="option"
        id={`${listId}-${index}`}
        aria-selected={option.value === value}
        className={`searchable-combobox-option ${index === activeIndex ? 'active' : ''}`}
        onMouseDown={event => event.preventDefault()}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(option)}
      >
        <span>{option.label}</span>
        {option.detail && <small>{option.detail}</small>}
      </div>) : <div className="searchable-combobox-empty">{emptyText}</div>}
      {matches.length > visible.length && <div className="searchable-combobox-hint">Escribe para buscar entre {matches.length} opciones.</div>}
    </div>}
  </div>;
}
