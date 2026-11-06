# Bot de promoções de jogos para Discord

Posta num canal do seu servidor:

- **Steam e GOG** com desconto a partir de 20% (via CheapShark, preços em dólar)
- **Nuuvem** com desconto a partir de 20% (via IsThereAnyDeal, preços em reais; precisa de chave gratuita)
- **Epic Games Store**: apenas os jogos **grátis** da semana

Verifica a cada 6 horas e nunca repete uma oferta já postada. O comando `/promocoes` força uma verificação na hora.

## Como rodar

1. **Gere um token novo** no [Portal de Desenvolvedores](https://discord.com/developers/applications) → seu app → Bot → *Reset Token*.
2. `npm install`
3. Copie `.env.example` para `.env` e preencha (token, CLIENT_ID, GUILD_ID, canal, chave do ITAD).
4. `npm start`

Para convidar o bot: OAuth2 → URL Generator → escopos `bot` e `applications.commands`; permissões *View Channels*, *Send Messages* e *Embed Links*.

Chave da Nuuvem/ITAD: https://isthereanydeal.com/apps/my/ (registre um app e copie a API key). Sem ela o bot funciona normalmente, só pula a Nuuvem.

## Estrutura

```
src/
  index.js          liga o bot, registra o /promocoes e agenda o cron
  config.js         lê o .env
  promocoes.js      busca nas fontes, filtra repetidas, envia ao canal
  embed.js          monta o cartão (embed) de cada oferta
  store.js          guarda em data/enviados.json o que já foi postado
  sources/
    cheapshark.js   Steam + GOG
    epic.js         jogos grátis da Epic
    nuuvem.js       Nuuvem via ITAD
```

Cada fonte devolve ofertas no **mesmo formato** (título, loja, preços, desconto, url...). Para adicionar uma loja nova, crie um arquivo em `sources/` com uma função `buscar()` e inclua na lista `FONTES` de `promocoes.js`.

## Bibliotecas usadas

| Biblioteca | Para que serve |
|---|---|
| **discord.js** | Fala com o Discord: conecta o bot, recebe comandos, envia mensagens e embeds. É a biblioteca padrão para bots em JavaScript. |
| **dotenv** | Lê o arquivo `.env` e coloca os valores em `process.env`. Mantém token e chaves fora do código. |
| **node-cron** | Agenda tarefas por horário, com a sintaxe do cron (`0 */6 * * *` = minuto 0 de 6 em 6 horas). |
| **fetch** (nativo) | Não é biblioteca: já vem no Node 18+. Usado para chamar as APIs das lojas. |
| **fs / path** (nativos) | Módulos do Node para ler e gravar o `enviados.json`. |

### Conceitos do discord.js que aparecem no código

- **Client e intents**: o `Client` é o bot conectado. Os *intents* dizem quais eventos você quer receber. Aqui só `Guilds`, pois o bot não lê mensagens (isso evita a intent privilegiada de conteúdo de mensagem).
- **Eventos** (`client.once`, `client.on`): `ClientReady` dispara quando o bot liga; `InteractionCreate` dispara quando alguém usa um comando slash.
- **Slash commands**: precisam ser *registrados* na API do Discord (feito com `REST` + `Routes` ao ligar). Comando registrado só num servidor (`GUILD_ID`) aparece na hora; global pode demorar.
- **`deferReply`**: o Discord exige resposta em 3 segundos. Como a busca é mais lenta, "adiamos" a resposta e depois usamos `editReply`.
- **Embed** (`EmbedBuilder`): o cartão com título, cor, imagem e descrição. Cada mensagem aceita no máximo 10, por isso o envio é em lotes.

### Conceitos de JavaScript úteis para ler o código

- **async/await**: chamadas de rede demoram; `await` espera o resultado sem travar o programa.
- **`Promise.allSettled`**: roda as três fontes ao mesmo tempo e, se uma falhar (ex.: API fora do ar), as outras continuam.
- **`.filter` / `.map` / `.sort`**: filtrar, transformar e ordenar listas, usados para converter a resposta de cada API no formato padrão do bot.

## Ajustes rápidos (no `.env`)

- `DESCONTO_MINIMO=20` muda o desconto mínimo (Steam, GOG, Nuuvem).
- `MAX_POR_CICLO=15` limita quantas ofertas vão por verificação (a primeira execução tende a ter muitas).
- `CRON=0 */6 * * *` muda a frequência.

## Limitações e avisos

- Os preços de Steam/GOG vêm em **dólar**, porque o CheapShark só informa USD. Nuuvem e Epic vêm em reais.
- O endpoint da Epic **não é oficial**; se a Epic mudar o formato, `sources/epic.js` precisará de ajuste.
- Os links de oferta do CheapShark passam pelo redirect deles, como a API exige.
- Para deixar o bot ligado 24h, você precisa de um lugar para hospedá-lo (um PC ligado, uma VPS, ou serviços como Railway/Fly.io). Rodando só no seu computador, ele posta enquanto estiver aberto.
