// Fonte: Epic Games Store -> apenas jogos GRÁTIS (os que a Epic "dá" toda semana).
// Usa o endpoint público (não oficial) que a própria loja usa. Não precisa de chave.
// Como não é uma API oficial, o formato pode mudar um dia; por isso o código é defensivo.
const URL_API =
  'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=pt-BR&country=BR&allowCountries=BR';

function slugDoJogo(el) {
  return (
    el.offerMappings?.[0]?.pageSlug ||
    el.catalogNs?.mappings?.[0]?.pageSlug ||
    el.productSlug ||
    el.urlSlug
  );
}

async function buscar() {
  const res = await fetch(URL_API);
  if (!res.ok) throw new Error(`Epic respondeu ${res.status}`);
  const json = await res.json();
  const elementos = json?.data?.Catalog?.searchStore?.elements ?? [];
  const agora = Date.now();
  const gratis = [];

  for (const el of elementos) {
    // "promotionalOffers" = promoção ativa AGORA ("upcomingPromotionalOffers" = futura, ignoramos)
    const janelas = el.promotions?.promotionalOffers?.flatMap((p) => p.promotionalOffers) ?? [];
    const ativa = janelas.find((o) => {
      const inicio = new Date(o.startDate).getTime();
      const fim = new Date(o.endDate).getTime();
      // desconto de 0% no preço final = 100% de desconto = grátis
      return o.discountSetting?.discountPercentage === 0 && inicio <= agora && agora <= fim;
    });
    if (!ativa) continue;

    const slug = slugDoJogo(el);
    if (!slug) continue;

    const imagem =
      el.keyImages?.find((i) => i.type === 'OfferImageWide')?.url ||
      el.keyImages?.find((i) => i.type === 'Thumbnail')?.url ||
      el.keyImages?.[0]?.url;

    gratis.push({
      id: `epic:${el.id}:${ativa.endDate}`,
      titulo: el.title,
      loja: 'Epic Games Store',
      precoNormal: (el.price?.totalPrice?.originalPrice ?? 0) / 100, // a Epic manda em centavos
      moeda: el.price?.totalPrice?.currencyCode || 'BRL',
      desconto: 100,
      url: `https://store.epicgames.com/pt-BR/p/${slug}`,
      imagem,
      ate: new Date(ativa.endDate),
      fonte: 'Epic Games Store',
      tipo: 'gratis',
    });
  }
  return gratis;
}

module.exports = { buscar };
