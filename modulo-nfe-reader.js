// Lê o PDF de uma Nota Fiscal (NFS-e) e tenta extrair automaticamente os dados
// da venda (empreendimento, unidade/torre, valor da nota). Suporta dois padrões
// conhecidos:
//   1) NFS-e padrão prefeitura (ex. São Paulo) — campos rotulados "Empreendimento:",
//      "Torre:", "Unidade:" e "VALOR TOTAL DO SERVIÇO = R$ ...".
//   2) DANFSe (ex. São Bernardo do Campo) — tudo dentro de "Descrição do Serviço",
//      no formato "na venda do apto X - Torre Y - Empreendimento Z..." e
//      "Valor do Serviço R$ ...".
// Novos padrões de nota podem ser adicionados em parseNfeText() conforme aparecerem.
//
// IMPORTANTE: o valor que aparece na nota é a COMISSÃO já recebida (ex. 3,65%
// do VGV do imóvel), não o VGV em si. O VGV precisa ser calculado de trás pra
// frente por quem consome esta função: vgv = valorNotaFiscal / (pctComissao / 100).

const PDFJS_VERSION = '3.11.174';
let pdfjsLibPromise = null;

function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfjsLibPromise) return pdfjsLibPromise;

    pdfjsLibPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
            resolve(window.pdfjsLib);
        };
        script.onerror = () => reject(new Error('Não foi possível carregar o leitor de PDF.'));
        document.head.appendChild(script);
    });
    return pdfjsLibPromise;
}

// Reconstrói o texto do PDF em linhas, agrupando itens que compartilham a
// mesma posição vertical (aproximação simples, mas suficiente para notas fiscais).
async function extractPdfText(file) {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const lines = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();

        let currentY = null;
        let currentLine = [];
        content.items.forEach(item => {
            const y = Math.round(item.transform[5]);
            if (currentY === null || Math.abs(y - currentY) > 2) {
                if (currentLine.length) lines.push(currentLine.join(' '));
                currentLine = [item.str];
                currentY = y;
            } else {
                currentLine.push(item.str);
            }
        });
        if (currentLine.length) lines.push(currentLine.join(' '));
    }
    return lines.join('\n');
}

function parseBRLNumber(str) {
    if (!str) return null;
    const cleaned = str.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
}

function parseNfeText(text) {
    const result = { empreendimento: '', unidadeTorre: '', valorNotaFiscal: null };

    // Padrão 1: NFS-e prefeitura, campos rotulados em linhas separadas
    const mEmpreendimento = text.match(/Empreendimento:\s*([^\n]+)/i);
    if (mEmpreendimento) {
        const mTorre = text.match(/Torre:\s*([^\n]+)/i);
        const mUnidade = text.match(/Unidade:\s*([^\n]+)/i);
        const mValor = text.match(/VALOR TOTAL DO SERVI[ÇC]O\s*=?\s*R\$\s*([\d.,]+)/i);

        result.empreendimento = mEmpreendimento[1].trim();
        result.unidadeTorre = [mUnidade?.[1]?.trim(), mTorre?.[1]?.trim()].filter(Boolean).join(' - ');
        if (mValor) result.valorNotaFiscal = parseBRLNumber(mValor[1]);
        return result;
    }

    // Padrão 2: DANFSe — tudo dentro da "Descrição do Serviço"
    const mDescricao = text.match(/na venda do\s+(.+?)\s*-\s*Torre\s+(.+?)\s*-\s*Empreendimento\s+(.+?)(?=DADOS PAGAMENTO|Chave Pix|$)/i);
    if (mDescricao) {
        result.unidadeTorre = `${mDescricao[1].trim()} - Torre ${mDescricao[2].trim()}`;
        result.empreendimento = mDescricao[3].trim();
    }
    const mValor2 = text.match(/Valor do Servi[çc]o\s*R\$\s*([\d.,]+)/i);
    if (mValor2) result.valorNotaFiscal = parseBRLNumber(mValor2[1]);

    return result;
}

/**
 * Tenta ler um PDF de nota fiscal e extrair empreendimento, unidade/torre e o
 * valor da nota (que é a COMISSÃO já recebida — ex. 3,65% do VGV — e não o
 * VGV do imóvel em si). Quem chama esta função é responsável por calcular o
 * VGV de trás pra frente: vgv = valorNotaFiscal / (pctComissao / 100).
 * Retorna null se o arquivo não for um PDF ou se a leitura falhar (o chamador
 * deve tratar isso como "não deu pra extrair, preencha manualmente").
 */
export async function tentarExtrairDadosDaNota(file) {
    if (!file || file.type !== 'application/pdf') return null;
    const text = await extractPdfText(file);
    const dados = parseNfeText(text);
    const encontrouAlgo = dados.empreendimento || dados.unidadeTorre || dados.valorNotaFiscal;
    return encontrouAlgo ? dados : null;
}
