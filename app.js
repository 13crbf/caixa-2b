const SUPABASE_URL = "https://rnswlektqerdhojlithx.supabase.co";
        const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuc3dsZWt0cWVyZGhvamxpdGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwODAxNTksImV4cCI6MjEwNDY1NjE1OX0.pDmnEQyu1HrM4g8jTn864bQG6k31vqHAPXogn-DOr5Q";
        
        let supabaseClient = null;
        try {
            if (window.supabase) {
                supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            }
        } catch(e) {}

        let currentMode = 'admin'; 
        let currentPassoFilter = 'all';

        let salesState = JSON.parse(localStorage.getItem('2b_sales')) || [
            { id: 'v_1', numero_nfe: '000102', codigo_pv: 'PV-395473', empreendimento: 'Cury Bosque Barra', unidade_torre: 'Torre B - Ap 2101', vgv_total: 249230.90, pct_comissao_bruta: 3.65, pct_imposto_das: 10.00, pct_repasse_corretor: 2.60, corretor_id: '1', status_passo: 'passo4', data_criacao: '2026-08-25' }
        ];
        let corretoresState = JSON.parse(localStorage.getItem('2b_corretores')) || [
            { id: '1', nome: 'Guilherme Silva', cpf: '123.456.789-00', creci: '245100-F', telefone: '(11) 98888-7777', chave_pix: '123.456.789-00' },
            { id: '2', nome: 'Mariana Oliveira', cpf: '987.654.321-11', creci: '198230-F', telefone: '(11) 97777-6666', chave_pix: 'mariana@pix.com' }
        ];
        let movimentacoesState = JSON.parse(localStorage.getItem('2b_movimentacoes')) || [];

        let chartFaturamentoObj = null;
        let chartSplitObj = null;

        window.addEventListener('DOMContentLoaded', () => {
            initApp();
        });

        async function initApp() {
            migrarIdsAntigos();
            renderTudo();
            initCharts();

            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('view') === '1') setAccessMode('viewer');

            await carregarDadosDoBanco();
        }

        function renderTudo() {
            renderCorretoresGrid();
            renderCorretoresDropdown();
            renderEsteiraCards();
            renderExtratoTable();
            populateExtratoDropdowns();
            updateAnalyticsDashboard();
        }

        // Corrige IDs antigos (não-UUID) que impediam a sincronização com o Supabase
        function ehUUID(v) {
            return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
        }

        function migrarIdsAntigos() {
            let mudou = false;
            corretoresState.forEach(c => {
                if (!ehUUID(c.id)) {
                    const novoId = crypto.randomUUID();
                    salesState.forEach(v => { if (v.corretor_id === c.id) v.corretor_id = novoId; });
                    c.id = novoId;
                    mudou = true;
                }
            });
            salesState.forEach(v => {
                if (!ehUUID(v.id)) { v.id = crypto.randomUUID(); mudou = true; }
            });
            movimentacoesState.forEach(m => {
                if (!ehUUID(m.id)) { m.id = crypto.randomUUID(); mudou = true; }
            });
            if (mudou) {
                localStorage.setItem('2b_corretores', JSON.stringify(corretoresState));
                localStorage.setItem('2b_sales', JSON.stringify(salesState));
                localStorage.setItem('2b_movimentacoes', JSON.stringify(movimentacoesState));
            }
        }

        function marcarStatusNuvem(ok) {
            const badge = document.getElementById('supabase-status-badge');
            if (!badge) return;
            if (ok) {
                badge.className = "hidden sm:flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] rounded-full";
                badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span><span>Nuvem Conectada</span>';
            } else {
                badge.className = "flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] rounded-full";
                badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span><span>Sem conexão — salvando só neste aparelho</span>';
            }
        }

        function vendaParaLinhaBanco(v) {
            return {
                id: v.id,
                corretor_id: v.corretor_id || null,
                numero_nfe: v.numero_nfe,
                codigo_pv: v.codigo_pv,
                empreendimento: v.empreendimento,
                unidade_torre: v.unidade_torre,
                vgv_total: v.vgv_total,
                pct_comissao_bruta: v.pct_comissao_bruta,
                pct_imposto_das: v.pct_imposto_das,
                pct_repasse_corretor: v.pct_repasse_corretor,
                status_chamado: v.status_passo,
                url_pdf_nfe: v.url_pdf_nfe || null,
                url_contrato_govbr: v.url_contrato_govbr || null,
                url_pix_cury: v.url_pix_cury || null,
                url_pix_corretor: v.url_pix_corretor || null
            };
        }

        function linhaBancoParaVenda(row) {
            return {
                id: row.id,
                corretor_id: row.corretor_id,
                numero_nfe: row.numero_nfe,
                codigo_pv: row.codigo_pv,
                empreendimento: row.empreendimento,
                unidade_torre: row.unidade_torre,
                vgv_total: parseFloat(row.vgv_total),
                pct_comissao_bruta: parseFloat(row.pct_comissao_bruta),
                pct_imposto_das: parseFloat(row.pct_imposto_das),
                pct_repasse_corretor: parseFloat(row.pct_repasse_corretor),
                status_passo: row.status_chamado,
                data_criacao: row.created_at,
                url_pdf_nfe: row.url_pdf_nfe,
                url_contrato_govbr: row.url_contrato_govbr,
                url_pix_cury: row.url_pix_cury,
                url_pix_corretor: row.url_pix_corretor
            };
        }

        function movParaLinhaTransaction(m) {
            return {
                id: m.id,
                tipo: 'saida',
                data: m.data,
                valor: m.valor,
                descricao: m.descricao,
                categoria: m.fonte === 'caixa_reserva' ? 'Caixa Reserva' : 'Saldo Livre',
                fonte_debito: m.fonte,
                comprovantes: m.comprovantes || []
            };
        }

        function linhaTransactionParaMov(row) {
            return {
                id: row.id,
                descricao: row.descricao,
                valor: parseFloat(row.valor),
                fonte: row.fonte_debito || 'saldo_livre',
                data: row.data,
                tipo: 'saida',
                comprovantes: row.comprovantes || []
            };
        }

        async function carregarDadosDoBanco() {
            if (!supabaseClient) { marcarStatusNuvem(false); return; }

            try {
                const [rCorretores, rVendas, rTransacoes] = await Promise.all([
                    supabaseClient.from('corretores').select('*'),
                    supabaseClient.from('vendas').select('*'),
                    supabaseClient.from('transactions').select('*').eq('tipo', 'saida')
                ]);

                if (rCorretores.error || rVendas.error || rTransacoes.error) {
                    throw (rCorretores.error || rVendas.error || rTransacoes.error);
                }

                // Se a nuvem já tem dados, ela manda. Se estiver vazia, sobe o que já existe localmente.
                if (rCorretores.data && rCorretores.data.length > 0) {
                    corretoresState = rCorretores.data;
                } else if (corretoresState.length > 0) {
                    await supabaseClient.from('corretores').upsert(corretoresState);
                }

                if (rVendas.data && rVendas.data.length > 0) {
                    salesState = rVendas.data.map(linhaBancoParaVenda);
                } else if (salesState.length > 0) {
                    await supabaseClient.from('vendas').upsert(salesState.map(vendaParaLinhaBanco));
                }

                if (rTransacoes.data && rTransacoes.data.length > 0) {
                    movimentacoesState = rTransacoes.data.map(linhaTransactionParaMov);
                } else if (movimentacoesState.length > 0) {
                    await supabaseClient.from('transactions').upsert(movimentacoesState.map(movParaLinhaTransaction));
                }

                localStorage.setItem('2b_corretores', JSON.stringify(corretoresState));
                localStorage.setItem('2b_sales', JSON.stringify(salesState));
                localStorage.setItem('2b_movimentacoes', JSON.stringify(movimentacoesState));

                marcarStatusNuvem(true);
                renderTudo();
            } catch (e) {
                marcarStatusNuvem(false);
            }
        }

        function setAccessMode(mode) {
            currentMode = mode;
            const btnAdmin = document.getElementById('btn-mode-admin');
            const btnViewer = document.getElementById('btn-mode-viewer');

            if (mode === 'admin') {
                btnAdmin.className = "px-2 py-1 rounded bg-yellow-500 text-slate-950 font-bold shadow";
                btnViewer.className = "px-2 py-1 rounded text-slate-400 hover:text-white";
                document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
            } else {
                btnViewer.className = "px-2 py-1 rounded bg-yellow-500 text-slate-950 font-bold shadow";
                btnAdmin.className = "px-2 py-1 rounded text-slate-400 hover:text-white";
                document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
                switchTab('analytics');
            }
            renderCorretoresGrid();
        }

        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            
            // Reset Desktop
            document.querySelectorAll('.tab-btn-desk').forEach(el => {
                el.classList.remove('bg-yellow-500', 'text-slate-950');
                el.classList.add('text-slate-400', 'hover:bg-slate-800');
            });
            // Reset Mobile
            document.querySelectorAll('.mob-tab-btn').forEach(el => {
                el.classList.remove('text-yellow-500', 'font-bold');
                el.classList.add('text-slate-400', 'font-medium');
            });

            document.getElementById(`tab-${tabId}`).classList.remove('hidden');

            const targetDesk = document.getElementById(`desk-nav-${tabId}`);
            if (targetDesk) {
                targetDesk.classList.remove('text-slate-400', 'hover:bg-slate-800');
                targetDesk.classList.add('bg-yellow-500', 'text-slate-950');
            }

            const targetMob = document.getElementById(`mob-nav-${tabId}`);
            if (targetMob) {
                targetMob.classList.remove('text-slate-400', 'font-medium');
                targetMob.classList.add('text-yellow-500', 'font-bold');
            }

            if (tabId === 'recibo') populateReciboSelect();
        }

        // ANALYTICS & RBT12
        function updateAnalyticsDashboard() {
            let totalVgvMes = 0;
            let totalSobra2BMes = 0;
            let totalVendasMes = salesState.length;
            let totalRbt12 = 0;

            salesState.forEach(v => {
                const vgv = parseFloat(v.vgv_total || 0);
                const comissaoBruta = (vgv * parseFloat(v.pct_comissao_bruta || 3.65)) / 100;
                const impostoDas = (comissaoBruta * parseFloat(v.pct_imposto_das || 10)) / 100;
                const repasseCorretor = (vgv * parseFloat(v.pct_repasse_corretor || 2.60)) / 100;
                const sobra2B = comissaoBruta - impostoDas - repasseCorretor;

                totalVgvMes += vgv;
                totalSobra2BMes += sobra2B;
                totalRbt12 += comissaoBruta;
            });

            const ticketMedio = totalVendasMes > 0 ? (totalVgvMes / totalVendasMes) : 0;

            document.getElementById('kpi-vendas-mes').innerText = totalVendasMes;
            document.getElementById('kpi-vgv-mes').innerText = formatBRL(totalVgvMes);
            document.getElementById('kpi-ticket-medio').innerText = formatBRL(ticketMedio);
            document.getElementById('kpi-sobra-2b').innerText = formatBRL(totalSobra2BMes);
            document.getElementById('rbt12-total-text').innerText = formatBRL(totalRbt12);

            const pctProgresso = Math.min((totalRbt12 / 620000) * 100, 100);
            document.getElementById('rbt12-progress-bar').style.width = `${Math.max(pctProgresso, 5)}%`;

            let aliquotaEfetiva = '6,00%';
            if (totalRbt12 > 180000) aliquotaEfetiva = '7,30%';
            if (totalRbt12 > 360000) aliquotaEfetiva = '9,50%';
            if (totalRbt12 > 620000) aliquotaEfetiva = '10,70%';
            document.getElementById('rbt12-effective-tax').innerText = aliquotaEfetiva;

            updateBalances();
        }

        function updateBalances() {
            let saldoBrutoTotal = 0;
            let saldoReservaImpostos = 0;
            let saldoLivreSobra = 0;

            salesState.forEach(v => {
                const vgv = parseFloat(v.vgv_total || 0);
                const bruto = (vgv * parseFloat(v.pct_comissao_bruta || 3.65)) / 100;
                const das = (bruto * parseFloat(v.pct_imposto_das || 10)) / 100;
                const repasse = (vgv * parseFloat(v.pct_repasse_corretor || 2.60)) / 100;
                const sobra = bruto - das - repasse;

                if (['passo4', 'passo5'].includes(v.status_passo)) {
                    saldoBrutoTotal += bruto;
                    saldoReservaImpostos += das;
                    saldoLivreSobra += sobra;
                }
            });

            movimentacoesState.forEach(m => {
                const val = parseFloat(m.valor || 0);
                saldoBrutoTotal -= val;
                if (m.fonte === 'caixa_reserva') saldoReservaImpostos -= val;
                else saldoLivreSobra -= val;
            });

            document.getElementById('card-saldo-total').innerText = formatBRL(saldoBrutoTotal);
            document.getElementById('card-saldo-reserva').innerText = formatBRL(saldoReservaImpostos);
            document.getElementById('card-saldo-livre').innerText = formatBRL(saldoLivreSobra);
        }

        // ESTEIRA DE VENDAS (CARDS VERTICAIS MOBILE)
        function filterEsteiraPasso(passo) {
            currentPassoFilter = passo;
            document.querySelectorAll('.passo-filter-btn').forEach(btn => {
                btn.className = "passo-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-slate-400 shrink-0";
            });
            const activeBtn = document.getElementById(`btn-passo-filter-${passo}`);
            if (activeBtn) activeBtn.className = "passo-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-500 text-slate-950 shrink-0";
            renderEsteiraCards();
        }

        function renderEsteiraCards() {
            const container = document.getElementById('container-esteira-cards');
            container.innerHTML = '';

            const filtered = salesState.filter(v => currentPassoFilter === 'all' || v.status_passo === currentPassoFilter);

            if (filtered.length === 0) {
                container.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs bg-brand-card rounded-2xl border border-slate-800">Nenhuma venda neste passo.</div>`;
                return;
            }

            const stepTitles = {
                passo1: { name: '1. Nota Importada', color: 'text-blue-400', bg: 'bg-blue-400/10' },
                passo2: { name: '2. Corretor Vinculado', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
                passo3: { name: '3. Stand-by Gov.br', color: 'text-purple-400', bg: 'bg-purple-400/10' },
                passo4: { name: '4. Pix Cury Recebido', color: 'text-amber-400', bg: 'bg-amber-400/10' },
                passo5: { name: '5. Finalizada / Dossiê', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
            };

            filtered.forEach(v => {
                const stepInfo = stepTitles[v.status_passo] || stepTitles['passo1'];
                const corretor = corretoresState.find(c => c.id === v.corretor_id);
                const corretorNome = corretor ? corretor.nome : 'Pendente...';

                const card = document.createElement('div');
                card.className = "bg-brand-card border border-brand-border rounded-2xl p-3.5 space-y-2.5 shadow-md relative";
                card.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${stepInfo.bg} ${stepInfo.color} border border-current/20">
                            ${stepInfo.name}
                        </span>
                        <span class="text-xs font-mono font-bold text-yellow-400">${v.codigo_pv}</span>
                    </div>

                    <div>
                        <h4 class="font-bold text-white text-xs">${v.empreendimento}</h4>
                        <p class="text-[11px] text-slate-400">${v.unidade_torre} • NF ${v.numero_nfe || '---'}</p>
                    </div>

                    <div class="pt-2 border-t border-slate-800/80 flex justify-between items-center text-xs">
                        <div>
                            <span class="text-[10px] text-slate-500 block">VGV Total</span>
                            <span class="font-bold text-emerald-400">${formatBRL(v.vgv_total)}</span>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] text-slate-500 block">Corretor</span>
                            <span class="font-bold text-yellow-400">${corretorNome}</span>
                        </div>
                    </div>

                    <div class="pt-1 flex gap-2 justify-end">
                        ${renderActionButtonsCards(v)}
                    </div>
                `;
                container.appendChild(card);
            });
        }

        function renderActionButtonsCards(v) {
            if (currentMode !== 'admin') return '';

            if (v.status_passo === 'passo1') {
                return `<button onclick="abrirModalVincularCorretor('${v.id}')" class="px-2.5 py-1 rounded-lg bg-yellow-500 text-slate-950 font-bold text-[11px]">Vincular Corretor</button>`;
            }
            if (v.status_passo === 'passo2') {
                return `<button onclick="avancarPassoKanban('${v.id}', 'passo3')" class="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-bold text-[11px]">Gerar Minuta A4</button>`;
            }
            if (v.status_passo === 'passo3') {
                return `<button onclick="confirmarPixCury('${v.id}')" class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px]">Confirmar Pix Cury</button>`;
            }
            if (v.status_passo === 'passo4') {
                return `<button onclick="finalizarQuiterVenda('${v.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold text-[11px]">Quitar & Repassar</button>`;
            }
            if (v.status_passo === 'passo5') {
                return `<span class="text-[11px] text-emerald-400 font-bold flex items-center gap-1"><i class="fa-solid fa-check-double"></i> Arquivado Drive</span>`;
            }
            return '';
        }

        // EXTRATO FORMATO BANCÁRIO MOBILE
        function populateExtratoDropdowns() {
            const selectDia = document.getElementById('filter-extrato-dia');
            const selectMes = document.getElementById('filter-extrato-mes');
            const selectAno = document.getElementById('filter-extrato-ano');

            for (let i = 1; i <= 31; i++) {
                const d = String(i).padStart(2, '0');
                selectDia.innerHTML += `<option value="${d}">${d}</option>`;
            }

            const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            meses.forEach((m, idx) => {
                const val = String(idx + 1).padStart(2, '0');
                selectMes.innerHTML += `<option value="${val}">${m}</option>`;
            });

            selectAno.innerHTML += `<option value="2026">2026</option><option value="2025">2025</option>`;
        }

        function renderExtratoTable() {
            const container = document.getElementById('list-extrato-container');
            container.innerHTML = '';

            const textFilter = document.getElementById('search-extrato-text').value.toLowerCase();
            const diaFilter = document.getElementById('filter-extrato-dia').value;
            const mesFilter = document.getElementById('filter-extrato-mes').value;
            const anoFilter = document.getElementById('filter-extrato-ano').value;

            let items = [];

            // Entradas de Vendas
            salesState.filter(v => ['passo4', 'passo5'].includes(v.status_passo)).forEach(v => {
                const vgv = parseFloat(v.vgv_total || 0);
                const bruto = (vgv * parseFloat(v.pct_comissao_bruta || 3.65)) / 100;
                const dateObj = new Date(v.data_criacao);
                
                items.push({
                    id: v.id,
                    data: v.data_criacao.split('T')[0],
                    dataObj: dateObj,
                    titulo: `Comissão Cury (${v.codigo_pv})`,
                    sub: `NFS ${v.numero_nfe || '---'} • Caixa Bruto PJ`,
                    valor: bruto,
                    tipo: 'entrada',
                    origemId: v.id
                });
            });

            // Saídas
            movimentacoesState.forEach(m => {
                const dateObj = new Date(m.data);
                items.push({
                    id: m.id,
                    data: m.data,
                    dataObj: dateObj,
                    titulo: m.descricao,
                    sub: m.fonte === 'caixa_reserva' ? 'Caixa Reserva (DAS)' : 'Saldo Livre (2B)',
                    valor: m.valor,
                    tipo: 'saida',
                    origemId: m.id
                });
            });

            // Filtros
            items = items.filter(item => {
                const parts = item.data.split('-');
                const ano = parts[0];
                const mes = parts[1];
                const dia = parts[2];

                if (textFilter && !item.titulo.toLowerCase().includes(textFilter) && !item.sub.toLowerCase().includes(textFilter)) return false;
                if (diaFilter && dia !== diaFilter) return false;
                if (mesFilter && mes !== mesFilter) return false;
                if (anoFilter && ano !== anoFilter) return false;
                return true;
            });

            if (items.length === 0) {
                container.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs">Nenhuma movimentação no período.</div>`;
                return;
            }

            items.sort((a, b) => b.dataObj - a.dataObj);

            items.forEach(item => {
                const el = document.createElement('div');
                el.className = "bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-2 shadow-sm";
                
                const isEntrada = item.tipo === 'entrada';
                const iconClass = isEntrada ? 'fa-arrow-down text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'fa-arrow-up text-rose-400 bg-rose-500/10 border-rose-500/20';
                const valClass = isEntrada ? 'text-emerald-400' : 'text-slate-200';
                const signal = isEntrada ? '+' : '-';

                el.className = "bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2 shadow-sm";
                el.innerHTML = `
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${iconClass}">
                                <i class="fa-solid ${iconClass}"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-white text-xs leading-tight">${item.titulo}</h4>
                                <p class="text-[10px] text-slate-400 mt-0.5">${item.sub}</p>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <span class="font-bold text-xs ${valClass}">${signal} ${formatBRL(item.valor)}</span>
                            <span class="text-[9px] font-mono text-slate-500 block mt-0.5">${new Date(item.data).toLocaleDateString('pt-BR')}</span>
                        </div>
                    </div>
                    <button onclick="abrirModalArquivos('${item.origemId}', '${item.tipo}')" class="self-start px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold flex items-center gap-1">
                        <i class="fa-solid fa-paperclip"></i> Ver Arquivos
                    </button>
                `;
                container.appendChild(el);
            });
        }

        function abrirModalArquivos(id, tipo) {
            const container = document.getElementById('lista-arquivos-transacao');
            let arquivos = [];

            if (tipo === 'entrada') {
                const v = salesState.find(x => x.id === id);
                if (v) {
                    if (v.url_pdf_nfe) arquivos.push({ nome: 'Nota Fiscal (NFS-e)', url: v.url_pdf_nfe });
                    if (v.url_contrato_govbr) arquivos.push({ nome: 'Contrato Gov.br', url: v.url_contrato_govbr });
                    if (v.url_pix_cury) arquivos.push({ nome: 'Comprovante Pix da Construtora', url: v.url_pix_cury });
                    if (v.url_pix_corretor) arquivos.push({ nome: 'Comprovante Pix do Corretor', url: v.url_pix_corretor });
                }
            } else {
                const m = movimentacoesState.find(x => x.id === id);
                if (m && m.comprovantes) arquivos = m.comprovantes.map(c => ({ nome: c.nome, url: c.url }));
            }

            container.innerHTML = arquivos.length ? '' : '<p class="text-slate-500 text-center py-4">Nenhum arquivo anexado a esta transação ainda.</p>';

            arquivos.forEach(a => {
                const linha = document.createElement('div');
                linha.className = "flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-lg p-2";
                linha.innerHTML = `
                    <span class="text-slate-200 truncate">${a.nome}</span>
                    <div class="flex gap-1 shrink-0">
                        <a href="${a.url}" target="_blank" rel="noopener" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold"><i class="fa-solid fa-eye"></i></a>
                        <a href="${a.url}" download class="px-2 py-1 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-slate-950 text-[10px] font-bold"><i class="fa-solid fa-download"></i></a>
                    </div>
                `;
                container.appendChild(linha);
            });

            document.getElementById('modal-arquivos').classList.remove('hidden');
        }

        // CORRETORES
        function openModalNovoCorretor() {
            document.getElementById('form-corretor-id').value = '';
            document.getElementById('form-corretor-nome').value = '';
            document.getElementById('form-corretor-cpf').value = '';
            document.getElementById('form-corretor-creci').value = '';
            document.getElementById('form-corretor-tel').value = '';
            document.getElementById('form-corretor-pix').value = '';
            document.getElementById('modal-corretor-titulo').innerHTML = '<i class="fa-solid fa-user-plus text-yellow-500"></i> Cadastrar Corretor';
            document.getElementById('btn-salvar-corretor').innerText = 'Salvar';
            document.getElementById('modal-novo-corretor').classList.remove('hidden');
        }

        function abrirEdicaoCorretor(id) {
            if (currentMode !== 'admin') return;
            const c = corretoresState.find(x => x.id === id);
            if (!c) return;
            document.getElementById('form-corretor-id').value = c.id;
            document.getElementById('form-corretor-nome').value = c.nome;
            document.getElementById('form-corretor-cpf').value = c.cpf;
            document.getElementById('form-corretor-creci').value = c.creci;
            document.getElementById('form-corretor-tel').value = c.telefone;
            document.getElementById('form-corretor-pix').value = c.chave_pix;
            document.getElementById('modal-corretor-titulo').innerHTML = '<i class="fa-solid fa-pen text-yellow-500"></i> Editar Corretor';
            document.getElementById('btn-salvar-corretor').innerText = 'Salvar Alterações';
            document.getElementById('modal-novo-corretor').classList.remove('hidden');
        }

        function salvarNovoCorretor() {
            const idExistente = document.getElementById('form-corretor-id').value;
            const dados = {
                nome: document.getElementById('form-corretor-nome').value,
                cpf: document.getElementById('form-corretor-cpf').value,
                creci: document.getElementById('form-corretor-creci').value,
                telefone: document.getElementById('form-corretor-tel').value,
                chave_pix: document.getElementById('form-corretor-pix').value
            };

            if (idExistente) {
                if (currentMode !== 'admin') { alert('Somente o admin pode editar corretores.'); return; }
                const c = corretoresState.find(x => x.id === idExistente);
                if (c) Object.assign(c, dados);
            } else {
                corretoresState.push({ id: (crypto.randomUUID ? crypto.randomUUID() : 'c_' + Date.now()), ...dados });
            }

            persistCorretores();
            closeModal('modal-novo-corretor');
            renderCorretoresGrid();
            renderCorretoresDropdown();
        }

        function apagarCorretor(id) {
            if (currentMode !== 'admin') return;
            const c = corretoresState.find(x => x.id === id);
            if (!c) return;
            if (!confirm(`Apagar o corretor ${c.nome}? Essa ação não pode ser desfeita.`)) return;

            corretoresState = corretoresState.filter(x => x.id !== id);
            persistCorretores();
            if (supabaseClient) {
                supabaseClient.from('corretores').delete().eq('id', id).then(() => marcarStatusNuvem(true)).catch(e => marcarStatusNuvem(false));
            }
            renderCorretoresGrid();
            renderCorretoresDropdown();
        }

        function persistCorretores() {
            localStorage.setItem('2b_corretores', JSON.stringify(corretoresState));
            if (supabaseClient) {
                supabaseClient.from('corretores').upsert(corretoresState).then(() => marcarStatusNuvem(true)).catch(e => marcarStatusNuvem(false));
            }
        }

        function renderCorretoresGrid() {
            const container = document.getElementById('grid-corretores');
            container.innerHTML = '';

            corretoresState.forEach(c => {
                const card = document.createElement('div');
                card.className = "bg-brand-card border border-brand-border rounded-xl p-3.5 space-y-2 shadow-sm";
                card.innerHTML = `
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 flex items-center justify-center font-bold text-xs shrink-0">
                            ${c.nome.charAt(0)}
                        </div>
                        <div>
                            <h4 class="font-bold text-white text-xs leading-tight">${c.nome}</h4>
                            <p class="text-[10px] text-slate-400">CRECI: ${c.creci}</p>
                        </div>
                    </div>
                    <div class="pt-1.5 border-t border-slate-800 space-y-0.5 text-[11px]">
                        <p class="text-slate-300"><i class="fa-solid fa-id-card text-slate-500 w-3.5"></i> ${c.cpf}</p>
                        <p class="text-slate-300"><i class="fa-brands fa-whatsapp text-emerald-400 w-3.5"></i> ${c.telefone}</p>
                        <p class="text-slate-300"><i class="fa-solid fa-key text-yellow-400 w-3.5"></i> <span class="font-mono text-yellow-400 text-[10px]">${c.chave_pix}</span></p>
                    </div>
                    ${currentMode === 'admin' ? `
                    <div class="pt-1.5 border-t border-slate-800 flex gap-2">
                        <button onclick="abrirEdicaoCorretor('${c.id}')" class="flex-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center gap-1">
                            <i class="fa-solid fa-pen"></i> Editar
                        </button>
                        <button onclick="apagarCorretor('${c.id}')" class="flex-1 px-2 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 text-[10px] font-bold flex items-center justify-center gap-1">
                            <i class="fa-solid fa-trash"></i> Apagar
                        </button>
                    </div>` : ''}
                `;
                container.appendChild(card);
            });
        }

        function renderCorretoresDropdown() {
            const select = document.getElementById('form-vincular-corretor-select');
            select.innerHTML = '';
            corretoresState.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.innerText = `${c.nome} (${c.creci})`;
                select.appendChild(opt);
            });
        }

        // PASSO 1, 2 & ACCIONS
        function openModalImportarNfse() {
            document.getElementById('modal-nfse').classList.remove('hidden');
        }

        let nfsePdfUrlPendente = null;

        async function lerArquivoNota(e) {
            const file = e.target.files[0];
            if (!file) return;

            const status = document.getElementById('nfse-leitura-status');
            status.innerText = 'Lendo arquivo...';
            nfsePdfUrlPendente = null;

            try {
                let texto = '';
                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                    texto = await extrairTextoPdf(file);
                } else {
                    texto = (await file.text()).replace(/<[^>]+>/g, '\n');
                }

                const dados = interpretarTextoNfse(texto);
                let algumCampo = false;

                if (dados.numero) { document.getElementById('form-nfse-numero').value = dados.numero; algumCampo = true; }
                if (dados.empreendimento) { document.getElementById('form-nfse-emp').value = dados.empreendimento; algumCampo = true; }
                if (dados.unidade) { document.getElementById('form-nfse-unidade').value = dados.unidade; algumCampo = true; }
                if (dados.valor) { document.getElementById('form-nfse-bruto').value = dados.valor.toFixed(2); algumCampo = true; }

                recalcularVgvPorTaxa();

                status.innerText = algumCampo
                    ? 'Nota lida. Confira os dados antes de salvar.'
                    : 'Não consegui reconhecer os dados automaticamente — preencha manualmente.';

                // Sobe o arquivo original para o Storage para ficar disponível em "Ver Arquivos"
                uploadArquivoParaStorage(file, 'notas').then(url => { nfsePdfUrlPendente = url; }).catch(() => {});
            } catch (err) {
                status.innerText = 'Falha ao ler o arquivo — preencha os dados manualmente.';
            }
        }

        async function extrairTextoPdf(file) {
            if (window.pdfjsLib) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
            const buffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
            let textoCompleto = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                textoCompleto += content.items.map(it => it.str).join(' ') + '\n';
            }
            return textoCompleto;
        }

        function interpretarTextoNfse(texto) {
            const limpo = texto.replace(/\s+/g, ' ');
            const resultado = {};

            // Número da nota (bloco isolado de 6 a 9 dígitos, ignorando CNPJ/inscrições e IDs longos)
            const numMatch = limpo.match(/N[uú]mero da Nota\D{0,40}?(\d{6,9})(?!\d)/i) || limpo.match(/(?<!\d)(\d{8})(?!\d)/);
            if (numMatch) resultado.numero = numMatch[1];

            const empMatch = limpo.match(/Empreendimento:\s*([^:]+?)(?=\s+Torre:|\s+Unidade:|$)/i);
            if (empMatch) resultado.empreendimento = empMatch[1].trim();

            const torreMatch = limpo.match(/Torre:\s*([^:]+?)(?=\s+Unidade:|$)/i);
            const unidadeMatch = limpo.match(/Unidade:\s*([^:]+?)(?=\s+[A-ZÀ-Ú]{3,}[a-zà-ú]*:|$)/i);
            const partesUnidade = [];
            if (torreMatch) partesUnidade.push(torreMatch[1].trim());
            if (unidadeMatch) partesUnidade.push(unidadeMatch[1].trim());
            if (partesUnidade.length) resultado.unidade = partesUnidade.join(' - ');

            const valorMatch = limpo.match(/VALOR TOTAL DO SERVI[ÇC]O\s*=?\s*R\$\s*([\d.,]+)/i);
            if (valorMatch) {
                resultado.valor = parseFloat(valorMatch[1].replace(/\./g, '').replace(',', '.'));
            }

            return resultado;
        }

        async function uploadArquivoParaStorage(file, pasta) {
            if (!supabaseClient) return null;
            const caminho = `${pasta}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const { error } = await supabaseClient.storage.from('comprovantes').upload(caminho, file, { upsert: true });
            if (error) throw error;
            const { data } = supabaseClient.storage.from('comprovantes').getPublicUrl(caminho);
            return data ? data.publicUrl : null;
        }

        function recalcularVgvPorTaxa() {
            const bruto = parseFloat(document.getElementById('form-nfse-bruto').value || 0);
            const pct = parseFloat(document.getElementById('form-nfse-pct-comissao').value || 3.65);
            if (pct > 0) {
                document.getElementById('form-nfse-vgv').value = (bruto / (pct / 100)).toFixed(2);
            }
        }

        function salvarPasso1() {
            const novaVenda = {
                id: (crypto.randomUUID ? crypto.randomUUID() : 'v_' + Date.now()),
                numero_nfe: document.getElementById('form-nfse-numero').value,
                codigo_pv: document.getElementById('form-nfse-pv').value,
                empreendimento: document.getElementById('form-nfse-emp').value,
                unidade_torre: document.getElementById('form-nfse-unidade').value,
                vgv_total: parseFloat(document.getElementById('form-nfse-vgv').value || 0),
                pct_comissao_bruta: parseFloat(document.getElementById('form-nfse-pct-comissao').value || 3.65),
                pct_imposto_das: 10.00,
                pct_repasse_corretor: 2.60,
                corretor_id: null,
                status_passo: 'passo1',
                data_criacao: new Date().toISOString(),
                url_pdf_nfe: nfsePdfUrlPendente
            };

            salesState.unshift(novaVenda);
            persistSales();
            nfsePdfUrlPendente = null;
            document.getElementById('nfse-leitura-status').innerText = '';
            closeModal('modal-nfse');
            renderEsteiraCards();
            updateAnalyticsDashboard();
        }

        function abrirModalVincularCorretor(vendaId) {
            document.getElementById('form-vincular-venda-id').value = vendaId;
            document.getElementById('modal-corretor-venda').classList.remove('hidden');
        }

        function salvarPasso2() {
            const vendaId = document.getElementById('form-vincular-venda-id').value;
            const corretorId = document.getElementById('form-vincular-corretor-select').value;
            const pctCorretor = parseFloat(document.getElementById('form-vincular-pct-corretor').value || 2.60);
            const pctDas = parseFloat(document.getElementById('form-vincular-pct-das').value || 10.00);

            const v = salesState.find(x => x.id === vendaId);
            if (v) {
                v.corretor_id = corretorId;
                v.pct_repasse_corretor = pctCorretor;
                v.pct_imposto_das = pctDas;
                v.status_passo = 'passo2';
            }

            persistSales();
            closeModal('modal-corretor-venda');
            renderEsteiraCards();
            updateAnalyticsDashboard();
        }

        function avancarPassoKanban(vendaId, proximoPasso) {
            const v = salesState.find(x => x.id === vendaId);
            if (v) {
                v.status_passo = proximoPasso;
                persistSales();
                renderEsteiraCards();
                if (proximoPasso === 'passo3') switchTab('recibo');
            }
        }

        function confirmarPixCury(vendaId) {
            const v = salesState.find(x => x.id === vendaId);
            if (v && confirm(`Confirmar o Pix da Cury referente à Nota ${v.numero_nfe}?`)) {
                v.status_passo = 'passo4';
                persistSales();
                renderEsteiraCards();
                updateAnalyticsDashboard();
                renderExtratoTable();
            }
        }

        function finalizarQuiterVenda(vendaId) {
            const v = salesState.find(x => x.id === vendaId);
            if (v && confirm(`Finalizar venda e anexar dossiê no Drive?`)) {
                v.status_passo = 'passo5';
                persistSales();
                renderEsteiraCards();
                updateAnalyticsDashboard();
                renderExtratoTable();
            }
        }

        function openModalOutroPagamento() {
            document.getElementById('modal-outro-pagamento').classList.remove('hidden');
        }

        async function salvarOutroPagamento() {
            const btn = document.getElementById('btn-salvar-despesa');
            const arquivos = Array.from(document.getElementById('form-despesa-arquivos').files || []);
            btn.disabled = true;
            btn.innerText = arquivos.length ? 'Enviando arquivos...' : 'Salvando...';

            let comprovantes = [];
            try {
                for (const file of arquivos) {
                    const url = await uploadArquivoParaStorage(file, 'despesas');
                    if (url) comprovantes.push({ nome: file.name, url });
                }
            } catch (e) {
                alert('Não foi possível enviar um ou mais arquivos. A despesa será salva sem esse(s) anexo(s).');
            }

            const novo = {
                id: (crypto.randomUUID ? crypto.randomUUID() : 'm_' + Date.now()),
                descricao: document.getElementById('form-despesa-desc').value,
                valor: parseFloat(document.getElementById('form-despesa-valor').value || 0),
                fonte: document.getElementById('form-despesa-fonte').value,
                data: new Date().toISOString().split('T')[0],
                tipo: 'saida',
                comprovantes: comprovantes
            };

            movimentacoesState.unshift(novo);
            persistMovimentacoes();
            document.getElementById('form-despesa-arquivos').value = '';
            btn.disabled = false;
            btn.innerText = 'Debitar';
            closeModal('modal-outro-pagamento');
            renderExtratoTable();
            updateAnalyticsDashboard();
        }

        function persistMovimentacoes() {
            localStorage.setItem('2b_movimentacoes', JSON.stringify(movimentacoesState));
            if (supabaseClient) {
                const linhas = movimentacoesState.map(movParaLinhaTransaction);
                supabaseClient.from('transactions').upsert(linhas).then(() => marcarStatusNuvem(true)).catch(e => marcarStatusNuvem(false));
            }
        }

        // RECIBO
        function populateReciboSelect() {
            const select = document.getElementById('select-venda-recibo');
            select.innerHTML = '<option value="">-- Escolha uma venda gravada --</option>';
            salesState.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.id;
                opt.innerText = `${v.codigo_pv} - ${v.empreendimento}`;
                select.appendChild(opt);
            });
        }

        function carregarVendaNoRecibo() {
            const id = document.getElementById('select-venda-recibo').value;
            if (!id) return;

            const v = salesState.find(x => x.id === id);
            if (!v) return;

            const vgv = parseFloat(v.vgv_total || 0);
            const repasse = (vgv * parseFloat(v.pct_repasse_corretor || 2.60)) / 100;
            const corretor = corretoresState.find(c => c.id === v.corretor_id) || { nome: 'CORRETOR NÃO VINCULADO', cpf: '***.***.***-**', creci: '------' };

            document.getElementById('recibo-out-valor').innerText = formatBRL(repasse);
            document.getElementById('recibo-out-valor-extenso').innerText = formatBRL(repasse);
            document.getElementById('recibo-out-pv').innerText = `${v.codigo_pv} / NF: ${v.numero_nfe || 'Pendente'}`;
            document.getElementById('recibo-out-emp').innerText = v.empreendimento;
            document.getElementById('recibo-out-unidade').innerText = v.unidade_torre;
            document.getElementById('recibo-out-codigo-pv').innerText = v.codigo_pv;
            document.getElementById('recibo-out-vgv').innerText = formatBRL(vgv);
            document.getElementById('recibo-out-pct').innerText = (v.pct_repasse_corretor || 2.60) + '%';
            document.getElementById('recibo-out-data').innerText = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
            
            document.getElementById('recibo-out-corretor-nome').innerText = corretor.nome.toUpperCase();
            document.getElementById('recibo-out-corretor-cpf').innerText = corretor.cpf;
            document.getElementById('recibo-out-corretor-creci').innerText = corretor.creci;
        }

        // CHARTS & UTILS
        function initCharts() {
            const ctx1 = document.getElementById('chart-faturamento').getContext('2d');
            chartFaturamentoObj = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set'],
                    datasets: [{
                        label: 'Comissão Bruta (R$)',
                        data: [12000, 15000, 8000, 22000, 18000, 25000, 14000, 29000, 32000],
                        backgroundColor: '#EAB308',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { ticks: { color: '#64748B', font: { size: 9 } }, grid: { color: '#1E293B' } },
                        x: { ticks: { color: '#64748B', font: { size: 9 } }, grid: { display: false } }
                    }
                }
            });

            const ctx2 = document.getElementById('chart-split').getContext('2d');
            chartSplitObj = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Corretor (2.60%)', 'Reserva DAS (10%)', 'Sobra 2B'],
                    datasets: [{
                        data: [65, 10, 25],
                        backgroundColor: ['#EAB308', '#F59E0B', '#10B981'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: '#94A3B8', font: { size: 10 } } } }
                }
            });
        }

        function formatBRL(val) {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
        }

        function closeModal(id) {
            document.getElementById(id).classList.add('hidden');
        }

        function persistSales() {
            localStorage.setItem('2b_sales', JSON.stringify(salesState));
            if (supabaseClient) {
                const linhas = salesState.map(vendaParaLinhaBanco);
                supabaseClient.from('vendas').upsert(linhas).then(() => marcarStatusNuvem(true)).catch(e => marcarStatusNuvem(false));
            }
        }
