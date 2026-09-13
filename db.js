import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = "https://rnswlektqerdhojlithx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuc3dsZWt0cWVyZGhvamxpdGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwODAxNTksImV4cCI6MjEwNDY1NjE1OX0.pDmnEQyu1HrM4g8jTn864bQG6k31vqHAPXogn-DOr5Q";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const PAGE_SIZE = 30;

/**
 * Busca uma "página" de lançamentos, do mais recente para o mais antigo,
 * já com o corretor vinculado (join) e com os filtros aplicados no banco
 * (em vez de trazer tudo e filtrar no navegador).
 */
export async function fetchTransactionsPage({ offset = 0, limit = PAGE_SIZE, filtro = null } = {}) {
    let query = supabase
        .from('transactions')
        .select('*, corretores(*)')
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (filtro) {
        if (filtro.dia) query = query.eq('dia_num', Number(filtro.dia));
        if (filtro.mes) query = query.eq('mes_num', Number(filtro.mes));
        if (filtro.ano) query = query.eq('ano_num', Number(filtro.ano));
        if (filtro.search) {
            const s = filtro.search.replace(/[%,]/g, '');
            query = query.or(`categoria.ilike.%${s}%,descricao.ilike.%${s}%`);
        }
    }

    const { data, error } = await query;
    if (error) console.error("Erro Supabase (página de lançamentos):", error);
    return data || [];
}

/**
 * Totais gerais (todas as entradas/saídas, de todo o histórico) calculados
 * no próprio banco via função fn_totais_fluxo — não precisa baixar todas as linhas.
 */
export async function fetchTotaisGerais() {
    const { data, error } = await supabase.rpc('fn_totais_fluxo').single();
    if (error) {
        console.error("Erro Supabase (totais gerais):", error);
        return { total_entradas: 0, total_saidas: 0 };
    }
    return data;
}

/**
 * Saldo acumulado (entradas - saídas) até uma data específica, inclusive.
 * Usado para exibir o "Saldo:" de cada grupo de dia no extrato sem precisar
 * ter todo o histórico carregado no navegador.
 */
export async function fetchSaldoAteData(dataLimite) {
    const { data, error } = await supabase.rpc('fn_saldo_ate', { data_limite: dataLimite });
    if (error) {
        console.error("Erro Supabase (saldo até data):", error);
        return 0;
    }
    return data || 0;
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

/**
 * Reduz o tamanho de imagens antes do upload (redimensiona para no máximo
 * `maxDimension` px no maior lado e reexporta como JPEG). PDFs e GIFs não
 * são tocados. Se por algum motivo a compressão falhar ou não ajudar,
 * o arquivo original é usado.
 */
async function compressImageIfNeeded(file, maxDimension = 1600, quality = 0.75) {
    if (!file.type || !file.type.startsWith('image/') || file.type === 'image/gif') {
        return file;
    }

    try {
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const img = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = dataUrl;
        });

        let { width, height } = img;
        if (width <= maxDimension && height <= maxDimension) {
            return file; // já é pequena o suficiente
        }

        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob || blob.size >= file.size) {
            return file; // compressão não valeu a pena
        }

        const newName = file.name.replace(/\.\w+$/, '') + '.jpg';
        return new File([blob], newName, { type: 'image/jpeg' });
    } catch (err) {
        console.warn("Falha ao comprimir imagem, enviando original:", err);
        return file;
    }
}

export async function uploadFileDB(file) {
    const processedFile = await compressImageIfNeeded(file);
    const fileExt = processedFile.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage.from('comprovantes').upload(fileName, processedFile, { cacheControl: '3600', upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(fileName);
    return { name: file.name, url: urlData.publicUrl };
}
