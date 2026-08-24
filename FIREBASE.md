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

**A ordem importa:** a *primeira* conta liberada vira a dona do financeiro
particular (`dono: true`). Faça a sua antes de avisar a Grazi.

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
