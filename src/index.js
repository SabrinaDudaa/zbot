// Ponto de entrada: conecta no Discord, registra o comando slash e agenda as verificações.
const { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const cron = require('node-cron');
const config = require('./config');
const { verificarPromocoes } = require('./promocoes');
const cores = require('./painelCores');
const { verificarAnimes } = require('./animes');

// Intents = quais tipos de evento o bot quer receber. Só precisamos do básico (Guilds);
// não lemos mensagens, então não precisa de intents privilegiadas.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const comandos = [
  new SlashCommandBuilder()
    .setName('promocoes')
    .setDescription('Verifica agora as promoções de jogos e posta as novas no canal')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // só quem gerencia o servidor
    .toJSON(),
  ...cores.comandos,
];

async function registrarComandos() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  // Comando de servidor aparece na hora; o global pode demorar até 1h.
  const rota = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);
  await rest.put(rota, { body: comandos });
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Logado como ${c.user.tag}`);
  try {
    await registrarComandos();
    console.log('Comandos registrados.');
  } catch (erro) {
    console.error('Falha ao registrar comandos:', erro);
  }

  // Agenda a verificação periódica (padrão: a cada 6 horas) e faz uma já na inicialização.
  cron.schedule(config.cron, () => verificarPromocoes(client).catch(console.error));
  verificarPromocoes(client).catch(console.error);

  // Animes novos: a cada 30 minutos (só se CANAL_ANIMES_ID estiver configurado).
  if (config.canalAnimesId) {
    cron.schedule(config.cronAnimes, () => verificarAnimes(client).catch(console.error));
    verificarAnimes(client).catch(console.error);
  }
});

// Cores: painel, menu, botões e comandos /cor e /painel-cores.
client.on(Events.InteractionCreate, (interacao) => {
  cores.tratar(interacao).catch((erro) => console.error('[cores] erro:', erro));
});

client.on(Events.InteractionCreate, async (interacao) => {
  if (!interacao.isChatInputCommand() || interacao.commandName !== 'promocoes') return;

  // A busca pode demorar mais de 3s (limite do Discord), então "adiamos" a resposta.
  await interacao.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const r = await verificarPromocoes(client);
    await interacao.editReply(r.aviso ?? `Pronto! ${r.postadas} promoção(ões) nova(s) postada(s).`);
  } catch (erro) {
    console.error(erro);
    await interacao.editReply('Deu erro ao verificar. Veja o console do bot.');
  }
});

client.login(config.token);
