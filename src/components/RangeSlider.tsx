import React, { useState, useEffect, useRef } from 'react';

export interface RangeSliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  className?: string;
  renderLabel?: (displayValue: number) => React.ReactNode;
}

/**
 * Standardized RangeSlider component that:
 * 1. Smoothly updates local thumb position and visual label during dragging without triggering global engine recalculations.
 * 2. Only commits the new value to the upstream state upon release (onPointerUp / onTouchEnd / onKeyUp / onBlur).
 * 3. Only triggers recalculation if the released value is actually different from the previous value.
 */
export const RangeSlider: React.FC<RangeSliderProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  className = 'w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500',
  renderLabel,
  ...rest
}) => {
  const [localVal, setLocalVal] = useState<number>(value);
  const isInteractingRef = useRef(false);
  const currentLocalValRef = useRef<number>(value);

  // Sync external value changes when not actively interacting
  useEffect(() => {
    if (!isInteractingRef.current) {
      setLocalVal(value);
      currentLocalValRef.current = value;
    }
  }, [value]);

  const commitValue = () => {
    isInteractingRef.current = false;
    const finalVal = currentLocalValRef.current;
    if (finalVal !== value) {
      onChange(finalVal);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    isInteractingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (rest.onPointerDown) rest.onPointerDown(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLInputElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    commitValue();
    if (rest.onPointerUp) rest.onPointerUp(e);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
    isInteractingRef.current = true;
    if (rest.onMouseDown) rest.onMouseDown(e);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    commitValue();
    if (rest.onMouseUp) rest.onMouseUp(e);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLInputElement>) => {
    isInteractingRef.current = true;
    if (rest.onTouchStart) rest.onTouchStart(e);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLInputElement>) => {
    commitValue();
    if (rest.onTouchEnd) rest.onTouchEnd(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setLocalVal(val);
    currentLocalValRef.current = val;
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      commitValue();
    }
    if (rest.onKeyUp) rest.onKeyUp(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    commitValue();
    if (rest.onBlur) rest.onBlur(e);
  };

  return (
    <>
      {renderLabel && renderLabel(localVal)}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localVal}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onChange={handleChange}
        onKeyUp={handleKeyUp}
        onBlur={handleBlur}
        className={className}
        {...rest}
      />
    </>
  );
};
