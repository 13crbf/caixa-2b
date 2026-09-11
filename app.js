// Credenciais de Conexão com o Supabase
const SUPABASE_URL = "https://rnswlektqerdhojlithx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuc3dsZWt0cWVyZGhvamxpdGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwODAxNTksImV4cCI6MjEwNDY1NjE1OX0.pDmnEQyu1HrM4g8jTn864bQG6k31vqHAPXogn-DOr5Q";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CATEGORIAS = {
    entrada: ['Comissão Construtora (Cury)', 'Bônus de Entrada', 'Devolução / Reembolso', 'Outras Entradas'],
    saida: ['Repasse Corretor Associado', 'Imposto DAS (Simples)', 'Aluguel Virtual', 'Contabilidade Digital', 'CRECI Anuidade', 'Marketing / Redes', 'Outras Saídas']
};

let transactions = [];
let isReadOnly = false;

function formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

async function loadFromSupabase() {
    const { data, error } = await _supabase.from('transactions').select('*').order('data', { ascending: false });
    if (error) {
        alert("Erro ao carregar dados: " + error.message);
        return;
    }
    transactions = data || [];
    renderApp();
}

async function saveTransaction() {
    if (isReadOnly) return;

    const id = document.getElementById('in-id').value;
    const tipo = document.getElementById('in-tipo').value;
    const data = document.getElementById('in-data').value;
    const valor = parseFloat(document.getElementById('in-valor').value);
    const descricao = document.getElementById('in-descricao').value;
    const categoria = document.getElementById('in-categoria').value;
    const ref_code = document.getElementById('in-ref-code').value;
    const fileInput = document.getElementById('in-file');

    if (!data || isNaN(valor) || !descricao) {
        alert("Preencha a data, valor e descrição.");
        return;
    }

    let comprovante_url = null;
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { data: storageData, error: storageError } = await _supabase.storage.from('comprovantes').upload(fileName, file);

        if (!storageError) {
            const { data: urlData } = _supabase.storage.from('comprovantes').getPublicUrl(fileName);
            comprovante_url = urlData.publicUrl;
        } else {
            console.error("Erro no upload do anexo:", storageError);
        }
    }

    if (id) {
        // Atualizar Lançamento
        const updatePayload = { tipo, data, valor, descricao, categoria, ref_code };
        if (comprovante_url) updatePayload.comprovante_url = comprovante_url;

        const { error } = await _supabase.from('transactions').update(updatePayload).eq('id', id);
        if (error) alert("Erro ao atualizar: " + error.message);
        else alert("Lançamento atualizado!");
    } else {
        // Novo Lançamento
        const { error } = await _supabase.from('transactions').insert([{
            tipo, data, valor, descricao, categoria, ref_code, comprovante_url
        }]);
        if (error) alert("Erro ao salvar: " + error.message);
        else alert("Lançamento salvo com sucesso!");
    }

    resetForm();
    switchTab('extrato');
    loadFromSupabase();
}

async function deleteTransaction(id) {
    if (isReadOnly) return;
    if (confirm("Deseja realmente excluir esta movimentação?")) {
        const { error } = await _supabase.from('transactions').delete().eq('id', id);
        if (error) alert("Erro ao excluir: " + error.message);
        else {
            loadFromSupabase();
        }
    }
}

function editTransaction(id) {
    if (isReadOnly) return;
    const t = transactions.find(x => x.id === id);
    if (!t) return;

    document.getElementById('in-id').value = t.id;
    document.getElementById('in-data').value = t.data;
    document.getElementById('in-valor').value = t.valor;
    document.getElementById('in-descricao').value = t.descricao;
    document.getElementById('in-ref-code').value = t.ref_code || "";
    setMovementType(t.tipo);
    document.getElementById('in-categoria').value = t.categoria;
    document.getElementById('form-title').innerText = "Editar Lançamento";
    document.getElementById('btn-save-label').innerText = "Atualizar Lançamento";

    switchTab('lancar');
}

function renderApp() {
    const container = document.getElementById('tb-caixa-body');
    container.innerHTML = '';
    let totalEntradas = 0, totalSaidas = 0;

    if (transactions.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-xs text-slate-500">Nenhuma movimentação encontrada.</div>`;
    } else {
        transactions.forEach(t => {
            if (t.tipo === 'entrada') totalEntradas += Number(t.valor);
            else totalSaidas += Number(t.valor);

            const row = document.createElement('div');
            row.className = "p-3 flex items-center justify-between hover:bg-slate-800/30 transition text-xs";
            
            // Ícone visível e funcional para anexo
            const anexoBtnHtml = t.comprovante_url 
                ? `<a href="${t.comprovante_url}" target="_blank" class="inline-flex items-center gap-1 bg-brand-500/10 text-brand-500 border border-brand-500/30 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-brand-500/20 transition">
                    <i class="fa-solid fa-paperclip text-brand-500"></i> Ver Anexo
                   </a>` 
                : '';

            // Oculta Editar e Excluir totalmente se for Somente Leitura
            const acoesEdicaoHtml = isReadOnly ? '' : `
                <button onclick="editTransaction('${t.id}')" class="text-slate-400 hover:text-white transition p-1" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteTransaction('${t.id}')" class="text-rose-500 hover:text-rose-400 transition p-1" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            `;

            row.innerHTML = `
                <div class="space-y-0.5">
                    <div class="flex items-center gap-1.5 font-bold text-white">
                        <span class="text-[10px] ${t.tipo === 'entrada' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'} font-bold px-1.5 py-0.2 rounded border uppercase">${t.tipo}</span>
                        <span>${t.descricao}</span>
                    </div>
                    <div class="text-[10px] text-slate-400 font-mono">
                        <span>${t.data}</span> • <span>${t.categoria}</span> ${t.ref_code ? `• <span class="text-amber-400">${t.ref_code}</span>` : ''}
                    </div>
                </div>
                <div class="text-right space-y-1">
                    <div class="font-black ${t.tipo === 'entrada' ? 'text-emerald-400' : 'text-rose-400'}">
                        ${t.tipo === 'entrada' ? '+' : '-'} ${formatBRL(t.valor)}
                    </div>
                    <div class="flex items-center justify-end gap-2">
                        ${anexoBtnHtml}
                        ${acoesEdicaoHtml}
                    </div>
                </div>
            `;
            container.appendChild(row);
        });
    }

    document.getElementById('card-total-entradas').innerText = formatBRL(totalEntradas);
    document.getElementById('card-total-saidas').innerText = formatBRL(totalSaidas);
    const saldo = totalEntradas - totalSaidas;
    document.getElementById('card-saldo-liquido').innerText = formatBRL(saldo);
}

function switchTab(tab) {
    document.getElementById('view-lancar').classList.add('hidden');
    document.getElementById('view-extrato').classList.add('hidden');

    if (tab === 'lancar') {
        if (isReadOnly) return; // Impede entrar via comando no modo leitura
        document.getElementById('view-lancar').classList.remove('hidden');
        document.getElementById('desk-tab-lancar').className = "px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 active-tab";
        document.getElementById('desk-tab-extrato').className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition flex items-center gap-1.5";
    } else {
        document.getElementById('view-extrato').classList.remove('hidden');
        document.getElementById('desk-tab-extrato').className = "px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 active-tab";
        if (document.getElementById('desk-tab-lancar')) {
            document.getElementById('desk-tab-lancar').className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition flex items-center gap-1.5";
        }
        loadFromSupabase();
    }
}

function setMovementType(tipo) {
    document.getElementById('in-tipo').value = tipo;
    const btnEntrada = document.getElementById('btn-type-entrada');
    const btnSaida = document.getElementById('btn-type-saida');

    if (tipo === 'entrada') {
        btnEntrada.className = "py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
        btnSaida.className = "py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 bg-slate-950 text-slate-400 border border-slate-800";
    } else {
        btnSaida.className = "py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 bg-rose-500/20 text-rose-400 border border-rose-500/40";
        btnEntrada.className = "py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 bg-slate-950 text-slate-400 border border-slate-800";
    }
    updateCategoryOptions(tipo);
}

function updateCategoryOptions(tipo) {
    const select = document.getElementById('in-categoria');
    select.innerHTML = '';
    CATEGORIAS[tipo].forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.innerText = c;
        select.appendChild(opt);
    });
}

function resetForm() {
    document.getElementById('in-id').value = "";
    document.getElementById('in-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('in-valor').value = "";
    document.getElementById('in-descricao').value = "";
    document.getElementById('in-ref-code').value = "";
    document.getElementById('in-file').value = "";
    document.getElementById('form-title').innerText = "Lançamento de Caixa";
    document.getElementById('btn-save-label').innerText = "Salvar no Supabase";
    setMovementType('entrada');
}

window.onload = function() {
    document.getElementById('in-data').value = new Date().toISOString().split('T')[0];
    updateCategoryOptions('entrada');
    loadFromSupabase();

    // Verificação de URL para travar o modo Somente Leitura (?view=1)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === '1') {
        isReadOnly = true;

        // Oculta botões "+ Lançar" no menu Desktop e Mobile
        const deskLancar = document.getElementById('desk-tab-lancar');
        const mobLancar = document.getElementById('mob-tab-lancar');
        if (deskLancar) deskLancar.classList.add('hidden');
        if (mobLancar) mobLancar.classList.add('hidden');

        // Altera distintivo para "Somente Leitura"
        document.getElementById('status-text').innerText = 'Somente Leitura';
        document.getElementById('role-badge').className = 'inline-flex items-center gap-1 text-[9px] font-medium text-amber-400';

        // Força a exibição fixa da aba Extrato
        switchTab('extrato');
    }
};
