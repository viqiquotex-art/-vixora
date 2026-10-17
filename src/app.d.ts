declare global {
  namespace App {
    interface Platform {
      env: {
        SUPABASE_URL?: string;
        SUPABASE_ANON_KEY?: string;
        DASHSCOPE_API_KEY?: string;
        DASHSCOPE_FREE_QUOTA_ONLY_CONFIRMED?: string;
      };
    }
  }
}

export {};
