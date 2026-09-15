import { fetchTransacoesParaEstatisticas } from './db.js';

const CATEGORIA_CURY = 'Comissão Construtora (Cury)';
const CATEGORIA_REPASSE = 'Repasse Corretor';
const CHARTJS_VERSION = '4.4.1';

let todasTransacoes = null; // cache — recarregado toda vez que a aba é aberta
let periodoAtual = '3';
let chartInstance = null;
let chartjsPromise = null;

function formatBRL(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function loadChartJs() {
    if (window.Chart) return Promise.resolve(window.Chart);
    if (chartjsPromise) return chartjsPromise;

    chartjsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/${CHARTJS_VERSION}/chart.umd.min.js`;
        script.onload = () => resolve(window.Chart);
        script.onerror = () => reject(new Error('Não foi possível carregar a biblioteca de gráficos.'));
        document.head.appendChild(script);
    });
    return chartjsPromise;
}

// Corta a data (yyyy-mm-dd) de acordo com o período escolhido nos botões.
function filtrarPorPeriodo(transacoes, periodo) {
    if (periodo === 'tudo') return transacoes;

    const hoje = new Date();
    let dataLimite;

    if (periodo === 'mes') {
        dataLimite = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    } else {
        const meses = parseInt(periodo, 10);
        dataLimite = new Date(hoje.getFullYear(), hoje.getMonth() - meses + 1, 1);
    }
    const dataLimiteStr = dataLimite.toISOString().split('T')[0];
    return transacoes.filter(t => t.data >= dataLimiteStr);
}

function calcularCards(transacoesPeriodo) {
    let vgvTotal = 0, comissaoBruta = 0, repassado = 0, despesas = 0, qtdVendas = 0;

    transacoesPeriodo.forEach(t => {
        const valor = Number(t.valor) || 0;
        if (t.tipo === 'entrada' && t.categoria === CATEGORIA_CURY) {
            comissaoBruta += valor;
            qtdVendas += 1;
            if (t.vendas?.vgv_total) vgvTotal += Number(t.vendas.vgv_total);
        } else if (t.tipo === 'saida' && t.categoria === CATEGORIA_REPASSE) {
            repassado += valor;
        } else if (t.tipo === 'saida') {
            despesas += valor;
        }
    });

    const lucroLiquido = comissaoBruta - repassado - despesas;
    return { vgvTotal, comissaoBruta, repassado, despesas, lucroLiquido, qtdVendas };
}

function calcularRankingEmpreendimentos(transacoesPeriodo) {
    const porEmpreendimento = {};
    transacoesPeriodo.forEach(t => {
        if (t.tipo === 'entrada' && t.categoria === CATEGORIA_CURY && t.vendas?.empreendimento) {
            const nome = t.vendas.empreendimento;
            if (!porEmpreendimento[nome]) porEmpreendimento[nome] = { vgv: 0, qtd: 0 };
            porEmpreendimento[nome].vgv += Number(t.vendas.vgv_total) || 0;
            porEmpreendimento[nome].qtd += 1;
        }
    });

    return Object.entries(porEmpreendimento)
        .map(([nome, dados]) => ({ nome, ...dados }))
        .sort((a, b) => b.vgv - a.vgv)
        .slice(0, 8);
}

// Últimos 12 meses (fixo, independente do filtro de período dos cards), pra dar
// uma visão de tendência consistente sempre que a aba é aberta.
function calcularEvolucaoMensal(todasTransacoes) {
    const hoje = new Date();
    const meses = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        meses.push({ ano: d.getFullYear(), mes: d.getMonth(), label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) });
    }

    const porMes = meses.map(m => ({ ...m, vgv: 0, comissao: 0, repasse: 0, despesas: 0 }));

    todasTransacoes.forEach(t => {
        const [ano, mes] = t.data.split('-').map(Number);
        const idx = porMes.findIndex(m => m.ano === ano && (m.mes + 1) === mes);
        if (idx === -1) return;

        const valor = Number(t.valor) || 0;
        if (t.tipo === 'entrada' && t.categoria === CATEGORIA_CURY) {
            porMes[idx].comissao += valor;
            if (t.vendas?.vgv_total) porMes[idx].vgv += Number(t.vendas.vgv_total);
        } else if (t.tipo === 'saida' && t.categoria === CATEGORIA_REPASSE) {
            porMes[idx].repasse += valor;
        } else if (t.tipo === 'saida') {
            porMes[idx].despesas += valor;
        }
    });

    return porMes.map(m => ({ ...m, lucro: m.comissao - m.repasse - m.despesas }));
}

function renderCards(cards) {
    document.getElementById('stat-vgv-total').innerText = formatBRL(cards.vgvTotal);
    document.getElementById('stat-comissao-bruta').innerText = formatBRL(cards.comissaoBruta);
    document.getElementById('stat-repassado').innerText = formatBRL(cards.repassado);
    document.getElementById('stat-despesas').innerText = formatBRL(cards.despesas);
    document.getElementById('stat-lucro-liquido').innerText = formatBRL(cards.lucroLiquido);
    document.getElementById('stat-qtd-vendas').innerText = String(cards.qtdVendas);
}

function renderRanking(ranking) {
    const container = document.getElementById('ranking-empreendimentos-container');
    if (!container) return;

    if (ranking.length === 0) {
        container.innerHTML = `<div class="text-center text-xs text-textsecondary py-4">Nenhuma venda no período selecionado.</div>`;
        return;
    }

    const maiorVgv = ranking[0].vgv || 1;
    container.innerHTML = ranking.map(r => `
        <div class="space-y-1">
            <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-white">${r.nome}</span>
                <span class="text-textsecondary">${formatBRL(r.vgv)} · ${r.qtd} venda${r.qtd > 1 ? 's' : ''}</span>
            </div>
            <div class="h-1.5 bg-darkbg rounded-full overflow-hidden">
                <div class="h-full bg-brand-500" style="width: ${(r.vgv / maiorVgv) * 100}%"></div>
            </div>
        </div>
    `).join('');
}

async function renderChart(evolucaoMensal) {
    const canvas = document.getElementById('chart-evolucao-mensal');
    if (!canvas) return;

    let Chart;
    try {
        Chart = await loadChartJs();
    } catch (err) {
        console.warn(err);
        return;
    }

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    chartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: evolucaoMensal.map(m => m.label),
            datasets: [
                { label: 'VGV', data: evolucaoMensal.map(m => m.vgv), borderColor: '#D4AF37', backgroundColor: 'transparent', tension: 0.3 },
                { label: 'Comissão Bruta', data: evolucaoMensal.map(m => m.comissao), borderColor: '#3FB950', backgroundColor: 'transparent', tension: 0.3 },
                { label: 'Repasse Pago', data: evolucaoMensal.map(m => m.repasse), borderColor: '#F0883E', backgroundColor: 'transparent', tension: 0.3 },
                { label: 'Lucro Líquido', data: evolucaoMensal.map(m => m.lucro), borderColor: '#F0F6FC', backgroundColor: 'transparent', tension: 0.3, borderDash: [4, 3] }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { ticks: { color: '#8B949E', font: { size: 10 } }, grid: { color: 'rgba(139,148,158,0.1)' } },
                y: { ticks: { color: '#8B949E', font: { size: 10 }, callback: (v) => formatBRL(v) }, grid: { color: 'rgba(139,148,158,0.1)' } }
            },
            plugins: {
                legend: { labels: { color: '#F0F6FC', font: { size: 10 }, boxWidth: 12 } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatBRL(ctx.parsed.y)}` } }
            }
        }
    });
}

function setPeriodoAtivoUI(periodo) {
    document.querySelectorAll('.periodo-btn').forEach(btn => {
        const ativo = btn.dataset.periodo === periodo;
        btn.classList.toggle('pill-active', ativo);
    });
}

async function renderTudo() {
    if (!todasTransacoes) {
        todasTransacoes = await fetchTransacoesParaEstatisticas();
    }

    const transacoesPeriodo = filtrarPorPeriodo(todasTransacoes, periodoAtual);
    renderCards(calcularCards(transacoesPeriodo));
    renderRanking(calcularRankingEmpreendimentos(transacoesPeriodo));
    await renderChart(calcularEvolucaoMensal(todasTransacoes));
}

/**
 * Inicializa a aba de Estatísticas: liga os botões de período e faz a
 * primeira carga. Deve ser chamado uma vez, no DOMContentLoaded.
 */
export function setupEstatisticasEvents() {
    document.querySelectorAll('.periodo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            periodoAtual = btn.dataset.periodo;
            setPeriodoAtivoUI(periodoAtual);
            const transacoesPeriodo = filtrarPorPeriodo(todasTransacoes || [], periodoAtual);
            renderCards(calcularCards(transacoesPeriodo));
            renderRanking(calcularRankingEmpreendimentos(transacoesPeriodo));
        });
    });
    setPeriodoAtivoUI(periodoAtual);
}

/**
 * Chamado toda vez que a aba de Estatísticas é aberta — recarrega os dados
 * do banco (pra refletir lançamentos novos) e redesenha tudo.
 */
export async function loadEstatisticas() {
    todasTransacoes = null; // força recarregar do banco
    await renderTudo();
}
