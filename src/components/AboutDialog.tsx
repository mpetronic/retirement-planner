import React, { useState } from 'react';
import {
  Flame,
  X,
  GitBranch,
  GitCommit,
  Tag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Cpu,
  Layers,
  ShieldCheck,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { getVersionInfo } from '../utils/version';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const versionInfo = getVersionInfo();

  if (!isOpen) return null;

  const handleCopyDiagnostics = async () => {
    const diagnosticData = [
      `Application: Retirement Planner 2.0`,
      `Display Version: ${versionInfo.displayVersion}`,
      `Git Tag: ${versionInfo.tag || 'None'}`,
      `Commit (Short): ${versionInfo.commitShort}`,
      `Commit (Full): ${versionInfo.commitFull}`,
      `Commit Date: ${versionInfo.commitDate}`,
      `Branch: ${versionInfo.branch}`,
      `Working Tree: ${versionInfo.isDirty ? 'Dirty (Uncommitted Changes)' : 'Clean'}`,
      `Build Timestamp: ${versionInfo.buildTimestamp} (${versionInfo.buildIsoTime})`,
      `Engine: 35-Year Stochastic & Deterministic Lookback Simulator`,
      `Timestamp: ${new Date().toISOString()}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(diagnosticData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy version diagnostics:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden glass-panel backdrop-blur-xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 sticky top-0 z-10">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-emerald-400">
              <Flame className="w-6 h-6 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black text-slate-100 tracking-tight">
                  Retirement Planner
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  {versionInfo.displayVersion}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Interactive 35-Year Tax, IRMAA & Wealth Simulator
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/30 rounded-xl transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 text-xs">
          {/* Main SCM Card */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                Build & SCM Version Details
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border ${
                  versionInfo.isDirty
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {versionInfo.isDirty ? (
                  <>
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Uncommitted Changes (-d{versionInfo.buildTimestamp})
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Clean Working Tree
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
              {/* Row 1: SCM Version String */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  SCM Display Version
                </span>
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="font-mono font-bold text-slate-200 text-xs">
                    {versionInfo.displayVersion}
                  </span>
                  {versionInfo.tag && (
                    <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30 font-medium">
                      Release Tag
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: Active Branch */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Git Branch
                </span>
                <div className="flex items-center gap-2">
                  <GitBranch className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span className="font-mono font-semibold text-slate-200 text-xs">
                    {versionInfo.branch}
                  </span>
                </div>
              </div>

              {/* Row 3: Git Commit Hash */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Latest Commit
                </span>
                <div className="flex items-center gap-2">
                  <GitCommit className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span
                    className="font-mono font-bold text-emerald-400 text-xs cursor-pointer hover:underline"
                    title={versionInfo.commitFull}
                  >
                    {versionInfo.commitShort}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">
                    {versionInfo.commitFull.slice(0, 16)}...
                  </span>
                </div>
              </div>

              {/* Row 4: Commit Date */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Commit Date
                </span>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="font-mono text-slate-300 text-xs truncate">
                    {versionInfo.commitDate || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Row 5: Build / Generated Timestamp */}
              <div className="space-y-1 md:col-span-2 pt-2 border-t border-slate-800/60">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Build Timestamp (Local / UTC)
                </span>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <span className="font-mono text-slate-300 text-xs">
                    {versionInfo.buildTimestamp} &bull; {versionInfo.buildIsoTime}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Engine & Specifications Section */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              Engine Architecture & Simulation Model
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-bold text-xs">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>35-Year Timeline</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  High-fidelity annual engine modeling age 65 to 100 with dynamic longevity ages.
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-bold text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>IRMAA & Tax Rules</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  2-year lookback MAGI tiering for Medicare Parts B & D; Federal and MD/FL state tax rates.
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-bold text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Monte Carlo Engine</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  1,000+ stochastic trials, sequence-of-returns risk analysis, and historical backtesting.
                </p>
              </div>
            </div>
          </div>

          {/* SCM Auto-Version Note */}
          <div className="p-3.5 bg-indigo-950/20 border border-indigo-900/30 rounded-2xl flex items-start gap-2.5 text-slate-300">
            <span className="text-base">💡</span>
            <div className="space-y-0.5">
              <span className="font-bold text-indigo-300 block text-[11px]">
                Continuous SCM Integration
              </span>
              <p className="text-[10px] text-slate-400 leading-normal">
                This version is automatically resolved during every development reload and production build.
                It follows standard SCM rules: Git Release Tag &rarr; Commit SHA &rarr; Suffix <code className="text-indigo-300">-dYYYYMMDDHHMMSS</code> for uncommitted modifications.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleCopyDiagnostics}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700/50 hover:border-slate-600 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-98"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Version Diagnostics</span>
              </>
            )}
          </button>

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
