/**
 * URL Utilities
 * Security-focused URL validation and manipulation
 */

import { OAUTH_DOMAINS, ALLOWED_DOMAINS, APP_SCHEME, WEB_URL } from '../constants';

/**
 * Check if URL should open in external browser (OAuth flows)
 */
export function shouldOpenExternally(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return OAUTH_DOMAINS.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Check if URL is allowed for WebView navigation (security)
 */
export function isAllowedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // Allow blob URLs for file downloads
    if (urlObj.protocol === 'blob:') {
      return true;
    }
    
    // Allow data URLs for inline content
    if (urlObj.protocol === 'data:') {
      return true;
    }
    
    return ALLOWED_DOMAINS.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Convert deep link to web URL
 */
export function deepLinkToWebUrl(deepLink: string): string | null {
  try {
    // Handle coop:// scheme
    if (deepLink.startsWith(`${APP_SCHEME}://`)) {
      const path = deepLink.replace(`${APP_SCHEME}://`, '');
      // Handle auth error deep links
      if (path.startsWith('auth/error')) {
        return `${WEB_URL}/login?error=auth_failed`;
      }
      return `${WEB_URL}/${path}`;
    }
    
    // Handle https:// links to our domain
    if (deepLink.includes('co-op-dev.vercel.app') || deepLink.includes('co-op.vercel.app')) {
      return deepLink;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract path from URL
 */
export function getUrlPath(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname + urlObj.search + urlObj.hash;
  } catch {
    return '/';
  }
}

/**
 * Check if URL is a file download
 */
export function isDownloadUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    const downloadExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.json', '.md', '.txt'];
    return downloadExtensions.some(ext => path.endsWith(ext));
  } catch {
    return false;
  }
}
