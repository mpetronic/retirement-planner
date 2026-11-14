import React from 'react';
import { X } from 'lucide-react';
import { getVersionInfo } from '../../utils/version';
import { formatBuildTime } from '../../shared/utils/buildTime';
import { EXPENSER_ICON_PATH } from './expenserBranding';

interface ExpenserAboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExpenserAboutDialog: React.FC<ExpenserAboutDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const versionInfo = getVersionInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={EXPENSER_ICON_PATH}
              alt=""
              className="w-11 h-11 rounded-xl border border-slate-700/60 shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-lg font-black text-slate-100 tracking-tight">Expenser</h2>
              <p className="text-xs text-slate-400">Retirement Actuals Tracker &amp; Mobile Companion</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 ml-2 text-slate-400 hover:text-slate-100 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/30 rounded-xl transition-all cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Version details */}
        <dl className="px-5 py-4 divide-y divide-slate-800/70">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Version</dt>
            <dd className="font-mono text-sm font-bold text-emerald-300 text-right break-all">
              {versionInfo.displayVersion}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Built</dt>
            <dd className="text-sm text-slate-200 text-right">{formatBuildTime(versionInfo.buildIsoTime)}</dd>
          </div>
        </dl>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-950/60 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
