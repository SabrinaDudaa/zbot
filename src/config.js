// Carrega o arquivo .env para process.env e centraliza as configurações do bot.
require('dotenv').config();

function obrigatoria(nome) {
  const valor = process.env[nome];
  if (!valor) {
    console.error(
      `Variável de ambiente ${nome} não definida. Veja o .env.example.`,
    );
    process.exit(1);
  }
  return valor;
}

module.exports = {
  token: obrigatoria('DISCORD_TOKEN'),
  clientId: obrigatoria('CLIENT_ID'),
  guildId: process.env.GUILD_ID || null,
  canalId: obrigatoria('CANAL_PROMOCOES_ID'),
  descontoMinimo: Number(process.env.DESCONTO_MINIMO ?? 20),
  maxPorCiclo: Number(process.env.MAX_POR_CICLO ?? 15),
  cron: process.env.CRON || '0 */6 * * *',
  itadKey: process.env.ITAD_API_KEY || null,
  // Só posta jogos que estejam entre os N mais populares do ITAD (0 desliga o filtro).
  popularidadeTop: Number(process.env.POPULARIDADE_TOP ?? 2000),
  pais: 'BR',
};
