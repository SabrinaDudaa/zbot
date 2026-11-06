// Transforma uma oferta (formato padrão do bot) em um "embed", o cartão do Discord.
//
// Layout do cartão:
//   [🟦 STEAM]                      <- loja em destaque no topo (author)
//   🎮 Nome do jogo                 <- título clicável
//   ## 🔥 70% DE DESCONTO           <- título grande (markdown "##")
//   [🛒 Comprar na Steam]           <- link em negrito
//   💰 Por apenas | 🏷️ Preço normal | 🏪 Loja      <- campos lado a lado
//   📉 Mínimo histórico | 🎟️ Cupom | ⏳ Termina
//   [imagem grande de capa]         <- é ela que deixa o cartão "maior"
const { EmbedBuilder } = require('discord.js');

const LOJAS = {
  steam: { exibir: 'Steam', emoji: '🟦', cor: 0x66c0f4 },
  gog: { exibir: 'GOG', emoji: '🟪', cor: 0xb04bd0 },
  nuuvem: { exibir: 'Nuuvem', emoji: '🟧', cor: 0xff7a1a },
  epic: { exibir: 'Epic Games Store', emoji: '⬛', cor: 0x0078f2 },
};

// A Steam (via CheapShark) devolve a nota em inglês; traduzimos.
const AVALIACOES = {
  'Overwhelmingly Positive': 'Extremamente positivas',
  'Very Positive': 'Muito positivas',
  Positive: 'Positivas',
  'Mostly Positive': 'Majoritariamente positivas',
  Mixed: 'Mistas',
  'Mostly Negative': 'Majoritariamente negativas',
  Negative: 'Negativas',
  'Very Negative': 'Muito negativas',
  'Overwhelmingly Negative': 'Extremamente negativas',
};

// Acha o visual da loja pelo nome ("Epic Games Store" e "Epic Game Store" caem em "epic").
function infoLoja(nome) {
  const n = String(nome).toLowerCase();
  const chave = Object.keys(LOJAS).find((k) => n.includes(k));
  return chave ? LOJAS[chave] : { exibir: nome, emoji: '🛒', cor: 0x5865f2 };
}

function dinheiro(valor, moeda, estimado = false) {
  // Intl formata no padrão brasileiro (R$ 19,90 / US$ 4,99)
  const texto = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: moeda,
  }).format(valor);
  return estimado ? `≈ ${texto}` : texto;
}

// Discord usa tempo em segundos (Unix). <t:X:R> vira "em 2 dias" e <t:X:f> vira a data completa,
// já no fuso horário de quem está lendo.
const unix = (data) => Math.floor(data.getTime() / 1000);

function criarEmbed(o) {
  const loja = infoLoja(o.loja);
  const gratis = o.tipo === 'gratis';

  const embed = new EmbedBuilder()
    .setColor(loja.cor)
    .setAuthor({ name: `${loja.emoji} ${loja.exibir.toUpperCase()}` })
    .setTitle(`🎮 ${o.titulo}`)
    .setURL(o.url)
    .setTimestamp();

  // Descrição: título grande + selo de menor preço + botão (link) de compra
  const linhas = [
    gratis ? '## 🎁 JOGO GRÁTIS' : `## 🔥 ${o.desconto}% DE DESCONTO`,
  ];
  if (
    !gratis &&
    o.minimoHistorico != null &&
    o.precoPromo <= o.minimoHistorico + 0.005
  ) {
    linhas.push('🏆 **Menor preço já registrado!**');
  }
  const acao = gratis ? '🎁 Resgatar' : '🛒 Comprar';
  linhas.push('', `[**${acao} na ${loja.exibir}**](${o.url})`);
  embed.setDescription(linhas.join('\n'));

  // Campos "inline" ficam lado a lado (até 3 por linha)
  const campos = [];
  if (gratis) {
    campos.push({ name: '💰 Por apenas', value: '**GRÁTIS**', inline: true });
    if (o.precoNormal > 0) {
      campos.push({
        name: '🏷️ Valia',
        value: `~~${dinheiro(o.precoNormal, o.moeda)}~~`,
        inline: true,
      });
    }
  } else {
    campos.push({
      name: '💰 Por apenas',
      value: `**${dinheiro(o.precoPromo, o.moeda, o.estimado)}**`,
      inline: true,
    });
    campos.push({
      name: '🏷️ Preço normal',
      value: `~~${dinheiro(o.precoNormal, o.moeda, o.estimado)}~~`,
      inline: true,
    });
  }
  campos.push({ name: '🏪 Loja', value: `**${loja.exibir}**`, inline: true });

  if (!gratis && o.minimoHistorico != null) {
    campos.push({
      name: '📉 Mínimo histórico',
      value: dinheiro(o.minimoHistorico, o.moeda),
      inline: true,
    });
  }
  if (o.cupom)
    campos.push({ name: '🎟️ Cupom', value: `\`${o.cupom}\``, inline: true });
  if (o.avaliacao) {
    campos.push({
      name: '⭐ Avaliação',
      value: AVALIACOES[o.avaliacao] ?? o.avaliacao,
      inline: true,
    });
  }
  if (o.ate) {
    campos.push({
      name: gratis ? '⏳ Resgate até' : '⏳ Termina',
      value: `<t:${unix(o.ate)}:R>\n<t:${unix(o.ate)}:f>`,
      inline: true,
    });
  }
  embed.addFields(campos);

  // Imagem grande (em vez de miniatura): ocupa a largura toda do cartão
  if (o.imagem) embed.setImage(o.imagem);

  let rodape = `via ${o.fonte}`;
  if (o.estimado && o.taxa) {
    rodape += ` • valores estimados (US$ 1 ≈ R$ ${o.taxa.toFixed(2).replace('.', ',')})`;
  }
  embed.setFooter({ text: rodape });

  return embed;
}

module.exports = { criarEmbed };
