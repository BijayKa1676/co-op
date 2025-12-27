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
