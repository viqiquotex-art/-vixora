declare global {
  namespace App {
    interface Platform {
      env: {
        SUPABASE_URL?: string;
        SUPABASE_ANON_KEY?: string;
        GEMINI_API_KEY?: string;
        GEMINI_FREE_TIER_ONLY_CONFIRMED?: string;
      };
    }
  }
}

export {};
