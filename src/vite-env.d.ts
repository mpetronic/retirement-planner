/// <reference types="vite/client" />

declare module 'virtual:version-info' {
  const versionInfo: import('./utils/version').AppVersionInfo;
  export default versionInfo;
}
