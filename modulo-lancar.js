import { saveTransactionDB, saveVendaDB, uploadFileDB } from './db.js';
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
        'Imposto DAS (Simples)',
        'Aluguel Virtual',
        'Contabilidade Digital',
        'CRECI Anuidade',
        'Marketing / Redes',
        'Outras Categorias'
    ]
};

const CATEGORIA_VENDA_CURY = 'Comissão Construtora (Cury)';

function formatBRL(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

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

    const valorInput = document.getElementById('in-valor');
    if (valorInput) {
        valorInput.readOnly = show;
        valorInput.classList.toggle('opacity-60', show);
        valorInput.classList.toggle('cursor-not-allowed', show);
    }

    if (show) recalcVendaValor();
}

function resetVendaCuryFields() {
    ['in-venda-corretor-id', 'in-venda-codigo-pv', 'in-venda-empreendimento', 'in-venda-unidade-torre', 'in-venda-vgv-total', 'in-venda-nfe', 'in-venda-pix-cury'].forEach(id => {
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

export function setupLancarEvents(onSuccessCallback, getSaldoAtualFn) {
    const btnEntrada = document.getElementById('btn-type-entrada');
    const btnSaida = document.getElementById('btn-type-saida');
    const selectCategoria = document.getElementById('in-categoria');
    const containerCorretor = document.getElementById('container-select-corretor');

    if (btnEntrada) btnEntrada.addEventListener('click', () => setMovementType('entrada'));
    if (btnSaida) btnSaida.addEventListener('click', () => setMovementType('saida'));
    
    if (selectCategoria) {
        selectCategoria.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'Repasse Corretor') {
                containerCorretor?.classList.remove('hidden');
            } else {
                containerCorretor?.classList.add('hidden');
            }
            toggleVendaCuryFields(val === CATEGORIA_VENDA_CURY);
        });
    }

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
                if (dados.vgvTotal) {
                    document.getElementById('in-venda-vgv-total').value = dados.vgvTotal.toFixed(2);
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

            let valor = parseFloat(document.getElementById('in-valor').value);
            const corretor_id = categoria === 'Repasse Corretor' ? document.getElementById('in-corretor-id').value : null;

            // --- Coleta e validação dos dados da venda (somente para Comissão Cury) ---
            let vendaPayload = null;
            let nfeFile = null;
            let pixFile = null;

            if (isVendaCury) {
                const vendaCorretorId = document.getElementById('in-venda-corretor-id').value;
                const codigoPv = document.getElementById('in-venda-codigo-pv').value.trim();
                const empreendimento = document.getElementById('in-venda-empreendimento').value.trim();
                const unidadeTorre = document.getElementById('in-venda-unidade-torre').value.trim();
                const vgvTotal = parseFloat(document.getElementById('in-venda-vgv-total').value);
                const pctComissao = parseFloat(document.getElementById('in-venda-pct-comissao').value) || 0;
                const pctImposto = parseFloat(document.getElementById('in-venda-pct-imposto-das').value);
                const pctRepasse = parseFloat(document.getElementById('in-venda-pct-repasse').value);
                nfeFile = document.getElementById('in-venda-nfe').files?.[0] || null;
                pixFile = document.getElementById('in-venda-pix-cury').files?.[0] || null;

                if (!vendaCorretorId || !codigoPv || !empreendimento || !unidadeTorre || isNaN(vgvTotal) || vgvTotal <= 0) {
                    alert("Preencha todos os dados da venda: corretor, código PV, empreendimento, unidade/torre e VGV.");
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
                    empreendimento,
                    unidade_torre: unidadeTorre,
                    vgv_total: vgvTotal,
                    pct_comissao_bruta: pctComissao,
                    pct_imposto_das: isNaN(pctImposto) ? null : pctImposto,
                    pct_repasse_corretor: isNaN(pctRepasse) ? null : pctRepasse
                };
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

            if (categoria === 'Repasse Corretor' && !corretor_id) {
                alert("Por favor, selecione qual Corretor receberá este repasse.");
                return;
            }

            btnSave.disabled = true;
            const originalLabel = btnSave.innerHTML;

            // --- Envio dos anexos (Nota Fiscal + PIX da venda, ou comprovante genérico) ---
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

            let comprovantesGenericos;
            if (!isVendaCury) {
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

            const payload = {
                tipo,
                data,
                valor,
                categoria,
                descricao: categoria,
                corretor_id: isVendaCury ? (vendaPayload?.corretor_id || null) : corretor_id
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
    const containerCorretor = document.getElementById('container-select-corretor');

    if (tipo === 'entrada') {
        if (btnEntrada) btnEntrada.className = "py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-positive/20 text-positive border border-positive/40";
        if (btnSaida) btnSaida.className = "py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-darkbg text-textsecondary border border-cardborder";
        if (containerCorretor) containerCorretor.classList.add('hidden');
    } else {
        if (btnSaida) btnSaida.className = "py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-negative/20 text-negative border border-negative/40";
        if (btnEntrada) btnEntrada.className = "py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-darkbg text-textsecondary border border-cardborder";
    }

    if (select) {
        select.innerHTML = '';
        CATEGORIAS[tipo].forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; 
            opt.innerText = c;
            select.appendChild(opt);
        });
    }

    if (tipo === 'saida' && select && select.value === 'Repasse Corretor') {
        if (containerCorretor) containerCorretor.classList.remove('hidden');
    }

    toggleVendaCuryFields(tipo === 'entrada' && select && select.value === CATEGORIA_VENDA_CURY);
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
    setMovementType('entrada');
}
