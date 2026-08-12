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
  let branch = 'main';
  let tag: string | null = null;

  try {
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    isDirty = statusOutput.length > 0;
  } catch {
    isDirty = false;
  }

  try {
    commitShort = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    commitFull = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {}

  try {
    commitDate = execSync('git log -1 --format=%cd --date=iso', { encoding: 'utf-8' }).trim();
  } catch {}

  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {}

  try {
    const tagOutput = execSync('git describe --tags --exact-match HEAD 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (tagOutput) {
      tag = tagOutput;
    }
  } catch {
    tag = null;
  }

  const baseIdentifier = tag ? tag : commitShort;
  const displayVersion = isDirty
    ? `${baseIdentifier}-d${buildTimestamp}`
    : baseIdentifier;

  return {
    appName: pkg.name || 'retirement-planner',
    appVersion: pkg.version || '2.0.0',
    displayVersion,
    baseIdentifier,
    tag,
    commitShort,
    commitFull,
    commitDate,
    branch,
    isDirty,
    buildTimestamp,
    buildIsoTime,
  };
}

const scmInfo = resolveScmVersionInfo();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION_INFO__: JSON.stringify(scmInfo),
  },
  test: {
    environment: 'node',
  },
});
