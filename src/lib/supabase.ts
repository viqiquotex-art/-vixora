import { createClient } from '@supabase/supabase-js';

// Keep the TypeScript and JavaScript Supabase clients aligned.
// Auth and personal tasks use the existing VIXORA project; Agent Run history
// is isolated behind /api/agent-runs and its dedicated storage endpoint.
const SUPABASE_URL = 'https://gdxughluqryzlklrnzhz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ5NiIsInR5cCI6IkpXVCJ9';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
