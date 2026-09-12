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
    // Impede transicionar para formulários se estiver em modo leitura
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
    // 1. Checa se o parâmetro ?view=1 está presente de forma estrita
    const urlParams = new URLSearchParams(window.location.search);
    isReadOnly = urlParams.get('view') === '1';

    // 2. Se FOR modo somente leitura, oculta os menus operacionais
    if (isReadOnly) {
        document.getElementById('desk-tab-lancar')?.classList.add('hidden');
        document.getElementById('mob-tab-lancar')?.classList.add('hidden');
        document.getElementById('desk-tab-corretores')?.classList.add('hidden');
        document.getElementById('mob-tab-corretores')?.classList.add('hidden');
        
        const subtitle = document.getElementById('header-subtitle');
        if (subtitle) subtitle.innerText = "Extrato Corporativo (Somente Leitura)";
    } else {
        // Se FOR Administrador (link normal), garante que tudo esteja visível
        document.getElementById('desk-tab-lancar')?.classList.remove('hidden');
        document.getElementById('mob-tab-lancar')?.classList.remove('hidden');
        document.getElementById('desk-tab-corretores')?.classList.remove('hidden');
        document.getElementById('mob-tab-corretores')?.classList.remove('hidden');
    }

    // 3. Registra os ouvintes de clique nas abas
    ['extrato', 'lancar', 'corretores'].forEach(t => {
        document.getElementById(`desk-tab-${t}`)?.addEventListener('click', () => switchTab(t));
        document.getElementById(`mob-tab-${t}`)?.addEventListener('click', () => switchTab(t));
    });

    // 4. Ocultar / Exibir Saldo
    document.getElementById('btn-toggle-eye')?.addEventListener('click', () => {
        isBalanceHidden = !isBalanceHidden;
        const eyeIcon = document.getElementById('eye-icon');
        const eyeText = document.getElementById('eye-text');
        
        if (eyeIcon) eyeIcon.className = isBalanceHidden ? 'fa-solid fa-eye-slash text-amber-400' : 'fa-solid fa-eye';
        if (eyeText) eyeText.innerText = isBalanceHidden ? 'Exibir' : 'Ocultar';
        
        calculateTotals();
        renderExtratoModule(transactionsState, isBalanceHidden, isReadOnly, loadDataAndRender);
    });

    // 5. Filtros da tela de Extrato
    ['filter-dia', 'filter-mes', 'filter-ano'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => renderExtratoModule(transactionsState, isBalanceHidden, isReadOnly, loadDataAndRender));
    });
    document.getElementById('search-input')?.addEventListener('input', () => renderExtratoModule(transactionsState, isBalanceHidden, isReadOnly, loadDataAndRender));
    
    document.getElementById('bottom-sheet-backdrop')?.addEventListener('click', closeBottomSheet);
    document.getElementById('btn-close-bs')?.addEventListener('click', closeBottomSheet);

    // 6. Inicializa os módulos
    setupLancarEvents(loadDataAndRender, getSaldoAtual);
    await initCorretoresModule();
    
    // Força o início na aba Extrato com os botões liberados
    switchTab('extrato');
});
