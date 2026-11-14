import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Check, ChevronDown, FileText, Plus, Search, Split, Trash2, X } from 'lucide-react';
import type { PlannerExpenseLineItem } from '../shared/utils/plannerCategories';
import {
  allocatedCents,
  emptyBlock,
  blockCents,
  fromCents,
  hasInvalidAmount,
  parseAmountExpression,
  remainingCents,
  withRemainderApplied,
  type SplitBlockDraft,
} from '../utils/expenseSplit';

export interface SplitReceiptInitial {
  date: string;
  merchant: string;
  blocks: SplitBlockDraft[];
  /** Receipt total fixed up front (new receipt or split of an existing expense). Null follows the category sums. */
  totalText: string | null;
}

export interface SplitReceiptResult {
  date: string;
  merchant: string;
  totalCents: number;
  blocks: Array<{ key: string; catalogId: string; expenseId?: string; cents: number }>;
}

interface SplitReceiptDialogProps {
  mode: 'new' | 'edit';
  catalogItems: PlannerExpenseLineItem[];
  initial: SplitReceiptInitial;
  isSaving: boolean;
  error: string | null;
  onSave: (result: SplitReceiptResult) => void;
  onCancel: () => void;
  onDeleteGroup?: () => void;
}

const formatMoney = (cents: number) => `$${fromCents(cents).toFixed(2)}`;

export const SplitReceiptDialog: React.FC<SplitReceiptDialogProps> = ({
  mode,
  catalogItems,
  initial,
  isSaving,
  error,
  onSave,
  onCancel,
  onDeleteGroup,
}) => {
  const [date, setDate] = useState(initial.date);
  const [merchant, setMerchant] = useState(initial.merchant);
  const [blocks, setBlocks] = useState<SplitBlockDraft[]>(initial.blocks);
  const [totalText, setTotalText] = useState<string | null>(initial.totalText);
  const [pickerBlockKey, setPickerBlockKey] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [focusTarget, setFocusTarget] = useState<{ key: string; index: number } | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const allocated = allocatedCents(blocks);
  const totalFollowsSum = totalText === null;
  const totalParsed = totalFollowsSum ? allocated : parseAmountExpression(totalText);
  const totalCents = totalParsed ?? 0;
  const remaining = remainingCents(totalCents, blocks);
  const anyInvalid = totalParsed === null || blocks.some(b => hasInvalidAmount(b.amounts));
  const everyBlockValid = blocks.length > 0 && blocks.every(b => b.catalogId && blockCents(b.amounts) > 0);
  const canSave = !anyInvalid && everyBlockValid && totalCents > 0 && remaining === 0 && Boolean(date) && !isSaving;

  useEffect(() => {
    if (!focusTarget) return;
    inputRefs.current.get(`${focusTarget.key}:${focusTarget.index}`)?.focus();
    setFocusTarget(null);
  }, [focusTarget, blocks]);

  const catalogById = useMemo(() => new Map(catalogItems.map(item => [item.id, item])), [catalogItems]);

  const filteredItems = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase();
    if (!query) return catalogItems;
    return catalogItems.filter(item => `${item.groupCategory} ${item.name} ${item.displayName}`.toLowerCase().includes(query));
  }, [catalogItems, pickerQuery]);

  const updateBlock = (key: string, update: (block: SplitBlockDraft) => SplitBlockDraft) =>
    setBlocks(prev => prev.map(block => (block.key === key ? update(block) : block)));

  const setAmount = (key: string, index: number, value: string) =>
    updateBlock(key, block => ({ ...block, amounts: block.amounts.map((a, i) => (i === index ? value : a)) }));

  const addAmount = (key: string) => {
    const block = blocks.find(b => b.key === key);
    if (!block) return;
    updateBlock(key, b => ({ ...b, amounts: [...b.amounts, ''] }));
    setFocusTarget({ key, index: block.amounts.length });
  };

  const removeAmount = (key: string, index: number) =>
    updateBlock(key, block => {
      const next = block.amounts.filter((_, i) => i !== index);
      return { ...block, amounts: next.length > 0 ? next : [''] };
    });

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      date,
      merchant: merchant.trim(),
      totalCents,
      blocks: blocks.map(b => ({ key: b.key, catalogId: b.catalogId, expenseId: b.expenseId, cents: blockCents(b.amounts) })),
    });
  };

  const inputClass =
    'bg-slate-950 border border-slate-800 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 rounded-xl px-2.5 py-1.5 transition-all';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full max-h-[94vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-4 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Split className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{mode === 'edit' ? 'Edit Split Receipt' : 'Split Receipt'}</h2>
              <p className="text-[10px] text-slate-400">One charge, several categories</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Receipt total ($)</label>
              <div className={`flex items-center ${inputClass}`}>
                <span className="text-emerald-400 font-bold mr-1">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={totalFollowsSum ? fromCents(allocated).toFixed(2) : totalText}
                  onChange={e => setTotalText(e.target.value)}
                  placeholder="0.00"
                  aria-label="Receipt total"
                  className="w-full bg-transparent text-base font-bold text-white focus:outline-none"
                  autoFocus={mode === 'new'}
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Date</label>
              <div className={`flex items-center ${inputClass}`}>
                <Calendar className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-transparent text-xs text-white focus:outline-none [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">Merchant / note (shared)</label>
            <div className={`flex items-center ${inputClass}`}>
              <FileText className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
              <input
                type="text"
                value={merchant}
                onChange={e => setMerchant(e.target.value)}
                placeholder="e.g. Costco"
                maxLength={200}
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {blocks.map((block, blockIndex) => {
            const item = catalogById.get(block.catalogId);
            const subtotal = blockCents(block.amounts);
            const pickerOpen = pickerBlockKey === block.key;
            return (
              <div key={block.key} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPickerBlockKey(pickerOpen ? null : block.key);
                      setPickerQuery('');
                    }}
                    className="flex-1 min-w-0 flex items-center justify-between rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 px-2.5 py-1.5 text-left cursor-pointer"
                  >
                    <span className="flex items-center space-x-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item?.color || '#64748b' }} />
                      <span className={`text-xs truncate ${item ? 'font-semibold text-white' : 'text-slate-400'}`}>
                        {item ? `${item.groupCategory} - ${item.name}` : 'Choose category...'}
                      </span>
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>
                  <span className="text-xs font-bold text-emerald-300 shrink-0 w-20 text-right" aria-label={`Category ${blockIndex + 1} subtotal`}>
                    {formatMoney(subtotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBlocks(prev => prev.filter(b => b.key !== block.key))}
                    disabled={blocks.length <= 1}
                    className="p-1.5 text-slate-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                    title="Remove category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {pickerOpen && (
                  <div className="space-y-1.5 p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                      <Search className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
                      <input
                        type="text"
                        value={pickerQuery}
                        onChange={e => setPickerQuery(e.target.value)}
                        placeholder="Search categories..."
                        className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto custom-scrollbar divide-y divide-slate-800/60">
                      {filteredItems.length === 0 ? (
                        <div className="py-2 text-center text-xs text-slate-500">No matching categories</div>
                      ) : (
                        filteredItems.map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              updateBlock(block.key, b => ({ ...b, catalogId: cat.id }));
                              setPickerBlockKey(null);
                            }}
                            className="w-full p-1.5 text-left flex items-center justify-between text-xs text-slate-300 hover:bg-slate-800 rounded cursor-pointer"
                          >
                            <span className="flex items-center space-x-2 truncate">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#3b82f6' }} />
                              <span className="truncate">{cat.displayName || cat.name}</span>
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider shrink-0 ml-1">{cat.groupCategory}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  {block.amounts.map((amount, index) => {
                    const invalid = parseAmountExpression(amount) === null;
                    return (
                      <div key={index} className="flex items-center gap-1.5">
                        <div className={`flex-1 flex items-center ${inputClass} ${invalid ? '!border-rose-500' : ''}`}>
                          <span className="text-slate-500 text-xs mr-1">$</span>
                          <input
                            ref={el => {
                              const refKey = `${block.key}:${index}`;
                              if (el) inputRefs.current.set(refKey, el);
                              else inputRefs.current.delete(refKey);
                            }}
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={e => setAmount(block.key, index, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addAmount(block.key);
                              }
                            }}
                            placeholder="item amount (e.g. 12.99)"
                            aria-label={`Category ${blockIndex + 1} item ${index + 1} amount`}
                            className="w-full bg-transparent text-xs text-white placeholder-slate-600 focus:outline-none"
                          />
                        </div>
                        {block.amounts.length > 1 && (
                          <button type="button" onClick={() => removeAmount(block.key, index)} className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer" title="Remove item">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => addAmount(block.key)} className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 cursor-pointer">
                    <Plus className="w-3 h-3" /> add item
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlocks(prev => withRemainderApplied(prev, block.key, totalCents))}
                    disabled={remaining <= 0}
                    className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 disabled:opacity-30 cursor-pointer"
                  >
                    Assign remainder
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setBlocks(prev => [...prev, emptyBlock()])}
            className="w-full py-2 rounded-xl border border-dashed border-slate-700 text-xs text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add category
          </button>
        </div>

        <div className="border-t border-slate-800 p-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Total <strong className="text-white">{formatMoney(totalCents)}</strong>
            </span>
            <span className="text-slate-400">
              Allocated <strong className="text-white">{formatMoney(allocated)}</strong>
            </span>
            <span className={remaining === 0 ? 'text-emerald-400' : remaining < 0 ? 'text-rose-400' : 'text-amber-300'}>
              {remaining < 0 ? 'Over' : 'Remaining'} <strong>{formatMoney(Math.abs(remaining))}</strong>
            </span>
          </div>
          <div className="flex gap-2">
            {mode === 'edit' && onDeleteGroup && (
              <button type="button" onClick={onDeleteGroup} disabled={isSaving} className="px-3 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-semibold cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button type="button" onClick={onCancel} disabled={isSaving} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{mode === 'edit' ? 'Save Changes' : 'Save Split'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
