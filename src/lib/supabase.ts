import { createClient } from '@supabase/supabase-js';

// This branch is isolated staging: auth and user data must not touch production.
const SUPABASE_URL = 'https://nuofddhqznewkkryejmu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51b2ZkZGhxem5ld2trcnllam11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNzk3NTAsImV4cCI6MjEwNzk1NTc1MH0.Wg7ClORTohR_Ps06x7aYTjFI5OdGm8MNqYAr-AfjurQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
