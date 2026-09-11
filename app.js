// App Central - 2B Imobiliária
// Controle de Permissões, OCR de NFS-e, Gráficos Analytics e Gestão de Arquivos

const IS_SOCIO_VIEW = new URLSearchParams(window.location.search).get('view') === '1';

// Estado Local / Cache
let corretoresState = [
    { id: 'c1', nome: 'Guilherme de Souza Santos', cpf: '345.678.901-00', creci: '254120-F', telefone: '(11) 98888-7777', chave_pix: 'guilherme@pix.com' }
];

let vendasState = [];
let transactionsState = [];

let chartEvolucao = null;
let chartCorretores = null;

function formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

// 1. Inicialização e Permissões de Usuário
window.onload = function() {
    setupUserPermissions();
    populateCorretoresDropdown();
    renderCorretoresTable();
    initCharts();
    switchTab('stats');
};

function setupUserPermissions() {
    if (IS_SOCIO_VIEW) {
        document.getElementById('badge-user-mode').innerHTML = '<i class="fa-solid fa-eye mr-1"></i> Modo Sócio (Visualizador)';
        document.getElementById('badge-user-mode').className = 'text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30';
        
        // Esconde botões operacionais exclusivos do Admin
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    }
}

// 2. Navegação por Abas
function switchTab(tabId) {
    ['stats', 'extrato', 'esteira', 'corretores', 'recibo'].forEach(t => {
        const view = document.getElementById(`view-${t}`);
        if (view) view.classList.add('hidden');
        
        const btnMob = document.getElementById(`mob-tab-${t}`);
        if (btnMob) btnMob.className = 'flex flex-col items-center text-slate-400';
    });

    const activeView = document.getElementById(`view-${tabId}`);
    if (activeView) activeView.classList.remove('hidden');

    const activeBtnMob = document.getElementById(`mob-tab-${tabId}`);
    if (activeBtnMob) activeBtnMob.className = 'flex flex-col items-center text-brand-500 font-bold';

    if (tabId === 'stats') updateStatsView();
    if (tabId === 'extrato') renderExtrato();
}

// 3. Leitor OCR / Parser da NFS-e (Prefeitura de SP / Cury)
function handleNFeUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Simulação de leitura OCR refinada com base na estrutura real da NFS-e da Prefeitura de SP
    const reader = new FileReader();
    reader.onload = function() {
        // Leitura simulada com mapeamento dos dados da Nota NF-00000001
        document.getElementById('form-nfe').value = '00000001';
        document.getElementById('form-pv').value = 'PV-395473';
        document.getElementById('form-emp').value = 'Bosque da Barra';
        document.getElementById('form-unidade').value = 'Apto 2101 - Torre B';
        document.getElementById('form-bruto').value = 9096.93;
        
        calculateForm();
        alert('NFS-e lida com sucesso! Dados preenchidos.');
    };
    reader.readAsDataURL(file);
}

function calculateForm() {
    const bruto = parseFloat(document.getElementById('form-bruto').value) || 0;
    const pctBruta = parseFloat(document.getElementById('form-pct-bruta').value) || 3.65;
    
    // Cálculo inverso para extrair o VGV Total
    const vgvCalculado = pctBruta > 0 ? (bruto / (pctBruta / 100)) : 0;
    document.getElementById('form-vgv').value = vgvCalculado.toFixed(2);
}

// 4. Módulo de Transações e Extrato com Botão "Ver Arquivos"
function renderExtrato() {
    const container = document.getElementById('extrato-list-container');
    const search = document.getElementById('extrato-search').value.toLowerCase();
    container.innerHTML = '';

    let totalEntradas = 0;
    let totalSaidas = 0;

    const dummyTransactions = [
        {
            id: 't1',
            tipo: 'entrada',
            descricao: 'Comissão Cury - Bosque da Barra Apto 2101',
            valor: 9096.93,
            data: '2026-08-20',
            ref_code: 'NF-00000001 / PV-395473',
            comprovantes: [
                { nome: 'PDF Nota Fiscal NFS-e', url: '#' },
                { nome: 'Comprovante Pix Cury', url: '#' }
            ]
        },
        {
            id: 't2',
            tipo: 'saida',
            descricao: 'Repasse Corretor - Guilherme Santos',
            valor: 6480.00,
            data: '2026-08-21',
            ref_code: 'PV-395473',
            comprovantes: [
                { nome: 'Contrato Assinado Gov.br', url: '#' },
                { nome: 'Comprovante Pix Repasse', url: '#' }
            ]
        }
    ];

    dummyTransactions.forEach(t => {
        if (t.tipo === 'entrada') totalEntradas += t.valor;
        if (t.tipo === 'saida') totalSaidas += t.valor;

        const isEntrada = t.tipo === 'entrada';
        const row = document.createElement('div');
        row.className = 'p-3 flex items-center justify-between hover:bg-slate-800/40 transition';
        row.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-8 h-8 rounded-full flex items-center justify-center ${isEntrada ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
                    <i class="fa-solid ${isEntrada ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs"></i>
                </div>
                <div>
                    <h4 class="text-xs font-bold text-white">${t.descricao}</h4>
                    <span class="text-[10px] text-slate-400">${t.data} • Ref: ${t.ref_code}</span>
                </div>
            </div>
            <div class="text-right flex items-center gap-3">
                <div>
                    <span class="text-xs font-black ${isEntrada ? 'text-emerald-400' : 'text-slate-200'}">${isEntrada ? '+' : '-'} ${formatBRL(t.valor)}</span>
                </div>
                <button onclick="openFilesModal('${t.id}')" class="bg-slate-800 hover:bg-slate-700 text-brand-500 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1">
                    <i class="fa-solid fa-paperclip"></i> Ver Arquivos
                </button>
            </div>
        `;
        container.appendChild(row);
    });

    document.getElementById('extrato-total-entradas').innerText = formatBRL(totalEntradas);
    document.getElementById('extrato-total-saidas').innerText = formatBRL(totalSaidas);
    document.getElementById('extrato-saldo-liquido').innerText = formatBRL(totalEntradas - totalSaidas);
}

function openFilesModal(transId) {
    const container = document.getElementById('files-container');
    container.innerHTML = `
        <div class="p-2 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center">
            <span class="text-xs text-slate-300"><i class="fa-solid fa-file-pdf text-rose-400 mr-2"></i>NFS-e 00000001 (Prefeitura SP).pdf</span>
            <a href="#" class="text-brand-500 text-xs hover:underline font-bold"><i class="fa-solid fa-download"></i> Baixar</a>
        </div>
        <div class="p-2 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center">
            <span class="text-xs text-slate-300"><i class="fa-solid fa-file-contract text-blue-400 mr-2"></i>Contrato_Govbr_Assinado.pdf</span>
            <a href="#" class="text-brand-500 text-xs hover:underline font-bold"><i class="fa-solid fa-download"></i> Baixar</a>
        </div>
    `;
    document.getElementById('modal-files').classList.remove('hidden');
}

function closeFilesModal() {
    document.getElementById('modal-files').classList.add('hidden');
}

// 5. Módulo de Corretores Parceiros
function populateCorretoresDropdown() {
    const select = document.getElementById('form-corretor-id');
    if (!select) return;
    select.innerHTML = '';
    corretoresState.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.nome} (CRECI ${c.creci})</option>`;
    });
}

function renderCorretoresTable() {
    const tbody = document.getElementById('tb-corretores-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    corretoresState.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/30';
        tr.innerHTML = `
            <td class="p-3 font-medium text-white">${c.nome}</td>
            <td class="p-3 text-slate-400">${c.creci}</td>
            <td class="p-3 text-slate-400">${c.telefone}</td>
            <td class="p-3 font-mono text-amber-400">${c.chave_pix}</td>
            <td class="p-3 text-center admin-only">
                <button onclick="deleteCorretor('${c.id}')" class="text-rose-400 hover:text-rose-300"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openCorretorModal() {
    document.getElementById('modal-corretor').classList.remove('hidden');
}

function closeCorretorModal() {
    document.getElementById('modal-corretor').classList.add('hidden');
}

function saveCorretor() {
    const nome = document.getElementById('corretor-form-nome').value;
    const creci = document.getElementById('corretor-form-creci').value;
    const tel = document.getElementById('corretor-form-tel').value;
    const pix = document.getElementById('corretor-form-pix').value;

    if (!nome) return alert('Digite o nome do corretor');

    corretoresState.push({ id: 'c_' + Date.now(), nome, creci, telefone: tel, chave_pix: pix });
    populateCorretoresDropdown();
    renderCorretoresTable();
    closeCorretorModal();
}

// 6. Painel de Estatísticas & Gráficos
function initCharts() {
    const ctx1 = document.getElementById('chartEvolucaoVendas').getContext('2d');
    chartEvolucao = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: ['Mai', 'Jun', 'Jul', 'Ago', 'Set'],
            datasets: [{
                label: 'VGV (R$)',
                data: [180000, 220000, 310000, 249230, 410000],
                borderColor: '#d4af37',
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const ctx2 = document.getElementById('chartVendasCorretores').getContext('2d');
    chartCorretores = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['Guilherme Santos', 'Corretor Parceiro 2', 'Corretor Parceiro 3'],
            datasets: [{
                label: 'Quantidade de Vendas',
                data: [5, 3, 2],
                backgroundColor: '#3b82f6'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updateStatsView() {
    document.getElementById('stat-count-month').innerText = '4';
    document.getElementById('stat-vgv-total').innerText = formatBRL(980000);
    document.getElementById('stat-comissao-bruta').innerText = formatBRL(35770);
    document.getElementById('stat-reserva-das').innerText = formatBRL(3577);
}
