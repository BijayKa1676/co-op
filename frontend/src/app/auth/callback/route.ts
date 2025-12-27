import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Mobile app scheme for deep linking
const MOBILE_APP_SCHEME = 'coop';

/**
 * Detect if request is from mobile app (only when explicitly set)
 */
function shouldRedirectToMobileApp(searchParams: URLSearchParams): boolean {
  return searchParams.get('mobile') === 'true';
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  
  const shouldRedirectToApp = shouldRedirectToMobileApp(searchParams);
  
  // Handle OAuth error responses
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  if (errorParam) {
    const errorMsg = errorDescription || errorParam;
    
    if (shouldRedirectToApp) {
      // For mobile: redirect to a page that will trigger the deep link
      return NextResponse.redirect(`${origin}/auth/mobile-redirect?error=${encodeURIComponent(errorMsg)}`);
    }
    
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  if (code) {
    const cookieStore = await cookies();
    
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
        // For mobile: redirect to a page that will handle the deep link
        const tokenParams = new URLSearchParams({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: String(session.expires_at || ''),
        });
        
        return NextResponse.redirect(`${origin}/auth/mobile-redirect?${tokenParams.toString()}`);
      }
      
      // For web: Redirect to dashboard
      return NextResponse.redirect(`${origin}${next}`);
    }
    
    if (error) {
      console.error('Auth callback error:', error.message);
      
      if (shouldRedirectToApp) {
        return NextResponse.redirect(`${origin}/auth/mobile-redirect?error=${encodeURIComponent(error.message)}`);
      }
      
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message || 'auth_failed')}`);
    }
  }

  if (shouldRedirectToApp) {
    return NextResponse.redirect(`${origin}/auth/mobile-redirect?error=auth_failed`);
  }
  
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
