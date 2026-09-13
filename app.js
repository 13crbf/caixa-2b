import { fetchTransactions } from './db.js';
import { setupLancarEvents, setMovementType } from './modulo-lancar.js';
import { renderExtratoModule, closeBottomSheet } from './modulo-extrato.js';
import { initCorretoresModule } from './modulo-corretores.js';

let transactionsState = [];
let isBalanceHidden = false;
let isReadOnly = false;
let currentFilter = null;

async function loadDataAndRender() {
    transactionsState = await fetchTransactions();
    calculateTotals();
    renderExtratoModule(transactionsState, isBalanceHidden, isReadOnly, loadDataAndRender, currentFilter);
}

function calculateTotals() {
    let entradas = 0, saidas = 0;
    transactionsState.forEach(t => {
        if (t.tipo === 'entrada') entradas += Number(t.valor);
        else saidas += Number(t.valor);
    });

    const saldo = entradas - saidas;
    const formatBRL = (v) => isBalanceHidden ? '••••••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    const elEntradas = document.getElementById('val-total-entradas');
    const elSaidas = document.getElementById('val-total-saidas');
    const elSaldo = document.getElementById('val-saldo-liquido');

    if (elEntradas) elEntradas.innerText = formatBRL(entradas);
    if (elSaidas) elSaidas.innerText = formatBRL(saidas);
    if (elSaldo) {
        elSaldo.innerText = formatBRL(saldo);
        elSaldo.className = `text-2xl sm:text-3xl font-black tracking-tight ${saldo >= 0 ? 'text-positive' : 'text-negative'}`;
    }
}

function getSaldoAtual() {
    let entradas = 0, saidas = 0;
    transactionsState.forEach(t => {
        if (t.tipo === 'entrada') entradas += Number(t.valor);
        else saidas += Number(t.valor);
    });
    return entradas - saidas;
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
        renderExtratoModule(transactionsState, isBalanceHidden, isReadOnly, loadDataAndRender, currentFilter);
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
        renderExtratoModule(transactionsState, isBalanceHidden, isReadOnly, loadDataAndRender, currentFilter);
    });

    document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
        currentFilter = null;
        if (document.getElementById('filter-dia')) document.getElementById('filter-dia').value = '';
        if (document.getElementById('filter-mes')) document.getElementById('filter-mes').value = '';
        if (document.getElementById('filter-ano')) document.getElementById('filter-ano').value = '';
        if (document.getElementById('search-input')) document.getElementById('search-input').value = '';
        filterModal?.classList.add('hidden');
        renderExtratoModule(transactionsState, isBalanceHidden, isReadOnly, loadDataAndRender, currentFilter);
    });

    document.getElementById('bottom-sheet-backdrop')?.addEventListener('click', closeBottomSheet);
    document.getElementById('btn-close-bs')?.addEventListener('click', closeBottomSheet);

    setMovementType('entrada');
    setupLancarEvents(loadDataAndRender, getSaldoAtual);
    await initCorretoresModule(isReadOnly);
    
    switchTab('extrato');
});
