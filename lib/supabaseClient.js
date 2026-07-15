import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Doesn't throw at import time (would break the build) — components that
  // call the Supabase client should handle a missing/failed call gracefully.
  console.warn(
    'Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    // Implicit flow (instead of the default PKCE) so email confirmation and
    // password-reset links work when opened on a different device/browser
    // than the one that started the signup/reset — a very normal thing for
    // real users to do (sign up on desktop, check email on phone).
    flowType: 'implicit',
  },
});
