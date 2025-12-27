import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';

// Mobile app scheme for deep linking
const MOBILE_APP_SCHEME = 'coop';

/**
 * Detect if request is from mobile app (only when explicitly set)
 * We no longer auto-detect mobile browsers to avoid breaking web OAuth on mobile devices
 */
function shouldRedirectToMobileApp(searchParams: URLSearchParams): boolean {
  // Only redirect to mobile app if explicitly requested via param
  return searchParams.get('mobile') === 'true';
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  
  // Only redirect to mobile app if explicitly requested
  const shouldRedirectToApp = shouldRedirectToMobileApp(searchParams);
  
  // Handle OAuth error responses (e.g., user denied access)
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  if (errorParam) {
    const errorMsg = errorDescription || errorParam;
    
    if (shouldRedirectToApp) {
      return NextResponse.redirect(`${MOBILE_APP_SCHEME}://auth/error?message=${encodeURIComponent(errorMsg)}`);
    }
    
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  if (code) {
    const cookieStore = await cookies();
    
    // Create Supabase client with proper cookie handling for the response
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.session) {
      const { session } = data;
      
      if (shouldRedirectToApp) {
        // For mobile app: Pass tokens via URL fragment
        const tokenParams = new URLSearchParams({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: String(session.expires_at || ''),
          token_type: session.token_type || 'bearer',
        });
        
        return NextResponse.redirect(`${MOBILE_APP_SCHEME}://auth/callback#${tokenParams.toString()}`);
      }
      
      // For web: Redirect to dashboard (cookies are already set by Supabase client)
      return NextResponse.redirect(`${origin}${next}`);
    }
    
    if (error) {
      console.error('Auth callback error:', error.message);
      
      if (shouldRedirectToApp) {
        const errorMsg = error.message || 'Failed to exchange code for session';
        return NextResponse.redirect(`${MOBILE_APP_SCHEME}://auth/error?message=${encodeURIComponent(errorMsg)}`);
      }
      
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message || 'auth_failed')}`);
    }
  }

  // Return to login on error
  if (shouldRedirectToApp) {
    return NextResponse.redirect(`${MOBILE_APP_SCHEME}://login?error=auth_failed`);
  }
  
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
