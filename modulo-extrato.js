import { saveTransactionDB, uploadFileDB, deleteTransactionDB, fetchSaldoAteData } from './db.js';

const CATEGORY_ICONS = {
    'Comissão Construtora (Cury)': 'fa-building',
    'Bônus de Entrada': 'fa-gift',
    'Devolução / Reembolso': 'fa-rotate-left',
    'Repasse Corretor': 'fa-user-tie',
    'Imposto DAS (Simples)': 'fa-landmark',
    'Aluguel Virtual': 'fa-house',
    'Contabilidade Digital': 'fa-calculator',
    'CRECI Anuidade': 'fa-id-card',
    'Marketing / Redes': 'fa-bullhorn',
    'Outras Categorias': 'fa-coins'
};

export async function renderExtratoModule(transactions, isBalanceHidden, isReadOnly, onRefreshNeeded, options = {}) {
    const { hasMore = false, onLoadMore = null, isLoadingMore = false } = options;
    const container = document.getElementById('transactions-grouped-container');
    if (!container) return;
    container.innerHTML = '';

    const formatBRL = (v) => isBalanceHidden ? '••••••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    // O filtro (dia/mês/ano/busca) já foi aplicado no banco por quem buscou `transactions`.
    if (transactions.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-textsecondary text-xs font-semibold">Nenhuma movimentação encontrada.</div>`;
        return;
    }

    // Agrupamento por Data
    const groups = {};
    transactions.forEach(t => {
        if (!groups[t.data]) groups[t.data] = [];
        groups[t.data].push(t);
    });

    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    // Saldo acumulado de todo o histórico até cada dia exibido, calculado no banco
    // (não depende de ter todos os lançamentos carregados no navegador).
    const saldosPorDia = {};
    await Promise.all(sortedDates.map(async (dateStr) => {
        saldosPorDia[dateStr] = await fetchSaldoAteData(dateStr);
    }));

    sortedDates.forEach(dateStr => {
        const saldoMomentaneo = Number(saldosPorDia[dateStr]) || 0;

        // Ordenação Interna do Dia: cronológica — o lançamento mais recente
        // (por created_at) aparece primeiro, já vem assim da consulta ao banco.
        const dayTransactions = groups[dateStr];

        const groupSection = document.createElement('div');
        groupSection.className = "space-y-1 py-1";

        const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', {
            weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
        });

        groupSection.innerHTML = `
            <div class="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-textprimary border-b border-cardborder/40">
                <span class="capitalize"><i class="fa-regular fa-calendar-days text-textprimary mr-1.5"></i> ${formattedDate}</span>
                <span class="text-xs font-black text-textprimary">
                    Saldo: ${formatBRL(saldoMomentaneo)}
                </span>
            </div>
            <div class="space-y-1.5 pt-1" id="group-body-${dateStr}"></div>
        `;

        container.appendChild(groupSection);
        const groupBody = groupSection.querySelector(`#group-body-${dateStr}`);

        dayTransactions.forEach(t => {
            const isEntrada = t.tipo === 'entrada';
            const iconClass = CATEGORY_ICONS[t.categoria] || (isEntrada ? 'fa-arrow-down' : 'fa-arrow-up');
            
            const row = document.createElement('div');
            row.className = "p-3 rounded-xl bg-cardbg/40 hover:bg-cardbg transition cursor-pointer flex items-center justify-between border border-transparent hover:border-cardborder/60";
            row.onclick = () => openBottomSheet(t, isReadOnly, onRefreshNeeded);

            // Linha Enxuta Minimalista (Ícone, Categoria e Valor)
            row.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full ${isEntrada ? 'bg-positive/10 text-positive' : 'bg-darkbg text-textsecondary'} flex items-center justify-center font-bold text-xs shrink-0">
                        <i class="fa-solid ${iconClass}"></i>
                    </div>
                    <div>
                        <div class="font-bold text-white text-xs sm:text-sm">${t.categoria}</div>
                    </div>
                </div>
                <div class="font-black ${isEntrada ? 'text-positive' : 'text-negative'} text-xs sm:text-sm">
                    ${isEntrada ? '+' : '-'} ${formatBRL(t.valor)}
                </div>
            `;
            groupBody.appendChild(row);
        });
    });

    // Botão "Carregar mais antigos" (paginação/lazy-load)
    if (hasMore && onLoadMore) {
        const loadMoreWrap = document.createElement('div');
        loadMoreWrap.className = "pt-3 flex justify-center";
        loadMoreWrap.innerHTML = `
            <button id="btn-load-more" ${isLoadingMore ? 'disabled' : ''} class="px-4 py-2 rounded-xl text-xs font-bold bg-cardbg border border-cardborder/60 text-textprimary hover:border-brand-500 transition flex items-center gap-2 disabled:opacity-60">
                ${isLoadingMore ? '<i class="fa-solid fa-spinner fa-spin"></i> Carregando...' : '<i class="fa-solid fa-rotate"></i> Carregar mais antigos'}
            </button>
        `;
        container.appendChild(loadMoreWrap);
        document.getElementById('btn-load-more')?.addEventListener('click', onLoadMore);
    }
}

function openBottomSheet(t, isReadOnly, onRefreshNeeded) {
    const isEntrada = t.tipo === 'entrada';
    const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    document.getElementById('bs-category').innerText = t.categoria;
    document.getElementById('bs-subtitle').innerText = `${t.data} • ${isEntrada ? '+' : '-'} ${formatBRL(t.valor)}`;

    const iconBadge = document.getElementById('bs-icon-badge');
    const iconClass = CATEGORY_ICONS[t.categoria] || (isEntrada ? 'fa-arrow-down' : 'fa-arrow-up');
    iconBadge.className = `w-10 h-10 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${isEntrada ? 'bg-positive/10 text-positive' : 'bg-darkbg text-textsecondary'}`;
    iconBadge.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;

    // Corretor se houver
    const corretorBox = document.getElementById('bs-corretor-box');
    if (t.corretores) {
        corretorBox.classList.remove('hidden');
        document.getElementById('bs-corretor-nome').innerText = t.corretores.nome;
        document.getElementById('bs-corretor-detalhes').innerText = `CRECI: ${t.corretores.creci} | Tel: ${t.corretores.telefone} | Pix: ${t.corretores.chave_pix}`;
    } else {
        corretorBox.classList.add('hidden');
    }

    const descInput = document.getElementById('bs-in-descricao');
    descInput.value = t.descricao || '';

    // Renderiza Anexos com Opção de Exclusão Individual (Admin) ou Visualização (Sócio)
    renderBSFiles(t, isReadOnly, onRefreshNeeded);

    // Ajustes para o Modo Leitura (?view=1)
    const fileUploadContainer = document.getElementById('bs-container-fileupload');
    const editBtn = document.getElementById('bs-btn-edit');
    const deleteBtn = document.getElementById('bs-btn-delete');

    if (isReadOnly) {
        descInput.disabled = true;
        if (fileUploadContainer) fileUploadContainer.classList.add('hidden');
        if (editBtn) editBtn.classList.add('hidden');
        if (deleteBtn) deleteBtn.classList.add('hidden');
    } else {
        descInput.disabled = false;
        if (fileUploadContainer) fileUploadContainer.classList.remove('hidden');
        if (editBtn) editBtn.classList.remove('hidden');
        if (deleteBtn) deleteBtn.classList.remove('hidden');

        // Botão Salvar Geral / Editar
        editBtn.onclick = async () => {
            const novaDesc = descInput.value;
            const { error } = await saveTransactionDB({ id: t.id, descricao: novaDesc });
            if (error) {
                alert("Erro ao salvar alterações: " + error.message);
                return;
            }
            closeBottomSheet();
            onRefreshNeeded();
        };

        // Upload de Novo Anexo
        const fileInput = document.getElementById('bs-in-file');
        fileInput.onchange = async (e) => {
            if (e.target.files.length === 0) return;
            try {
                const newFile = await uploadFileDB(e.target.files[0]);
                const updatedFiles = [...(t.comprovantes || []), newFile];
                const { error } = await saveTransactionDB({ id: t.id, comprovantes: updatedFiles, descricao: descInput.value });
                if (error) throw error;
                t.comprovantes = updatedFiles;
                renderBSFiles(t, isReadOnly, onRefreshNeeded);
                onRefreshNeeded();
                fileInput.value = '';
            } catch (err) {
                alert("Erro ao enviar anexo: " + (err.message || JSON.stringify(err)));
            }
        };

        deleteBtn.onclick = async () => {
            if (confirm("Deseja realmente excluir esta movimentação?")) {
                const { error } = await deleteTransactionDB(t.id);
                if (error) {
                    alert("Erro ao excluir movimentação: " + error.message);
                    return;
                }
                closeBottomSheet();
                onRefreshNeeded();
            }
        };
    }

    const backdrop = document.getElementById('bottom-sheet-backdrop');
    const panel = document.getElementById('bottom-sheet-panel');
    backdrop.classList.remove('pointer-events-none');
    backdrop.classList.add('opacity-100');
    panel.classList.remove('bottom-sheet-hidden');
    panel.classList.add('bottom-sheet-visible');
}

function renderBSFiles(t, isReadOnly, onRefreshNeeded) {
    const filesContainer = document.getElementById('bs-files-list');
    filesContainer.innerHTML = '';
    const files = t.comprovantes || [];

    if (files.length === 0) {
        filesContainer.innerHTML = `<div class="text-center py-2 text-xs text-textsecondary border border-dashed border-cardborder/60 rounded-xl">Sem arquivos ou comprovantes anexados.</div>`;
        return;
    }

    files.forEach((f, idx) => {
        const card = document.createElement('div');
        card.className = "p-2 bg-darkbg border border-cardborder rounded-xl flex items-center justify-between text-xs";
        
        const deleteFileBtn = (!isReadOnly) 
            ? `<button class="p-1 text-negative hover:text-red-400 transition" title="Excluir Arquivo" onclick="window.removeAttachment('${t.id}', ${idx})"><i class="fa-solid fa-trash"></i></button>` 
            : '';

        card.innerHTML = `
            <span class="truncate text-white text-xs max-w-[180px] sm:max-w-xs">${f.name}</span>
            <div class="flex items-center gap-2">
                <a href="${f.url}" target="_blank" class="px-2.5 py-1 rounded-lg bg-brand-500 text-darkbg font-bold text-[10px]">Abrir</a>
                ${deleteFileBtn}
            </div>
        `;
        filesContainer.appendChild(card);
    });

    // Função de remoção individual de anexo
    window.removeAttachment = async (txId, fileIndex) => {
        const targetFile = files[fileIndex];
        const label = targetFile ? `"${targetFile.name}"` : "este arquivo";
        if (confirm(`Excluir o arquivo ${label} desta movimentação?`)) {
            const updatedFiles = files.filter((_, index) => index !== fileIndex);
            const { error } = await saveTransactionDB({ id: txId, comprovantes: updatedFiles });
            if (error) {
                alert("Erro ao excluir arquivo: " + error.message);
                return;
            }
            t.comprovantes = updatedFiles;
            renderBSFiles(t, isReadOnly, onRefreshNeeded);
            onRefreshNeeded();
        }
    };
}

export function closeBottomSheet() {
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    const panel = document.getElementById('bottom-sheet-panel');
    if (backdrop) {
        backdrop.classList.remove('opacity-100');
        backdrop.classList.add('pointer-events-none');
    }
    if (panel) {
        panel.classList.remove('bottom-sheet-visible');
        panel.classList.add('bottom-sheet-hidden');
    }
}
