import { createClient } from '@supabase/supabase-js';

// Public client credential only; database access remains controlled by RLS.
// Use the project's legacy anon key for compatibility with the active Auth gateway.
const SUPABASE_URL = 'https://gdxughluqryzlklrnzhz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkeHVnaGx1cXJ5emxrbHJuemh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjI0ODAsImV4cCI6MjEwMzEzODQ4MH0.YhQaMhH6gwhLZNVem9NR0Ow32iqrgcB3YiAi-WSBKMo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
