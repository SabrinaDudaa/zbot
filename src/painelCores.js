// Interface das cores no Discord: comandos /painel-cores e /cor, o painel com menu + botões
// e a janelinha (modal) para digitar um hex. A parte dos cargos fica em cores.js.
//
// Os componentes usam "customId" fixos, então o painel continua funcionando mesmo depois de
// reiniciar o bot (não depende de nada guardado na memória).
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { PALETA, normalizarHex, definirCor, removerCor, limparCargosVazios } = require('./cores');

const ID_MENU = 'cor:menu';
const ID_BOTAO_HEX = 'cor:hex';
const ID_BOTAO_REMOVER = 'cor:remover';
const ID_MODAL = 'cor:modal';
const ID_CAMPO_HEX = 'cor:campo';

const comandos = [
  new SlashCommandBuilder()
    .setName('painel-cores')
    .setDescription('Posta neste canal o painel para o pessoal escolher a cor do nome')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),
  new SlashCommandBuilder()
    .setName('cor')
    .setDescription('Muda a cor do seu nome usando um código hex (ex.: #ff69b4)')
    .addStringOption((o) =>
      o.setName('hex').setDescription('Código da cor, como #ff69b4').setRequired(true)
    )
    .toJSON(),
];

function montarPainel() {
  const embed = new EmbedBuilder()
    .setColor(0xff69b4)
    .setTitle('🎨 Escolha a cor do seu nome')
    .setDescription(
      [
        '**1.** Escolha uma cor pronta no menu abaixo, ou',
        '**2.** Clique em **Cor personalizada** e digite qualquer código hex (ex.: `#ff69b4`).',
        '',
        'Quer outra cor depois? É só escolher de novo. Para voltar ao normal, use **Remover minha cor**.',
        '',
        'Dica: para achar o hex de uma cor, procure "color picker" no Google.',
      ].join('\n')
    );

  const menu = new StringSelectMenuBuilder()
    .setCustomId(ID_MENU)
    .setPlaceholder('Escolha uma cor pronta…')
    .addOptions(
      PALETA.map((c, i) => ({
        label: c.nome,
        description: c.hex,
        value: String(i),
        emoji: c.emoji,
      }))
    );

  const botoes = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(ID_BOTAO_HEX)
      .setLabel('Cor personalizada (hex)')
      .setEmoji('🖌️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(ID_BOTAO_REMOVER)
      .setLabel('Remover minha cor')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), botoes] };
}

function modalHex() {
  return new ModalBuilder()
    .setCustomId(ID_MODAL)
    .setTitle('Cor personalizada')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ID_CAMPO_HEX)
          .setLabel('Código hex da cor')
          .setPlaceholder('#ff69b4')
          .setStyle(TextInputStyle.Short)
          .setMinLength(3)
          .setMaxLength(7)
          .setRequired(true)
      )
    );
}

// Aplica a cor e responde (a resposta só aparece para quem clicou).
async function aplicar(interacao, hex, nome) {
  await interacao.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const membro = await interacao.guild.members.fetch(interacao.user.id);
    await definirCor(membro, hex, nome);
    await interacao.editReply(`Pronto! Seu nome agora está na cor **${nome ?? hex}** (${hex}) 🎨`);
  } catch (erro) {
    console.error('[cores]', erro);
    await interacao.editReply(mensagemDeErro(erro));
  }
}

function mensagemDeErro(erro) {
  if (erro.code === 50013) {
    return 'Não consegui mexer nos cargos. Peça para um admin dar ao bot a permissão **Gerenciar Cargos** e colocar o cargo dele no topo da lista de cargos.';
  }
  return 'Deu erro ao mudar sua cor. Tente de novo em instantes.';
}

const HEX_INVALIDO =
  'Esse código não parece um hex válido. Use 6 letras/números, como `#ff69b4` (ou 3, como `#f0a`).';

// Devolve true se a interação era das cores (e já foi tratada).
async function tratar(interacao) {
  if (!interacao.inGuild()) return false;

  if (interacao.isChatInputCommand()) {
    if (interacao.commandName === 'painel-cores') {
      await interacao.channel.send(montarPainel());
      await interacao.reply({ content: 'Painel postado! 🎨', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (interacao.commandName === 'cor') {
      const hex = normalizarHex(interacao.options.getString('hex', true));
      if (!hex) {
        await interacao.reply({ content: HEX_INVALIDO, flags: MessageFlags.Ephemeral });
      } else {
        await aplicar(interacao, hex);
      }
      return true;
    }
    return false;
  }

  if (interacao.isStringSelectMenu() && interacao.customId === ID_MENU) {
    const cor = PALETA[Number(interacao.values[0])];
    await aplicar(interacao, normalizarHex(cor.hex), cor.nome);
    return true;
  }

  if (interacao.isButton() && interacao.customId === ID_BOTAO_HEX) {
    await interacao.showModal(modalHex());
    return true;
  }

  if (interacao.isButton() && interacao.customId === ID_BOTAO_REMOVER) {
    await interacao.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const membro = await interacao.guild.members.fetch(interacao.user.id);
      await removerCor(membro);
      await limparCargosVazios(interacao.guild).catch(() => {});
      await interacao.editReply('Pronto, tirei a sua cor. ✨');
    } catch (erro) {
      console.error('[cores]', erro);
      await interacao.editReply(mensagemDeErro(erro));
    }
    return true;
  }

  if (interacao.isModalSubmit() && interacao.customId === ID_MODAL) {
    const hex = normalizarHex(interacao.fields.getTextInputValue(ID_CAMPO_HEX));
    if (!hex) {
      await interacao.reply({ content: HEX_INVALIDO, flags: MessageFlags.Ephemeral });
    } else {
      await aplicar(interacao, hex);
    }
    return true;
  }

  return false;
}

module.exports = { comandos, tratar };
