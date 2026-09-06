
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createMockSupabaseClient } from './mock/mockSupabaseClient'

// Local testing without a backend: set VITE_USE_MOCK=true in .env.local to swap
// in an in-memory fake seeded with generated data (see src/mock/fixtures.ts).
const useMock = import.meta.env.VITE_USE_MOCK === 'true'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!useMock && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase: SupabaseClient = useMock
  ? createMockSupabaseClient()
  : createClient(supabaseUrl, supabaseAnonKey)
