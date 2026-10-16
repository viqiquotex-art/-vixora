import { createClient } from '@supabase/supabase-js';

// These are publishable client settings, never service-role credentials.
export const supabase = createClient(
  'https://gdxughluqryzlklrnzhz.supabase.co',
  'sb_publishable_uZzoysYex21M0kADoogegA_3gE5oL9z',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
