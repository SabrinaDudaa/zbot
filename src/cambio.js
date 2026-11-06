// Cotação do dólar, usada só no "plano B" (sem chave do ITAD), porque o CheapShark informa apenas US$.
// Usa a AwesomeAPI (brasileira, gratuita, sem chave) e guarda o resultado por 1 hora.
const URL_COTACAO = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';
const UMA_HORA = 60 * 60 * 1000;

let cache = { taxa: null, quando: 0 };

async function dolarParaReal() {
  if (cache.taxa && Date.now() - cache.quando < UMA_HORA) return cache.taxa;

  const res = await fetch(URL_COTACAO);
  if (!res.ok) throw new Error(`Cotação respondeu ${res.status}`);
  const json = await res.json();

  const taxa = Number(json?.USDBRL?.bid); // "bid" = preço de compra do dólar
  if (!Number.isFinite(taxa) || taxa <= 0) throw new Error('Cotação inválida');

  cache = { taxa, quando: Date.now() };
  return taxa;
}

module.exports = { dolarParaReal };
