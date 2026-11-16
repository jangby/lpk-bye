const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function assetUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url.startsWith('/') ? url : `/${url}`}`;
}
