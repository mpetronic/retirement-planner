/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import pkg from './package.json';

function getTimestampYYYYMMDDHHMMSS(d: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
}

function resolveScmVersionInfo() {
  const now = new Date();
  const buildTimestamp = getTimestampYYYYMMDDHHMMSS(now);
  const buildIsoTime = now.toISOString();

  let isDirty = false;
  let commitShort = 'dev';
  let commitFull = 'dev';
  let commitDate = buildIsoTime;
  let commitTimestamp = buildTimestamp;
  let branch = 'main';


  try {
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    isDirty = statusOutput.length > 0;
  } catch {
    isDirty = false;
  }

  try {
    commitShort = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    commitFull = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    /* ignore */
  }

  try {
    commitDate = execSync('git log -1 --format=%cd --date=iso', { encoding: 'utf-8' }).trim();
  } catch {
    /* ignore */
  }

  try {
    const rawCommitTs = execSync('git log -1 --format=%cd --date=format:%Y%m%d%H%M%S', { encoding: 'utf-8' }).trim();
    if (rawCommitTs) {
      commitTimestamp = rawCommitTs;
    }
  } catch {
    commitTimestamp = buildTimestamp;
  }

  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    /* ignore */
  }

  let exactTag: string | null = null;
  let lastTag: string | null = null;
  let tagDistance = 0;

  try {
    const tagOutput = execSync('git describe --tags --exact-match HEAD 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (tagOutput) {
      exactTag = tagOutput;
    }
  } catch {
    exactTag = null;
  }

  try {
    const describeLong = execSync('git describe --tags --long --always', { encoding: 'utf-8' }).trim();
    const match = describeLong.match(/^(.+)-(\d+)-g([0-9a-f]+)$/i);
    if (match) {
      lastTag = match[1];
      tagDistance = parseInt(match[2], 10);
    }
  } catch {
    lastTag = null;
    tagDistance = 0;
  }

  let displayVersion = '';
  if (lastTag) {
    if (tagDistance === 0) {
      displayVersion = isDirty ? `${lastTag}-d${buildTimestamp}` : lastTag;
    } else {
      displayVersion = isDirty
        ? `${lastTag}-${tagDistance}-g${commitShort}-d${buildTimestamp}`
        : `${lastTag}-${tagDistance}-g${commitShort}`;
    }
  } else {
    displayVersion = isDirty
      ? `${commitShort}-d${buildTimestamp}`
      : commitShort;
  }

  return {
    appName: pkg.name || 'retirement-planner',
    appVersion: pkg.version || '2.0.0',
    displayVersion,
    baseIdentifier: lastTag || commitShort,
    tag: exactTag,
    lastTag,
    tagDistance,
    commitShort,
    commitFull,
    commitDate,
    commitTimestamp,
    branch,
    isDirty,
    buildTimestamp,
    buildIsoTime,
  };
}

function versionPlugin() {
  const virtualModuleId = 'virtual:version-info';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  return {
    name: 'vite-plugin-version-info',
    resolveId(id: string) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    load(id: string) {
      if (id === resolvedVirtualModuleId) {
        const scm = resolveScmVersionInfo();
        return `export default ${JSON.stringify(scm)};`;
      }
    },
    handleHotUpdate({ server }: { server: import('vite').ViteDevServer }) {
      const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
      if (mod) {
        server.moduleGraph.invalidateModule(mod);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionPlugin()],
  define: {
    __APP_VERSION_INFO__: JSON.stringify(resolveScmVersionInfo()),
  },
  test: {
    environment: 'node',
  },
});

