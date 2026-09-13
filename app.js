import { fetchTransactionsPage, fetchTotaisGerais, PAGE_SIZE } from './db.js';
import { setupLancarEvents, setMovementType } from './modulo-lancar.js';
import { renderExtratoModule, closeBottomSheet } from './modulo-extrato.js';
import { initCorretoresModule } from './modulo-corretores.js';

let transactionsState = [];
let isBalanceHidden = false;
let isReadOnly = false;
let currentFilter = null;
let currentOffset = 0;
let hasMoreTransactions = true;
let isLoadingMore = false;
let totaisGeraisCache = { total_entradas: 0, total_saidas: 0 };

function renderCurrentExtrato() {
    return renderExtratoModule(transactionsState, isBalanceHidden, isReadOnly, loadDataAndRender, {
        hasMore: hasMoreTransactions,
        onLoadMore: loadMoreTransactions,
        isLoadingMore
    });
}

// Recarrega do zero: totais gerais (todo o histórico) + primeira página do extrato,
// respeitando o filtro atual. Usado ao entrar na aba, aplicar/limpar filtro e após
// qualquer criação/edição/exclusão de lançamento.
async function loadDataAndRender() {
    currentOffset = 0;
    hasMoreTransactions = true;

    totaisGeraisCache = await fetchTotaisGerais();
    calculateTotals();

    transactionsState = await fetchTransactionsPage({ offset: 0, limit: PAGE_SIZE, filtro: currentFilter });
    hasMoreTransactions = transactionsState.length === PAGE_SIZE;
    currentOffset = transactionsState.length;

    await renderCurrentExtrato();
}

// Busca a próxima página (mais antiga) e acrescenta à lista já exibida.
async function loadMoreTransactions() {
    if (isLoadingMore || !hasMoreTransactions) return;
    isLoadingMore = true;
    await renderCurrentExtrato(); // mostra o botão em estado "carregando"

    const nextPage = await fetchTransactionsPage({ offset: currentOffset, limit: PAGE_SIZE, filtro: currentFilter });
    transactionsState = transactionsState.concat(nextPage);
    hasMoreTransactions = nextPage.length === PAGE_SIZE;
    currentOffset += nextPage.length;
    isLoadingMore = false;

    await renderCurrentExtrato();
}

function calculateTotals() {
    const entradas = Number(totaisGeraisCache.total_entradas) || 0;
    const saidas = Number(totaisGeraisCache.total_saidas) || 0;
    const saldo = entradas - saidas;
    const formatBRL = (v) => isBalanceHidden ? '••••••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    const elEntradas = document.getElementById('val-total-entradas');
    const elSaidas = document.getElementById('val-total-saidas');
    const elSaldo = document.getElementById('val-saldo-liquido');

    if (elEntradas) elEntradas.innerText = formatBRL(entradas);
    if (elSaidas) elSaidas.innerText = formatBRL(saidas);
    if (elSaldo) {
        elSaldo.innerText = formatBRL(saldo);
        elSaldo.className = `text-2xl sm:text-3xl font-black tracking-tight text-textprimary`;
    }
}

function getSaldoAtual() {
    return (Number(totaisGeraisCache.total_entradas) || 0) - (Number(totaisGeraisCache.total_saidas) || 0);
}

function switchTab(tab) {
    if (isReadOnly && tab !== 'extrato') return;

    ['extrato', 'lancar', 'corretores'].forEach(t => {
        const viewEl = document.getElementById(`view-${t}`);
        if (viewEl) viewEl.classList.add('hidden');
        
        const deskTab = document.getElementById(`desk-tab-${t}`);
        if (deskTab) deskTab.classList.remove('pill-active');
        
        const mobTab = document.getElementById(`mob-tab-${t}`);
        if (mobTab) {
            mobTab.classList.remove('text-brand-500', 'font-bold');
            mobTab.classList.add('text-textsecondary');
        }
    });

    const activeView = document.getElementById(`view-${tab}`);
    if (activeView) activeView.classList.remove('hidden');

    const activeDesk = document.getElementById(`desk-tab-${tab}`);
    if (activeDesk) activeDesk.classList.add('pill-active');

    const activeMob = document.getElementById(`mob-tab-${tab}`);
    if (activeMob) {
        activeMob.classList.remove('text-textsecondary');
        activeMob.classList.add('text-brand-500', 'font-bold');
    }

    if (tab === 'extrato') loadDataAndRender();
}

window.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    isReadOnly = urlParams.get('view') === '1';

    if (isReadOnly) {
        document.getElementById('desk-tab-lancar')?.classList.add('hidden');
        document.getElementById('mob-tab-lancar')?.classList.add('hidden');
        
        const subtitle = document.getElementById('header-subtitle');
        if (subtitle) subtitle.innerText = "Extrato Corporativo (Somente Leitura)";
    } else {
        document.getElementById('desk-tab-lancar')?.classList.remove('hidden');
        document.getElementById('mob-tab-lancar')?.classList.remove('hidden');
    }

    ['extrato', 'lancar', 'corretores'].forEach(t => {
        document.getElementById(`desk-tab-${t}`)?.addEventListener('click', () => switchTab(t));
        document.getElementById(`mob-tab-${t}`)?.addEventListener('click', () => switchTab(t));
    });

    // Toggle Eye
    document.getElementById('btn-toggle-eye')?.addEventListener('click', () => {
        isBalanceHidden = !isBalanceHidden;
        const eyeIcon = document.getElementById('eye-icon');
        const eyeText = document.getElementById('eye-text');
        
        if (eyeIcon) eyeIcon.className = isBalanceHidden ? 'fa-solid fa-eye-slash text-amber-400' : 'fa-solid fa-eye';
        if (eyeText) eyeText.innerText = isBalanceHidden ? 'Exibir' : 'Ocultar';
        
        calculateTotals();
        renderCurrentExtrato();
    });

    // Modal de Filtros Avançados
    const filterModal = document.getElementById('filter-modal');
    document.getElementById('btn-open-filter')?.addEventListener('click', () => filterModal?.classList.remove('hidden'));
    document.getElementById('btn-close-filter')?.addEventListener('click', () => filterModal?.classList.add('hidden'));

    document.getElementById('btn-apply-filter')?.addEventListener('click', () => {
        currentFilter = {
            dia: document.getElementById('filter-dia')?.value || '',
            mes: document.getElementById('filter-mes')?.value || '',
            ano: document.getElementById('filter-ano')?.value || '',
            search: document.getElementById('search-input')?.value || ''
        };
        filterModal?.classList.add('hidden');
        loadDataAndRender();
    });

    document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
        currentFilter = null;
        if (document.getElementById('filter-dia')) document.getElementById('filter-dia').value = '';
        if (document.getElementById('filter-mes')) document.getElementById('filter-mes').value = '';
        if (document.getElementById('filter-ano')) document.getElementById('filter-ano').value = '';
        if (document.getElementById('search-input')) document.getElementById('search-input').value = '';
        filterModal?.classList.add('hidden');
        loadDataAndRender();
    });

    document.getElementById('bottom-sheet-backdrop')?.addEventListener('click', closeBottomSheet);
    document.getElementById('btn-close-bs')?.addEventListener('click', closeBottomSheet);

    setMovementType('entrada');
    setupLancarEvents(loadDataAndRender, getSaldoAtual);
    await initCorretoresModule(isReadOnly);
    
    switchTab('extrato');
});
