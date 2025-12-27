import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Mobile app scheme for deep linking
const MOBILE_APP_SCHEME = 'coop';

/**
 * Detect if request is from mobile app WebView or system browser during OAuth
 */
function isMobileRequest(userAgent: string | null): boolean {
  if (!userAgent) return false;
  
  // Check for common mobile indicators
  const mobileIndicators = [
    'Mobile',
    'Android',
    'iPhone',
    'iPad',
    'iPod',
  ];
  
  return mobileIndicators.some(indicator => userAgent.includes(indicator));
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  
  // Get user agent to detect mobile
  const headersList = await headers();
  const userAgent = headersList.get('user-agent');
  const isMobile = isMobileRequest(userAgent);
  
  // Check for mobile param (can be set explicitly)
  const mobileParam = searchParams.get('mobile');
  const shouldRedirectToApp = isMobile || mobileParam === 'true';
  
  // Handle OAuth error responses (e.g., user denied access)
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  if (errorParam) {
    const errorMsg = errorDescription || errorParam;
    
    if (shouldRedirectToApp) {
      // Redirect back to mobile app with error
      return NextResponse.redirect(`${MOBILE_APP_SCHEME}://auth/error?message=${encodeURIComponent(errorMsg)}`);
    }
    
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        if (shouldRedirectToApp) {
          // Redirect back to mobile app - it will reload the WebView
          // The WebView will now have the auth session via cookies
          return NextResponse.redirect(`${MOBILE_APP_SCHEME}://${next.replace(/^\//, '')}`);
        }
        
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
    
    if (error) {
      console.error('Auth callback error:', error.message);
    }
  }

  // Return to login on error
  if (shouldRedirectToApp) {
    return NextResponse.redirect(`${MOBILE_APP_SCHEME}://login?error=auth_failed`);
  }
  
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
