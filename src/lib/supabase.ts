import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://svmjtlsdyghxilpcdywc.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2bWp0bHNkeWdoeGlscGNkeXdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0Nzk1MDksImV4cCI6MjA4ODA1NTUwOX0.hXsVBhNE-_DhVaTx1VTpeqeU7iEz46nPL_CDE_PdhsY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
