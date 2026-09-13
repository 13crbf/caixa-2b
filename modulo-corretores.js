import { fetchCorretores, saveCorretorDB, supabase } from './db.js';

let corretoresState = [];
let editingCorretorId = null;

export async function initCorretoresModule(isReadOnly = false) {
    // Alternância de Sub-Abas do Módulo Corretores
    const btnTabLista = document.getElementById('cor-tab-lista');
    const btnTabNovo = document.getElementById('cor-tab-novo');
    const viewLista = document.getElementById('cor-view-lista');
    const viewNovo = document.getElementById('cor-view-novo');

    if (btnTabLista && btnTabNovo) {
        btnTabLista.addEventListener('click', () => {
            viewLista.classList.remove('hidden');
            viewNovo.classList.add('hidden');
            btnTabLista.className = "px-3 py-1.5 rounded-lg text-xs font-bold pill-active";
            btnTabNovo.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-textsecondary hover:text-white";
        });

        btnTabNovo.addEventListener('click', () => {
            viewNovo.classList.remove('hidden');
            viewLista.classList.add('hidden');
            btnTabNovo.className = "px-3 py-1.5 rounded-lg text-xs font-bold pill-active";
            btnTabLista.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-textsecondary hover:text-white";
        });
    }

    // Salvar/Editar Corretor
    const btnSave = document.getElementById('btn-save-corretor');
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const nome = document.getElementById('cor-nome').value.trim();
            const telefone = document.getElementById('cor-telefone').value.trim();
            const creci = document.getElementById('cor-creci').value.trim();
            const cpf = document.getElementById('cor-cpf').value.trim();
            const chave_pix = document.getElementById('cor-pix').value.trim();

            if (!nome || !telefone || !creci || !cpf || !chave_pix) {
                alert("Por favor, preencha todos os campos do corretor (Nome, Telefone, CRECI, CPF e Chave Pix).");
                return;
            }

            const payload = { nome, telefone, creci, cpf, chave_pix };
            if (editingCorretorId) payload.id = editingCorretorId;

            const { error } = await saveCorretorDB(payload);
            if (error) {
                alert("Erro ao salvar corretor: " + error.message);
            } else {
                alert(editingCorretorId ? "Corretor atualizado com sucesso!" : "Corretor cadastrado com sucesso!");
                resetCorretorForm();
                await loadCorretoresUI(isReadOnly);
                // Retorna para a lista
                btnTabLista.click();
            }
        });
    }

    await loadCorretoresUI(isReadOnly);
}

export async function loadCorretoresUI(isReadOnly = false) {
    corretoresState = await fetchCorretores();
    const container = document.getElementById('corretores-list-container');
    const selectLancar = document.getElementById('in-corretor-id');
    const selectVenda = document.getElementById('in-venda-corretor-id');

    if (container) container.innerHTML = '';
    if (selectLancar) selectLancar.innerHTML = '<option value="">Selecione um Corretor...</option>';
    if (selectVenda) selectVenda.innerHTML = '<option value="">Selecione um Corretor...</option>';

    if (!corretoresState || corretoresState.length === 0) {
        if (container) container.innerHTML = `<div class="p-6 text-center text-xs text-textsecondary">Nenhum corretor parceiro cadastrado.</div>`;
        return;
    }

    corretoresState.forEach(c => {
        const isInactive = c.ativo === false;

        // Tabela / Lista
        if (container) {
            const row = document.createElement('div');
            row.className = `p-3.5 flex items-center justify-between hover:bg-darkbg/40 transition text-xs border-b border-cardborder/40 last:border-0 ${isInactive ? 'opacity-50' : ''}`;

            const actionsHtml = (!isReadOnly) ? `
                <div class="flex items-center gap-2">
                    <button class="p-1.5 text-textsecondary hover:text-brand-500 transition" onclick="window.editCorretor('${c.id}')" title="Editar Corretor"><i class="fa-solid fa-pen-to-square"></i></button>
                    ${isInactive
                        ? `<button class="p-1.5 text-positive hover:text-green-400 transition" onclick="window.toggleAtivoCorretor('${c.id}', true)" title="Reativar Corretor"><i class="fa-solid fa-rotate-left"></i></button>`
                        : `<button class="p-1.5 text-negative hover:text-red-400 transition" onclick="window.deleteCorretor('${c.id}')" title="Excluir Corretor"><i class="fa-solid fa-trash"></i></button>`
                    }
                </div>
            ` : '';

            row.innerHTML = `
                <div>
                    <div class="font-bold text-white">${c.nome} ${isInactive ? '<span class="text-[9px] font-bold text-textsecondary border border-cardborder/60 rounded px-1 py-0.5 ml-1 align-middle">INATIVO</span>' : ''}</div>
                    <div class="text-[10px] text-textsecondary">CRECI: ${c.creci} | Tel: ${c.telefone} | CPF: ${c.cpf}</div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-right">
                        <div class="font-mono text-amber-400 font-bold text-[11px]">${c.chave_pix}</div>
                    </div>
                    ${actionsHtml}
                </div>
            `;
            container.appendChild(row);
        }

        // Dropdown no formulário de Lançamentos — só corretores ativos
        if (selectLancar && !isInactive) {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.innerText = `${c.nome} (${c.creci})`;
            selectLancar.appendChild(opt);
        }
        if (selectVenda && !isInactive) {
            const optVenda = document.createElement('option');
            optVenda.value = c.id;
            optVenda.innerText = `${c.nome} (${c.creci})`;
            selectVenda.appendChild(optVenda);
        }
    });

    // Funções Globais de Edição/Exclusão
    window.editCorretor = (id) => {
        const c = corretoresState.find(x => x.id === id);
        if (!c) return;

        editingCorretorId = c.id;
        document.getElementById('cor-nome').value = c.nome;
        document.getElementById('cor-telefone').value = c.telefone;
        document.getElementById('cor-creci').value = c.creci;
        document.getElementById('cor-cpf').value = c.cpf;
        document.getElementById('cor-pix').value = c.chave_pix;

        document.getElementById('cor-form-title').innerText = "Editar Cadastro de Corretor";
        document.getElementById('btn-save-corretor').innerText = "Atualizar Corretor";

        document.getElementById('cor-tab-novo').click();
    };

    // Ativa/desativa um corretor sem apagar seu histórico
    window.toggleAtivoCorretor = async (id, novoStatus) => {
        const { error } = await saveCorretorDB({ id, ativo: novoStatus });
        if (error) alert("Erro ao atualizar corretor: " + error.message);
        else await loadCorretoresUI(isReadOnly);
    };

    window.deleteCorretor = async (id) => {
        if (!confirm("Deseja realmente excluir este corretor do cadastro?")) return;

        const { error } = await supabase.from('corretores').delete().eq('id', id);
        if (!error) {
            await loadCorretoresUI(isReadOnly);
            return;
        }

        // Código 23503 = violação de chave estrangeira (existem vendas/repasses vinculados a este corretor)
        if (error.code === '23503') {
            if (confirm("Este corretor já tem vendas/repasses registrados e não pode ser excluído sem perder esse histórico.\n\nDeseja apenas DESATIVAR o corretor? Ele deixa de aparecer para novos lançamentos, mas o histórico é mantido.")) {
                await window.toggleAtivoCorretor(id, false);
            }
        } else {
            alert("Erro ao excluir corretor: " + error.message);
        }
    };
}

function resetCorretorForm() {
    editingCorretorId = null;
    document.getElementById('cor-nome').value = '';
    document.getElementById('cor-telefone').value = '';
    document.getElementById('cor-creci').value = '';
    document.getElementById('cor-cpf').value = '';
    document.getElementById('cor-pix').value = '';
    document.getElementById('cor-form-title').innerText = "Cadastrar Novo Corretor";
    document.getElementById('btn-save-corretor').innerText = "Salvar Corretor";
}
