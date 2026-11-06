// Fonte principal: IsThereAnyDeal (ITAD) -> Steam, GOG e Nuuvem, com preços REAIS em reais (BRL).
// Diferente do CheapShark (que só informa dólar), o ITAD devolve o preço da loja para o país escolhido.
// Também traz o menor preço histórico, cupom (quando existe) e a imagem de capa do jogo.
// Precisa de uma chave gratuita: https://isthereanydeal.com/apps/my/  -> ITAD_API_KEY no .env
// Docs: https://docs.isthereanydeal.com/
const BASE = 'https://api.isthereanydeal.com';
const LOJAS_DESEJADAS = ['steam', 'gog', 'nuuvem'];
const HEADERS = { 'User-Agent': 'bot-promocoes-discord/1.0 (bot pessoal de Discord)' };

let idsCache = null; // os IDs das lojas não mudam, então buscamos uma vez só

async function erroDaApi(res, rota) {
  const corpo = (await res.text().catch(() => '')).slice(0, 200);
  return new Error(`ITAD ${rota} respondeu ${res.status} ${corpo}`);
}

// Em vez de "chumbar" os IDs das lojas, perguntamos à API pelos nomes.
async function descobrirIdsDasLojas(chave, pais) {
  if (idsCache) return idsCache;
  const params = new URLSearchParams({ key: chave, country: pais });
  const res = await fetch(`${BASE}/service/shops/v1?${params}`, { headers: HEADERS });
  if (!res.ok) throw await erroDaApi(res, '/service/shops');

  const lojas = await res.json();
  const ids = lojas
    .filter((l) => LOJAS_DESEJADAS.includes(String(l.title).toLowerCase()))
    .map((l) => l.id);
  if (ids.length === 0) throw new Error('Steam/GOG/Nuuvem não encontradas na lista de lojas do ITAD');

  idsCache = ids;
  return ids;
}

async function buscar({ descontoMinimo, itadKey, pais }) {
  const ids = await descobrirIdsDasLojas(itadKey, pais);

  const params = new URLSearchParams({
    key: itadKey,
    country: pais, // BR = preços em reais
    shops: ids.join(','), // o ITAD devolve cada jogo uma vez, na loja com o melhor preço
    limit: '100',
  });
  const res = await fetch(`${BASE}/deals/v2?${params}`, { headers: HEADERS });
  if (!res.ok) throw await erroDaApi(res, '/deals');
  const json = await res.json();

  return (json.list ?? [])
    .filter((item) => item.type === 'game' && item.deal && item.deal.cut >= descontoMinimo)
    .map((item) => {
      const d = item.deal;
      const arte = item.assets ?? {};
      return {
        // O id inclui loja e preço: se o jogo entrar em promoção de novo por outro valor, posta de novo.
        id: `itad:${d.shop.id}:${item.id}:${d.price.amount}`,
        titulo: item.title,
        loja: d.shop.name,
        precoPromo: d.price.amount,
        precoNormal: d.regular.amount,
        desconto: d.cut,
        moeda: d.price.currency || 'BRL',
        url: d.url || `https://isthereanydeal.com/game/${item.slug}/info/`,
        // Pegamos a maior capa disponível (o nome das chaves pode variar, então testamos várias)
        imagem: arte.banner600 || arte.banner400 || arte.banner300 || arte.boxart || null,
        ate: d.expiry ? new Date(d.expiry) : null,
        cupom: d.voucher || null,
        minimoHistorico: d.historyLow?.amount ?? null,
        avaliacao: null,
        fonte: 'IsThereAnyDeal',
        tipo: 'promocao',
      };
    });
}

module.exports = { buscar };
