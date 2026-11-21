// Avisos de episódios novos de anime, usando a API gratuita do AniList (https://anilist.gitbook.io/anilist-apiv2-docs).
// O AniList informa a agenda de lançamentos e os links OFICIAIS de streaming de cada anime
// (Crunchyroll, Netflix, Prime Video etc.). A API usa GraphQL: em vez de várias URLs, mandamos
// uma "query" dizendo exatamente quais campos queremos.
const { EmbedBuilder } = require('discord.js');
const config = require('./config');
const store = require('./store');
const { fetchComTimeout } = require('./http');

const API = 'https://graphql.anilist.co';
const JANELA_S = 6 * 60 * 60; // olha os episódios que saíram nas últimas 6 horas

const QUERY = `
query ($de: Int, $ate: Int, $pagina: Int) {
  Page(page: $pagina, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $de, airingAt_lesser: $ate, sort: TIME) {
      airingAt
      episode
      media {
        id
        title { romaji english }
        format
        episodes
        popularity
        isAdult
        countryOfOrigin
        siteUrl
        bannerImage
        coverImage { extraLarge color }
        externalLinks { site url type }
      }
    }
  }
}`;

const FORMATOS = { TV: 'Anime de TV', TV_SHORT: 'TV (curto)', MOVIE: 'Filme', ONA: 'ONA (web)', OVA: 'OVA', SPECIAL: 'Especial' };
const PRIORIDADE = ['crunchyroll', 'aniplex', 'netflix', 'prime video', 'disney', 'hidive', 'max'];

async function buscarAgenda(agora) {
  const episodios = [];
  for (let pagina = 1; pagina <= 5; pagina++) {
    const res = await fetchComTimeout(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query: QUERY,
        variables: { de: agora - JANELA_S, ate: agora, pagina },
      }),
    });
    if (!res.ok) throw new Error(`AniList respondeu ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(`AniList: ${json.errors[0]?.message}`);
    const dados = json.data.Page;
    episodios.push(...dados.airingSchedules);
    if (!dados.pageInfo.hasNextPage) break;
  }
  return episodios;
}

// Só links de STREAMING (oficiais), com os mais conhecidos primeiro.
function linksDeStreaming(media) {
  const links = (media.externalLinks ?? []).filter((l) => l.type === 'STREAMING' && l.url);
  const peso = (l) => {
    const i = PRIORIDADE.findIndex((p) => l.site.toLowerCase().includes(p));
    return i === -1 ? PRIORIDADE.length : i;
  };
  return links.sort((a, b) => peso(a) - peso(b));
}

function criarEmbedAnime(ep) {
  const m = ep.media;
  const titulo = m.title.english || m.title.romaji;
  const links = linksDeStreaming(m);
  const cor = /^#[0-9a-f]{6}$/i.test(m.coverImage?.color ?? '')
    ? parseInt(m.coverImage.color.slice(1), 16)
    : 0xf47521; // laranja da Crunchyroll

  const embed = new EmbedBuilder()
    .setColor(cor)
    .setAuthor({ name: '📺 NOVO EPISÓDIO' })
    .setTitle(`${titulo}`)
    .setURL(m.siteUrl)
    .setDescription(`## Episódio ${ep.episode}${m.episodes ? ` de ${m.episodes}` : ''}`)
    .addFields(
      {
        name: '▶️ Onde assistir',
        value: links.length
          ? links.map((l) => `[${l.site}](${l.url})`).join(' · ')
          : `Sem link oficial cadastrado ainda. [Ver no AniList](${m.siteUrl})`,
      },
      { name: '🎞️ Formato', value: FORMATOS[m.format] ?? m.format ?? '—', inline: true },
      { name: '🕒 Saiu', value: `<t:${ep.airingAt}:R>`, inline: true }
    )
    .setFooter({ text: 'via AniList' })
    .setTimestamp(new Date(ep.airingAt * 1000));

  // Sempre a CAPA (poster) como miniatura: tamanho fixo no canto, igual em todos os cards.
  // (Antes usávamos o banner quando existia, e banner e capa têm proporções diferentes.)
  const capa = m.coverImage?.extraLarge;
  if (capa) embed.setThumbnail(capa);
  return embed;
}

// Filtra: só anime japonês, não adulto e com um mínimo de popularidade (quantas pessoas têm o
// anime na lista do AniList), para não avisar de coisa obscura.
function filtrar(episodios, popularidadeMin) {
  return episodios.filter(
    (ep) =>
      ep.media &&
      !ep.media.isAdult &&
      ep.media.countryOfOrigin === 'JP' &&
      ep.media.popularity >= popularidadeMin
  );
}

let rodando = false;

async function verificarAnimes(client) {
  if (!config.canalAnimesId) return { postadas: 0, aviso: 'CANAL_ANIMES_ID não configurado.' };
  if (rodando) return { postadas: 0, aviso: 'Já existe uma verificação de animes em andamento.' };
  rodando = true;
  try {
    const canal = await client.channels.fetch(config.canalAnimesId);
    if (!canal?.isTextBased()) throw new Error('CANAL_ANIMES_ID não é um canal de texto');

    const todos = await buscarAgenda(Math.floor(Date.now() / 1000));
    const enviados = store.limparAntigos(store.carregar());
    const candidatos = filtrar(todos, config.animePopularidadeMin);
    const novos = candidatos
      .filter((ep) => !enviados[`anime:${ep.media.id}:${ep.episode}`])
      .slice(0, config.maxAnimesPorCiclo);

    // Mostra os descartados e o motivo, para ajustar o ANIME_POPULARIDADE_MIN com facilidade.
    for (const ep of todos.filter((e) => !candidatos.includes(e))) {
      const m = ep.media;
      const motivo = m.isAdult
        ? 'adulto'
        : m.countryOfOrigin !== 'JP'
          ? `origem ${m.countryOfOrigin}`
          : `popularidade ${m.popularity} < ${config.animePopularidadeMin}`;
      console.log(`[animes] descartado: ${m.title.romaji} ep ${ep.episode} (${motivo})`);
    }
    console.log(
      `[animes] ${todos.length} episódios na janela, ${candidatos.length} populares, ${novos.length} novos.`
    );

    for (const ep of novos) {
      await canal.send({ embeds: [criarEmbedAnime(ep)] });
      enviados[`anime:${ep.media.id}:${ep.episode}`] = Date.now();
      store.salvar(enviados); // salva a cada envio: se o bot cair, não repete
      await new Promise((r) => setTimeout(r, 1500));
    }
    return { postadas: novos.length };
  } finally {
    rodando = false;
  }
}

module.exports = { verificarAnimes, criarEmbedAnime, filtrar, linksDeStreaming };
