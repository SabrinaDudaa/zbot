// Cores personalizadas: cada cor vira um CARGO do Discord com aquela cor, e o bot dá o cargo
// para a pessoa. É assim que o Discord colore o nome de alguém (não existe outro jeito).
// Para qualquer hex (#RRGGBB) o bot cria o cargo na hora, se ainda não existir, e reaproveita
// o mesmo cargo para quem escolher a mesma cor. Cargos de cor que ficam sem ninguém são apagados.
const PREFIXO = '🎨 '; // é assim que o bot reconhece os cargos de cor que ele mesmo criou

// Paleta rápida: o menu do Discord aceita no máximo 25 opções.
const PALETA = [
  { nome: 'Vermelho', hex: '#E74C3C', emoji: '🟥' },
  { nome: 'Carmim', hex: '#B71C1C', emoji: '🍒' },
  { nome: 'Rosa choque', hex: '#FF1493', emoji: '💗' },
  { nome: 'Rosa bebê', hex: '#FFB6C1', emoji: '🌸' },
  { nome: 'Pink', hex: '#FF69B4', emoji: '🎀' },
  { nome: 'Laranja', hex: '#FF8C00', emoji: '🟧' },
  { nome: 'Coral', hex: '#FF7F50', emoji: '🪸' },
  { nome: 'Pêssego', hex: '#FFCBA4', emoji: '🍑' },
  { nome: 'Amarelo', hex: '#FFD700', emoji: '🟨' },
  { nome: 'Dourado', hex: '#DAA520', emoji: '🌟' },
  { nome: 'Lima', hex: '#B6F500', emoji: '🍋' },
  { nome: 'Verde', hex: '#2ECC71', emoji: '🟩' },
  { nome: 'Verde floresta', hex: '#228B22', emoji: '🌲' },
  { nome: 'Menta', hex: '#98FFCC', emoji: '🍃' },
  { nome: 'Turquesa', hex: '#1ABC9C', emoji: '🐢' },
  { nome: 'Ciano', hex: '#00E5FF', emoji: '🧊' },
  { nome: 'Azul céu', hex: '#87CEEB', emoji: '☁️' },
  { nome: 'Azul', hex: '#3498DB', emoji: '🟦' },
  { nome: 'Azul marinho', hex: '#1F3A93', emoji: '🌊' },
  { nome: 'Roxo', hex: '#9B59B6', emoji: '🟪' },
  { nome: 'Violeta', hex: '#7B2FF7', emoji: '🔮' },
  { nome: 'Lavanda', hex: '#C3A6FF', emoji: '💜' },
  { nome: 'Marrom', hex: '#8B5A2B', emoji: '🟫' },
  { nome: 'Cinza', hex: '#95A5A6', emoji: '🩶' },
  { nome: 'Branco', hex: '#FFFFFF', emoji: '⬜' },
];

// Aceita "#ff00aa", "ff00aa" e a forma curta "f0a". Devolve "#FF00AA" ou null se for inválido.
function normalizarHex(texto) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(texto).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  // O Discord trata 0x000000 como "sem cor"; usamos um preto quase idêntico.
  if (h === '000000') h = '000001';
  return `#${h.toUpperCase()}`;
}

const ehCargoDeCor = (cargo) => cargo.name.startsWith(PREFIXO);

// Apaga os cargos de cor (feitos pelo bot) que não têm mais ninguém, para não encher o limite
// de 250 cargos do servidor. A contagem vem direto da API do Discord (rota de contagem de
// membros por cargo), então não precisamos da intent privilegiada de membros.
// Se a contagem falhar por qualquer motivo, não apagamos nada (melhor sobrar um cargo do que
// apagar um cargo em uso).
async function limparCargosVazios(guild) {
  const contagem = await guild.client.rest.get(`/guilds/${guild.id}/roles/member-counts`);
  if (typeof contagem?.[guild.id] !== 'number') return; // resposta estranha: não apaga nada
  for (const cargo of guild.roles.cache.values()) {
    if (ehCargoDeCor(cargo) && (contagem[cargo.id] ?? 0) === 0 && cargo.editable) {
      await cargo.delete('Cargo de cor sem ninguém').catch(() => {});
    }
  }
}

// Dá a cor para a pessoa: tira a cor antiga e coloca a nova.
async function definirCor(membro, hex, nome) {
  const guild = membro.guild;
  const cores = await guild.roles.fetch();
  const nomeDoCargo = `${PREFIXO}${nome ?? hex}`;

  let cargo = cores.find((r) => r.name === nomeDoCargo);
  if (!cargo) {
    cargo = await guild.roles.create({
      name: nomeDoCargo,
      color: hex,
      permissions: [], // cargo só estético, sem nenhuma permissão
      reason: 'Cargo de cor personalizada',
    });
  }

  await removerCor(membro, cargo.id);
  await membro.roles.add(cargo, 'Escolheu uma cor');
  await limparCargosVazios(guild).catch(() => {});
  return cargo;
}

// Tira da pessoa qualquer cargo de cor (menos o que estiver em "manter").
async function removerCor(membro, manter = null) {
  const antigos = membro.roles.cache.filter((r) => ehCargoDeCor(r) && r.id !== manter);
  if (antigos.size > 0) await membro.roles.remove(antigos, 'Trocou de cor');
}

module.exports = { PALETA, normalizarHex, definirCor, removerCor, limparCargosVazios, ehCargoDeCor };
