import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = "https://rnswlektqerdhojlithx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuc3dsZWt0cWVyZGhvamxpdGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwODAxNTksImV4cCI6MjEwNDY1NjE1OX0.pDmnEQyu1HrM4g8jTn864bQG6k31vqHAPXogn-DOr5Q";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function fetchTransactions() {
    const { data, error } = await supabase
        .from('transactions')
        .select('*, corretores(*)')
        .order('data', { ascending: true })
        .order('created_at', { ascending: true });
    if (error) console.error("Erro Supabase:", error);
    return data || [];
}

export async function fetchCorretores() {
    const { data, error } = await supabase.from('corretores').select('*').order('nome', { ascending: true });
    if (error) console.error("Erro Supabase:", error);
    return data || [];
}

export async function saveCorretorDB(corretorData) {
    return await supabase.from('corretores').insert([corretorData]);
}

export async function saveTransactionDB(payload) {
    if (payload.id) {
        return await supabase.from('transactions').update(payload).eq('id', payload.id);
    }
    return await supabase.from('transactions').insert([payload]);
}

export async function deleteTransactionDB(id) {
    return await supabase.from('transactions').delete().eq('id', id);
}

export async function uploadFileDB(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage.from('comprovantes').upload(fileName, file, { cacheControl: '3600', upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(fileName);
    return { name: file.name, url: urlData.publicUrl };
}