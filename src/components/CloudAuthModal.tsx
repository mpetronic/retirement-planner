import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Lock,
  Mail,
  User,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Fingerprint,
  LogOut,
  Settings,
  X,
  ShieldCheck,
} from 'lucide-react';
import { AuthService, AuthSession } from '../shared/auth/AuthService';
import { getCloudConfig, saveCloudConfig, CloudConfig } from '../shared/auth/config';
import { getStorageAdapter, AwsCloudStorageAdapter } from '../shared/storage';

interface CloudAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export const CloudAuthModal: React.FC<CloudAuthModalProps> = ({ isOpen, onClose, onSyncComplete }) => {
  const [session, setSession] = useState<AuthSession | null>(() => AuthService.getSession());
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Cloud Config state for overrides
  const [configForm, setConfigForm] = useState<CloudConfig>(() => getCloudConfig());

  useEffect(() => {
    return AuthService.subscribe(s => {
      setSession(s);
      if (s) {
        setEmail(s.email);
      }
    });
  }, []);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const newSession = await AuthService.signIn(email, password);
      setSuccessMsg(`Welcome, ${newSession.email}!`);
      setPassword('');

      // Trigger initial cloud sync immediately upon login
      await handleSyncNow();
      setTimeout(() => {
        setSuccessMsg('');
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      if (!window.PublicKeyCredential) {
        throw new Error('Passkeys are not supported on this browser or device.');
      }
      // Informative helper for Passkey authentication
      setErrorMsg('Passkey sign-in requires an initial password sign-in to register this device.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Passkey sign-in failed';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    AuthService.signOut();
    setSuccessMsg('Signed out of household cloud.');
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setErrorMsg('');
    try {
      const adapter = getStorageAdapter();
      if (adapter instanceof AwsCloudStorageAdapter) {
        await adapter.getCategories();
        const currentYear = new Date().getFullYear();
        await adapter.getExpenses(currentYear);
        const { syncedCount } = await adapter.flushPendingExpenses();
        setSuccessMsg(syncedCount > 0 ? `Synced ${syncedCount} pending expenses to cloud!` : 'Cloud sync up to date.');
      }
      if (onSyncComplete) {
        onSyncComplete();
      }
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setErrorMsg(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveCloudConfig(configForm);
    setShowConfig(false);
    setSuccessMsg('Cloud settings saved.');
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Household Cloud Sync
              </h2>
              <p className="text-xs text-slate-400">AWS Cognito & DynamoDB</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowConfig(prev => !prev)}
              className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
              title="Cloud Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Alerts */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <div className="flex-1 font-medium">{successMsg}</div>
            </div>
          )}

          {/* Config Override Form */}
          {showConfig ? (
            <form onSubmit={handleSaveConfig} className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>AWS Endpoint Settings</span>
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">API Gateway Endpoint</label>
                <input
                  type="text"
                  value={configForm.apiEndpoint}
                  onChange={e => setConfigForm({ ...configForm, apiEndpoint: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Cognito Region</label>
                  <input
                    type="text"
                    value={configForm.region}
                    onChange={e => setConfigForm({ ...configForm, region: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">App Client ID</label>
                  <input
                    type="text"
                    value={configForm.clientId}
                    onChange={e => setConfigForm({ ...configForm, clientId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">User Pool ID</label>
                <input
                  type="text"
                  value={configForm.userPoolId}
                  onChange={e => setConfigForm({ ...configForm, userPoolId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
              >
                Save AWS Config
              </button>
            </form>
          ) : session ? (
            /* Authenticated View */
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Household Connection
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Active & Synced
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Account:</span>
                    <span className="font-mono text-white font-medium">{session.email}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Household ID:</span>
                    <span className="font-mono text-emerald-400 font-semibold">{session.householdId}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={handleSyncNow}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing Household Data...' : 'Sync Cloud Data Now'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full py-2 bg-slate-800/80 hover:bg-slate-700/80 text-rose-300 hover:text-rose-200 border border-slate-700/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            /* Sign In Form */
            <form onSubmit={handleSignIn} className="space-y-3.5">
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                Log into your AWS Cognito household account to sync real-time expenses and categories across your phone and desktop.
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-300">Email Address</label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <User className="w-4 h-4" />
                    <span>Sign In to Household</span>
                  </>
                )}
              </button>

              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold absolute">
                  or
                </span>
              </div>

              <button
                type="button"
                disabled={isLoading}
                onClick={handlePasskeySignIn}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Fingerprint className="w-4 h-4 text-emerald-400" />
                <span>Sign in with Passkey / Face ID</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span>End-to-End Encrypted Sync</span>
          <span className="font-mono">v2.0 Cloud</span>
        </div>
      </div>
    </div>
  );
};
