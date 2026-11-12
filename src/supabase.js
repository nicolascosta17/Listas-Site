import { createClient } from '@supabase/supabase-js';
// Chave publishable pública — a tabela continua protegida com RLS por usuário.
// Usamos o MESMO projeto e a MESMA tabela para preservar os dados existentes.
const url = 'https://dbzgcydwevpjsfindwcx.supabase.co';
const publishable = 'sb_publishable_SJIFc-jOXfQdYJjrkH334A_UAw3_1uG';
export const sb = createClient(url, publishable, {
  auth: {persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});
