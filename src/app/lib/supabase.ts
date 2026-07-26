import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const STORAGE_KEY = 'sb-app-auth';

declare global {
  interface Window {
    __supabase_instance__: SupabaseClient | undefined;
  }
}

export function getSupabaseClient(): SupabaseClient {
  if (!window.__supabase_instance__) {
    window.__supabase_instance__ = createClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: STORAGE_KEY,
        },
        db: {
          schema: 'public',
        },
      }
    );
  }
  return window.__supabase_instance__!;
}