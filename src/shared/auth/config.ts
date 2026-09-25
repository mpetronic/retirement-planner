export interface CloudConfig {
  region: string;
  userPoolId: string;
  clientId: string;
  apiEndpoint: string;
}

// Defaults populated from the N. Virginia (us-east-1) CDK deployment outputs
export const DEFAULT_CLOUD_CONFIG: CloudConfig = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_XAGFMZbXq',
  clientId: '738i6lv978odubksnrdpovsb39',
  apiEndpoint: 'https://yf96kukzfg.execute-api.us-east-1.amazonaws.com',
};

const STORAGE_KEY_CONFIG = 'retirement_planner_cloud_config';

export function getCloudConfig(): CloudConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_CLOUD_CONFIG;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        region: parsed.region || DEFAULT_CLOUD_CONFIG.region,
        userPoolId: parsed.userPoolId || DEFAULT_CLOUD_CONFIG.userPoolId,
        clientId: parsed.clientId || DEFAULT_CLOUD_CONFIG.clientId,
        apiEndpoint: parsed.apiEndpoint || DEFAULT_CLOUD_CONFIG.apiEndpoint,
      };
    }
  } catch (err) {
    console.error('Failed to read cloud config from localStorage:', err);
  }
  return DEFAULT_CLOUD_CONFIG;
}

export function saveCloudConfig(config: Partial<CloudConfig>): CloudConfig {
  const current = getCloudConfig();
  const updated: CloudConfig = {
    ...current,
    ...config,
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
    if (typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cloud_config_updated', { detail: updated }));
    }
  }
  return updated;
}
