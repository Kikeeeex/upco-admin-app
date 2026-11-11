'use client';

import { useEffect, useState } from 'react';

const formatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoneyInput(value: number): string {
  return formatter.format(Number.isFinite(value) ? value : 0);
}

export function parseMoneyInput(raw: string): number | null {
  const text = raw.trim();
  if (!text) return 0;
  // En este formulario el punto separa millares y la coma separa decimales.
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{0,2})?$/.test(text)) return null;
  const value = Number(text.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) && value >= 0 && value <= 9e12 ? value : null;
}

type Props = {
  value: number;
  onChange: (value: number) => void;
  onValidityChange?: (valid: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
};

export default function MoneyInput({ value, onChange, onValidityChange, disabled, 'aria-label': label }: Props) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState(() => formatMoneyInput(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!focused && !invalid) setRaw(formatMoneyInput(value));
  }, [focused, invalid, value]);

  return <>
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      aria-label={label}
      aria-invalid={invalid}
      value={focused || invalid ? raw : formatMoneyInput(value)}
      disabled={disabled}
      onFocus={event => { setFocused(true); if (!invalid) setRaw(formatMoneyInput(value)); event.target.select(); }}
      onChange={event => {
        const next = event.target.value;
        setRaw(next);
        const parsed = parseMoneyInput(next);
        const isValid = parsed !== null;
        setInvalid(!isValid);
        onValidityChange?.(isValid);
        if (isValid) onChange(parsed);
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parseMoneyInput(raw);
        const isValid = parsed !== null;
        setInvalid(!isValid);
        onValidityChange?.(isValid);
        if (isValid) { onChange(parsed); setRaw(formatMoneyInput(parsed)); }
      }}
    />
    {invalid && <small role="alert">Usa el formato 1.234,56.</small>}
  </>;
}
