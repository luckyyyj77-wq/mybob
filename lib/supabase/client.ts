import { createClient, SupabaseClient } from '@supabase/supabase-js';

// These variables should be in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if Supabase credentials are configured
const isConfigured = supabaseUrl &&
                     supabaseUrl !== 'YOUR_SUPABASE_URL' &&
                     supabaseAnonKey &&
                     supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY' &&
                     supabaseUrl.startsWith('http');

if (!isConfigured) {
  console.warn('⚠️ Supabase credentials not configured. Please update .env.local with your Supabase project details.');
}

// Create a single Supabase client for interacting with your database
// Use a valid placeholder URL when credentials are not configured
export const supabase: SupabaseClient = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://demo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbW8iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MTc2OTIwMCwiZXhwIjoxNzk5NTM1NjAwfQ.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE');
