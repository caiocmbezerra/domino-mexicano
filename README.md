# Dominó Mexicano — Placar

Aplicativo mobile-first (PWA) para controlar partidas de Dominó Mexicano (Mexican Train) com o conjunto **duplo-12**: busca do carroção de abertura, ordem de saída, pontuação, regra do 0-0, ranking, estatísticas, recordes e histórico.

Funciona sem conta e sem internet. Os dados ficam salvos no próprio aparelho.

## Instalar

- **Abrir / instalar pelo navegador (Android e iPhone):** https://caiocmbezerra.github.io/domino-mexicano/
- **APK para Android (instalação direta):** https://github.com/caiocmbezerra/domino-mexicano/releases/download/android/domino-placar.apk

Os dois são atualizados sozinhos a cada mudança na branch `main` (workflows em `.github/workflows/`).

## Como rodar

```bash
npm install
npm run dev          # desenvolvimento em http://localhost:5173
npm run build        # verificação de tipos + build de produção em dist/
npm test             # testes de regra (cenários obrigatórios A–J)
npm run test:e2e     # teste ponta a ponta no navegador (após npm run build)
```

O teste E2E usa o Playwright. Se ele estiver instalado globalmente, rode `NODE_PATH=$(npm root -g) npm run test:e2e`. Para salvar capturas de tela, defina `SCREENSHOTS_DIR=/caminho`.

## Estrutura

```
src/
  config.ts              nome padrão do app, limite de jogadores, conjunto duplo-12
  domain/                regras puras, sem React (testáveis)
    types.ts             modelo de dados: Player, Match, Round, RoundResult
    doubles.ts           sequência de carroções 12→0, elegíveis, busca (avançar/voltar)
    scoring.ts           cálculo da rodada: vencedor = 0, regra do 0-0, validações
    operations.ts        criar partida, abrir/fechar/corrigir/desfazer rodada, encerrar…
    stats.ts             totais, ranking com desempate, ranking de saídas, recordes
    format.ts            textos (resumo para WhatsApp)
    cenarios-obrigatorios.test.ts   testes A–J
  storage/adapter.ts     persistência (localStorage), migração e backup
  state/store.tsx        estado React + gravação automática a cada ação
  screens/               telas
  components/            peça de dominó (SVG), ranking, diálogos, avisos
e2e/fluxo-completo.mjs   fluxo completo no navegador, em tela de celular
supabase/schema.sql      esquema preparado para sincronizar entre aparelhos (opcional)
```

### Decisões importantes

- **Nada é armazenado em duplicidade.** O total de cada jogador, o ranking, as estatísticas e a lista de carroções já utilizados são sempre derivados das rodadas e dos resultados. Por isso, corrigir uma rodada recalcula tudo sem duplicar pontos, e desfazer uma rodada devolve o carroção dela à lista de elegíveis.
- **O carroção só é marcado como usado na confirmação da abertura.** Navegar na busca ("Ninguém tem" / "Voltar") não consome nada.
- **O rascunho da rodada é salvo a cada toque**: ordem de saída, pontos e 0-0. Se o app fechar no meio da rodada, ela é retomada de onde parou.
- **Regras da turma configuráveis por partida**: a regra "0-0 marca zero" vem ativada por padrão, e os critérios de desempate (0-0, vitórias, menor pior rodada) podem ser ligados e ordenados. Sem critério que desempate, os jogadores ficam **empatados** na mesma posição. Nunca há desempate arbitrário.
- **Durante a partida, a tela principal é uma planilha**: jogadores em linhas (na ordem de exibição), rodadas em colunas e o somatório fixo à direita. Tocar numa rodada abre o detalhe dela (ordem de saída, pontos, acumulado) com a opção de corrigir. **Não há classificação durante o jogo**: ranking por pontos, ranking de saídas e recordes aparecem só no encerramento.
- **Partidas encerradas são somente leitura.** Para apagar uma partida é preciso confirmar.
- O nome do app pode ser alterado em `src/config.ts` (padrão) ou na tela **Ajustes**.

### Regras implementadas

| Situação | Pontos contabilizados |
|---|---|
| 1º a sair (vencedor da rodada) | 0 |
| Terminou com o 0-0 (regra ativa) | 0. A ocorrência fica registrada à parte e serve de desempate |
| Venceu **e** tinha o 0-0 | 0, sem benefício extra |
| Demais | soma informada das peças (inteiro ≥ 0) |

Quem sai depois do vencedor recebe 0 sugerido no campo de pontos, e o valor pode ser editado. A ordem de saída e os pontos são guardados separadamente.

## Contagem de pontos por foto (opcional)

**É opcional, à escolha do organizador.** Digitar os pontos é sempre o caminho normal. A câmera só aparece quando o servidor está configurado **e** o organizador liga a opção em **Ajustes → Contagem por foto** (desligada por padrão). Com ela ligada, cada jogador que ficou com peças ganha um botão de câmera ao lado do campo de pontos:

1. Ele vira as peças para cima, separadas, com boa luz, e tira a foto.
2. O app reduz a foto no próprio celular e envia para a função `contar-pecas` (Supabase).
3. A IA (Claude, modelo `claude-opus-5-5`) **lista** as peças. A **soma é feita no código**, nunca pela IA, e valores fora de 0–12 são descartados.
4. O operador confere peça por peça contra a foto. Peças em que a IA ficou em dúvida vêm destacadas, e dá para corrigir, remover ou adicionar uma peça que faltou.
5. "Usar N pontos" preenche o campo. Se o 0-0 estiver entre as peças, ele já é marcado e a regra da turma é aplicada. Nada fecha a rodada sem a confirmação normal.

A foto não é guardada em lugar nenhum. Sem internet ou sem configuração, o app funciona como antes, com contagem manual.

### Ativar

A chave da API fica **só no servidor** (segredo da função), nunca dentro do app.

1. Crie uma chave em https://platform.claude.com (Settings → API Keys) e adicione créditos. Cada foto custa poucos centavos de dólar.
2. Crie um projeto no Supabase **separado** só para o dominó (plano gratuito).
3. Na pasta do projeto, com a [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   supabase login
   supabase link --project-ref SEU-PROJETO
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy contar-pecas
   ```
4. No GitHub, em **Settings → Secrets and variables → Actions → Variables**, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (URL e chave **anon** do projeto). O site e o APK seguintes já saem com a câmera disponível. Localmente, use `.env.local` (modelo em `.env.example`).
5. No app, o organizador liga a opção em **Ajustes → Contagem por foto**.

A chave anon é pública por natureza. Ela impede chamadas anônimas fora do app, mas quem a extrair do app pode chamar a função e gastar créditos. Por isso vale definir um limite de gasto mensal no painel da Anthropic.

Testes: `src/photo/contagem.test.ts` cobre as regras aplicadas à resposta, e `node e2e/contagem-foto.mjs` testa o fluxo no navegador com a resposta da IA simulada, sem gastar créditos.

## Instalação no celular

### Pelo navegador (PWA) — Android e iPhone

1. Abra https://caiocmbezerra.github.io/domino-mexicano/
2. **Android (Chrome):** menu ⋮ → **Instalar app**.
3. **iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**.

Depois do primeiro acesso, o app abre mesmo sem internet (service worker em `public/sw.js`). O app usa `base: "./"` e roteamento por hash, então funciona em qualquer hospedagem estática (GitHub Pages, Vercel, Netlify, Lovable).

### APK Android (instalação direta)

O workflow `gerar-apk.yml` empacota o app com o Capacitor (`android/`) e publica o APK em **Releases → android**, sempre no mesmo link. No celular: baixe o arquivo, abra e permita "instalar apps desta fonte". Para atualizar, instale a versão nova por cima: as partidas são mantidas.

O APK é assinado com uma chave **fixa** (`android/app/instalacao-direta.keystore`), guardada no repositório de propósito. Assim todo build atualiza o app sem apagar os dados. Ela serve **apenas** para essa instalação direta.

> Atenção: os dados ficam no aparelho e no app onde foram lançados. O app instalado pelo APK e o site têm armazenamentos separados. Para levar dados de um para o outro, ou para outro celular, use **Ajustes → Exportar/Importar**.

Ícones e telas de abertura do Android: `NODE_PATH=$(npm root -g) node scripts/gerar-icones-android.cjs`.

## Publicação nas lojas (não automática)

- **Google Play:** crie a conta de desenvolvedor (taxa única). Gere uma chave de envio **própria**, guardada fora do repositório (nunca use a chave de instalação direta), e um AAB com `cd android && ./gradlew bundleRelease`, assinado com essa chave. Depois preencha a ficha da loja (política de privacidade, capturas de tela, classificação) e envie para revisão.
- **App Store (iPhone):** exige Mac com Xcode e conta Apple Developer (anual): `npm i -D @capacitor/ios@8.5.0 && npx cap add ios && npx cap open ios` → Archive → App Store Connect. Até lá, no iPhone, use a instalação pelo navegador.

## Sincronização entre aparelhos (opcional, futuro)

O armazenamento passa pela interface `StorageAdapter` (`src/storage/adapter.ts`). Para sincronizar:

1. Crie um projeto no Supabase e aplique `supabase/schema.sql`. As tabelas espelham o modelo, com chaves estrangeiras, um carroção por partida e uma rodada aberta por vez.
2. Implemente um `SupabaseAdapter` com a mesma interface e passe-o ao `StoreProvider`.
3. Mantenha o uso local como padrão: o login só deve ser exigido para quem quiser sincronizar.

## Usando no Lovable

Este é um projeto Vite + React + TypeScript + Tailwind CSS v4, a mesma base usada pelo Lovable. Para editá-lo lá, importe este repositório (`caiocmbezerra/domino-mexicano`) num projeto do Lovable.
