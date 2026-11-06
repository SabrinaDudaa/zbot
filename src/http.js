// fetch com tempo limite.
// O fetch normal do Node NÃO tem limite de tempo: se um site aceita a conexão e nunca responde,
// a chamada espera para sempre. Aqui cancelamos a requisição depois de 20 segundos.
// (O AbortSignal.timeout também cobre a leitura do corpo da resposta, o res.json().)
const TEMPO_LIMITE_MS = 20_000;

function fetchComTimeout(url, opcoes = {}) {
  return fetch(url, { ...opcoes, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
}

module.exports = { fetchComTimeout };
