import { saveTransactionDB, saveVendaDB, uploadFileDB, fetchVendasPendentesRepasse, updateVendaDB } from './db.js';
import { tentarExtrairDadosDaNota } from './modulo-nfe-reader.js';

export const CATEGORIAS = {
    entrada: [
        'Comissão Construtora (Cury)',
        'Bônus de Entrada',
        'Devolução / Reembolso',
        'Outras Categorias'
    ],
    saida: [
        'Repasse Corretor',
        'PAGA NOIS',
        'Imposto DAS (Simples)',
        'Impostos',
        'Contabilidade Digital',
        'Custos Operacionais',
        'Marketing',
        'Leads'
    ]
};

const CATEGORIA_VENDA_CURY = 'Comissão Construtora (Cury)';
const CATEGORIA_REPASSE = 'Repasse Corretor';
const STATUS_REPASSE_CONCLUIDO = 'repasse_concluido';

// Cache da última busca de vendas pendentes de repasse, e a venda selecionada
// no momento (usada tanto pra exibir o resumo quanto na hora de salvar).
let vendasPendentesCache = [];
let vendaRepasseSelecionada = null;

function formatBRL(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function toggleValorReadonly(readonly) {
    const valorInput = document.getElementById('in-valor');
    if (!valorInput) return;
    valorInput.readOnly = readonly;
    valorInput.classList.toggle('opacity-60', readonly);
    valorInput.classList.toggle('cursor-not-allowed', readonly);
}

// ---------- Comissão Cury (entrada) ----------

// Recalcula o valor da comissão (VGV × % comissão bruta) e reflete tanto no
// campo "Valor" do lançamento quanto no texto informativo do bloco da venda.
function recalcVendaValor() {
    const vgv = parseFloat(document.getElementById('in-venda-vgv-total')?.value) || 0;
    const pct = parseFloat(document.getElementById('in-venda-pct-comissao')?.value) || 0;
    const valor = vgv * (pct / 100);

    const valorInput = document.getElementById('in-valor');
    if (valorInput) valorInput.value = valor > 0 ? valor.toFixed(2) : '';

    const display = document.getElementById('in-venda-valor-calculado');
    if (display) display.innerText = formatBRL(valor);
}

// Mostra/esconde o bloco de dados da venda Cury e trava o campo "Valor"
// (que passa a ser calculado, não digitado) quando essa categoria está ativa.
function toggleVendaCuryFields(show) {
    document.getElementById('container-venda-cury')?.classList.toggle('hidden', !show);
    document.getElementById('container-comprovante-generico')?.classList.toggle('hidden', show);
    if (show) toggleValorReadonly(true);
    if (show) recalcVendaValor();
}

function resetVendaCuryFields() {
    ['in-venda-corretor-id', 'in-venda-codigo-pv', 'in-venda-numero-nfe', 'in-venda-empreendimento', 'in-venda-unidade-torre', 'in-venda-vgv-total', 'in-venda-nfe', 'in-venda-pix-cury'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const pctComissaoEl = document.getElementById('in-venda-pct-comissao');
    if (pctComissaoEl) pctComissaoEl.value = '3.65';
    const pctImpostoEl = document.getElementById('in-venda-pct-imposto-das');
    if (pctImpostoEl) pctImpostoEl.value = '10.00';
    const pctRepasseEl = document.getElementById('in-venda-pct-repasse');
    if (pctRepasseEl) pctRepasseEl.value = '2.60';
    const display = document.getElementById('in-venda-valor-calculado');
    if (display) display.innerText = 'R$ 0,00';
    const statusEl = document.getElementById('in-venda-nfe-status');
    if (statusEl) statusEl.innerText = '';
}

// ---------- Repasse ao Corretor (saída), vinculado a uma venda ----------

async function popularVendasPendentesRepasse() {
    const select = document.getElementById('in-repasse-venda-id');
    if (!select) return;
    select.innerHTML = '<option value="">Carregando vendas pendentes...</option>';
    vendasPendentesCache = await fetchVendasPendentesRepasse();

    if (vendasPendentesCache.length === 0) {
        select.innerHTML = '<option value="">Nenhuma venda pendente de repasse</option>';
        return;
    }
    select.innerHTML = '<option value="">Selecione a venda...</option>';
    vendasPendentesCache.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        const nomeCorretor = v.corretores?.nome || 'Corretor não identificado';
        opt.innerText = `${v.empreendimento} - ${v.unidade_torre} (${nomeCorretor})`;
        select.appendChild(opt);
    });
}

function onVendaRepasseSelecionada() {
    const select = document.getElementById('in-repasse-venda-id');
    const resumo = document.getElementById('repasse-venda-resumo');
    const valorInput = document.getElementById('in-valor');
    const id = select?.value;
    vendaRepasseSelecionada = vendasPendentesCache.find(v => v.id === id) || null;

    if (!vendaRepasseSelecionada) {
        if (resumo) resumo.classList.add('hidden');
        if (valorInput) valorInput.value = '';
        return;
    }

    const pct = Number(vendaRepasseSelecionada.pct_repasse_corretor) || 0;
    const valor = Number(vendaRepasseSelecionada.vgv_total) * (pct / 100);
    if (valorInput) valorInput.value = valor > 0 ? valor.toFixed(2) : '';

    if (resumo) {
        resumo.classList.remove('hidden');
        resumo.innerText = `VGV: ${formatBRL(vendaRepasseSelecionada.vgv_total)} × ${pct}% de repasse = ${formatBRL(valor)}`;
    }
}

// Alterna entre "repasse vinculado a uma venda" (padrão) e "repasse avulso"
// (comportamento antigo: escolhe só o corretor, valor digitado manualmente).
function toggleRepasseAvulso(avulso) {
    document.getElementById('container-repasse-venda')?.classList.toggle('hidden', avulso);
    document.getElementById('container-repasse-avulso')?.classList.toggle('hidden', !avulso);
    toggleValorReadonly(!avulso);

    if (avulso) {
        vendaRepasseSelecionada = null;
        const valorInput = document.getElementById('in-valor');
        if (valorInput) valorInput.value = '';
        const resumo = document.getElementById('repasse-venda-resumo');
        if (resumo) resumo.classList.add('hidden');
    }
}

function resetRepasseFields() {
    const chk = document.getElementById('chk-repasse-avulso');
    if (chk) chk.checked = false;
    const selectVenda = document.getElementById('in-repasse-venda-id');
    if (selectVenda) selectVenda.innerHTML = '';
    const resumo = document.getElementById('repasse-venda-resumo');
    if (resumo) { resumo.classList.add('hidden'); resumo.innerText = ''; }
    ['in-repasse-contrato-govbr', 'in-repasse-pix-corretor', 'in-corretor-id'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    vendaRepasseSelecionada = null;
    toggleRepasseAvulso(false);
}

// ---------- Setup geral ----------

export function setupLancarEvents(onSuccessCallback, getSaldoAtualFn) {
    const btnEntrada = document.getElementById('btn-type-entrada');
    const btnSaida = document.getElementById('btn-type-saida');
    const selectCategoria = document.getElementById('in-categoria');
    const containerRepasse = document.getElementById('container-select-corretor');

    if (btnEntrada) btnEntrada.addEventListener('click', () => setMovementType('entrada'));
    if (btnSaida) btnSaida.addEventListener('click', () => setMovementType('saida'));

    if (selectCategoria) {
        selectCategoria.addEventListener('change', async (e) => {
            const val = e.target.value;
            const isRepasse = val === CATEGORIA_REPASSE;

            containerRepasse?.classList.toggle('hidden', !isRepasse);
            if (isRepasse) {
                const avulso = document.getElementById('chk-repasse-avulso')?.checked;
                toggleRepasseAvulso(!!avulso);
                if (!avulso) await popularVendasPendentesRepasse();
            } else {
                toggleValorReadonly(false);
            }

            toggleVendaCuryFields(val === CATEGORIA_VENDA_CURY);
        });
    }

    document.getElementById('chk-repasse-avulso')?.addEventListener('change', async (e) => {
        const avulso = e.target.checked;
        toggleRepasseAvulso(avulso);
        if (!avulso) await popularVendasPendentesRepasse();
    });

    document.getElementById('in-repasse-venda-id')?.addEventListener('change', onVendaRepasseSelecionada);

    // Recalcula o valor da comissão sempre que o VGV ou o % mudarem
    ['in-venda-vgv-total', 'in-venda-pct-comissao'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', recalcVendaValor);
    });

    // Ao anexar a Nota Fiscal, tenta ler o PDF e pré-preencher empreendimento/unidade/VGV
    document.getElementById('in-venda-nfe')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        const statusEl = document.getElementById('in-venda-nfe-status');
        if (!file) return;

        if (statusEl) {
            statusEl.className = 'text-[10px] mt-1 text-textsecondary';
            statusEl.innerText = 'Lendo a nota fiscal...';
        }

        try {
            const dados = await tentarExtrairDadosDaNota(file);
            if (dados) {
                if (dados.empreendimento) document.getElementById('in-venda-empreendimento').value = dados.empreendimento;
                if (dados.unidadeTorre) document.getElementById('in-venda-unidade-torre').value = dados.unidadeTorre;
                if (dados.numeroNfe) document.getElementById('in-venda-numero-nfe').value = dados.numeroNfe;
                if (dados.valorNotaFiscal) {
                    // O valor da nota é a comissão (ex. 3,65% do VGV) — calcula o VGV de trás pra frente
                    const pctAtual = parseFloat(document.getElementById('in-venda-pct-comissao')?.value) || 3.65;
                    const vgvCalculado = dados.valorNotaFiscal / (pctAtual / 100);
                    document.getElementById('in-venda-vgv-total').value = vgvCalculado.toFixed(2);
                    recalcVendaValor();
                }
                if (statusEl) {
                    statusEl.className = 'text-[10px] mt-1 text-positive font-semibold';
                    statusEl.innerText = '✓ Dados extraídos da nota — confira antes de salvar.';
                }
            } else if (statusEl) {
                statusEl.className = 'text-[10px] mt-1 text-textsecondary';
                statusEl.innerText = 'Não consegui identificar os dados dessa nota automaticamente; preencha manualmente.';
            }
        } catch (err) {
            console.warn('Falha ao ler PDF da nota fiscal:', err);
            if (statusEl) {
                statusEl.className = 'text-[10px] mt-1 text-textsecondary';
                statusEl.innerText = 'Não consegui ler o PDF automaticamente; preencha os dados manualmente.';
            }
        }
    });

    const btnSave = document.getElementById('btn-save-tx');
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const id = document.getElementById('in-id').value;
            const tipo = document.getElementById('in-tipo').value;
            const data = document.getElementById('in-data').value;
            const categoria = selectCategoria.value;
            const isVendaCury = categoria === CATEGORIA_VENDA_CURY;
            const isRepasse = categoria === CATEGORIA_REPASSE;
            const repasseAvulso = isRepasse && !!document.getElementById('chk-repasse-avulso')?.checked;
            const repasseVinculado = isRepasse && !repasseAvulso;

            if (!categoria) {
                alert("Selecione uma categoria.");
                return;
            }

            let valor = parseFloat(document.getElementById('in-valor').value);
            let corretor_id = repasseAvulso ? document.getElementById('in-corretor-id').value : null;

            // --- Coleta e validação dos dados da venda (somente para Comissão Cury) ---
            let vendaPayload = null;
            let nfeFile = null;
            let pixFile = null;

            if (isVendaCury) {
                const vendaCorretorId = document.getElementById('in-venda-corretor-id').value;
                const codigoPv = document.getElementById('in-venda-codigo-pv').value.trim();
                const numeroNfe = document.getElementById('in-venda-numero-nfe').value.trim();
                const empreendimento = document.getElementById('in-venda-empreendimento').value.trim();
                const unidadeTorre = document.getElementById('in-venda-unidade-torre').value.trim();
                const vgvTotal = parseFloat(document.getElementById('in-venda-vgv-total').value);
                const pctComissao = parseFloat(document.getElementById('in-venda-pct-comissao').value) || 0;
                const pctImposto = parseFloat(document.getElementById('in-venda-pct-imposto-das').value);
                const pctRepasse = parseFloat(document.getElementById('in-venda-pct-repasse').value);
                nfeFile = document.getElementById('in-venda-nfe').files?.[0] || null;
                pixFile = document.getElementById('in-venda-pix-cury').files?.[0] || null;

                if (!vendaCorretorId || !codigoPv || !numeroNfe || !empreendimento || !unidadeTorre || isNaN(vgvTotal) || vgvTotal <= 0) {
                    alert("Preencha todos os dados da venda: corretor, código PV, número da nota, empreendimento, unidade/torre e VGV.");
                    return;
                }
                if (!id && (!nfeFile || !pixFile)) {
                    alert("Anexe a Nota Fiscal enviada à Cury e o comprovante PIX para lançar esta venda.");
                    return;
                }

                valor = vgvTotal * (pctComissao / 100);

                vendaPayload = {
                    corretor_id: vendaCorretorId,
                    codigo_pv: codigoPv,
                    numero_nfe: numeroNfe,
                    empreendimento,
                    unidade_torre: unidadeTorre,
                    vgv_total: vgvTotal,
                    pct_comissao_bruta: pctComissao,
                    pct_imposto_das: isNaN(pctImposto) ? null : pctImposto,
                    pct_repasse_corretor: isNaN(pctRepasse) ? null : pctRepasse
                };
            }

            // --- Coleta e validação do repasse vinculado a uma venda ---
            let repasseContratoFile = null;
            let repassePixFile = null;
            if (repasseVinculado) {
                if (!vendaRepasseSelecionada) {
                    alert("Selecione a venda que está sendo repassada.");
                    return;
                }
                repasseContratoFile = document.getElementById('in-repasse-contrato-govbr').files?.[0] || null;
                repassePixFile = document.getElementById('in-repasse-pix-corretor').files?.[0] || null;
                if (!id && (!repasseContratoFile || !repassePixFile)) {
                    alert("Anexe o repasse assinado pelo GOV.br e o comprovante PIX do pagamento.");
                    return;
                }

                const pct = Number(vendaRepasseSelecionada.pct_repasse_corretor) || 0;
                valor = Number(vendaRepasseSelecionada.vgv_total) * (pct / 100);
                corretor_id = vendaRepasseSelecionada.corretor_id;
            }

            if (repasseAvulso && !corretor_id) {
                alert("Por favor, selecione qual Corretor receberá este repasse.");
                return;
            }

            if (!data || isNaN(valor) || valor <= 0) {
                alert("Por favor, preencha uma data válida e valor maior que zero.");
                return;
            }

            // Trava de Saldo Negativo
            if (tipo === 'saida') {
                const saldoDisponivel = getSaldoAtualFn();
                if (valor > saldoDisponivel && !id) {
                    alert("Operação Bloqueada: Saldo Insuficiente para realizar esta retirada!");
                    return;
                }
            }

            btnSave.disabled = true;
            const originalLabel = btnSave.innerHTML;

            // --- Envio dos anexos da venda Cury (Nota Fiscal + PIX) ---
            let vendaAnexos = {};
            if (isVendaCury && (nfeFile || pixFile)) {
                btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando documentos...';
                try {
                    if (nfeFile) vendaAnexos.url_pdf_nfe = (await uploadFileDB(nfeFile)).url;
                    if (pixFile) vendaAnexos.url_pix_cury = (await uploadFileDB(pixFile)).url;
                } catch (err) {
                    alert("Erro ao enviar documentos da venda: " + (err.message || JSON.stringify(err)));
                    btnSave.disabled = false;
                    btnSave.innerHTML = originalLabel;
                    return;
                }
            }

            // --- Envio dos anexos do repasse (contrato GOV.br + PIX) ---
            let repasseAnexos = {};
            if (repasseVinculado && (repasseContratoFile || repassePixFile)) {
                btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando documentos do repasse...';
                try {
                    if (repasseContratoFile) repasseAnexos.url_contrato_govbr = (await uploadFileDB(repasseContratoFile)).url;
                    if (repassePixFile) repasseAnexos.url_pix_corretor = (await uploadFileDB(repassePixFile)).url;
                } catch (err) {
                    alert("Erro ao enviar documentos do repasse: " + (err.message || JSON.stringify(err)));
                    btnSave.disabled = false;
                    btnSave.innerHTML = originalLabel;
                    return;
                }
            }

            // --- Comprovante genérico (qualquer categoria fora do fluxo de venda/repasse) ---
            let comprovantesGenericos;
            if (!isVendaCury && !repasseVinculado) {
                const fileInput = document.getElementById('in-comprovante');
                const file = fileInput?.files?.[0];
                if (file) {
                    btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando anexo...';
                    try {
                        comprovantesGenericos = [await uploadFileDB(file)];
                    } catch (err) {
                        alert("Erro ao enviar comprovante: " + (err.message || JSON.stringify(err)));
                        btnSave.disabled = false;
                        btnSave.innerHTML = originalLabel;
                        return;
                    }
                }
            }

            // --- Grava a venda primeiro (se houver) para poder linkar o venda_id no lançamento ---
            let vendaId = null;
            if (vendaPayload) {
                const { data: novaVenda, error: vendaError } = await saveVendaDB({ ...vendaPayload, ...vendaAnexos });
                if (vendaError) {
                    alert("Erro ao salvar dados da venda: " + vendaError.message);
                    btnSave.disabled = false;
                    btnSave.innerHTML = originalLabel;
                    return;
                }
                vendaId = novaVenda?.id || null;
            }

            // --- Atualiza a venda repassada com os documentos e o novo status ---
            if (repasseVinculado) {
                const { error: updateError } = await updateVendaDB(vendaRepasseSelecionada.id, {
                    ...repasseAnexos,
                    status_chamado: STATUS_REPASSE_CONCLUIDO
                });
                if (updateError) {
                    alert("Erro ao atualizar a venda com os dados do repasse: " + updateError.message);
                    btnSave.disabled = false;
                    btnSave.innerHTML = originalLabel;
                    return;
                }
                vendaId = vendaRepasseSelecionada.id;
            }

            const payload = {
                tipo,
                data,
                valor,
                categoria,
                descricao: categoria,
                corretor_id: (isVendaCury ? vendaPayload?.corretor_id : corretor_id) || null
            };
            if (id) payload.id = id;
            if (vendaId) payload.venda_id = vendaId;
            if (comprovantesGenericos) payload.comprovantes = comprovantesGenericos;

            const { error } = await saveTransactionDB(payload);
            btnSave.disabled = false;
            btnSave.innerHTML = originalLabel;

            if (error) {
                alert("Erro ao salvar lançamento: " + error.message);
            } else {
                resetForm();
                onSuccessCallback();
            }
        });
    }
}

export function setMovementType(tipo) {
    const inTipo = document.getElementById('in-tipo');
    if (inTipo) inTipo.value = tipo;

    const btnEntrada = document.getElementById('btn-type-entrada');
    const btnSaida = document.getElementById('btn-type-saida');
    const select = document.getElementById('in-categoria');
    const containerRepasse = document.getElementById('container-select-corretor');

    if (tipo === 'entrada') {
        if (btnEntrada) btnEntrada.className = "py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-positive/20 text-positive border border-positive/40";
        if (btnSaida) btnSaida.className = "py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-darkbg text-textsecondary border border-cardborder";
    } else {
        if (btnSaida) btnSaida.className = "py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-negative/20 text-negative border border-negative/40";
        if (btnEntrada) btnEntrada.className = "py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-darkbg text-textsecondary border border-cardborder";
    }

    // Categoria começa em branco — nenhum bloco extra (venda Cury, repasse) aparece
    // até o usuário escolher explicitamente uma categoria.
    if (select) {
        select.innerHTML = '<option value="" disabled selected>Selecione a categoria...</option>';
        CATEGORIAS[tipo].forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.innerText = c;
            select.appendChild(opt);
        });
    }

    containerRepasse?.classList.add('hidden');
    toggleVendaCuryFields(false);
    toggleValorReadonly(false);
}

export function resetForm() {
    const idEl = document.getElementById('in-id');
    const dataEl = document.getElementById('in-data');
    const valorEl = document.getElementById('in-valor');

    if (idEl) idEl.value = "";
    if (dataEl) dataEl.value = new Date().toISOString().split('T')[0];
    if (valorEl) valorEl.value = "";
    const comprovanteEl = document.getElementById('in-comprovante');
    if (comprovanteEl) comprovanteEl.value = "";
    resetVendaCuryFields();
    resetRepasseFields();
    setMovementType('entrada');
}
