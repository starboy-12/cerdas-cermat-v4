const apiMeta = document.querySelector('meta[name="api-base-url"]');
const configuredApiUrl = window.CERDAS_CONFIG?.apiBaseUrl || apiMeta?.content;
const defaultApiUrl = window.location.port === '5174'
  ? `${window.location.protocol}//${window.location.hostname}:3101/api`
  : `${window.location.origin}/api`;

window.CERDAS_CONFIG = {
  ...window.CERDAS_CONFIG,
  apiBaseUrl: configuredApiUrl || defaultApiUrl,
};
