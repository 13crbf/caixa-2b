const SUPABASE_URL = "https://rnswlektqerdhojlithx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuc3dsZWt0cWVyZGhvamxpdGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwODAxNTksImV4cCI6MjEwNDY1NjE1OX0.pDmnEQyu1HrM4g8jTn864bQG6k31vqHAPXogn-DOr5Q";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CATEGORIAS = {
    entrada: ['Comissão Construtora (Cury)', 'Bônus de Entrada', 'Devolução / Reembolso', 'Outras Entradas'],
    saida: ['Repasse Corretor Associado', 'Imposto DAS (Simples)', 'Aluguel Virtual', 'Contabilidade Digital', 'CRECI Anuidade', 'Marketing / Redes', 'Outras Saídas']
};

let transactions = [];
let isReadOnly = false;
let selectedFilterPeriod = 'mes_atual';

function formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

async function loadFromSupabase() {
    const { data, error } = await _supabase
        .from('transactions')
        .select('*')
        .order('data', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        alert("Erro ao carregar dados: " + error.message);
        return;
    }
    transactions = data || [];
    renderApp();
}

function setFilterPeriod(period) {
    selectedFilterPeriod = period;
    ['hoje', 'mes_atual', 'mes_anterior', 'ano', 'todos'].forEach(p => {
        const btn = document.getElementById(`btn-period-${p}`);
        if (btn) {
            btn.className = p === period 
                ? "px-3 py-1 rounded-lg text-xs font-semibold bg-brand-500 text-slate-950 whitespace-nowrap shadow"
                : "px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 whitespace-nowrap";
        }
    });

    document.getElementById('filter-date-start').value = "";
    document.getElementById('filter-date-end').value = "";
    renderApp();
}

function getFilteredTransactions() {
    const startDate = document.getElementById('filter-date-start').value;
    const endDate = document.getElementById('filter-date-end').value;
    const search = document.getElementById('search-input').value.toLowerCase();

    const todayStr = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    return transactions.filter(t => {
        const matchSearch = t.descricao.toLowerCase().includes(search) || 
                            t.categoria.toLowerCase().includes(search) || 
                            (t.ref_code && t.ref_code.toLowerCase().includes(search)) ||
                            t.valor.toString().includes(search);

        if (!matchSearch) return false;

        if (startDate && endDate) {
            return t.data >= startDate && t.data <= endDate;
        }

        const tDate = new Date(t.data + 'T00:00:00');

        if (selectedFilterPeriod === 'hoje') {
            return t.data === todayStr;
        } else if (selectedFilterPeriod === 'mes_atual') {
            return tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth;
        } else if (selectedFilterPeriod === 'mes_anterior') {
            const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            return tDate.getFullYear() === prevYear && tDate.getMonth() === prevMonth;
        } else if (selectedFilterPeriod === 'ano') {
            return tDate.getFullYear() === currentYear;
        }

        return true;
    });
}

function renderApp() {
    const filtered = getFilteredTransactions();
    const container = document.getElementById('tb-caixa-body');
    container.innerHTML = '';

    let totalEntradas = 0, totalSaidas = 0;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-xs text-slate-500">Nenhuma movimentação encontrada para este filtro.</div>`;
    } else {
        filtered.forEach(t => {
            if (t.tipo === 'entrada') totalEntradas += Number(t.valor);
            else totalSaidas += Number(t.valor);

            const dateParts = t.data.split('-');
            const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : t.data;

            const row = document.createElement('div');
            row.className = "p-3 flex items-center justify-between hover:bg-slate-800/40 transition text-xs";
            
            // Ícone circular com seta no estilo aplicativo bancário
            const iconHtml = t.tipo === 'entrada'
                ? `<div class="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-sm shrink-0">
                    <i class="fa-solid fa-arrow-down"></i>
                   </div>`
                : `<div class="w-8 h-8 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                    <i class="fa-solid fa-arrow-up"></i>
                   </div>`;

            const anexoBtnHtml = t.comprovante_url 
                ? `<a href="${t.comprovante_url}" target="_blank" class="inline-flex items-center gap-1 bg-brand-500/10 text-brand-500 border border-brand-500/30 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-brand-500/20 transition">
                    <i class="fa-solid fa-paperclip text-brand-500"></i> Anexo
                   </a>` 
                : '';

            const acoesEdicaoHtml = isReadOnly ? '' : `
                <button onclick="editTransaction('${t.id}')" class="text-slate-400 hover:text-white transition p-1" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteTransaction('${t.id}')" class="text-rose-500 hover:text-rose-400 transition p-1" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            `;

            row.innerHTML = `
                <div class="flex items-center gap-3">
                    ${iconHtml}
                    <div class="space-y-0.5">
                        <div class="font-bold text-white text-xs">${t.descricao}</div>
                        <div class="text-[10px] text-slate-400 font-mono">
                            <span>${formattedDate}</span> • <span>${t.categoria}</span> ${t.ref_code ? `• <span class="text-amber-400 font-bold">${t.ref_code}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="text-right space-y-1">
                    <div class="font-black ${t.tipo === 'entrada' ? 'text-emerald-400' : 'text-slate-200'} text-xs sm:text-sm">
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
        
        const { data: storageData, error: storageError } = await _supabase.storage
            .from('comprovantes')
            .upload(fileName, file, { cacheControl: '3600', upsert: true });

        if (!storageError) {
            const { data: urlData } = _supabase.storage.from('comprovantes').getPublicUrl(fileName);
            comprovante_url = urlData.publicUrl;
        } else {
            console.error("Erro ao subir o arquivo:", storageError);
            alert("Erro ao enviar anexo: " + storageError.message);
        }
    }

    if (id) {
        const updatePayload = { tipo, data, valor, descricao, categoria, ref_code };
        if (comprovante_url) updatePayload.comprovante_url = comprovante_url;

        const { error } = await _supabase.from('transactions').update(updatePayload).eq('id', id);
        if (error) alert("Erro ao atualizar: " + error.message);
        else alert("Lançamento atualizado!");
    } else {
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

function switchTab(tab) {
    document.getElementById('view-lancar').classList.add('hidden');
    document.getElementById('view-extrato').classList.add('hidden');

    if (tab === 'lancar') {
        if (isReadOnly) return;
        document.getElementById('view-lancar').classList.remove('hidden');
        document.getElementById('desk-tab-lancar').className = "px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 active-tab";
        document.getElementById('desk-tab-extrato').className = "px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition flex items-center gap-1.5";
    } else {
        document.getElementById('view-extrato').classList.remove('hidden');
        document.getElementById('desk-tab-extrato').className = "px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 active-tab";
        if (document.getElementById('desk-tab-lancar')) {
            document.getElementById('desk-tab-lancar').className = "px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition flex items-center gap-1.5";
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

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === '1') {
        isReadOnly = true;

        const deskLancar = document.getElementById('desk-tab-lancar');
        const mobLancar = document.getElementById('mob-tab-lancar');
        if (deskLancar) deskLancar.classList.add('hidden');
        if (mobLancar) mobLancar.classList.add('hidden');

        document.getElementById('status-text').innerText = 'Somente Leitura';
        document.getElementById('role-badge').className = 'inline-flex items-center gap-1 text-[9px] font-medium text-amber-400';

        switchTab('extrato');
    }
};
