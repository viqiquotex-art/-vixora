declare global {
  namespace App {
    interface Platform {
      env: {
        SUPABASE_URL?: string;
        SUPABASE_ANON_KEY?: string;
      };
    }
  }
}

export {};
