import React, { useState, useEffect, useCallback } from 'react';
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
  Smartphone,
  Trash2,
  Key,
} from 'lucide-react';
import { AuthService, AuthSession, WebAuthnCredentialInfo } from '../shared/auth/AuthService';
import { getCloudConfig, saveCloudConfig, CloudConfig } from '../shared/auth/config';
import { getStorageAdapter, AwsCloudStorageAdapter, PlanSyncService } from '../shared/storage';

interface CloudAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export const CloudAuthModal: React.FC<CloudAuthModalProps> = ({ isOpen, onClose, onSyncComplete }) => {
  const [session, setSession] = useState<AuthSession | null>(() => AuthService.getSession());
  const [email, setEmail] = useState<string>(() => AuthService.getLastUsedEmail() || '');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState<boolean>(false);
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [passkeys, setPasskeys] = useState<WebAuthnCredentialInfo[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Cloud Config state for overrides
  const [configForm, setConfigForm] = useState<CloudConfig>(() => getCloudConfig());

  const fetchPasskeys = useCallback(async () => {
    if (!session) return;
    try {
      const keys = await AuthService.listPasskeys();
      setPasskeys(keys);
    } catch {
      // Ignored for UI fallback
    }
  }, [session]);

  useEffect(() => {
    const unsub = AuthService.subscribe(s => {
      setSession(s);
      if (s?.email) {
        setEmail(s.email);
      } else if (!email) {
        const last = AuthService.getLastUsedEmail();
        if (last) setEmail(last);
      }
    });
    return () => unsub();
  }, [email]);

  useEffect(() => {
    if (isOpen && session) {
      fetchPasskeys();
    }
  }, [isOpen, session, fetchPasskeys]);

  if (!isOpen) return null;

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setErrorMsg('');
    try {
      // 1. Sync Household Retirement Plan
      await PlanSyncService.syncPlanNow();

      // 2. Sync Expenses & Categories
      const adapter = getStorageAdapter();
      if (adapter instanceof AwsCloudStorageAdapter) {
        await adapter.getCategories();
        const currentYear = new Date().getFullYear();
        await adapter.getExpenses(currentYear);
        const { syncedCount } = await adapter.flushPendingExpenses();
        setSuccessMsg(syncedCount > 0 ? `Synced plan & ${syncedCount} pending expenses to cloud!` : 'Household plan & expenses up to date.');
      } else {
        setSuccessMsg('Household plan synced with cloud.');
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

      // Trigger initial cloud sync immediately upon login and close modal
      await handleSyncNow();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setIsPasskeyLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (!AuthService.supportsPasskeys()) {
        throw new Error('Passkeys / Biometrics are not supported on this browser or platform.');
      }
      const targetEmail = email.trim() || AuthService.getLastUsedEmail() || '';
      if (!targetEmail) {
        throw new Error('Please enter your account email address above to sign in with your passkey.');
      }

      const newSession = await AuthService.signInWithPasskey(targetEmail);
      setSuccessMsg(`Welcome, ${newSession.email}!`);

      // Trigger initial cloud sync and close modal
      await handleSyncNow();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setErrorMsg('Passkey prompt was cancelled or timed out.');
      } else {
        const msg = err instanceof Error ? err.message : 'Passkey sign-in failed';
        setErrorMsg(msg);
      }
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    setIsRegisteringPasskey(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const savedDeviceName = AuthService.getRegisteredDeviceName();
      const defaultDeviceName = savedDeviceName || (isMobile ? 'Mobile Phone' : 'Desktop / Laptop');
      const deviceName = window.prompt('Enter a nickname for this device (optional):', defaultDeviceName) || defaultDeviceName;

      const result = await AuthService.registerPasskey(deviceName);
      setSuccessMsg(result.message);
      await fetchPasskeys();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setErrorMsg('Passkey registration was cancelled or timed out.');
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to register passkey';
        setErrorMsg(msg);
      }
    } finally {
      setIsRegisteringPasskey(false);
    }
  };

  const handleDeletePasskey = async (credentialId: string) => {
    if (!window.confirm('Are you sure you want to remove this passkey from your account?')) {
      return;
    }
    setDeletingId(credentialId);
    setErrorMsg('');
    try {
      await AuthService.deletePasskey(credentialId);
      setSuccessMsg('Passkey removed.');
      await fetchPasskeys();
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete passkey';
      setErrorMsg(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSignOut = () => {
    AuthService.signOut();
    setPasskeys([]);
    onClose();
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
              <div className="flex-1 font-medium leading-relaxed">{errorMsg}</div>
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

              {/* Passkey & Biometric Device Registration */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Fingerprint className="w-4 h-4 text-emerald-400" />
                    Passkeys & Biometrics
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {AuthService.supportsPasskeys() ? 'Supported on this device' : 'Unsupported'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Register this phone or computer to sign in seamlessly using Face ID, Touch ID, or your device passcode without typing your password.
                </p>

                {AuthService.supportsPasskeys() && (
                  <div className="space-y-2">
                    {AuthService.getRegisteredDeviceName() && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span>This device is registered as: <strong className="text-white font-medium">{AuthService.getRegisteredDeviceName()}</strong></span>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={isRegisteringPasskey}
                      onClick={handleRegisterPasskey}
                      className="w-full py-2 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {isRegisteringPasskey ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Smartphone className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isRegisteringPasskey
                          ? 'Registering with Biometrics...'
                          : AuthService.getRegisteredDeviceName()
                          ? 'Re-register / Update Device Passkey'
                          : 'Register This Device (Face ID / Passkey)'}
                      </span>
                    </button>
                  </div>
                )}

                {/* Registered passkeys list */}
                {passkeys.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 block">Registered Devices ({passkeys.length})</span>
                    <div className="space-y-1.5">
                      {passkeys.map(pk => (
                        <div
                          key={pk.credentialId}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300"
                        >
                          <div className="flex items-center gap-2 overflow-hidden pr-2">
                            <Key className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <div className="truncate">
                              <span className="font-medium text-white block truncate">
                                {pk.friendlyCredentialName || 'Device Passkey'}
                              </span>
                              {pk.createdAt && (
                                <span className="text-[10px] text-slate-500">
                                  Added {new Date(pk.createdAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={deletingId === pk.credentialId}
                            onClick={() => handleDeletePasskey(pk.credentialId)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors shrink-0"
                            title="Remove Passkey"
                          >
                            {deletingId === pk.credentialId ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

              {/* Passkey Fast Sign-In Option */}
              <button
                type="button"
                disabled={isPasskeyLoading || isLoading}
                onClick={handlePasskeySignIn}
                className="w-full py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isPasskeyLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Fingerprint className="w-4 h-4 text-emerald-400" />
                )}
                <span>{isPasskeyLoading ? 'Authenticating with Biometrics...' : 'Sign in with Passkey / Face ID'}</span>
              </button>

              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold absolute">
                  or with password
                </span>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || isPasskeyLoading}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <User className="w-4 h-4" />
                    <span>Sign In with Password</span>
                  </>
                )}
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
