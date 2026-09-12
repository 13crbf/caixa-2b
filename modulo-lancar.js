import { saveTransactionDB, uploadFileDB } from './db.js';

export const CATEGORIAS = {
    entrada: ['Comissão Construtora (Cury)', 'Bônus de Entrada', 'Devolução / Reembolso', 'Outras Entradas'],
    saida: ['Repasse Corretor', 'Imposto DAS (Simples)', 'Aluguel Virtual', 'Contabilidade Digital', 'CRECI Anuidade', 'Marketing / Redes', 'Outras Saídas']
};

export function setupLancarEvents(onSuccessCallback, getSaldoAtualFn) {
    const btnEntrada = document.getElementById('btn-type-entrada');
    const btnSaida = document.getElementById('btn-type-saida');
    const selectCategoria = document.getElementById('in-categoria');
    const containerCorretor = document.getElementById('container-select-corretor');

    btnEntrada.addEventListener('click', () => setMovementType('entrada'));
    btnSaida.addEventListener('click', () => setMovementType('saida'));
    
    selectCategoria.addEventListener('change', (e) => {
        if (e.target.value === 'Repasse Corretor') {
            containerCorretor.classList.remove('hidden');
        } else {
            containerCorretor.classList.add('hidden');
        }
    });

    document.getElementById('btn-save-tx').addEventListener('click', async () => {
        const id = document.getElementById('in-id').value;
        const tipo = document.getElementById('in-tipo').value;
        const data = document.getElementById('in-data').value;
        const valor = parseFloat(document.getElementById('in-valor').value);
        const categoria = selectCategoria.value;
        const corretor_id = categoria === 'Repasse Corretor' ? document.getElementById('in-corretor-id').value : null;

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
            alert("Por favor, selecione qual Corretor receberá esta retirada.");
            return;
        }

        const payload = { tipo, data, valor, categoria, corretor_id };
        if (id) payload.id = id;

        const { error } = await saveTransactionDB(payload);
        if (error) {
            alert("Erro ao salvar lançamento: " + error.message);
        } else {
            resetForm();
            onSuccessCallback();
        }
    });
}

export function setMovementType(tipo) {
    document.getElementById('in-tipo').value = tipo;
    const btnEntrada = document.getElementById('btn-type-entrada');
    const btnSaida = document.getElementById('btn-type-saida');
    const select = document.getElementById('in-categoria');
    const containerCorretor = document.getElementById('container-select-corretor');

    if (tipo === 'entrada') {
        btnEntrada.className = "py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-positive/20 text-positive border border-positive/40";
        btnSaida.className = "py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-darkbg text-textsecondary border border-cardborder";
        containerCorretor.classList.add('hidden');
    } else {
        btnSaida.className = "py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-negative/20 text-negative border border-negative/40";
        btnEntrada.className = "py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-darkbg text-textsecondary border border-cardborder";
    }

    select.innerHTML = '';
    CATEGORIAS[tipo].forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.innerText = c;
        select.appendChild(opt);
    });

    if (tipo === 'saida' && select.value === 'Repasse Corretor') {
        containerCorretor.classList.remove('hidden');
    }
}

export function resetForm() {
    document.getElementById('in-id').value = "";
    document.getElementById('in-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('in-valor').value = "";
    setMovementType('entrada');
}