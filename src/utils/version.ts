export interface AppVersionInfo {
  appName: string;
  appVersion: string;
  displayVersion: string;
  baseIdentifier: string;
  tag: string | null;
  commitShort: string;
  commitFull: string;
  commitDate: string;
  branch: string;
  isDirty: boolean;
  buildTimestamp: string;
  buildIsoTime: string;
}

export function formatTimestampYYYYMMDDHHMMSS(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
}

export function computeDisplayVersion(params: {
  tag?: string | null;
  commitShort?: string;
  isDirty?: boolean;
  timestamp?: string;
}): string {
  const base = params.tag || params.commitShort || 'dev';
  if (params.isDirty) {
    const ts = params.timestamp || formatTimestampYYYYMMDDHHMMSS();
    return `${base}-d${ts}`;
  }
  return base;
}

declare const __APP_VERSION_INFO__: AppVersionInfo | undefined;

export const DEFAULT_VERSION_INFO: AppVersionInfo = {
  appName: 'retirement-planner',
  appVersion: '2.0.0',
  displayVersion: 'dev',
  baseIdentifier: 'dev',
  tag: null,
  commitShort: 'dev',
  commitFull: 'development-build',
  commitDate: new Date().toISOString(),
  branch: 'main',
  isDirty: false,
  buildTimestamp: formatTimestampYYYYMMDDHHMMSS(),
  buildIsoTime: new Date().toISOString(),
};

export function getVersionInfo(): AppVersionInfo {
  if (typeof __APP_VERSION_INFO__ !== 'undefined' && __APP_VERSION_INFO__) {
    return __APP_VERSION_INFO__;
  }
  return DEFAULT_VERSION_INFO;
}
