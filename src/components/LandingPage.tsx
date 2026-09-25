import React from 'react';
import {
  TrendingUp,
  Sparkles,
  Lock,
  Cloud,
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
    <div className="min-h-screen w-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden relative selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Background Ambient Glow Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-emerald-500/15 via-teal-500/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-[500px] h-[500px] bg-cyan-500/10 blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-[600px] h-[400px] bg-emerald-500/10 blur-3xl pointer-events-none -z-10" />

      {/* Top Navigation Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between z-10 border-b border-slate-800/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-100 flex items-center gap-1.5">
              <span>Retirement</span>
              <span className="text-emerald-400 font-extrabold">Planner</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono font-medium">
              {versionInfo.displayVersion}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExploreDemo}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-900 border border-slate-800 rounded-xl transition-all cursor-pointer hidden sm:inline-flex items-center gap-2"
          >
            <span>Explore Demo</span>
          </button>
          <button
            type="button"
            onClick={onSignIn}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 hover:from-emerald-300 hover:to-teal-300 rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
          >
            <Fingerprint className="w-4 h-4 text-slate-950" />
            <span>Sign In</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 lg:py-16 flex flex-col justify-center items-center text-center z-10 space-y-10">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold shadow-inner">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Cloud-Enabled Household Retirement Intelligence</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-100 tracking-tight leading-[1.1]">
            Intelligent Retirement &amp; <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Multi-Decade Tax Planning
            </span>
          </h2>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Model Roth conversions, Social Security claiming strategies, Monte Carlo sequence of returns, 
            and Medicare healthcare expenses with real-time multi-device cloud synchronization.
          </p>
        </div>

        {/* Primary Call-to-Action Card */}
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl space-y-4 text-left">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Cloud className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Household Access</h3>
                <p className="text-[11px] text-slate-400">Authenticate with Cognito or Passkeys</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <Fingerprint className="w-3 h-3" />
              Passkey Ready
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={onSignIn}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98]"
            >
              <Fingerprint className="w-4 h-4 text-slate-950" />
              <span>Sign In to Household Plan</span>
              <ArrowRight className="w-4 h-4 text-slate-950 ml-1" />
            </button>

            <button
              type="button"
              onClick={onExploreDemo}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-slate-100 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Explore Demo / Offline Scratchpad</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>

          <p className="text-[11px] text-slate-500 text-center pt-1 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-500" />
            <span>End-to-end encrypted storage in AWS DynamoDB</span>
          </p>
        </div>

        {/* Feature Grid */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 text-left">
          {/* Card 1 */}
          <div className="bg-slate-900/60 border border-slate-800/80 hover:border-emerald-500/40 rounded-2xl p-5 backdrop-blur-md transition-all space-y-3 group">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-100">Tax Bracket &amp; Roth Planning</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Fill lower marginal tax brackets and avoid Medicare IRMAA cliffs with precision conversion scheduling.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/40 rounded-2xl p-5 backdrop-blur-md transition-all space-y-3 group">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-100">1,000-Trial Monte Carlo</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Stress-test your portfolio against historical return sequences, regime shifts, and multi-decade inflation.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-900/60 border border-slate-800/80 hover:border-teal-500/40 rounded-2xl p-5 backdrop-blur-md transition-all space-y-3 group">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-100">Shared Household Sync</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Both spouses log in with individual passkeys to view, edit, and keep the exact same plan synchronized.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 z-10">
        <div className="flex items-center gap-2">
          <span>&copy; {new Date().getFullYear()} Retirement Planner</span>
          <span>&bull;</span>
          <span className="text-emerald-400/80 font-mono">v{versionInfo.appVersion}</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400 text-xs">
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
