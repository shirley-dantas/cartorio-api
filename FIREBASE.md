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
2. **Configurações do projeto › Propriedades do script**, adicione:
   `REDE_CHAVE` = um texto longo e aleatório. É a chave que embaralha o CPF.
   Escolha uma e **não troque**: trocar faz todo mundo virar gente nova e o
   cadastro duplicar.
3. Ainda em Configurações, marque **"Mostrar arquivo de manifesto
   appsscript.json"** e acrescente em `oauthScopes`:

   ```
   "https://www.googleapis.com/auth/firebase.database",
   "https://www.googleapis.com/auth/userinfo.email"
   ```

   É isso que permite gravar num caminho fechado sem criar conta de serviço: o
   token sai da sua própria conta, que é dona do projeto do Firebase. Sem esses
   escopos, tudo volta 401 — e a mensagem de erro do script diz exatamente isso.
4. Rode `varrerRede()` uma vez, na mão, e aceite a permissão nova. Veja o
   resultado em **Execuções**. A primeira rodada demora (lê tudo); as seguintes
   são rápidas, porque quem já foi lido não é lido de novo.
5. Rode `criarGatilhoDaRede()` uma vez, e a varredura passa a acontecer sozinha
   toda madrugada.

Se precisar recomeçar do zero, `zerarRede()` apaga o cadastro — **e leva junto
as correções e anotações feitas à mão na tela**. As minutas no Drive não são
tocadas.

## O que ainda fica aberto, e por quê

`/casos`, `/jobs`, `/modelos` e os caminhos do bot continuam sem exigir conta
porque quem escreve neles não é o navegador:

- `api/salvar-caso.js` (o bot do WhatsApp na Vercel) grava por REST;
- `apps-script/cartorio-drive-api.js` (as minutas) também.

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
