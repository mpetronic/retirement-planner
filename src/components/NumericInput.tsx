import React, { useState, useEffect, useRef } from 'react';

export interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  allowDecimals?: boolean;
  decimalPlaces?: number;
  className?: string;
  wrapperClassName?: string;
  placeholder?: string;
}

const formatValue = (val: number | null | undefined, allowDec: boolean, maxDecimals: number = 2): string => {
  if (val === null || val === undefined || isNaN(val)) return '';
  if (!allowDec) {
    return String(Math.round(val));
  }
  // Round to maxDecimals places without floating point precision issues (e.g. 2.5000000000000004 -> 2.5)
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round((val + Number.EPSILON) * factor) / factor;
  return String(rounded);
};

/**
 * Standardized NumericInput component that:
 * 1. Automatically highlights text on focus so typing immediately replaces the existing number.
 * 2. Allows clearing the field without forcing a rigid '0' character.
 * 3. Gracefully formats number strings to at most specified decimal places (default 2) without floating point artifacts.
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  prefix,
  suffix,
  min,
  max,
  allowDecimals = false,
  decimalPlaces = 2,
  className = '',
  wrapperClassName = '',
  placeholder,
  disabled,
  ...rest
}) => {
  // Local string state to allow fluent typing (e.g. typing decimals or negative sign, or empty string)
  const [localStr, setLocalStr] = useState<string>(() => {
    return formatValue(value, allowDecimals, decimalPlaces);
  });
  const isFocusedRef = useRef(false);

  // Sync external value changes when not actively focused
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalStr(formatValue(value, allowDecimals, decimalPlaces));
    }
  }, [value, allowDecimals, decimalPlaces]);

  const commitValue = () => {
    const trimmed = localStr.trim();
    if (trimmed === '' || isNaN(Number(trimmed))) {
      if (value !== null && value !== undefined) {
        onChange(null);
      }
      setLocalStr('');
    } else {
      let num = Number(trimmed);
      if (allowDecimals) {
        const factor = Math.pow(10, decimalPlaces);
        num = Math.round((num + Number.EPSILON) * factor) / factor;
      } else {
        num = Math.round(num);
      }
      if (min !== undefined && num < min) num = min;
      if (max !== undefined && num > max) num = max;
      if (num !== value) {
        onChange(num);
      }
      setLocalStr(formatValue(num, allowDecimals, decimalPlaces));
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    // Auto-select text on focus so typing immediately replaces the value
    e.currentTarget.select();
    if (rest.onFocus) rest.onFocus(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false;
    commitValue();
    if (rest.onBlur) rest.onBlur(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalStr(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      isFocusedRef.current = false;
      setLocalStr(formatValue(value, allowDecimals, decimalPlaces));
      e.currentTarget.blur();
    }
    if (rest.onKeyDown) rest.onKeyDown(e);
  };

  const hasPrefix = Boolean(prefix);
  const hasSuffix = Boolean(suffix);

  return (
    <div className={`relative flex items-center ${wrapperClassName}`}>
      {hasPrefix && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-semibold select-none pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        value={localStr}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full h-8 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono transition-all focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed ${
          hasPrefix ? 'pl-6' : 'pl-2.5'
        } ${hasSuffix ? 'pr-8' : 'pr-2.5'} ${className}`}
        {...rest}
      />
      {hasSuffix && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-semibold select-none pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
};
