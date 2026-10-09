# Caderno da Rafaela

Painel de estudos para o vestibular (ENEM, FUVEST, UNICAMP), nas cores **palha, bege, branco e preto** (os post-its do mural
guardam as cores próprias deles — palha, areia, argila e linho — e não mudam com a paleta). Nasceu do *Acervo de Vestibulares* (as 247 questões com
imagem, gabarito e matéria) e ganhou, em 08/10/2026, as abas de erros,
estatísticas e macetes — sem tirar nada do acervo. Um arquivo só:
**`painel/index.html`**; a IA mora em `painel/api/ia.js`.

**É um projeto à parte do painel do cartório**: tem o próprio `package.json`,
o próprio `vercel.json` e é publicado num projeto próprio da Vercel (como o
Bússola), com *Root Directory* = `rafaela/painel`. Não mexe em nada do resto
do repositório, e o limite de 12 funções do painel do cartório não vale aqui.

## Como publicar (uma vez só)

1. Vercel → *Add New Project* → este repositório → **Root Directory:
   `rafaela/painel`** (framework: Other).
2. Variáveis de ambiente do projeto: `ANTHROPIC_API_KEY` (obrigatória).
   Opcionais: `RAFAELA_CODIGO` (um código que a página pede uma vez; sem ele
   qualquer um que ache o endereço gasta a chave), `RAFAELA_MODELO` (padrão
   `claude-opus-5-5`) e `RAFAELA_ORIGENS` (outros endereços autorizados).
3. Abrir `https://<endereço>/api/ia` no navegador: deve responder
   `{"ok":true,"chaveDaIA":true,...}`. É a conferência sem ferramenta nenhuma.
4. No celular, *Adicionar à tela inicial* (tem manifesto e ícone).

## As abas

| Aba | O que faz |
|---|---|
| **Início** | Saudação, o que revisar agora e o **mural de post-its** (lembretes: cor, concluir, apagar; escritos à mão, levemente tortos, com fita). Cópia de segurança. |
| **Acervo** | O painel de antes, inteiro: banca → matéria → filtros, PDF, resolver online, gabarito, busca. Cada questão ganhou *Errei esta* / *Tenho dúvida*. **Minhas questões**: ela fotografa uma questão de fora e ela entra no acervo dela (a IA sugere matéria e assunto e lê o texto para a busca; o gabarito é opcional). |
| **Meus erros e dúvidas** | Registro com matéria, assunto, alternativa marcada, **como resolvi**, **onde tive dificuldade**, observações, **fotos** (da resolução e da questão) e o **quadro da caneta** (resolver à mão na tela; o desenho vira foto da resolução). Liga ao acervo. *Corrigir com a IA*, *Tentar de novo*, *Marcar como dominado*. |
| **Estatísticas** | Revisar primeiro · matérias e assuntos em que mais erra · tipos de questão que confundem · por que erra · erros recorrentes · onde vai melhor. Embaixo, as estatísticas do acervo de antes. |
| **Macetes** | A IA lê as estatísticas dela e escreve macete, dica prática, como reconhecer e um "antes de marcar" por assunto prioritário. Dá para fixar no mural. |

## Regras que **não devem ser mexidas sem perguntar**

- **A IA não presume o motivo do erro.** O diagnóstico sai do que ela
  escreveu ou fotografou. Só marcou a alternativa, sem raciocínio nem foto?
  A resposta vem com `diagnostico_confiavel: false`, **sem padrão de erro**
  (nada entra nas estatísticas como se fosse certo) e com perguntas
  específicas; ela responde na própria correção e *Reanalisar* manda a
  resposta como esclarecimento. Está no prompt (`SISTEMA_CORRIGIR`) **e** no
  código (`limparCorrecao` zera o padrão quando não é confiável) — regra que só
  existe no prompt depende de o modelo lembrar dela naquele dia.
- **Estatística só com registro real.** Nada é estimado nem inventado:
  *Onde vou melhor* sai só das questões resolvidas online (mínimo 3 por
  assunto, 5 por matéria) — sem isso a tela diz que não há dados. Registro
  vindo do "Resolver online" (`origem: "online"`) não é contado duas vezes.
- **Quem classifica é a IA, mas o rótulo é reaproveitado.** Cada correção
  recebe os `padrões` e `tipos de questão` já usados e deve repetir o mesmo
  texto quando for o mesmo erro; senão "esquece de converter" e "não converte
  g em mol" virariam dois erros e nada seria *recorrente*. O tipo de erro
  pode ser trocado por ela no próprio cartão.
- **Dominado sai da fila de revisão**, mas continua nas contagens históricas.
  Nada vira dominado sozinho: acertar no *Tentar de novo* só oferece o botão.
- **Macete só vale se estiver certo.** O prompt manda deixar o campo vazio em
  vez de inventar mnemônico, falar só dos assuntos que ela de fato errou e não
  citar estatística de "quanto cai".
- **Tudo o que é dela mora no aparelho** (texto no `localStorage`, fotos no
  IndexedDB). Nada vai a um banco; a IA recebe o que é preciso para cada
  chamada e não guarda nada. Por isso existe a **cópia de segurança** na aba
  Início — e é o primeiro lugar a olhar se ela disser que "sumiu".
- **Questão adicionada por ela é dela, não do acervo oficial.** Fica só no aparelho (e na cópia de segurança), marcada *minha*, e o gabarito é o que ela digitar — a IA **nunca** diz qual alternativa é a certa ao classificar (o prompt veda e o teste confere). Sem gabarito a questão aparece e pode ser resolvida, mas não entra na conta de acertos. Escrever a banca como ENEM, FUVEST ou UNICAMP põe a questão sob a banca oficial; qualquer outro nome cria uma banca nova.
- **As fotos são reduzidas antes de sair** (JPEG, até 1.400 px; abaixo disso
  se não couber): a Vercel recusa corpo acima de 4,5 MB. No máximo 5 imagens
  por correção (o enunciado do acervo + 4 fotos).

## Onde as coisas estão (`painel/index.html`)

| O quê | Onde procurar |
|---|---|
| Guardar no aparelho | `gravarLS()`, `fotoPut()` / `fotoGet()` (IndexedDB) |
| Redução das fotos | `reduzir()`, `montarImagens()` |
| O acervo (filtros, lista, PDF) | `baseFiltro()`, `render()`, `lista()`, `#b-pdf` |
| Resolver online / tentar de novo | `abrirResolver()` — grava as tentativas |
| Minhas questões (acervo pessoal) | `formQuestao()`, `montarPessoais()` — entram em `D.q` com `pessoal: true`; foto no IndexedDB (chave = id da questão), dados em `rafa.questoes` |
| Formulário de registro | `formRegistro()`, `buscarQ()` |
| Quadro da caneta | `quadroCaneta()` — pressão vira espessura; depois que a caneta aparece, o toque (palma) é ignorado; traços em fração da largura |
| A correção | `corrigir()`, `htmlCorrecao()`, `assinatura()` |
| As contas das estatísticas | `calc()` — puro, exposto em `window.__rafa.calc` |
| Estatísticas e prioridades na tela | `renderStats()` |
| Macetes | `resumoParaIA()`, `gerarDicas()`, `renderDicas()` |
| Mural de post-its | `htmlPostit()`, `desenharMural()`, estilo `.postit` |
| Cópia de segurança | `salvarCopia()`, `restaurarCopia()` |
| A IA (servidor) | `painel/api/ia.js` — `corrigir()`, `dicas()` |

## Testes

```bash
node rafaela/testes/ia.mjs       # a porta da IA, sem internet e sem chave
node rafaela/testes/painel.mjs   # o painel no Chromium (iPad e iPhone 13), IA fingida
```

O `painel.mjs` sobe um servidor com os arquivos de verdade (inclusive as 247
questões) e um `/api/ia` fingido, e guarda imagens em `rafaela/testes/saida/`.
Ele cobre o caminho que ela descreveu: Acervo → *Errei esta* → foto →
*Salvar e corrigir* → *Tentar de novo*; e as estatísticas com registros
semeados à mão para conferir cada número.

## Na fila

- O quadro da caneta foi testado com eventos de caneta simulados num iPad virtual; **ainda não numa caneta de verdade**. Se o traço sair falhado, ou a palma escrever, é o primeiro lugar a olhar.

- A IA **ainda não foi chamada de verdade** (sem chave aqui): o formato da
  resposta e o prompt estão testados com cliente fingido. A primeira correção
  real é o primeiro lugar a olhar se algo vier estranho.
- O `data.json` tem 247 questões / 3 provas. Para ampliar o acervo oficial
  (provas inteiras), ver `LEIA-ME.md` (importar PDFs → classificar →
  `gerar_painel.py`); questões soltas ela mesma adiciona pelo painel.
- Os registros ainda não vão para a nuvem: trocar de aparelho é por cópia de
  segurança. Se ela quiser sincronizar celular e computador, o caminho é um
  Firebase próprio dela — não o do cartório.
- O nome *Caderno da Rafaela* está no `<title>`, no `<h1>`, no manifesto e na
  nota do PDF; trocar o nome é trocar esses quatro lugares.
