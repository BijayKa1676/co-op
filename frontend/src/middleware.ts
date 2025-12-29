import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';

// Session cookie name for user ID validation
const USER_ID_COOKIE = 'coop-user-id';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require auth
  const publicRoutes = ['/', '/login', '/privacy', '/terms'];
  const isPublicRoute = publicRoutes.some((route) => pathname === route) || pathname.startsWith('/auth/');

  // If user is not logged in and trying to access protected route
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    // Clear any stale user ID cookie
    const response = NextResponse.redirect(url);
    response.cookies.delete(USER_ID_COOKIE);
    return response;
  }

  // If user is logged in and trying to access login page
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // SESSION VALIDATION: Verify user ID cookie matches authenticated user
  // This prevents session mixing if cookies are tampered with
  if (user) {
    const userIdCookie = request.cookies.get(USER_ID_COOKIE)?.value;
    
    if (userIdCookie && userIdCookie !== user.id) {
      // Session mismatch detected - possible tampering or stale session
      // Clear cookies and redirect to login
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'session_mismatch');
      const response = NextResponse.redirect(url);
      response.cookies.delete(USER_ID_COOKIE);
      // Sign out to clear Supabase session
      await supabase.auth.signOut();
      return response;
    }
    
    // Set/update user ID cookie for session tracking
    if (!userIdCookie) {
      supabaseResponse.cookies.set(USER_ID_COOKIE, user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
