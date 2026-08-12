# Guia: instalar o VS Code e trabalhar com o Claude no seu notebook

Guia feito para quem **nunca programou**. Siga na ordem, de cima para baixo.
Reserve uns 30 minutos para a primeira vez. Depois disso, abrir o projeto leva 10 segundos.

Este guia é para **Windows**. Onde o Mac for diferente, tem uma nota 🍎.

---

## Antes de começar: 5 palavras que você vai ouvir

| Palavra | O que significa na prática |
|---|---|
| **VS Code** | O programa onde os arquivos do projeto ficam abertos. É como o Word, mas para código. |
| **Terminal** | Uma caixinha preta dentro do VS Code onde você digita comandos. Nada quebra por digitar errado — ele só responde "comando não encontrado". |
| **Repositório** | A pasta do projeto, com todo o histórico de alterações. O seu fica no GitHub: `shirley-dantas/cartorio-api`. |
| **Commit** | "Salvar uma versão" com um nome. Ex.: *"ajustei o texto do rodapé"*. |
| **Push** | Enviar os commits do seu notebook para o GitHub (a nuvem). |

---

## Passo 1 — Instalar o VS Code

1. Acesse **https://code.visualstudio.com**
2. Clique no botão azul **Download for Windows**
3. Abra o arquivo baixado (`VSCodeUserSetup-....exe`)
4. Aceite os termos, vá clicando em **Avançar** e, na tela **Selecionar tarefas adicionais**, deixe marcado:
   - ✅ Adicionar ação "Abrir com Code" no menu de contexto de arquivo
   - ✅ Adicionar ação "Abrir com Code" no menu de contexto de diretório
   - ✅ Adicionar ao PATH  ← **essa é importante**
5. **Instalar** → **Concluir**

> 🍎 **Mac:** baixe "Download for macOS", arraste o app para a pasta *Aplicativos*.

### Deixar em português (opcional)

Abra o VS Code → `Ctrl + Shift + X` → pesquise **"Portuguese"** → instale
*Portuguese (Brazil) Language Pack* → clique em **Restart**.

---

## Passo 2 — Instalar o Git

O Git é o que permite baixar o projeto e enviar suas alterações.

1. Acesse **https://git-scm.com/downloads/win**
2. Baixe e execute o instalador
3. Pode clicar **Next** em tudo — as opções padrão estão certas
4. **Install** → **Finish**

> 🍎 **Mac:** abra o app *Terminal* e digite `git --version`. Ele mesmo se oferece para instalar.

---

## Passo 3 — Instalar o Node.js

O Node é o motor que roda as APIs da pasta `api/` deste projeto.

1. Acesse **https://nodejs.org**
2. Baixe a versão marcada como **LTS** (a mais estável)
3. Instale clicando **Next** em tudo

---

## Passo 4 — Reiniciar o computador

Parece bobo, mas evita 90% dos problemas de "comando não encontrado".
Reinicie antes de continuar.

---

## Passo 5 — Conferir se deu tudo certo

1. Abra o **VS Code**
2. No menu de cima: **Terminal → Novo Terminal** (ou `Ctrl + '`)
3. Uma caixinha abre embaixo. Digite cada linha abaixo e aperte **Enter**:

```powershell
git --version
node --version
npm --version
```

Você deve ver três números de versão, tipo `git version 2.47.0`.

**Se aparecer "não é reconhecido como comando"** → aquele programa não instalou direito
ou o computador não foi reiniciado. Volte no passo dele e refaça.

---

## Passo 6 — Instalar o Claude dentro do VS Code

1. No VS Code, aperte `Ctrl + Shift + X` (abre a loja de extensões)
2. Pesquise por **Claude Code**
3. Instale a extensão da **Anthropic** (ícone de faísca ✱)
4. Vai aparecer um ícone de faísca na barra da esquerda — clique nele
5. Clique em **Sign in** e faça login com a **mesma conta Claude** que você já usa
6. Pronto: aquele painel lateral sou eu. Você escreve ali em português, do jeito que falaria comigo aqui.

> Requisito: uma assinatura Claude (Pro, Max, Team ou Enterprise). Não precisa de chave de API.

---

## Passo 7 — Baixar o projeto para o notebook

1. No VS Code: `Ctrl + Shift + P` → digite **Git: Clone** → **Enter**
2. Cole este endereço:

   ```
   https://github.com/shirley-dantas/cartorio-api.git
   ```

3. Ele pergunta **onde salvar**. Sugestão: crie uma pasta `Documentos\Projetos` e escolha ela.
4. Vai abrir uma janela do navegador pedindo login no GitHub → autorize.
5. Quando terminar, clique em **Abrir** na notificação do canto inferior direito.

Deu certo se você vir, na barra esquerda, os arquivos: `index.html`, `api`, `brand`, `icons`...

---

## Passo 8 — Preparar o projeto

Com o projeto aberto, abra o terminal (`Ctrl + '`) e rode:

```powershell
npm install
```

Isso baixa as bibliotecas que o projeto usa (`firebase` e `mammoth`). Demora 1–2 minutos
e cria uma pasta `node_modules` — pode ignorar ela, é normal e não vai para o GitHub.

---

## Passo 9 — Ver o site rodando no seu notebook

### Opção A — rápida, só para ver o visual

1. `Ctrl + Shift + X` → instale a extensão **Live Server**
2. Clique com o botão direito em `index.html` → **Open with Live Server**
3. O site abre no navegador

Bom para mexer em texto, cor e layout. As funções que dependem da pasta `api/`
não funcionam nesse modo.

### Opção B — completa, com as APIs

```powershell
npx vercel dev
```

Na primeira vez ele pede login na Vercel e faz algumas perguntas (pode aceitar as padrão).
Depois abre em `http://localhost:3000`.

⚠️ As APIs usam chaves secretas que ficam guardadas na Vercel, não no projeto.
Para rodá-las localmente é preciso trazer essas chaves com `vercel env pull`.
**Me peça ajuda quando chegar nessa parte** — é o único ponto realmente chato do processo.

---

## Passo 10 — Salvar e enviar suas alterações

O caminho mais simples: **me peça no painel do Claude**.

> "salve minhas alterações e envie para o GitHub"

Se quiser fazer na mão, pelo VS Code:

1. Clique no ícone de **ramificação** na barra esquerda (Controle do Código-Fonte)
2. Escreva na caixa de cima o que você mudou. Ex.: `ajustei o texto da página inicial`
3. Clique em **Commit**
4. Clique em **Sincronizar Alterações** (Sync Changes)

---

## Como conversar comigo no VS Code

- Escreva em **português normal**, como você fala. Não precisa de termo técnico.
- Antes de eu mexer em qualquer arquivo, aparece uma tela **lado a lado**:
  o antes (esquerda) e o depois (direita). Você aprova ou recusa. Nada muda sem seu OK.
- Para eu olhar um arquivo específico, digite `@` e o nome dele. Ex.: `@index.html`
- Selecione um trecho na tela e pergunte "o que isso faz?" — eu vejo o que está selecionado.
- Se eu fizer algo que você não gostou: **"desfaça a última alteração"**.

### Frases que funcionam bem

```
o que este projeto faz?
mude o telefone do rodapé para (11) 99999-9999
o botão de enviar não está funcionando, investigue e conserte
crie uma cópia de segurança antes de mexer
explique, em palavras simples, o que a pasta api faz
```

---

## Rotina do dia a dia (depois de tudo instalado)

1. Abrir o **VS Code**
2. Menu **Arquivo → Abrir Pasta Recente → cartorio-api**
3. Clicar na faísca ✱ e me pedir o que precisa
4. No fim, pedir: *"salve e envie para o GitHub"*

---

## Se algo der errado

| Problema | O que fazer |
|---|---|
| "'git' não é reconhecido..." | Não instalou o Git ou não reiniciou. Refaça o Passo 2 e reinicie. |
| A faísca do Claude não aparece | `Ctrl + Shift + P` → **Developer: Reload Window** |
| "Not logged in · Please run /login" | Clique em **Sign in** de novo no painel do Claude |
| `npm install` dá erro vermelho | Copie o erro inteiro e cole no painel do Claude |
| Fiz besteira e quero voltar atrás | Enquanto não deu Commit, dá para desfazer com `Ctrl + Z`. Depois disso, me peça: *"desfaça o último commit"* |

**Regra de ouro:** nada que você digitar errado quebra o projeto de forma permanente.
Tudo tem histórico e tudo tem volta. Pode experimentar sem medo.
