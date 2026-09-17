import dynamicVersion from 'virtual:version-info';

export interface AppVersionInfo {
  appName: string;
  appVersion: string;
  displayVersion: string;
  baseIdentifier: string;
  tag: string | null;
  lastTag?: string | null;
  tagDistance?: number;
  commitShort: string;
  commitFull: string;
  commitDate: string;
  commitTimestamp: string;
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
  lastTag?: string | null;
  tagDistance?: number;
  commitShort?: string;
  commitTimestamp?: string;
  isDirty?: boolean;
  timestamp?: string;
}): string {
  const effectiveTag = params.lastTag || params.tag;
  const commit = params.commitShort || 'dev';
  const distance = params.tagDistance !== undefined ? params.tagDistance : (params.tag ? 0 : undefined);

  let base: string;
  if (effectiveTag) {
    if (distance === 0 || distance === undefined) {
      base = effectiveTag;
    } else {
      base = `${effectiveTag}-${distance}-g${commit}`;
    }
  } else {
    base = commit;
  }

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
  commitTimestamp: formatTimestampYYYYMMDDHHMMSS(),
  branch: 'main',
  isDirty: false,
  buildTimestamp: formatTimestampYYYYMMDDHHMMSS(),
  buildIsoTime: new Date().toISOString(),
};

export function getVersionInfo(): AppVersionInfo {
  if (typeof dynamicVersion !== 'undefined' && dynamicVersion) {
    return dynamicVersion;
  }
  if (typeof __APP_VERSION_INFO__ !== 'undefined' && __APP_VERSION_INFO__) {
    return __APP_VERSION_INFO__;
  }
  return DEFAULT_VERSION_INFO;
}


