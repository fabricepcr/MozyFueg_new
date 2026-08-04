import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://arkcpveujkddkxqekueg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFya2NwdmV1amtkZGt4cWVrdWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTI4MDgsImV4cCI6MjA5NDc4ODgwOH0.JJesMeU-h33uwlJfjcHQwczNjRe7VTJrGWjuU8S_GHk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);