// Deployment dapat mengisi window.CERDAS_CONFIG sebelum config.js atau mengatur meta api-base-url.
const apiMeta = document.querySelector('meta[name="api-base-url"]');
window.CERDAS_CONFIG = {
  ...window.CERDAS_CONFIG,
  apiBaseUrl: window.CERDAS_CONFIG?.apiBaseUrl || apiMeta?.content || `${window.location.origin}/api`,
};
