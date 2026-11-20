// Diagnóstico do ITAD: descobre por que o filtro de popularidade não deixa passar nenhum jogo.
//
// Como usar (na pasta do bot, com o ITAD_API_KEY no .env):
//   node scripts/diagnostico-itad.js
// ou sem .env:
//   ITAD_API_KEY=sua_chave node scripts/diagnostico-itad.js
//
// Ele só LÊ dados do ITAD. A chave nunca é impressa, então dá para colar a saída num chat.
try {
  require('dotenv').config();
} catch {
  // sem dotenv: usa só as variáveis do ambiente
}

const BASE = 'https://api.isthereanydeal.com';
const CHAVE = process.env.ITAD_API_KEY;
const PAIS = 'BR';
const HEADERS = { 'User-Agent': 'zbot-diagnostico/1.0' };

if (!CHAVE) {
  console.error('Defina ITAD_API_KEY (no .env ou na linha de comando).');
  process.exit(1);
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const curto = (texto, n = 160) => String(texto).replace(/\s+/g, ' ').slice(0, n);

// Faz a requisição sem nunca deixar a chave aparecer na saída.
async function chamar(caminho, params = {}) {
  const url = new URL(BASE + caminho);
  url.searchParams.set('key', CHAVE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
    const texto = await res.text();
    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {
      // resposta que não é JSON
    }
    return { status: res.status, json, texto };
  } catch (erro) {
    return { status: 0, json: null, texto: `erro de rede: ${erro.message}` };
  }
}

const titulo = (t) => console.log(`\n=== ${t} ===`);

(async () => {
  // 1) Lojas
  titulo('1) Lojas encontradas');
  const lojasR = await chamar('/service/shops/v1', { country: PAIS });
  console.log('status:', lojasR.status);
  const lojas = Array.isArray(lojasR.json) ? lojasR.json : [];
  const alvo = lojas.filter((l) => ['steam', 'gog', 'nuuvem'].includes(String(l.title).toLowerCase()));
  console.log('Steam/GOG/Nuuvem:', JSON.stringify(alvo));
  const ids = alvo.map((l) => l.id).join(',');
  if (!ids) {
    console.log('Nenhuma das 3 lojas foi encontrada; confira a chave e o país.');
    return;
  }

  // 2) Lista de populares
  titulo('2) Lista de jogos populares (/stats/most-popular/v1)');
  const popular = new Map(); // id -> posição
  let amostraBruta = null;
  for (let offset = 0; offset < 3000; offset += 500) {
    const r = await chamar('/stats/most-popular/v1', { offset, limit: 500 });
    if (offset === 0) {
      console.log('status:', r.status);
      amostraBruta = r.texto;
      console.log('primeiros 300 caracteres da resposta:', curto(r.texto, 300));
    }
    const pagina = Array.isArray(r.json) ? r.json : (r.json?.list ?? []);
    pagina.forEach((j, i) => popular.set(j.id, offset + i + 1));
    if (pagina.length < 500) break;
  }
  console.log('jogos na lista de populares:', popular.size);
  console.log('exemplo de ids populares:', [...popular.keys()].slice(0, 3).join(', '));
  if (popular.size <= 1) {
    console.log('ATENÇÃO: a lista veio vazia ou sem campo "id". Resposta bruta acima.');
  }
  void amostraBruta;

  // 3) Ordem padrão das ofertas
  titulo('3) Ofertas na ordem padrão (5 páginas de 200)');
  let offset = 0;
  const todas = [];
  for (let p = 0; p < 5; p++) {
    const r = await chamar('/deals/v2', { country: PAIS, shops: ids, limit: 200, offset });
    if (p === 0) console.log('status:', r.status);
    todas.push(...(r.json?.list ?? []));
    if (!r.json?.hasMore) break;
    offset = r.json.nextOffset ?? offset + 200;
  }
  const comCorte = todas.filter((i) => i.type === 'game' && (i.deal?.cut ?? 0) >= 20);
  const naLista = comCorte.filter((i) => popular.has(i.id));
  console.log(`lidas: ${todas.length} | jogos com 20%+: ${comCorte.length} | desses, populares: ${naLista.length}`);
  console.log('exemplo de ids das ofertas:', todas.slice(0, 3).map((i) => i.id).join(', '));
  console.log('primeiras 8 ofertas (título | desconto | preço | loja):');
  todas.slice(0, 8).forEach((i) =>
    console.log(`  ${curto(i.title, 45)} | -${i.deal?.cut}% | ${i.deal?.price?.amount} | ${i.deal?.shop?.name}`)
  );

  // 4) Testa valores de "sort"
  titulo('4) Valores de sort (qual aceita e quantos populares trazem)');
  const candidatos = [
    '-cut', 'cut', 'price', '-price', 'trending', '-trending', 'hot', '-hot', 'rank', '-rank',
    'popularity', '-popularity', 'release', '-release', 'expiry', '-expiry', 'new', '-new',
  ];
  for (const sort of candidatos) {
    const r = await chamar('/deals/v2', { country: PAIS, shops: ids, limit: 200, sort });
    if (r.status !== 200) {
      console.log(`sort=${sort.padEnd(12)} -> HTTP ${r.status} ${curto(r.texto, 90)}`);
    } else {
      const lista = r.json?.list ?? [];
      const jogos = lista.filter((i) => i.type === 'game' && (i.deal?.cut ?? 0) >= 20);
      const pop = jogos.filter((i) => popular.has(i.id)).length;
      const nomes = lista.slice(0, 3).map((i) => curto(i.title, 22)).join(' / ');
      console.log(
        `sort=${sort.padEnd(12)} -> OK | ${lista.length} lidas, ${jogos.length} com 20%+, ${pop} populares | ${nomes}`
      );
    }
    await pausa(300); // não sobrecarrega a API
  }

  console.log('\nFim. Copie tudo acima e mande na conversa (a chave não aparece em nenhum lugar).');
})().catch((erro) => {
  console.error('Falhou:', erro.message);
  process.exit(1);
});
