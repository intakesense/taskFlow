// Re-export the desktop Supabase client with the same interface as web
import { supabase } from '@/lib/supabase';

export function createClient() {
  return supabase;
}

export { supabase };
