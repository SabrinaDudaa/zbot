# ZBot 🎮

Bot de Discord que verifica promoções de jogos e posta as melhores num canal do servidor, em reais e sem repetir ofertas.

Feito em **JavaScript (Node.js)** com **discord.js**.

## O que ele faz

- Busca promoções de **Steam, GOG e Nuuvem** (com preços reais em R$ via [IsThereAnyDeal](https://isthereanydeal.com/)).
- Posta os **jogos grátis da Epic Games Store**.
- Mostra cada oferta num cartão (embed) com capa, preço promocional, preço normal, desconto e data de término.
- Guarda o que já foi postado e **não repete** a mesma oferta (esquece depois de 30 dias).
- Verifica automaticamente a cada 6 horas (configurável) e também sob demanda com o comando `/promocoes`.

Para não postar jogos obscuros, as ofertas do ITAD são filtradas pelo ranking de popularidade do próprio ITAD (quantas pessoas têm o jogo na lista de desejos ou na coleção). Só entram jogos entre os `POPULARIDADE_TOP` mais populares; aumente o número para ter mais variedade ou diminua para ficar só com os mais famosos. Esse filtro não vale no plano B (CheapShark).

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
| `POPULARIDADE_TOP` | Não | Só posta jogos entre os N mais populares do ITAD (`0` desliga o filtro) | `2000` |
| `MAX_POR_CICLO` | Não | Máximo de promoções por verificação | `15` |
| `CRON` | Não | Frequência da verificação automática | `0 */6 * * *` |

## Comandos

- `/promocoes`: verifica agora e posta as promoções novas. Só quem tem a permissão de gerenciar o servidor consegue usar.

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
