import React from 'react';
import {
  TrendingUp,
  Sparkles,
  Lock,
  Fingerprint,
  ArrowRight,
  BarChart3,
  ChevronRight,
  Layers,
  Users,
} from 'lucide-react';
import { getVersionInfo } from '../utils/version';

interface LandingPageProps {
  onSignIn: () => void;
  onExploreDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, onExploreDemo }) => {
  const versionInfo = getVersionInfo();

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-hidden relative selection:bg-emerald-500/30 selection:text-emerald-200 p-4 sm:p-6">
      {/* Background Ambient Glow Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gradient-to-b from-emerald-500/15 via-teal-500/5 to-transparent blur-3xl pointer-events-none -z-10" />
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

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] font-medium text-slate-400 flex items-center gap-1.5 shadow-sm">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Passkey Ready</span>
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full flex flex-col justify-center items-center text-center z-10 py-4 my-auto space-y-5 sm:space-y-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold shadow-inner">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Cloud-Enabled Household Retirement Intelligence</span>
          </div>

          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-100 tracking-tight leading-[1.15]">
            <span>Retirement &amp; </span>
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Tax Planning
            </span>
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Model Roth conversions, Social Security claiming strategies, Monte Carlo sequence of returns, 
            and Medicare healthcare expenses with real-time multi-device cloud synchronization.
          </p>
        </div>

        {/* Single Primary Action Group */}
        <div className="w-full max-w-sm space-y-2.5">
          <button
            type="button"
            onClick={onSignIn}
            className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98]"
          >
            <Fingerprint className="w-4 h-4 text-slate-950" />
            <span>Sign In to Household</span>
            <ArrowRight className="w-4 h-4 text-slate-950 ml-0.5" />
          </button>

          <button
            type="button"
            onClick={onExploreDemo}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Explore Demo Sandbox</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>

        {/* Compact 3-Feature Cards */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-left">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-md space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-bold text-slate-100">Tax &amp; Roth Planning</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Fill lower marginal tax brackets and avoid Medicare IRMAA cliffs.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-md space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                <BarChart3 className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-bold text-slate-100">1,000-Trial Monte Carlo</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Stress-test against historical sequences and multi-decade inflation.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-md space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-bold text-slate-100">Household Cloud Sync</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Both spouses log in to keep the exact same plan synchronized.
            </p>
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
