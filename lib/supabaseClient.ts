import { createClient } from '@supabase/supabase-js';

// WICHTIG: Diese Daten findest du in deinem Supabase Dashboard unter "Settings" -> "API".
// Die URL habe ich aus deinem Connection-String extrahiert.
const SUPABASE_URL = 'https://dvtoestbmoykjwfbrzcz.supabase.co';

// ACHTUNG: Hier wurde der bereitgestellte API Key eingetragen.
const SUPABASE_ANON_KEY = 'sb_publishable_g8hAKOpcYxg_qrfmpc4aKA_Kn0a8F-X'; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);