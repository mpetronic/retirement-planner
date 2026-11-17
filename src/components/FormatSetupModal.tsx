import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sliders,
  Check,
  Eye,
  EyeOff,
  Info,
  Pencil,
  Plus,
} from 'lucide-react';
import {
  StatementColumnMapping,
  StatementFormatProfile,
} from '../shared/types/expenses';
import {
  calculateHeaderFingerprint,
  normalizeMerchant,
} from '../shared/utils/merchantMatcher';
import {
  compileIgnorePatterns,
  isIgnoredByPatterns,
  replaceIgnorePattern,
  validateIgnorePattern,
} from '../shared/utils/ignoreRules';

/** How many distinct matching descriptions the ignore-rule preview lists. */
const IGNORE_PREVIEW_SAMPLE_COUNT = 5;

export interface FormatSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  /** True when `headers` only lists the mapped columns because no statement is loaded. */
  headersIncomplete?: boolean;
  sampleRows: string[][];
  /** Every data row of the statement, used to preview ignore patterns; defaults to the sample rows. */
  allRows?: string[][];
  initialMapping: StatementColumnMapping;
  initialNickname?: string;
  /** The saved profile being edited, if any; keeps its id, created date and ignore patterns. */
  existingProfile?: StatementFormatProfile | null;
  fingerprint?: string;
  onSaveProfile: (profile: StatementFormatProfile) => void;
}

export const FormatSetupModal: React.FC<FormatSetupModalProps> = ({
  isOpen,
  onClose,
  headers,
  headersIncomplete = false,
  sampleRows,
  allRows,
  initialMapping,
  initialNickname = '',
  existingProfile = null,
  fingerprint,
  onSaveProfile,
}) => {
  const [nickname, setNickname] = useState<string>(initialNickname || 'Statement Profile 1');
  const [dateCol, setDateCol] = useState<string>(initialMapping.dateColumn || headers[0] || '');
  const [descCol, setDescCol] = useState<string>(initialMapping.descriptionColumn || headers[1] || '');
  const [amountMode, setAmountMode] = useState<'single' | 'split_debit_credit'>(initialMapping.amountMode || 'single');
  const [amountCol, setAmountCol] = useState<string>(initialMapping.amountColumn || headers[headers.length - 1] || '');
  const [debitCol, setDebitCol] = useState<string>(initialMapping.debitColumn || '');
  const [creditCol, setCreditCol] = useState<string>(initialMapping.creditColumn || '');
  const [chargesAreNegative, setChargesAreNegative] = useState<boolean>(initialMapping.chargesAreNegative ?? false);
  const [categoryCol, setCategoryCol] = useState<string>(initialMapping.categoryColumn || '');
  const [typeCol, setTypeCol] = useState<string>(initialMapping.typeColumn || '');
  const [notesCol, setNotesCol] = useState<string>(initialMapping.notesColumn || '');
  const [ignorePatterns, setIgnorePatterns] = useState<string[]>(existingProfile?.ignorePatterns ?? []);
  const [patternInput, setPatternInput] = useState<string>('');
  const [patternError, setPatternError] = useState<string | null>(null);
  // The saved pattern currently open for editing (by position), its text, and any error
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [editingError, setEditingError] = useState<string | null>(null);

  // Saved patterns with the open edit applied when it is valid, for the preview and for saving
  const patternsWithEdit = useMemo(() => {
    if (editingIndex === null) return ignorePatterns;
    const result = replaceIgnorePattern(ignorePatterns, editingIndex, editingValue);
    return 'error' in result ? ignorePatterns : result.patterns;
  }, [ignorePatterns, editingIndex, editingValue]);

  // Preview which statement rows the saved patterns, plus the one being typed, would ignore
  const ignorePreview = useMemo(() => {
    const rows = allRows ?? sampleRows;
    const descIdx = headers.indexOf(descCol);
    const pending = patternInput.trim();
    const candidates = pending && validateIgnorePattern(pending) === null
      ? [...patternsWithEdit, pending]
      : patternsWithEdit;
    const regexes = compileIgnorePatterns(candidates);
    if (regexes.length === 0 || descIdx === -1) return null;
    if (rows.length === 0) return { noRows: true as const };

    const matched = new Set<string>();
    let matchCount = 0;
    for (const row of rows) {
      const desc = row[descIdx] || '';
      if (isIgnoredByPatterns(desc, regexes)) {
        matchCount++;
        if (matched.size < IGNORE_PREVIEW_SAMPLE_COUNT) matched.add(desc.trim());
      }
    }
    return { noRows: false as const, matchCount, total: rows.length, samples: Array.from(matched) };
  }, [allRows, sampleRows, headers, descCol, patternsWithEdit, patternInput]);

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
    setEditingError(null);
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(ignorePatterns[index]);
    setEditingError(null);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const result = replaceIgnorePattern(ignorePatterns, editingIndex, editingValue);
    if ('error' in result) {
      setEditingError(result.error);
      return;
    }
    setIgnorePatterns(result.patterns);
    cancelEdit();
  };

  const removePattern = (index: number) => {
    setIgnorePatterns(prev => prev.filter((_, i) => i !== index));
    // Keep the open edit attached to the same pattern, or close it if that pattern was removed
    if (editingIndex === null) return;
    if (editingIndex === index) cancelEdit();
    else if (index < editingIndex) setEditingIndex(editingIndex - 1);
  };

  const handleAddPattern = () => {
    const trimmed = patternInput.trim();
    const error = validateIgnorePattern(trimmed);
    if (error) {
      setPatternError(error);
      return;
    }
    if (!ignorePatterns.includes(trimmed)) {
      setIgnorePatterns(prev => [...prev, trimmed]);
    }
    setPatternInput('');
    setPatternError(null);
  };

  // Calculate live preview rows based on current form selections
  const previewData = useMemo(() => {
    const rowsToPreview = sampleRows.slice(0, 3);
    const dateIdx = headers.indexOf(dateCol);
    const descIdx = headers.indexOf(descCol);
    const amtIdx = headers.indexOf(amountCol);
    const debitIdx = headers.indexOf(debitCol);
    const creditIdx = headers.indexOf(creditCol);
    const catIdx = categoryCol ? headers.indexOf(categoryCol) : -1;
    const typeIdx = typeCol ? headers.indexOf(typeCol) : -1;

    return rowsToPreview.map((row, idx) => {
      const rawDate = dateIdx !== -1 ? (row[dateIdx] || '') : '';
      const rawDesc = descIdx !== -1 ? (row[descIdx] || '') : '';
      const rawCat = catIdx !== -1 ? (row[catIdx] || '') : '';
      const rawType = typeIdx !== -1 ? (row[typeIdx] || '') : '';

      let netAmount = 0;
      if (amountMode === 'single' && amtIdx !== -1) {
        const rawAmt = parseFloat((row[amtIdx] || '0').replace(/[$,]/g, '').trim()) || 0;
        const isReturn = rawType.toLowerCase().includes('return') || rawType.toLowerCase().includes('reversal');

        if (chargesAreNegative) {
          // Capital One: sales are negative, returns are positive
          if (isReturn) {
            netAmount = -Math.abs(rawAmt);
          } else if (rawAmt < 0) {
            netAmount = Math.abs(rawAmt);
          } else {
            netAmount = -Math.abs(rawAmt);
          }
        } else {
          // Standard: charges are positive, credits are negative
          if (isReturn) {
            netAmount = -Math.abs(rawAmt);
          } else {
            netAmount = rawAmt;
          }
        }
      } else if (amountMode === 'split_debit_credit') {
        const debitVal = parseFloat((row[debitIdx] || '0').replace(/[$,]/g, '').trim()) || 0;
        const creditVal = parseFloat((row[creditIdx] || '0').replace(/[$,]/g, '').trim()) || 0;
        if (debitVal > 0) netAmount = debitVal;
        else if (creditVal > 0) netAmount = -creditVal;
      }

      return {
        id: `prev_${idx}`,
        date: rawDate,
        desc: rawDesc,
        cleanMerchant: normalizeMerchant(rawDesc),
        category: rawCat,
        type: rawType,
        amount: Math.round(netAmount * 100) / 100,
      };
    });
  }, [
    sampleRows,
    headers,
    dateCol,
    descCol,
    amountMode,
    amountCol,
    debitCol,
    creditCol,
    chargesAreNegative,
    categoryCol,
    typeCol,
  ]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedNick = nickname.trim() || 'Custom Statement';
    const activeFingerprint = fingerprint || calculateHeaderFingerprint(headers);

    const mapping: StatementColumnMapping = {
      dateColumn: dateCol,
      descriptionColumn: descCol,
      amountMode,
      amountColumn: amountMode === 'single' ? amountCol : undefined,
      debitColumn: amountMode === 'split_debit_credit' ? debitCol : undefined,
      creditColumn: amountMode === 'split_debit_credit' ? creditCol : undefined,
      chargesAreNegative: amountMode === 'single' ? chargesAreNegative : false,
      categoryColumn: categoryCol || undefined,
      typeColumn: typeCol || undefined,
      notesColumn: notesCol || undefined,
    };

    // A valid edit still open, or a pattern typed but not yet added, is kept so it is not silently lost
    const pending = patternInput.trim();
    const finalPatterns =
      pending && validateIgnorePattern(pending) === null && !patternsWithEdit.includes(pending)
        ? [...patternsWithEdit, pending]
        : patternsWithEdit;

    const now = new Date().toISOString();
    const profile: StatementFormatProfile = {
      id: existingProfile?.id ?? `prof_${Date.now()}`,
      nickname: trimmedNick,
      fingerprint: activeFingerprint,
      mapping,
      // Partial header lists (no statement loaded) must not overwrite the full list
      headers: headersIncomplete ? existingProfile?.headers : headers,
      ignorePatterns: finalPatterns.length > 0 ? finalPatterns : undefined,
      createdAt: existingProfile?.createdAt ?? now,
      updatedAt: now,
    };

    onSaveProfile(profile);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Statement Format Setup
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Confirm column mapping and assign a nickname to recognize this file format automatically.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm">
          {headersIncomplete && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                No statement is loaded, so only this format's current columns can be chosen. Import a
                statement in this format once to be able to switch to other columns.
              </span>
            </div>
          )}

          {/* Nickname */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Statement Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Capital One Venture, Chase Sapphire, Primary Checking"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-medium"
            />
          </div>

          {/* Core Columns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date Column */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Transaction Date Column
              </label>
              <select
                value={dateCol}
                onChange={(e) => setDateCol(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Description Column */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Description / Payee Column
              </label>
              <select
                value={descCol}
                onChange={(e) => setDescCol(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount Handling */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Amount Structure
              </span>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="amountMode"
                    checked={amountMode === 'single'}
                    onChange={() => setAmountMode('single')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Single Amount Column</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="amountMode"
                    checked={amountMode === 'split_debit_credit'}
                    onChange={() => setAmountMode('split_debit_credit')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Separate Debit & Credit</span>
                </label>
              </div>
            </div>

            {amountMode === 'single' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    Amount Column
                  </label>
                  <select
                    value={amountCol}
                    onChange={(e) => setAmountCol(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 text-xs"
                  >
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    Sign Convention
                  </label>
                  <div className="flex flex-col gap-1.5 pt-1">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="chargesNegative"
                        checked={chargesAreNegative}
                        onChange={() => setChargesAreNegative(true)}
                        className="text-indigo-600"
                      />
                      <span>Charges are negative (-), e.g. Capital One</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="chargesNegative"
                        checked={!chargesAreNegative}
                        onChange={() => setChargesAreNegative(false)}
                        className="text-indigo-600"
                      />
                      <span>Charges are positive (+), e.g. Chase / Amex</span>
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    Debit Column (Outflows / Charges)
                  </label>
                  <select
                    value={debitCol}
                    onChange={(e) => setDebitCol(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                  >
                    <option value="">-- Select Debit Column --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    Credit Column (Inflows / Returns)
                  </label>
                  <select
                    value={creditCol}
                    onChange={(e) => setCreditCol(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                  >
                    <option value="">-- Select Credit Column --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Optional Meta Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                Category Column (Optional)
              </label>
              <select
                value={categoryCol}
                onChange={(e) => setCategoryCol(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
              >
                <option value="">-- None / Not Present --</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                Type Column (Optional)
              </label>
              <select
                value={typeCol}
                onChange={(e) => setTypeCol(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
              >
                <option value="">-- None / Not Present --</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                Notes Column (Optional)
              </label>
              <select
                value={notesCol}
                onChange={(e) => setNotesCol(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
              >
                <option value="">-- None / Not Present --</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rows to Ignore */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              <EyeOff className="w-4 h-4 text-indigo-500" />
              <span>Rows to Ignore</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Rows whose description matches a pattern are excluded from import, like automatic payments.
              Patterns are regular expressions and ignore upper/lower case. Examples:{' '}
              <code className="font-mono">DIVIDEND|INTEREST</code>,{' '}
              <code className="font-mono">PAYMENT.*CAPITAL ONE</code>,{' '}
              <code className="font-mono">TRANSFER (TO|FROM).*SAVINGS</code>.
            </p>

            <div className="flex items-start gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={patternInput}
                  onChange={(e) => {
                    setPatternInput(e.target.value);
                    setPatternError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPattern();
                    }
                  }}
                  placeholder="Add a pattern, e.g. DIVIDEND|INTEREST"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {(patternError || (patternInput.trim() && validateIgnorePattern(patternInput))) && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    {patternError || validateIgnorePattern(patternInput)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleAddPattern}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {ignorePatterns.length > 0 && (
              <ul className="space-y-1.5">
                {ignorePatterns.map((pattern, index) => (
                  <li
                    key={index}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    {editingIndex === index ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={editingValue}
                            onChange={(e) => {
                              setEditingValue(e.target.value);
                              setEditingError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                saveEdit();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                e.stopPropagation();
                                cancelEdit();
                              }
                            }}
                            className="flex-1 px-2 py-1 rounded-lg border border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={saveEdit}
                            title="Save this pattern"
                            className="p-1 rounded text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            title="Cancel editing"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {(editingError || (editingValue.trim() && validateIgnorePattern(editingValue))) && (
                          <p className="text-xs text-rose-600 dark:text-rose-400">
                            {editingError || validateIgnorePattern(editingValue)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(index)}
                          title="Edit this pattern"
                          className="flex-1 text-left"
                        >
                          <code className="font-mono text-xs text-slate-800 dark:text-slate-200 break-all">{pattern}</code>
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(index)}
                          title="Edit this pattern"
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removePattern(index)}
                          title="Remove this pattern"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {ignorePreview?.noRows && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Load a statement in this format to preview which rows match.
              </p>
            )}
            {ignorePreview && !ignorePreview.noRows && (
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p className="font-semibold">
                  {ignorePreview.matchCount} of {ignorePreview.total} statement rows would be ignored.
                </p>
                {ignorePreview.samples.length > 0 && (
                  <ul className="font-mono text-slate-500 dark:text-slate-400 list-disc pl-4">
                    {ignorePreview.samples.map(sample => (
                      <li key={sample} className="truncate">{sample}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Live 2-Row Instant Preview */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Eye className="w-4 h-4 text-indigo-500" />
              <span>Live Sample Preview (First Rows)</span>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/40">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Date</th>
                    <th className="py-2 px-3 font-semibold">Clean Merchant</th>
                    <th className="py-2 px-3 font-semibold">Raw Description</th>
                    <th className="py-2 px-3 font-semibold text-right">Computed Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 font-mono">
                  {previewData.length > 0 ? (
                    previewData.map(p => (
                      <tr key={p.id} className="hover:bg-slate-100/40 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{p.date || '—'}</td>
                        <td className="py-2 px-3 text-indigo-600 dark:text-indigo-400 font-semibold">{p.cleanMerchant || '—'}</td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{p.desc || '—'}</td>
                        <td className={`py-2 px-3 text-right font-bold ${p.amount < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {p.amount < 0 ? `-$${Math.abs(p.amount).toFixed(2)}` : `+$${p.amount.toFixed(2)}`}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-3 px-3 text-center text-slate-400">
                        No rows available for preview
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Info className="w-4 h-4 text-slate-400" />
            <span>Profile will be remembered for all future statements with this header structure.</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              <span>Save & Continue</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
