import React from 'react';
import { Layers, Compass, ArrowRight, Smartphone } from 'lucide-react';
import { getVersionInfo } from '../utils/version';

interface NotFoundPageProps {
  onNavigateHome?: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigateHome }) => {
  const versionInfo = getVersionInfo();
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

  const handleGoHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/planner';
    }
  };

  const handleGoExpenser = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/expenser';
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-hidden relative selection:bg-emerald-500/30 selection:text-emerald-200 p-4 sm:p-6">
      {/* Background Ambient Glow Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gradient-to-b from-amber-500/10 via-emerald-500/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-cyan-500/10 blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-[500px] h-[300px] bg-emerald-500/10 blur-3xl pointer-events-none -z-10" />

      {/* Top Header */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between z-10 shrink-0 pb-3 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/10">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-100 flex items-center gap-1.5 leading-none">
              <span>Retirement</span>
              <span className="text-emerald-400 font-extrabold">Planner</span>
            </h1>
          </div>
        </div>
      </header>

      {/* Main 404 Card */}
      <main className="flex-1 max-w-lg mx-auto w-full flex flex-col justify-center items-center text-center z-10 py-6 my-auto space-y-6">
        <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-7 sm:p-8 shadow-2xl backdrop-blur-xl space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Compass className="w-7 h-7 animate-spin-slow" />
          </div>

          <div className="space-y-2">
            <div className="inline-block px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs">
              404 NOT FOUND
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
              Page Not Found
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
              The requested address <span className="font-mono text-amber-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">{currentPath || '/'}</span> does not exist or has moved.
            </p>
          </div>

          {/* Action Recovery Buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleGoHome}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98]"
            >
              <span>Go to Retirement Planner</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>

            <button
              type="button"
              onClick={handleGoExpenser}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Open Expenser PWA</span>
            </button>
          </div>
        </div>
      </main>

      {/* Compact Footer */}
      <footer className="w-full max-w-6xl mx-auto pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <span>&copy; {new Date().getFullYear()} Retirement Planner</span>
          <span>&bull;</span>
          <span className="text-emerald-400/80 font-mono">{versionInfo.displayVersion}</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
          <span>Encrypted Cloud Sync</span>
          <span>&bull;</span>
          <span>WebAuthn FIDO2</span>
          <span>&bull;</span>
          <span>Private &amp; Secure</span>
        </div>
      </footer>
    </div>
  );
};
