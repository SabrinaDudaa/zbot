// "Memória" do bot: guarda em um JSON quais promoções já foram postadas,
// para não repetir a mesma oferta a cada verificação.
const fs = require('node:fs');
const path = require('node:path');

const ARQUIVO = path.join(__dirname, '..', 'data', 'enviados.json');
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000; // esquece ofertas com mais de 30 dias

function carregar() {
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
  } catch {
    return {}; // primeira execução ou arquivo corrompido
  }
}

function salvar(dados) {
  fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  fs.writeFileSync(ARQUIVO, JSON.stringify(dados, null, 2));
}

// Remove entradas antigas para o arquivo não crescer para sempre.
function limparAntigos(dados) {
  const limite = Date.now() - VALIDADE_MS;
  for (const [id, quando] of Object.entries(dados)) {
    if (quando < limite) delete dados[id];
  }
  return dados;
}

module.exports = { carregar, salvar, limparAntigos };
