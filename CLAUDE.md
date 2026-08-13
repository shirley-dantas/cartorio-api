# cartorio-api — Painel Operacional da Equipe Prime

Painel de acompanhamento de casos do 20º Tabelião de Notas de São Paulo.
Quem usa no dia a dia: **Shirley**, **Grazi** e **Gabriel** — os três valores
possíveis do campo `resp` em todo lugar do código.

Não é um produto genérico: é uma ferramenta interna, feita sob medida pra
rotina desse cartório. Quando algo parecer estranho, normalmente é porque
reflete um problema real da operação, não um descuido. Pergunte antes de
"consertar".

## Arquitetura em uma tela

| Parte | Onde vive | O quê |
|---|---|---|
| Painel (front) | `index.html` | Arquivo **único**, ~3.300 linhas: HTML + CSS + JS num só lugar |
| Banco | Firebase Realtime Database | `painel-cartorio-default-rtdb`, config fixa no `index.html` |
| API | `api/*.js` | Funções serverless da Vercel (CommonJS, `require`), chamam a API da Anthropic |
| Drive/Calendar | `apps-script/cartorio-drive-api.js` | Google Apps Script, publicado à parte (ver abaixo) |
| Marca | `brand/`, `design-system/` | Paleta, logos e a Joaninha (mascote) |

**O aplicativo e o painel são a mesma coisa.** É um PWA: o app instalado no
iPhone é o próprio `index.html` (`manifest.json`, `display: standalone`). Não
existe código de app separado — uma mudança atende os dois.

## Rodar e publicar

- **Não tem build, não tem teste automatizado, não tem lint.** `package.json`
  não tem `scripts`. Abrir o `index.html` no navegador já é rodar.
- **Deploy:** push no `main` → Vercel publica. Tem **Netlify também ligado** no
  repositório, gerando previews em paralelo; a produção que importa é a Vercel
  (é ela que serve as funções de `api/`).
- **Cada PR ganha URL de preview** dos dois serviços.
- O `apps-script/` **não é publicado pelo deploy**. É copiado à mão pro editor
  do Google Apps Script e publicado lá. A URL publicada está fixa na constante
  `GAS_URL` no `index.html` — mudou o deployment do GAS, tem que atualizar essa
  constante.

### Como verificar uma mudança sem ambiente de teste

Não existe suíte de testes. O que funciona bem aqui:

1. **Renderizar num navegador headless** (Chromium + Playwright), em 900px e em
   390px (largura de iPhone), e olhar o resultado + os erros de console.
2. **Extrair as funções puras do `index.html`** por nome e rodá-las contra dados
   falsos — dá pra testar de verdade a lógica de agrupamento/decisão sem subir
   Firebase nenhum.
3. Medir sobreposição/estouro de layout comparando `getBoundingClientRect()` dos
   elementos com o do card que os contém. Vários bugs de celular só aparecem
   assim.

O Firebase e as fontes/ícones externos costumam estar bloqueados no ambiente de
sessão — erros de rede no console são esperados; erro de JavaScript não é.

## Dados no Firebase

Cinco nós na raiz:

- **`casos`** — o coração. Objeto por id.
- **`focos`** — os "Lembretes manuais" (o nome antigo era "Foco do dia").
  **Array**, não objeto — cuidado ao mexer.
- **`resolucoesCentral`** — o que foi marcado como já fiz / depois / aguardando /
  ignorado na Central de Comando. Chaveado por funções `chaveResolucao*`.
- **`lembretes`** — os lembretes da Joaninha, separados dos `focos`.
- **`joaninha`** — estado do assistente.

### Formato do caso

```
{ id, nome, tipo, acao, status, resp, prazo, dep, obs, atualizado, depDesde,
  agendado, agendado_desc, calendarEventId, segundaParte, concluido }
```

- `status`: `prioridade` | `critico` | `atencao` | `emdia`
- `dep`: a etapa atual, de uma lista fechada (`DEPS`) com regras por etapa em
  `DEP_CONFIG` — quem segura, em quantos dias vira crítico, qual a próxima ação
- `agendado` / `segundaParte.data`: as **duas datas independentes** que um caso
  pode ter (escritura principal e segunda parte). Cada uma vira seu próprio
  evento na Agenda.

### Formato do lembrete manual (`focos`)

```
{ id, text, done, casoNome, resp, urgente, quando }
```

`quando` é opcional (`datetime-local`). Com data preenchida, o lembrete também
aparece na Agenda — ver `eventosDeFocos()`.

## Mapa do `index.html`

Tudo num arquivo só, nesta ordem: `<style>` → HTML → `<script type="module">`.

- **Motor de decisão** (`motorDecisao`) — função **pura**, sem rede e sem IA:
  dado um caso, devolve o veredito sobre a etapa atual. Não olha datas.
- **Central de Comando** (`calcularCentralComando` + `render*`) — uma passada só
  sobre os casos ativos, alimentando Incêndios / Próximas ações / Agenda /
  Aguardando retorno. **Uma passada só é proposital**: já houve bug de item
  aparecer numa lista e não sumir da outra por serem calculados em momentos
  diferentes.
- **Agenda** (`renderAgenda`) — janela de 7 dias, grupos Hoje / Amanhã /
  Próximos 7 dias, mais "Atrasado" que **só vale pros lembretes manuais**
  (compromisso de caso vencido some da janela; o caso segue cobrado pelo
  Incêndios, mas tarefa marcada e não feita tem que continuar visível).
- **Cartões do topo** (`renderHeroResumo`) — os números **têm que bater** com as
  listas que abrem embaixo deles. Mudou critério numa lista, mude no cartão.
- **Joaninha** — assistente flutuante. O componente em `design-system/` é puro e
  não sabe nada do produto; a integração fica no `index.html`.

## Convenções

**Commits em português, sem acentos, escopo no começo:**

```
Lembretes manuais: fecha e limpa o formulario depois de adicionar
Painel: tira o botao "Inicio" da lateral - nao tinha funcao nenhuma
Central de Comando: "Aguardando" expira sozinho depois de 3 dias
```

- **Uma mudança por commit.** Escopo pequeno é o padrão da casa.
- Merge no `main` com merge commit: `Merge: <descrição>`.
- Branches: `feature/...`, `fix/...`, `teste/...`.

**Comentários explicam o porquê, não o quê.** O código é cheio de comentários
contando qual bug motivou aquela linha ou qual decisão de produto está por trás.
Mantenha esse hábito — é a memória do projeto.

**Modelo da Anthropic usado pelas funções:** `claude-sonnet-4-6`, com a chave em
`process.env.ANTHROPIC_API_KEY`.

## Armadilhas reais

- **Preview e produção usam o MESMO banco.** A config do Firebase é fixa no
  `index.html`. Lembrete de teste criado num preview aparece no painel de
  verdade. Não existe ambiente isolado.
- **Fuso horário.** Use sempre `isoHoje()`, que fixa `America/Sao_Paulo`. Depois
  das 21h de SP o UTC já virou o dia seguinte — isso já confundiu compromisso de
  "hoje à noite" com "ontem".
- **`esc()` só escapa aspas** (`"` → `&quot;`). Serve pra atributo HTML, não é
  sanitização de conteúdo. Não confie nela pra texto vindo do usuário.
- **`renderCentralComando()` sai cedo se não houver nenhum caso** — funções que
  dependem dela não rodam nesse estado.
- **`focos` é array.** Escritas usam `set()` no array inteiro, não `push` num
  objeto.
- **Mexeu em `focos`, chame `renderCentralComando()`** além de `renderFoco()` —
  senão a Agenda só atualiza no próximo evento vindo dos casos.
- **Layout de celular:** campos `datetime-local` e afins têm largura mínima
  natural grande e não encolhem sozinhos no flex. Sem `min-width:0` eles
  estouram o card.
- **Sem cache no caminho:** o `service-worker.js` repassa tudo pra rede e o
  `vercel.json` manda `no-cache` no `index.html`. Depois do deploy basta abrir o
  app — não precisa reinstalar nem limpar cache.

## Vocabulário do cartório

- **Minuta** — rascunho do ato (escritura, procuração), gerado com IA no Drive
- **Prenotação / Livro / Folha / Controle** — identificadores do registro
- **TQ (Termo de Quitação)** — cobrado da construtora; etapa "Aguardando TQ"
- **Traslado** — via do ato entregue ao cliente
- **Segunda parte** — quando as partes assinam em datas diferentes
- **Do It / Direcional / ABG** — construtoras e parceiros recorrentes
- **Etapa (`dep`)** — onde o caso está parado e quem está segurando

## Como trabalhar aqui

- Faça a mudança pedida, no tamanho pedido. Escopo pequeno, commit pequeno.
- Antes de mexer, leia o comentário em volta — quase sempre explica por que está
  daquele jeito.
- Se a mudança tiver uma decisão de produto embutida (o que conta como
  "atrasado", o que entra num contador), **pergunte antes** em vez de escolher
  sozinho — e depois registre a escolha em comentário.
- Mudou um critério de lista? Confira se algum contador do topo usa o mesmo
  critério.
- Terminou? Rode no navegador em largura de celular antes de dizer que está
  pronto. Boa parte dos usos do painel é no iPhone.
