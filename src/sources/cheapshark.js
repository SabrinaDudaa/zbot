// Plano B (usado quando NÃO há ITAD_API_KEY): CheapShark -> Steam e GOG.
// API pública e gratuita, mas só informa preços em dólar. Por isso convertemos para reais usando
// a cotação do dia e marcamos os valores como ESTIMADOS (o preço real da loja no Brasil pode ser diferente).
// Docs: https://apidocs.cheapshark.com/
const { dolarParaReal } = require('../cambio');

const BASE = 'https://www.cheapshark.com/api/1.0';
const LOJAS_DESEJADAS = ['Steam', 'GOG'];
// O CheapShark exige um User-Agent descritivo (sem ele a API responde 400).
const HEADERS = { 'User-Agent': 'bot-promocoes-discord/1.0 (bot pessoal de Discord)' };

// Em vez de "chumbar" os IDs das lojas (1 = Steam, 7 = GOG...), perguntamos à API.
async function descobrirIdsDasLojas() {
  const res = await fetch(`${BASE}/stores`, { headers: HEADERS });
  if (!res.ok) throw new Error(`CheapShark /stores respondeu ${res.status}`);
  const lojas = await res.json();
  const mapa = new Map();
  for (const loja of lojas) {
    if (LOJAS_DESEJADAS.includes(loja.storeName)) {
      mapa.set(loja.storeID, loja.storeName);
    }
  }
  return mapa;
}

async function buscar({ descontoMinimo }) {
  const lojas = await descobrirIdsDasLojas();
  if (lojas.size === 0) return [];

  // Se a cotação falhar, seguimos em dólar mesmo (melhor isso do que não postar nada).
  let taxa = null;
  try {
    taxa = await dolarParaReal();
  } catch (erro) {
    console.warn('[cheapshark] sem cotação do dólar, mantendo US$:', erro.message);
  }
  const converter = (usd) => (taxa ? Math.round(usd * taxa * 100) / 100 : usd);

  const params = new URLSearchParams({
    storeID: [...lojas.keys()].join(','),
    onSale: '1',
    sortBy: 'DealRating', // as melhores ofertas primeiro (nota própria do CheapShark)
    pageSize: '60',
  });

  const res = await fetch(`${BASE}/deals?${params}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`CheapShark /deals respondeu ${res.status}`);
  const ofertas = await res.json();

  return ofertas
    .filter((o) => Number(o.savings) >= descontoMinimo)
    .map((o) => {
      const temSteamId = o.steamAppID && o.steamAppID !== 'null';
      return {
        // O id inclui o preço: se o jogo entrar em promoção de novo por outro valor, posta de novo.
        id: `cs:${o.storeID}:${o.gameID}:${o.salePrice}`,
        titulo: o.title,
        loja: lojas.get(o.storeID),
        precoPromo: converter(Number(o.salePrice)),
        precoNormal: converter(Number(o.normalPrice)),
        desconto: Math.round(Number(o.savings)),
        moeda: taxa ? 'BRL' : 'USD',
        estimado: Boolean(taxa),
        taxa,
        // O CheapShark exige que os links de oferta passem pelo redirect deles.
        // O dealID já vem codificado para URL pela API, então NÃO usamos encodeURIComponent aqui.
        url: `https://www.cheapshark.com/redirect?dealID=${o.dealID}`,
        // A capa grande da Steam (header.jpg) é bem maior que a miniatura do CheapShark.
        imagem: temSteamId
          ? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${o.steamAppID}/header.jpg`
          : o.thumb,
        avaliacao: o.steamRatingText && o.steamRatingText !== 'null' ? o.steamRatingText : null,
        cupom: null,
        minimoHistorico: null,
        ate: null,
        fonte: 'CheapShark',
        tipo: 'promocao',
      };
    });
}

module.exports = { buscar };
