import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gdxughluqryzlklrnzhz.supabase.co'
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabasePublishableKey) {
  console.warn('VIXORA: VITE_SUPABASE_PUBLISHABLE_KEY belum dikonfigurasi.')
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey || 'sb_publishable_missing')
