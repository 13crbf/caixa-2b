import { fetchCorretores, saveCorretorDB } from './db.js';

export async function initCorretoresModule() {
    document.getElementById('btn-save-corretor').addEventListener('click', async () => {
        const nome = document.getElementById('cor-nome').value;
        const telefone = document.getElementById('cor-telefone').value;
        const creci = document.getElementById('cor-creci').value;
        const cpf = document.getElementById('cor-cpf').value;
        const chave_pix = document.getElementById('cor-pix').value;

        if (!nome || !cpf) {
            alert("Nome e CPF são obrigatórios para o cadastro.");
            return;
        }

        const { error } = await saveCorretorDB({ nome, telefone, creci, cpf, chave_pix });
        if (error) {
            alert("Erro ao salvar corretor: " + error.message);
        } else {
            alert("Corretor cadastrado com sucesso!");
            document.getElementById('cor-nome').value = '';
            document.getElementById('cor-telefone').value = '';
            document.getElementById('cor-creci').value = '';
            document.getElementById('cor-cpf').value = '';
            document.getElementById('cor-pix').value = '';
            loadCorretoresUI();
        }
    });

    await loadCorretoresUI();
}

export async function loadCorretoresUI() {
    const corretores = await fetchCorretores();
    const container = document.getElementById('corretores-list-container');
    const selectLancar = document.getElementById('in-corretor-id');

    container.innerHTML = '';
    selectLancar.innerHTML = '<option value="">Selecione um Corretor...</option>';

    if (corretores.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-xs text-textsecondary">Nenhum corretor cadastrado.</div>`;
        return;
    }

    corretores.forEach(c => {
        // Popula Tabela
        const row = document.createElement('div');
        row.className = "p-3 sm:p-4 flex items-center justify-between hover:bg-darkbg/50 transition text-xs";
        row.innerHTML = `
            <div>
                <div class="font-bold text-white">${c.nome}</div>
                <div class="text-[10px] text-textsecondary">CRECI: ${c.creci} • Tel: ${c.telefone}</div>
            </div>
            <div class="text-right">
                <div class="font-mono text-amber-400 font-bold text-[11px]">${c.chave_pix}</div>
                <div class="text-[10px] text-textsecondary">CPF: ${c.cpf}</div>
            </div>
        `;
        container.appendChild(row);

        // Popula Dropdown do Formulário de Lançamento
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = `${c.nome} (${c.creci})`;
        selectLancar.appendChild(opt);
    });
}
