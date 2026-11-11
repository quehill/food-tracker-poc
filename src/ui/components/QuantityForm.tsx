import { useState, type FormEvent } from 'react';
import { scaleMacros } from '../../domain/macros';
import {
  gramsFromServings,
  isValidQuantity,
  parseDecimal,
  servingsFromGrams,
} from '../../domain/quantity';
import type { Macros } from '../../domain/types';
import { fmtServings, macroLine, toInputValue } from '../format';

interface QuantityFormProps {
  servingLabel?: string;
  macrosPerServing: Macros;
  servingGrams?: number;
  initialServings?: number;
  confirmLabel: string;
  onConfirm: (servings: number) => void;
  onCancel: () => void;
}

/** Servings input with an optional synced grams input and a live macro preview. */
export function QuantityForm({
  servingLabel,
  macrosPerServing,
  servingGrams,
  initialServings = 1,
  confirmLabel,
  onConfirm,
  onCancel,
}: QuantityFormProps) {
  const hasGrams = servingGrams !== undefined && servingGrams > 0;
  const [servingsText, setServingsText] = useState(toInputValue(initialServings));
  const [gramsText, setGramsText] = useState(
    hasGrams ? toInputValue(gramsFromServings(initialServings, servingGrams)) : '',
  );

  const servings = parseDecimal(servingsText);
  const valid = isValidQuantity(servings);

  const onServingsChange = (text: string) => {
    setServingsText(text);
    const s = parseDecimal(text);
    if (hasGrams)
      setGramsText(isValidQuantity(s) ? toInputValue(gramsFromServings(s, servingGrams)) : '');
  };

  const onGramsChange = (text: string) => {
    setGramsText(text);
    const g = parseDecimal(text);
    if (hasGrams && isValidQuantity(g))
      setServingsText(toInputValue(servingsFromGrams(g, servingGrams)));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    // Prefer the exact grams-derived value over the 2-decimal display text.
    const g = parseDecimal(gramsText);
    const exact =
      hasGrams &&
      isValidQuantity(g) &&
      toInputValue(servingsFromGrams(g, servingGrams)) === servingsText
        ? servingsFromGrams(g, servingGrams)
        : servings;
    onConfirm(exact);
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className={hasGrams ? 'field-grid' : undefined}>
        <label className="field">
          <span>Servings{servingLabel ? ` (${servingLabel})` : ''}</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            value={servingsText}
            onChange={(e) => onServingsChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-invalid={!valid}
          />
        </label>
        {hasGrams && (
          <label className="field">
            <span>Grams</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              value={gramsText}
              onChange={(e) => onGramsChange(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </label>
        )}
      </div>
      <p className="macro-line" aria-live="polite">
        {valid
          ? `${fmtServings(servings)} × serving = ${macroLine(scaleMacros(macrosPerServing, servings))}`
          : 'Enter a quantity greater than 0'}
      </p>
      <div className="button-row">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button primary" disabled={!valid}>
          {confirmLabel}
        </button>
      </div>
    </form>
  );
}
