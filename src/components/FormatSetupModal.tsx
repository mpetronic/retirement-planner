import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sliders,
  Check,
  Eye,
  Info,
} from 'lucide-react';
import {
  StatementColumnMapping,
  StatementFormatProfile,
} from '../shared/types/expenses';
import {
  calculateHeaderFingerprint,
  normalizeMerchant,
} from '../shared/utils/merchantMatcher';

export interface FormatSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  sampleRows: string[][];
  initialMapping: StatementColumnMapping;
  initialNickname?: string;
  fingerprint?: string;
  onSaveProfile: (profile: StatementFormatProfile) => void;
}

export const FormatSetupModal: React.FC<FormatSetupModalProps> = ({
  isOpen,
  onClose,
  headers,
  sampleRows,
  initialMapping,
  initialNickname = '',
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

    const profile: StatementFormatProfile = {
      id: `prof_${Date.now()}`,
      nickname: trimmedNick,
      fingerprint: activeFingerprint,
      mapping,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
