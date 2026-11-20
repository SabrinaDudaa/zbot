// Fonte principal: IsThereAnyDeal (ITAD) -> Steam, GOG e Nuuvem, com preços REAIS em reais (BRL).
// Diferente do CheapShark (que só informa dólar), o ITAD devolve o preço da loja para o país escolhido.
// Também traz o menor preço histórico, cupom (quando existe) e a imagem de capa do jogo.
// Precisa de uma chave gratuita: https://isthereanydeal.com/apps/my/  -> ITAD_API_KEY no .env
// Docs: https://docs.isthereanydeal.com/
const { fetchComTimeout } = require('../http');

const BASE = 'https://api.isthereanydeal.com';
const LOJAS_DESEJADAS = ['steam', 'gog', 'nuuvem'];
const HEADERS = { 'User-Agent': 'bot-promocoes-discord/1.0 (bot pessoal de Discord)' };

// Quantas ofertas lemos por verificação (páginas de 200). Com o filtro de popularidade lemos
// mais páginas, porque só uma parte das ofertas sobra.
const OFERTAS_POR_PAGINA = 200;
const MAX_PAGINAS_COM_FILTRO = 10;
const MAX_PAGINAS_SEM_FILTRO = 3;

// Lista de jogos populares (ranking do próprio ITAD): guardamos por 12 horas para não pedir
// toda verificação. O ranking muda devagar.
const POPULARES_POR_PAGINA = 500;
const VALIDADE_POPULARES_MS = 12 * 60 * 60 * 1000;

let idsCache = null; // os IDs das lojas não mudam, então buscamos uma vez só
let popularesCache = { ids: null, quando: 0 };

async function erroDaApi(res, rota) {
  const corpo = (await res.text().catch(() => '')).slice(0, 200);
  return new Error(`ITAD ${rota} respondeu ${res.status} ${corpo}`);
}

// Em vez de "chumbar" os IDs das lojas, perguntamos à API pelos nomes.
async function descobrirIdsDasLojas(chave, pais) {
  if (idsCache) return idsCache;
  const params = new URLSearchParams({ key: chave, country: pais });
  const res = await fetchComTimeout(`${BASE}/service/shops/v1?${params}`, { headers: HEADERS });
  if (!res.ok) throw await erroDaApi(res, '/service/shops');

  const lojas = await res.json();
  const ids = lojas
    .filter((l) => LOJAS_DESEJADAS.includes(String(l.title).toLowerCase()))
    .map((l) => l.id);
  if (ids.length === 0) throw new Error('Steam/GOG/Nuuvem não encontradas na lista de lojas do ITAD');

  idsCache = ids;
  return ids;
}

// Devolve um Set com os IDs dos jogos mais populares do ITAD (soma de quem tem o jogo na
// lista de desejos e na coleção). Serve para descartar jogos muito obscuros.
// Devolve null (= sem filtro) se o filtro estiver desligado (top = 0) ou se a busca falhar.
async function carregarPopulares(chave, top) {
  if (!top) return null;
  if (popularesCache.ids && Date.now() - popularesCache.quando < VALIDADE_POPULARES_MS) {
    return popularesCache.ids;
  }

  try {
    const ids = new Set();
    for (let offset = 0; offset < top; offset += POPULARES_POR_PAGINA) {
      const params = new URLSearchParams({
        key: chave,
        offset: String(offset),
        limit: String(Math.min(POPULARES_POR_PAGINA, top - offset)),
      });
      const res = await fetchComTimeout(`${BASE}/stats/most-popular/v1?${params}`, {
        headers: HEADERS,
      });
      if (!res.ok) throw await erroDaApi(res, '/stats/most-popular');

      const json = await res.json();
      const pagina = Array.isArray(json) ? json : (json.list ?? []);
      pagina.forEach((jogo) => ids.add(jogo.id));
      if (pagina.length < POPULARES_POR_PAGINA) break; // acabou a lista
    }
    if (ids.size === 0) throw new Error('a lista de jogos populares veio vazia');

    popularesCache = { ids, quando: Date.now() };
    return ids;
  } catch (erro) {
    console.warn(`[itad] não consegui a lista de jogos populares: ${erro.message}`);
    if (popularesCache.ids) {
      console.warn('[itad] usando a última lista de populares que deu certo.');
      return popularesCache.ids;
    }
    console.warn(
      '[itad] ATENÇÃO: filtro de popularidade DESLIGADO neste ciclo; jogos obscuros podem aparecer.'
    );
    return null;
  }
}

// Lê as ofertas página por página (o ITAD entrega no máximo 200 por vez).
// sort=rank traz os jogos mais populares primeiro (a ordem padrão do ITAD é quase aleatória e
// cheia de jogos obscuros). Com o filtro ligado, paramos de ler quando uma página inteira não
// tem nenhum jogo popular, porque as próximas só piorariam.
async function buscarOfertas(chave, pais, idsDasLojas, populares) {
  const ofertas = [];
  const maxPaginas = populares ? MAX_PAGINAS_COM_FILTRO : MAX_PAGINAS_SEM_FILTRO;
  let offset = 0;

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const params = new URLSearchParams({
      key: chave,
      country: pais, // BR = preços em reais
      shops: idsDasLojas.join(','), // o ITAD devolve cada jogo uma vez, na loja com o melhor preço
      sort: 'rank', // mais populares primeiro
      limit: String(OFERTAS_POR_PAGINA),
      offset: String(offset),
    });
    const res = await fetchComTimeout(`${BASE}/deals/v2?${params}`, { headers: HEADERS });
    if (!res.ok) throw await erroDaApi(res, '/deals');
    const json = await res.json();

    const lista = json.list ?? [];
    ofertas.push(...lista);
    if (!json.hasMore) break;
    if (populares && !lista.some((item) => populares.has(item.id))) break;
    offset = json.nextOffset ?? offset + OFERTAS_POR_PAGINA;
  }
  return ofertas;
}

async function buscar({ descontoMinimo, itadKey, pais, popularidadeTop }) {
  const ids = await descobrirIdsDasLojas(itadKey, pais);
  const populares = await carregarPopulares(itadKey, popularidadeTop);
  const ofertas = await buscarOfertas(itadKey, pais, ids, populares);

  const comDesconto = ofertas.filter(
    (item) => item.type === 'game' && item.deal && item.deal.cut >= descontoMinimo
  );
  // Sem a lista de populares (filtro desligado ou falhou), deixa passar tudo.
  const conhecidas = populares
    ? comDesconto.filter((item) => populares.has(item.id))
    : comDesconto;
  console.log(
    `[itad] ${ofertas.length} ofertas lidas, ${comDesconto.length} com desconto de ${descontoMinimo}% ou mais` +
      (populares
        ? `, ${conhecidas.length} entre os ${popularidadeTop} jogos mais populares.`
        : ' (sem filtro de popularidade).')
  );

  return conhecidas
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
