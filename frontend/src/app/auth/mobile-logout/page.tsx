'use client';

import { useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

/**
 * Mobile Logout Page
 * 
 * This page runs in the system browser to clear the OAuth session.
 * It signs out from Supabase and clears localStorage, then redirects back to the app.
 */

function MobileLogoutContent() {
  useEffect(() => {
    const handleLogout = async () => {
      try {
        // Sign out from Supabase
        const supabase = createClient();
        await supabase.auth.signOut();
        
        // Clear all Supabase-related localStorage
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('supabase') || key.includes('sb-'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch {
        // Ignore errors
      }
      
      // Redirect back to app
      setTimeout(() => {
        window.location.href = 'coop://logout/complete';
      }, 500);
    };

    handleLogout();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Link href="/" className="mb-8">
        <span className="font-serif text-2xl font-semibold tracking-tight">Co-Op</span>
      </Link>
      
      <div className="w-full max-w-sm text-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-5" />
        <p className="text-muted-foreground text-sm">Signing out...</p>
      </div>
    </div>
  );
}

export default function MobileLogoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <span className="font-serif text-2xl font-semibold tracking-tight mb-8">Co-Op</span>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MobileLogoutContent />
    </Suspense>
  );
}
