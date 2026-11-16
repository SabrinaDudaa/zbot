# ZBot 🎮

Bot de Discord que verifica promoções de jogos e posta as melhores num canal do servidor, em reais e sem repetir ofertas.

Feito em **JavaScript (Node.js)** com **discord.js**.

## O que ele faz

- Busca promoções de **Steam, GOG e Nuuvem** (com preços reais em R$ via [IsThereAnyDeal](https://isthereanydeal.com/)).
- Posta os **jogos grátis da Epic Games Store**.
- Mostra cada oferta num cartão (embed) com capa, preço promocional, preço normal, desconto e data de término.
- Guarda o que já foi postado e **não repete** a mesma oferta (esquece depois de 30 dias).
- Verifica automaticamente a cada 6 horas (configurável) e também sob demanda com o comando `/promocoes`.

Sem a chave do ITAD, ele usa o CheapShark (Steam e GOG) e converte o dólar para real, então os preços ficam estimados e a Nuuvem não aparece.

## Tecnologias

Node.js 18.17+ · discord.js 14 · node-cron · dotenv · APIs do ITAD, CheapShark, Epic Games e AwesomeAPI (cotação do dólar)

## Como rodar

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o arquivo de exemplo e preencha com seus dados:

   ```bash
   cp .env.example .env
   ```

3. Inicie o bot:

   ```bash
   npm start
   ```

   Para recarregar automaticamente durante o desenvolvimento, use `npm run dev`.

## Configuração (`.env`)

| Variável | Obrigatória | Descrição | Padrão |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | Sim | Token do bot, do Discord Developer Portal | — |
| `CLIENT_ID` | Sim | ID da aplicação do bot | — |
| `CANAL_PROMOCOES_ID` | Sim | ID do canal de texto onde as promoções são postadas | — |
| `GUILD_ID` | Não | ID do servidor; com ele o comando aparece na hora (sem, pode levar até 1h) | — |
| `ITAD_API_KEY` | Não | Chave gratuita do ITAD para preços reais em R$ e Nuuvem | — |
| `DESCONTO_MINIMO` | Não | Desconto mínimo (%) para postar | `20` |
| `MAX_POR_CICLO` | Não | Máximo de promoções por verificação | `15` |
| `CRON` | Não | Frequência da verificação automática | `0 */6 * * *` |

## Comandos

- `/promocoes`: verifica agora e posta as promoções novas. Só quem tem a permissão de gerenciar o servidor consegue usar.

## Testes (QA)

Ainda não há testes automatizados: a verificação é manual, pelo roteiro abaixo, que parte do comportamento do código.

| # | Cenário | Como testar | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Variável obrigatória ausente | Apagar `DISCORD_TOKEN`, `CLIENT_ID` ou `CANAL_PROMOCOES_ID` do `.env` e iniciar | Mostra `Variável de ambiente X não definida. Veja o .env.example.` e encerra |
| 2 | Início normal | `npm start` com o `.env` completo | Mostra `Logado como ...` e `Comandos registrados.` |
| 3 | Sem chave do ITAD | Deixar `ITAD_API_KEY` vazia | Aviso no console e uso do CheapShark (Steam e GOG, preços estimados, sem Nuuvem) |
| 4 | Com chave do ITAD | Preencher `ITAD_API_KEY` | Ofertas de Steam, GOG e Nuuvem em R$ |
| 5 | Sem repetição | Rodar `/promocoes` duas vezes seguidas | Se nada novo apareceu, a segunda responde `Pronto! 0 promoção(ões) nova(s) postada(s).` |
| 6 | Verificação em andamento | Rodar `/promocoes` de novo enquanto a anterior ainda roda | Responde `Já existe uma verificação em andamento.` |
| 7 | Permissão do comando | Usar `/promocoes` com um usuário sem a permissão de gerenciar o servidor | O comando não fica disponível para esse usuário |
| 8 | Desconto mínimo | `DESCONTO_MINIMO=90` | Só ofertas com 90% ou mais; os jogos grátis da Epic continuam aparecendo |
| 9 | Limite por ciclo | `MAX_POR_CICLO=3` | No máximo 3 posts por verificação, jogos grátis primeiro, depois os maiores descontos |
| 10 | Lotes de embeds | `MAX_POR_CICLO=15` com mais de 10 ofertas novas | As ofertas saem em mensagens de até 10 cartões |
| 11 | Memória de ofertas | Apagar `data/enviados.json` e rodar `/promocoes` | As ofertas já postadas voltam a ser postadas |
| 12 | Canal inválido | Usar em `CANAL_PROMOCOES_ID` o ID de um canal que não é de texto | O erro `CANAL_PROMOCOES_ID não é um canal de texto.` aparece no console e a resposta do comando é `Deu erro ao verificar. Veja o console do bot.` |
| 13 | Uma fonte fora do ar | Simular falha de uma das fontes (por exemplo, sem internet para a Epic) | O erro dessa fonte é registrado no console e as outras continuam postando |

## Estrutura

```
src/
├── index.js        # conecta no Discord, registra o comando e agenda as verificações
├── config.js       # lê as variáveis do .env
├── promocoes.js    # busca nas fontes, filtra o que já foi postado e envia ao canal
├── embed.js        # monta o cartão de cada oferta
├── store.js        # guarda em JSON o que já foi postado
├── cambio.js       # cotação do dólar (plano B sem chave do ITAD)
├── http.js         # fetch com tempo limite
└── sources/        # itad.js, cheapshark.js, epic.js
```

O bot só usa o intent básico `Guilds`: ele não lê mensagens, então não precisa de permissões privilegiadas.
