import { saveTransactionDB, uploadFileDB, deleteTransactionDB } from './db.js';

const CATEGORY_ICONS = {
    'Comissão Construtora (Cury)': 'fa-building',
    'Bônus de Entrada': 'fa-gift',
    'Devolução / Reembolso': 'fa-rotate-left',
    'Repasse Corretor': 'fa-user-tie',
    'Imposto DAS (Simples)': 'fa-landmark',
    'Aluguel Virtual': 'fa-house',
    'Contabilidade Digital': 'fa-calculator',
    'CRECI Anuidade': 'fa-id-card',
    'Marketing / Redes': 'fa-bullhorn'
};

let currentSelectedTx = null;

export function renderExtratoModule(transactions, isBalanceHidden, isReadOnly, onRefreshNeeded) {
    const container = document.getElementById('transactions-grouped-container');
    container.innerHTML = '';

    const formatBRL = (v) => isBalanceHidden ? '••••••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    // Filtros
    const fDia = document.getElementById('filter-dia').value;
    const fMes = document.getElementById('filter-mes').value;
    const fAno = document.getElementById('filter-ano').value;
    const search = document.getElementById('search-input').value.toLowerCase();

    const filtered = transactions.filter(t => {
        const parts = t.data.split('-');
        if (fDia && parts[2] !== fDia) return false;
        if (fMes && parts[1] !== fMes) return false;
        if (fAno && parts[0] !== fAno) return false;
        if (search && !t.categoria.toLowerCase().includes(search) && !(t.descricao && t.descricao.toLowerCase().includes(search))) return false;
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="bg-cardbg border border-cardborder rounded-2xl p-8 text-center text-textsecondary text-xs">Nenhuma movimentação encontrada.</div>`;
        return;
    }

    // Agrupamento por Data mantendo a ordem cronológica invertida para exibição
    const groups = {};
    filtered.forEach(t => {
        if (!groups[t.data]) groups[t.data] = [];
        groups[t.data].push(t);
    });

    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    sortedDates.forEach(dateStr => {
        // Cálculo do Saldo Momentâneo até essa data exata
        let saldoMomentaneo = 0;
        transactions.forEach(t => {
            if (t.data <= dateStr) {
                if (t.tipo === 'entrada') saldoMomentaneo += Number(t.valor);
                else saldoMomentaneo -= Number(t.valor);
            }
        });

        const groupSection = document.createElement('div');
        groupSection.className = "bg-cardbg border border-cardborder rounded-2xl overflow-hidden shadow-lg space-y-0.5";

        groupSection.innerHTML = `
            <div class="px-4 py-2.5 bg-darkbg/80 border-b border-cardborder text-[11px] font-bold text-textsecondary flex items-center justify-between">
                <span><i class="fa-regular fa-calendar-days text-brand-500 mr-1.5"></i> ${dateStr}</span>
                <span class="text-xs font-black ${saldoMomentaneo >= 0 ? 'text-positive' : 'text-negative'}">
                    Saldo: ${formatBRL(saldoMomentaneo)}
                </span>
            </div>
            <div class="divide-y divide-cardborder/40" id="group-body-${dateStr}"></div>
        `;

        container.appendChild(groupSection);
        const groupBody = groupSection.querySelector(`#group-body-${dateStr}`);

        groups[dateStr].forEach(t => {
            const isEntrada = t.tipo === 'entrada';
            const iconClass = CATEGORY_ICONS[t.categoria] || (isEntrada ? 'fa-arrow-down' : 'fa-arrow-up');
            
            const row = document.createElement('div');
            row.className = "p-3.5 flex items-center justify-between hover:bg-darkbg/50 transition cursor-pointer";
            row.onclick = () => openBottomSheet(t, isReadOnly, onRefreshNeeded);

            // Linha Enxuta: Apenas Ícone, Categoria e Valor
            row.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl ${isEntrada ? 'bg-positive/10 text-positive border-positive/20' : 'bg-darkbg text-textsecondary border-cardborder'} border flex items-center justify-center font-bold text-sm shrink-0">
                        <i class="fa-solid ${iconClass}"></i>
                    </div>
                    <div class="font-bold text-white text-xs sm:text-sm">${t.categoria}</div>
                </div>
                <div class="font-black ${isEntrada ? 'text-positive' : 'text-negative'} text-xs sm:text-sm">
                    ${isEntrada ? '+' : '-'} ${formatBRL(t.valor)}
                </div>
            `;
            groupBody.appendChild(row);
        });
    });
}

function openBottomSheet(t, isReadOnly, onRefreshNeeded) {
    currentSelectedTx = t;
    const isEntrada = t.tipo === 'entrada';
    const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    document.getElementById('bs-category').innerText = t.categoria;
    document.getElementById('bs-subtitle').innerText = `${t.data} • ${isEntrada ? '+' : '-'} ${formatBRL(t.valor)}`;
    document.getElementById('bs-in-descricao').value = t.descricao || '';

    // Ícone
    const iconBadge = document.getElementById('bs-icon-badge');
    const iconClass = CATEGORY_ICONS[t.categoria] || (isEntrada ? 'fa-arrow-down' : 'fa-arrow-up');
    iconBadge.className = `w-10 h-10 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${isEntrada ? 'bg-positive/10 text-positive border border-positive/30' : 'bg-darkbg text-textsecondary border border-cardborder'}`;
    iconBadge.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;

    // Exibir Corretor se houver
    const corretorBox = document.getElementById('bs-corretor-box');
    if (t.corretores) {
        corretorBox.classList.remove('hidden');
        document.getElementById('bs-corretor-nome').innerText = t.corretores.nome;
        document.getElementById('bs-corretor-detalhes').innerText = `CRECI: ${t.corretores.creci} • Pix: ${t.corretores.chave_pix}`;
    } else {
        corretorBox.classList.add('hidden');
    }

    renderBSFiles(t.comprovantes || []);

    // Ações de Atualização no Bottom Sheet
    document.getElementById('btn-update-desc').onclick = async () => {
        if (isReadOnly) return;
        const novaDesc = document.getElementById('bs-in-descricao').value;
        await saveTransactionDB({ id: t.id, descricao: novaDesc });
        closeBottomSheet();
        onRefreshNeeded();
    };

    document.getElementById('bs-in-file').onchange = async (e) => {
        if (isReadOnly || e.target.files.length === 0) return;
        try {
            const newFile = await uploadFileDB(e.target.files[0]);
            const updatedFiles = [...(t.comprovantes || []), newFile];
            await saveTransactionDB({ id: t.id, comprovantes: updatedFiles });
            t.comprovantes = updatedFiles;
            renderBSFiles(updatedFiles);
            onRefreshNeeded();
        } catch (err) {
            alert("Erro ao enviar anexo: " + err.message);
        }
    };

    document.getElementById('bs-btn-delete').onclick = async () => {
        if (isReadOnly) return;
        if (confirm("Excluir esta transação?")) {
            await deleteTransactionDB(t.id);
            closeBottomSheet();
            onRefreshNeeded();
        }
    };

    if (isReadOnly) {
        document.getElementById('bs-btn-edit').classList.add('hidden');
        document.getElementById('bs-btn-delete').classList.add('hidden');
    }

    const backdrop = document.getElementById('bottom-sheet-backdrop');
    const panel = document.getElementById('bottom-sheet-panel');
    backdrop.classList.remove('pointer-events-none');
    backdrop.classList.add('opacity-100');
    panel.classList.remove('bottom-sheet-hidden');
    panel.classList.add('bottom-sheet-visible');
}

function renderBSFiles(files) {
    const filesContainer = document.getElementById('bs-files-list');
    filesContainer.innerHTML = '';
    if (files.length === 0) {
        filesContainer.innerHTML = `<div class="text-center py-2 text-xs text-textsecondary border border-dashed border-cardborder rounded-xl">Nenhum comprovante anexado.</div>`;
        return;
    }
    files.forEach(f => {
        const card = document.createElement('div');
        card.className = "p-2 bg-darkbg border border-cardborder rounded-xl flex items-center justify-between text-xs";
        card.innerHTML = `
            <span class="truncate text-white text-xs">${f.name}</span>
            <a href="${f.url}" target="_blank" class="px-2 py-1 rounded bg-brand-500 text-darkbg font-bold text-[10px]">Abrir</a>
        `;
        filesContainer.appendChild(card);
    });
}

export function closeBottomSheet() {
    const backdrop = document.getElementById('bottom-sheet-backdrop');
    const panel = document.getElementById('bottom-sheet-panel');
    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('pointer-events-none');
    panel.classList.remove('bottom-sheet-visible');
    panel.classList.add('bottom-sheet-hidden');
}