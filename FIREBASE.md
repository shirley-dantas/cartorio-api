# Fechando o financeiro no Firebase

O arquivo `database.rules.json` fecha o `/financeiro` para quem não tiver
conta. Faça na ordem abaixo — publicar as regras antes de criar as contas
deixa o Financeiro inacessível até você terminar (o resto do painel continua
funcionando normalmente).

## 1. Ligar o login por e-mail

Console do Firebase → **Authentication** → *Sign-in method* → habilitar
**E-mail/senha**. Não habilite "link por e-mail" nem login anônimo.

## 2. Criar as contas

Ainda em **Authentication** → *Users* → *Add user*. Uma para você e uma para
a Grazi, com senhas que vocês escolherem. Copie o **UID** de cada uma (a
coluna da direita).

## 3. Liberar as contas — pelo próprio painel

Não precisa mexer no banco à mão. Abra o painel, clique em **Financeiro** e
entre com a conta recém-criada: como ela ainda não está liberada, aparece a
tela **"Falta liberar esta conta"**. Escreva o nome e clique em
**Liberar esta conta** — o painel grava o `/acesso/{uid}` sozinho.

Quem é a dona do financeiro particular não depende da ordem: o painel marca
`dono: true` só na conta cujo e-mail está em `FIN_EMAIL_DONA` (hoje
`cartorio@shirleydantas.com`). Qualquer outra conta se libera para o
financeiro do escritório e nada mais. Se um dia esse e-mail mudar, troque a
constante no `index.html` ou edite o `dono` pelo console.

Isso só funciona enquanto as regras não estiverem publicadas — depois do
passo 4, `/acesso` fica somente-leitura e liberar conta nova volta a ser
tarefa do console:

```
acesso
  └─ UID_DA_PESSOA
       nome: "Grazi"
```

(`dono: true` só na sua linha.)

## 4. Publicar as regras

**Realtime Database** → *Rules* → apagar o conteúdo, colar o de
`database.rules.json`, *Publicar*.

## 5. Conferir

Abra o painel, clique em **Financeiro**: deve pedir e-mail e senha. Depois de
entrar, os lançamentos aparecem. Em **Meu financeiro**, além do login, vem a
senha do cofre.

Para confirmar que fechou mesmo, abra numa aba anônima:

```
https://painel-cartorio-default-rtdb.firebaseio.com/financeiro.json
```

Antes isso devolvia os valores. Agora tem que devolver
`{ "error" : "Permission denied" }`.

## 6. A Rede (prospecção)

O `/rede` é fechado como o cofre pessoal: **só a conta dona** lê e escreve, nem
a Grazi entra. Como as regras do passo 4 já trazem esse caminho, do lado do
painel não há nada a fazer — a aba aparece na lateral e funciona.

Falta o outro lado: quem lê as minutas do Drive e enche o `/rede`. É o
`apps-script/cartorio-rede.js`, e ele mora **no mesmo projeto do Apps Script**
das minutas, porque usa o `PASTA_RAIZ_ID` e o `FIREBASE_URL` de lá.

1. Em script.google.com, abra o projeto `cartorio-drive-api` → **Arquivo › Novo
   › Script**, nome `cartorio-rede`, e cole o conteúdo do arquivo.
2. **Configurações do projeto › Propriedades do script**, adicione **duas**:
   - `REDE_CHAVE` = um texto longo e aleatório. É a chave que embaralha o CPF.
     Escolha uma e **não troque**: trocar faz todo mundo virar gente nova e o
     cadastro duplicar.
   - `ANTHROPIC_API_KEY` = a chave da IA que lê as minutas. Ela **não vem de
     graça do resto do painel**: as funções em `api/` leem a delas do ambiente
     da Vercel, e o Apps Script não alcança aquilo. Precisa de uma cópia aqui,
     ou a varredura para na primeira minuta com "ANTHROPIC_API_KEY não
     configurada".
3. Ainda em Configurações, marque **"Mostrar arquivo de manifesto
   appsscript.json"** e acrescente em `oauthScopes`:

   ```
   "https://www.googleapis.com/auth/script.scriptapp",
   "https://www.googleapis.com/auth/firebase.database",
   "https://www.googleapis.com/auth/userinfo.email"
   ```

   Os dois últimos permitem gravar num caminho fechado sem criar conta de
   serviço: o token sai da sua própria conta, que é dona do projeto do Firebase.
   Sem eles, tudo volta 401 — e a mensagem de erro do script diz exatamente isso.
   O `script.scriptapp` é o do passo 5: sem ele o `criarGatilhoDaRede()` é
   recusado, e o erro só aparece no último passo, depois de tudo o mais ter dado
   certo.

   **Cuidado com essa lista.** Enquanto ela não existe, o Google descobre
   sozinho de que o projeto precisa. No instante em que ela passa a existir, ela
   vira a lista completa e definitiva — uma lista só com os escopos da Rede
   tiraria o Drive, os Documentos e a Agenda do projeto de uma vez. Se o
   `appsscript.json` ainda não tiver `oauthScopes`, acrescente **junto** os que
   o `cartorio-drive-api` já usa: `script.external_request`, `drive`,
   `documents` e `calendar`.
4. Rode `varrerRede()` uma vez, na mão, e aceite a permissão nova. Veja o
   resultado em **Execuções**. A primeira rodada demora (lê tudo); as seguintes
   são rápidas, porque quem já foi lido não é lido de novo.
5. Rode `criarGatilhoDaRede()` uma vez, e a varredura passa a acontecer sozinha
   toda madrugada.

Se precisar recomeçar do zero, `zerarRede()` apaga o cadastro — **e leva junto
as correções e anotações feitas à mão na tela**. As minutas no Drive não são
tocadas.

## 7. O Radar Jurídico e a Base de Regras

Diferente de tudo o que veio antes, este não tem tranca: aqui mora norma
publicada, que é informação pública. As regras do passo 4 já trazem
`/radar-juridico`, `/radar-juridico-meta` e `/base-regras` abertos para leitura,
como o `/casos` — do lado do painel não há nada a fazer.

Quem varre as fontes é a **função da Vercel**, não o Apps Script, porque ela já
tem a chave da IA no ambiente. Falta só ligar o relógio:

1. Na Vercel, em **Settings › Environment Variables**, acrescente
   `CRON_SECRET` = um texto longo e aleatório. Sem ela a rota
   `/api/radar-juridico` fica aberta a quem souber o endereço (o log avisa
   isso a cada execução). A `ANTHROPIC_API_KEY` já está lá desde as minutas —
   não precisa de outra.
2. Publique. O `vercel.json` já traz o cron:

   ```
   "crons": [{ "path": "/api/radar-juridico", "schedule": "0 9 * * 1-5" }]
   ```

   Nove da manhã em UTC é **seis da manhã em São Paulo**, de segunda a sexta.
   O horário é em UTC porque é assim que a Vercel lê; a função converte para o
   fuso do cartório na hora de carimbar o dia — sem isso a varredura das seis
   seria gravada no dia seguinte, e o Jornal abriria vazio.
3. Rode uma vez na mão para plantar a base de regras e ver o primeiro
   relatório:

   ```
   https://cartorio-api.vercel.app/api/radar-juridico?chave=SEU_CRON_SECRET
   ```

   A primeira chamada planta os seis temas da carga inicial e grava o dia. Para
   só plantar a base, sem varrer, acrescente `&semear=1`; para reler um dia já
   lido, `&forcar=1`.
4. Abra o painel. A faixa **Jornal da equipe** aparece no topo assim que
   houver um dia gravado, e o botão **Radar jurídico** está em *Mais opções*.

Vale saber, quando algo parecer errado:

- **Fonte que não responde não derruba a varredura.** Ela vira uma linha no
  relatório do dia ("não respondeu a tempo"), e a tela mostra isso. Portal de
  tribunal cai com frequência; a ANOREG, em particular, precisa ser lida na
  cara do site.
- **Dia que falhou fica gravado como falhou.** Não apagar e não deixar em
  branco é de propósito: dia sem nada no banco é indistinguível de dia calmo, e
  essa confusão é justamente a que o Radar existe para não deixar acontecer.
- **A varredura não roda duas vezes no mesmo dia** — se o dia já está com
  `status: ok`, a chamada seguinte é pulada. Use `&forcar=1` para reler.

## 8. Os orçamentos

Este volta a ter tranca, e a mesma do Financeiro: em `/orcamentos` moram nome
de cliente, valor de negócio e valor venal. As regras do passo 4 já trazem
`/orcamentos`, `/orcamento-conhecimento` e `/orcamento-config` fechados para
quem estiver em `/acesso` — a Grazi entra junto, porque é ela que atende no
balcão e dá o valor à cliente.

Do lado do painel não há nada a instalar: quem grava é o próprio navegador,
com a conta de quem entrou. As tabelas já entram com a vigência declarada (**até
01/01/2027**), então o orçamento fecha desde o primeiro dia. Duas coisas ficam
na aba **Tabelas e vigência**, para quando forem necessárias:

1. **Corrigir a vigência**, se a folha mudar antes da data. O campo sobrescreve
   o que veio com a tabela; deixá-lo vazio mantém a vigência declarada na
   fonte. Passada a data, o motor trava sozinho e manda procurar a folha nova —
   tabela vencida é pior que tabela sem data, porque parece certa.
2. **Corrigir o valor da UFESP** quando ele mudar de ano. O de 2026 (R$ 38,42)
   já vem declarado; o campo sobrescreve, e vazio mantém o da fonte. É nele que
   se contam as isenções de ITCMD e os tetos de interesse social.

A base de conhecimento (`/orcamento-conhecimento`) é plantada sozinha na
primeira vez que alguém entra, e **só se estiver vazia**: o que ela corrigir
ali não é sobrescrito na abertura seguinte. É o mesmo lápis da Rede e da Base
de Regras do Radar.

## 9. As alíquotas de fora da Capital

Nada a fazer no console: o caminho `/orcamento-aliquotas` já entra na mesma
publicação de regras do passo 4.

O que ele guarda é a alíquota de ITBI de cada município e a de ITCMD de cada
estado, achadas pelo `api/aliquota-municipal.js` — que precisa da
`ANTHROPIC_API_KEY` nas variáveis da Vercel, a mesma que o Radar já usa.

Leitura e escrita ficam **abertas**, como as do Radar, e pela mesma razão:
alíquota de imposto é informação pública (não há nome nem valor de cliente
aqui), e quem grava é a função da Vercel, por REST e sem conta. Entra na mesma
lista de pendências de baixo.

O que protege o orçamento aqui **não é a tranca do banco**: é a alíquota nascer
🔴 incerta e o CHECK FINAL não fechar enquanto a Shirley não confirmar. Mesmo
que alguém escrevesse um número no caminho aberto, ele chegaria à tela marcado
como não conferido.

## O que ainda fica aberto, e por quê

`/casos`, `/jobs`, `/modelos`, os caminhos do bot e os do Radar continuam sem
exigir conta porque quem escreve neles não é o navegador:

- `api/salvar-caso.js` (o bot do WhatsApp na Vercel) grava por REST;
- `apps-script/cartorio-drive-api.js` (as minutas) também;
- `api/radar-juridico.js` (a varredura das seis) idem.

No caso do Radar a leitura pode mesmo ficar aberta — é norma publicada, e o
painel operacional, que não tem login, precisa desenhar o Jornal. A **escrita**
é que fica aberta sem precisar: ela some junto com as outras no dia em que a
conta de serviço existir.

Nenhum dos dois faz login — fechar esses caminhos hoje derruba a criação de
casos pelo WhatsApp e a entrega das minutas. Para fechar também:

1. criar uma **conta de serviço** no Google Cloud do projeto;
2. na Vercel, guardar o JSON dela numa variável de ambiente e trocar as
   chamadas REST por `firebase-admin`;
3. no Apps Script, gerar um token OAuth da mesma conta e mandá-lo no
   cabeçalho das chamadas;
4. só então trocar `".read": true` por `"auth != null"` nesses caminhos.

É uma tarde de trabalho e mexe em dois sistemas que hoje funcionam — por isso
ficou separado do fechamento do financeiro, que não dependia de nada disso.
