// Orquestra tudo: busca nas fontes, filtra o que já foi postado e envia para o canal.
const config = require('./config');
const store = require('./store');
const { criarEmbed } = require('./embed');
const itad = require('./sources/itad');
const cheapshark = require('./sources/cheapshark');
const epic = require('./sources/epic');

// Escolha das fontes:
//  - COM chave do ITAD: Steam + GOG + Nuuvem em reais (preço real da loja no Brasil).
//  - SEM chave: plano B com CheapShark (Steam + GOG), convertendo o dólar para reais (valores estimados).
// A Epic (só jogos grátis) entra sempre.
const FONTES = [];
if (config.itadKey) {
  FONTES.push({ nome: 'ITAD (Steam/GOG/Nuuvem em R$)', buscar: itad.buscar });
} else {
  console.warn(
    '[aviso] ITAD_API_KEY não configurada: usando CheapShark com preços convertidos do dólar (estimados) e sem Nuuvem. ' +
      'Para preços reais em reais e Nuuvem, coloque a chave no .env.'
  );
  FONTES.push({ nome: 'CheapShark (Steam/GOG, convertido de US$)', buscar: cheapshark.buscar });
}
FONTES.push({ nome: 'Epic (grátis)', buscar: epic.buscar });

let rodando = false; // trava simples para não rodar dois ciclos ao mesmo tempo

async function verificarPromocoes(client) {
  if (rodando) return { postadas: 0, aviso: 'Já existe uma verificação em andamento.' };
  rodando = true;

  try {
    const canal = await client.channels.fetch(config.canalId);
    if (!canal?.isTextBased()) throw new Error('CANAL_PROMOCOES_ID não é um canal de texto.');

    // Roda as fontes em paralelo. allSettled = se uma falhar, as outras continuam.
    const resultados = await Promise.allSettled(
      FONTES.map((f) =>
        f.buscar({
          descontoMinimo: config.descontoMinimo,
          itadKey: config.itadKey,
          popularidadeTop: config.popularidadeTop,
          pais: config.pais,
        })
      )
    );

    let todas = [];
    resultados.forEach((r, i) => {
      if (r.status === 'fulfilled') todas = todas.concat(r.value);
      else console.error(`[${FONTES[i].nome}] falhou:`, r.reason?.message ?? r.reason);
    });

    const enviados = store.limparAntigos(store.carregar());
    const novas = todas.filter((o) => !enviados[o.id]);

    // Jogos grátis primeiro, depois maiores descontos; corta no limite por ciclo.
    novas.sort((a, b) => (b.tipo === 'gratis') - (a.tipo === 'gratis') || b.desconto - a.desconto);
    const paraPostar = novas.slice(0, config.maxPorCiclo);

    // Uma mensagem por jogo, com uma pequena pausa entre elas (evita o limite de envio do Discord
    // e deixa o canal mais fácil de ler).
    for (const oferta of paraPostar) {
      await canal.send({ embeds: [criarEmbed(oferta)] });
      enviados[oferta.id] = Date.now();
      store.salvar(enviados); // salva a cada mensagem: se o bot cair, não repete o que já foi
      await new Promise((r) => setTimeout(r, 1500));
    }

    console.log(`[${new Date().toISOString()}] ${paraPostar.length} promoções postadas.`);
    return { postadas: paraPostar.length };
  } finally {
    rodando = false;
  }
}

module.exports = { verificarPromocoes };
