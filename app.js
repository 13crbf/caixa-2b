import { fetchTransactions } from './db.js';
import { setupLancarEvents, resetForm } from './modulo-lancar.js';
import { renderExtratoModule, closeBottomSheet } from './modulo-extrato.js';
import { initCorretoresModule } from './modulo-corretores.js';

let transactionsState = [];
let isBalanceHidden = false;
let isReadOnly = false;

async function loadDataAndRender() {
    transactionsState = await fetchTransactions();
    calculateTotals();
    renderExtratoModule(transactionsState, isBalanceHidden, isReadOnly, loadDataAndRender);
}

function calculateTotals() {
    let entradas = 0, saidas = 0;
    transactionsState.forEach(t => {
        if (t.tipo === 'entrada') entradas += Number(t.valor);
        else saidas += Number(t.valor);
    });

    const saldo = entradas - saidas;
    const formatBRL = (v) => isBalanceHidden ? '••••••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    document.getElementById('val-total-entradas').innerText = formatBRL(entradas);
    document.getElementById('val-total-saidas').innerText = formatBRL(saidas);
    document.getElementById('val-saldo-liquido').innerText = formatBRL(saldo);
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
    ['extrato', 'lancar', 'corretores'].forEach(t => {
        document.getElementById(`view-${t}`).classList.add('hidden');
        document.getElementById(`desk-tab-${t}`)?.classList.remove('pill-active');
        document.getElementById(`mob-tab-${t}`)?.classList.remove('text-brand-500', 'font-bold');
        document.getElementById(`mob-tab-${t}`)?.classList.add('text-textsecondary');
    });

    document.getElementById(`view-${tab}`).classList.remove('hidden');
    document.getElementById(`desk-tab-${tab}`)?.classList.add('pill-active');
    document.getElementById(`mob-tab-${tab}`)?.classList.add('text-brand-500', 'font-bold');

    if (tab === 'extrato') loadDataAndRender();
}

window.addEventListener('DOMContentLoaded', async () => {
    // Verificação de URL para Modo Somente Leitura
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === '1') {
        isReadOnly = true;
        document.getElementById('desk-tab-lancar')?.classList.add('hidden');
        document.getElementById('mob-tab-lancar')?.classList.add('hidden');
        document.getElementById('header-subtitle').innerText = "Extrato Corporal (Somente Leitura)";
    }

    // Eventos de Navegação
    ['extrato', 'lancar', 'corretores'].forEach(t => {
        document.getElementById(`desk-tab-${t}`)?.addEventListener('click', () => switchTab(t));
        document.getElementById(`mob-tab-${t}`)?.addEventListener('click', () => switchTab(t));
    });

    // Evento Ocultar Saldo
    document.getElementById('btn-toggle-eye').addEventListener('click', () => {
        isBalanceHidden = !isBalanceHidden;
        document.getElementById('eye-icon').className = isBalanceHidden ? 'fa-solid fa-eye-slash text-amber-400' : 'fa-solid fa-eye';
        document.getElementById('eye-text').innerText = isBalanceHidden ? 'Exibir' : 'Ocultar';
        calculateTotals();
        renderExtratoModule(transactionsState, isBalanceHidden, isReadOnly, loadDataAndRender);
    });

    // Filtros
    ['filter-dia', 'filter-mes', 'filter-ano'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => renderExtratoModule(transactionsState, isBalanceHidden, isReadOnly, loadDataAndRender));
    });
    document.getElementById('search-input').addEventListener('input', () => renderExtratoModule(transactionsState, isBalanceHidden, isReadOnly, loadDataAndRender));
    document.getElementById('bottom-sheet-backdrop').addEventListener('click', closeBottomSheet);
    document.getElementById('btn-close-bs').addEventListener('click', closeBottomSheet);

    // Inicializações
    setupLancarEvents(loadDataAndRender, getSaldoAtual);
    await initCorretoresModule();
    switchTab('extrato');
});
