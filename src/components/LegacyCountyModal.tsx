import React, { useState } from 'react';
import { getSubJurisdictions } from '../engine/stateTaxRegistry';
import { MapPin, AlertCircle, ShieldCheck } from 'lucide-react';

interface LegacyCountyModalProps {
  isOpen: boolean;
  needsTargetCounty?: boolean;
  onConfirm: (currentCounty: string, targetCounty?: string) => void;
}

export const LegacyCountyModal: React.FC<LegacyCountyModalProps> = ({
  isOpen,
  needsTargetCounty = false,
  onConfirm,
}) => {
  const mdCounties = getSubJurisdictions('MD');
  const [currentCounty, setCurrentCounty] = useState<string>('montgomery');
  const [targetCounty, setTargetCounty] = useState<string>('montgomery');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCounty) return;
    onConfirm(currentCounty, needsTargetCounty ? targetCounty : undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/70 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Action Required: Select Maryland County
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Accurate state &amp; local tax calculations require your local jurisdiction
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-300/90 flex gap-3 leading-relaxed">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p>
              Your plan specifies <strong>Maryland</strong> as your tax residence, but does not have a county assigned.
              In Maryland, total state tax includes both state graduated brackets (up to 5.75%) and county piggyback local tax (2.25% &ndash; 3.20%).
              Please choose your county below to ensure precise tax projections.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Primary Residence County *
              </label>
              <select
                value={currentCounty}
                onChange={(e) => setCurrentCounty(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none"
                required
              >
                {mdCounties.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} &mdash; {(c.defaultLocalRate * 100).toFixed(2)}% local tax
                  </option>
                ))}
              </select>
            </div>

            {needsTargetCounty && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                <label className="text-xs font-bold text-slate-300 block">
                  Target Relocation County (Maryland) *
                </label>
                <select
                  value={targetCounty}
                  onChange={(e) => setTargetCounty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none"
                  required
                >
                  {mdCounties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} &mdash; {(c.defaultLocalRate * 100).toFixed(2)}% local tax
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Save &amp; Continue</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
