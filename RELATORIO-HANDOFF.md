# Relatório de passagem — Painel Operacional do 20º Tabelião de Notas

Documento para uma IA (ou pessoa) que vai **assumir a manutenção** deste painel.
Escrito em 11/11/2026. A fonte de verdade das regras de negócio é o `CLAUDE.md`
na raiz do repositório: **leia-o inteiro antes de mexer em qualquer coisa**.
Este relatório é o mapa; o `CLAUDE.md` é o contrato.

---

## 0. Prompt de abertura (cole isto na IA que vai receber o projeto)

> Você está assumindo a manutenção de um sistema em produção usado diariamente
> num cartório de notas (Shirley Dantas e Grazi). Ele calcula dinheiro real
> (comissões, emolumentos, impostos) e gera documentos que saem do cartório.
> Antes de qualquer alteração: (1) leia `CLAUDE.md` e `RELATORIO-HANDOFF.md`
> por inteiro; (2) rode a suíte de testes e confirme que está verde; (3) nunca
> altere uma regra marcada "não deve ser mexida sem perguntar" sem
> confirmação explícita da dona do projeto; (4) toda mudança de cálculo precisa
> de teste novo conferido à mão; (5) toda escrita/leitura no banco precisa
> tratar o caso "e se o banco recusar?"; (6) a usuária não é técnica: descreva
> o que mudou em termos do cartório e, em mudança de tela, mostre uma imagem
> antes de publicar; (7) ela testa pelo celular. Em dúvida sobre regra de
> negócio, pergunte — não deduza.

---

## 1. O que é o sistema

Painel de trabalho de um cartório (Capital/SP). Um arquivo principal,
**`index.html`** (~17 mil linhas: CSS, HTML e JS juntos), servido pela **Vercel**,
com **Firebase Realtime Database** por baixo. Sem framework, sem bundler, sem
build: o que está no arquivo é o que roda.

Módulos dentro do painel:

| Módulo | O que faz |
|---|---|
| Quadro / cards de caso | Esteira de etapas de cada escritura, agenda, Central de Comando |
| **Financeiro** | Fechamento mensal, comissões, DSR, carteira do registro, "Meu financeiro" cifrado |
| **Orçamentos** | Motor de cálculo de emolumentos, registro e impostos; versões; via do cliente em imagem |
| **Rede** | Prospecção a partir das qualificações das minutas (só a Shirley) |
| **Radar Jurídico** | Varredura diária de fontes oficiais por IA + Base de Regras + Joaninha jurídica |
| **Pedir documentos** | Lista por ato, link de envio para o cliente (`enviar.html`), arrastar do WhatsApp |
| **Link de pagamento / aprovação** | `pagar.html`, `orcamento.html` |
| **Minuta** | Geração por IA dentro do painel (`api/`) |
| **Capa do dossiê** | Folha impressa que acompanha o caso físico |
| **Ajudante** | Extensão do Chrome (JUCESP, RI Digital/ONR, Prefeitura de SP) |

Projetos satélites, **independentes** (outros deploys): `bussola/` (planner
pessoal da Shirley, lê `/financeiro` e escreve em `/focos`), `rafaela/` (caderno de
estudos), `maison/` (outro cliente, com Firebase próprio). Não tocar neles ao
mexer no painel, exceto o `bussola/fin-motor.js` (ver §6).

## 2. Mapa do repositório

```
index.html            painel inteiro (financeiro, orçamentos, rede, radar, cards…)
pedido-docs.js        montador do pedido de documentos (carregado pelo index)
enviar.html           página do cliente: envio de documentos (/e/{código})
pagar.html            página do cliente: pagamento (/p/{código})
orcamento.html        página do cliente: aprovar orçamento (/o/{código})
service-worker.js     PWA + recebimento de arquivos do WhatsApp (share_target)
manifest.json         PWA
vercel.json           rewrites (/e /p /o /whatsapp), cache, maxDuration
database.rules.json   regras do Firebase (quem lê/escreve cada caminho)
api/                  12 funções serverless da Vercel (LIMITE: 12, ver §5)
lib/                  lógica das funções + prompts + dados (a 13ª "função" mora aqui)
apps-script/          Google Apps Script: Drive, agenda, varredura da Rede, cliente-*
ajudante/             extensão Chrome (+ ajudante-do-painel.zip na raiz)
testes/               ~40 arquivos; suítes Node + Chromium (Playwright)
FIREBASE.md           passo a passo de infraestrutura (13 seções)
bussola/ rafaela/ maison/   projetos à parte
```

Funções em `api/`: `aliquota-municipal`, `analisar-caso`, `classificar-documento`,
`criar-doc`, `extrair-texto-arquivo`, `iniciar-minuta`, `joaninha-juridico`,
`perguntar-joaninha` (porta que atende várias ações: WhatsApp, ler-letra…),
`perguntas-minuta`, `radar-juridico` (cron), `registrar-atendimento`, `salvar-caso`
(bot antigo, desligado, código parado).

## 3. Serviços externos e segredos

Nada disso está no repositório e **não deve ser colocado nele**.

| Onde | Variável / segredo | Uso |
|---|---|---|
| Vercel | `ANTHROPIC_API_KEY` | Todas as chamadas de IA das funções (ver §8) |
| Vercel | `CRON_SECRET` | Autoriza o cron do Radar (06h de São Paulo, dia útil) |
| Vercel | `FIREBASE_HOST`/URL | Escrita por REST das funções |
| Vercel | `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | Caixa de entrada oficial (Meta) |
| Apps Script (Propriedades do script) | `ANTHROPIC_API_KEY`, `REDE_CHAVE`, `CLIENTE_SEGREDO`, `ENTRADA_SEGREDO` | IA no Apps Script; HMAC do CPF na Rede; selo dos arquivos do cliente; entrada WhatsApp |
| Firebase | Auth por e-mail/senha; nós `/acesso/{uid}` | Quem vê o financeiro (`dono`) |

As chaves `apiKey` do Firebase e do Google Picker que aparecem no `index.html`
são chaves **públicas de cliente web** (identificam o projeto; a proteção real é
`database.rules.json`). Mesmo assim: restrinja-as por domínio no console do
Google e **rode uma varredura de segredos antes de enviar o código a qualquer
terceiro**.

## 4. Modelo de dados (Firebase RTDB)

Caminhos principais e quem escreve:

- `/casos/{id}` — cards (documentos, orçamento, pagamento, envioCliente…). Aberto: escrevem o painel, o Apps Script e as funções (REST, sem conta).
- `/financeiro/*` (lançamentos, `dsr/{ciclo}`, config) — **fechado**: exige conta liberada em `/acesso`.
- Cofre "Meu financeiro" — **só `dono`**, cifrado no cliente (AES-GCM, PBKDF2 250 mil voltas, duas cópias da chave: senha e recuperação).
- `/rede`, `/correcoes` — só `dono` (Shirley). A varredura entra com o token da conta dela.
- `/radar-juridico`, `/base-regras` — abertos para leitura (norma publicada é informação pública).
- `/pedidos/{código}`, `/cobrancas/{código}`, `/entrada`, `/jobs`, `/focos` — ver `database.rules.json` e `FIREBASE.md`.

Qualquer caminho novo exige **regra nova publicada à mão no console do Firebase**
(a IA não tem acesso a isso). Sem a regra, o Firebase recusa — e o painel precisa
dizer isso na tela (ver §7, regra 5).

## 5. Restrições de plataforma que já causaram incidente

1. **Máximo de 12 funções em `api/`** (plano da Vercel). Em 22/09/2026 uma 13ª
   fez a Vercel recusar o deploy inteiro *sem aviso na tela*. Função nova entra em
   `lib/` e é atendida por uma porta existente. `testes/bussola.mjs` acusa o excesso.
2. **Firebase recusa `undefined` em qualquer profundidade** — a gravação inteira
   falha. Usar o saneador (`orcSemUndefined`) antes de gravar.
3. **Firebase não reabre uma escuta depois de `permission denied`.** Ler com erro
   deve mostrar o motivo e um "Tentar de novo".
4. **O Chromium dos testes muda de caminho entre ambientes.** Use sempre
   `testes/navegador-de-teste.mjs → abrirChromium()`; nunca `executablePath` fixo.
5. **A porta 8199 fixa** em cinco suítes (`enviar-tela`, `orcamento-link-tela`,
   `pagamento-painel`, `pagar-tela`, `pedido-tela`) pode dar `EADDRINUSE`; migrar
   para `servir()` sem argumento quando mexer nelas.
6. **Chrome bloqueia pop-up e links `javascript:` disparados por extensão**;
   o Ajudante já contorna o que foi possível e **para e pede o clique dela** no
   resto. Não tentar burlar captcha nem "clique de gente".

## 6. Acoplamentos escondidos (onde mudar um lugar quebra outro)

- **`bussola/fin-motor.js` é gerado do `index.html`** por
  `scripts/gerar-bussola-fin.mjs`. Mexeu no financeiro → rode o script; o
  `testes/bussola.mjs` acusa se ficou para trás.
- **`ajudante-do-painel.zip`** na raiz deve ser refeito
  (`zip -X -r ajudante-do-painel.zip ajudante`) a cada mudança na extensão; a versão
  do `manifest.json` e a `VERSAO` do `painel.js` **têm de andar juntas**
  (o teste obriga).
- **Os testes recortam o `index.html` publicado** (`montar.mjs`) em vez de manter
  cópia. Os recortes dependem de **comentários-âncora** no arquivo
  (`// ── Quem pode ver o dinheiro` … registro do service worker;
  `// ── A esteirinha: regras/tela`). **Não renomear nem apagar esses comentários.**
- O motor de orçamento é **puro** (sem DOM/Firebase) e vira
  `orcamento.gerado.mjs`; a tela vira `harness-orcamento.html`. Rede e Radar têm
  harness próprio porque moram fora dos recortes.
- Tabelas de emolumentos **vencem em 01/01/2027**: o motor trava sozinho a
  partir de 02/01/2027. É esperado; a folha nova das duas tabelas (Notas e
  Registro) precisa ser transcrita e conferida pelas três invariantes (§7.2).

## 7. Regras de negócio inegociáveis (resumo; detalhe e histórico no `CLAUDE.md`)

Qualquer mudança aqui exige confirmação da Shirley.

**Dinheiro**
1. Comissão nasce da **parte do tabelião**, nunca do valor cheio da escritura.
2. Repasse de 25% é **truncado**, não arredondado (856,8075 → 856,80).
3. Cada parte é arredondada por si; a diferença de até 1 centavo aparece
   declarada ("Arredondamento das partes"), nunca escondida.
4. DSR é valor **do mês**, dividido **só entre a equipe**.
5. IR só é retido no repasse a **parceiro** — regra **no código** (`finDivisao`),
   não na caixinha de Ajustes.
6. Registro de imóveis **não é receita** de ninguém: vai para a carteira virtual.
7. Fechamento: dia 26 a 25, antecipando fim de semana/feriado; batizado pelo mês em que fecha.
8. Dinheiro só aparece a quem entrou no Financeiro; o painel operacional **não tem senha de propósito**.
9. "2.000" é **dois mil** (`pagCentavos` / parser do financeiro) — já foi lido como R$ 2,00.

**Orçamentos**
1. Escada de confiança 🟢🔵🟡🔴: degrau de baixo nunca vence o de cima; nada sobe
   sozinho; divergência é mostrada, nunca aprendida em silêncio.
2. Conta **inteira em centavos**; só a tela converte para reais.
3. Registro sai da coluna **"registro com matrícula"** (= registro + R$ 76,54).
   Invariantes que protegem a transcrição das tabelas: faixas sem buraco, colunas
   crescentes, "com matrícula" = registro + 76,54 em **todas as 48 faixas**,
   45/48 tetos múltiplos exatos da UFESP (R$ 38,42).
4. **Gabarito**: apartamento 1301 → total **R$ 16.522,21**
   (escritura 4.176,24 · registro 3.133,28 · prenotação 80,14 · matrícula 76,54 · ITBI 9.056,01).
5. Imposto fora da Capital: alíquota da busca é **hipótese 🔴**, o CHECK FINAL não
   fecha até ela confirmar. Isenção **nunca** é aplicada sozinha (só o clique dela).
6. A via do cliente **sempre fecha**: linhas impressas somam o total impresso
   (teste nos 22 atos). A base mostrada à cliente é o **valor do negócio**.
7. Cada matrícula é um imóvel (3 registros, 3 prenotações, 3 certidões); imóveis
   distintos = escritura própria por imóvel (a tabela é regressiva: somar antes dá
   número menor e errado).
8. Redesenhos durante a digitação **nunca** refazem o campo sob o dedo
   (`orcRedesenharAcessorios`, `orcRedesenharResultado`).

**Banco e honestidade da tela**
5. **"E se o banco recusar?"** — toda escrita é `await`ada e diz o que houve; toda
   leitura mostra o motivo + "Tentar de novo". O `faz-de-conta-navegador.js` sabe
   recusar (`__recusarEscrita`, `__recusarLeitura`); novas escritas/leituras
   precisam de teste dos dois caminhos.

**Rede / Radar**
- Cada pessoa entra **uma vez**; CPF **nunca** vai ao banco (só HMAC com `REDE_CHAVE`);
  a correção manual da Shirley vence a máquina, sempre; "duvidoso" espera decisão.
- Radar: notícia não é norma e nunca vira 🔴; **dispensa nunca aparece sozinha**
  (`conferirItem`); fonte que falhou aparece escrita; o Radar **nunca sobrescreve**
  o que foi conferido à mão (só acrescenta em `atualizacoes`).
- Em aberto declarado (não resolver "por conta própria"): numeração 117.1 × 119.1
  das Normas de Serviço; LC municipal 227/2026 × STJ Tema 1.113; "Provimento CGJ
  17/2026" não localizado — **não citar**.

**Documentos do cliente / Ajudante**
- O que o cliente digita é "ainda não conferido" (cortado antes de entrar na minuta).
- O Drive só é tocado quando o **selo HMAC** confere.
- Nenhuma senha é guardada; **nada é pago sozinho**; captchas são dela; o Ajudante
  nunca clica no que gasta crédito (lista `NUNCA_CLICAR`, com teste).
- Nunca WhatsApp Web automatizado (Evolution/Baileys) — bane número. Só API oficial.

## 8. Pontos de atenção específicos de uma troca de IA/fornecedor

Hoje **toda a IA do sistema é Anthropic (Claude)**: `@anthropic-ai/sdk` no
`package.json`, `ANTHROPIC_API_KEY` na Vercel e no Apps Script, prompts em
`lib/*-prompt.js` e `lib/instrucoes-por-tipo.js`, e extração de texto/visão
(`lerDocumentoComIA`, `ler-letra`, classificação de documentos, minuta, Radar,
Joaninha jurídica, alíquota municipal com busca na web).

Duas coisas distintas — **decidir qual é o caso antes de começar**:

- **A) A IA nova só mantém o código** (editar, corrigir, evoluir): nada muda em
  produção; continua tudo chamando Claude. É o cenário mais seguro.
- **B) Trocar o modelo que roda dentro do painel** (Claude → outro): é uma
  migração, não uma manutenção. Riscos: prompts calibrados para um modelo;
  formatos de resposta JSON esperados (`conferirItem`, `consolidacaoDaFicha`,
  leitura dígito a dígito de documentos, "marca `?` no que não é nítido");
  suporte a PDF/imagem nativo; busca na web da alíquota; limites de tempo
  (`maxDuration` 10–60 s no `vercel.json`). Exigiria reavaliar **cada** prompt
  contra casos reais antes de publicar, e a minuta é o ponto mais sensível.

Regra para qualquer das duas: o **Radar e a Joaninha jurídica nunca podem dizer
"está liberado" sem dizer o que continua exigido** — isso é testado
(`radar-triagem.mjs`) e deve continuar sendo.

## 9. Como validar (obrigatório antes de qualquer publicação)

Pré-requisito: Node + Playwright/Chromium. Comandos (do `CLAUDE.md`):

```bash
node testes/montar.mjs && node testes/calculo.gerado.mjs
node testes/navegador.mjs && node testes/celular.mjs
node testes/rede.mjs && node testes/rede-varredura.mjs
node testes/radar.mjs && node testes/radar-triagem.mjs
node testes/orcamento.gerado.mjs && node testes/orcamento-tela.mjs
node testes/bussola.mjs
node testes/pedido-docs.mjs && node testes/pedido-tela.mjs
node testes/enviar-tela.mjs && node testes/cliente-envio.mjs && node testes/solte-card.mjs && node testes/whatsapp-entrada.mjs
node testes/docs-agrupados.mjs
node testes/card-topo.mjs
node testes/esteirinha.mjs
node testes/ajudante.mjs
node testes/capa.mjs
node testes/prefeitura.mjs
node testes/orcamento-link-tela.mjs && node testes/pagar-tela.mjs && node testes/pagamento-envio.mjs && node testes/pagamento-painel.mjs
```

Mínimo por área: **financeiro** → as 3 primeiras linhas; **orçamento** →
`orcamento.gerado` + `orcamento-tela`; **qualquer layout** → `celular.mjs`
(iPhone 13); **extensão** → `ajudante.mjs` (acusa zip/versão defasados).

**Primeira tarefa da IA que receber o projeto:** rodar a suíte inteira e
registrar o resultado-base. Só depois mexer. (Este relatório não afirma que a
suíte está verde hoje — não foi executada ao escrevê-lo.)

## 10. Fluxo de trabalho esperado

1. Mudança de tela: **desenhar antes** (`node testes/montar.mjs` + `preview.html`),
   enviar a imagem, publicar **depois do aval**.
2. Publicar = abrir PR e juntar na `main`; a Vercel sobe sozinha. Sem staging.
3. Reproduzir o defeito **pelo caminho que ela descreveu**, não pelo primeiro
   que reproduz o sintoma; antes de fechar, procurar os "irmãos" do defeito
   (`grep`) — lição do caso da soma das listas de imóveis (28/08/2026).
4. Corrigir no lugar comum, não no caso que apareceu.
5. Ela testa pelo celular e relata em linguagem do cartório ("a soma não
   funcionou"); traduzir para o caminho técnico exato antes de consertar.

## 11. Passos manuais que a IA não consegue fazer

Dependem da Shirley (console/contas): publicar `database.rules.json` no Firebase
a cada caminho novo; liberar contas em `/acesso`; variáveis na Vercel; Propriedades
do script no Apps Script (implantar nova versão a cada mudança em `apps-script/`);
configuração da Meta/WhatsApp; instalar a extensão do Chrome e dar F5 no painel
depois de atualizá-la; ligar "Permitir acesso a URLs de arquivo" na extensão.
Detalhe em `FIREBASE.md` (seções 1–13).

## 12. Pendências conhecidas (herdadas)

- Tabelas vencem **01/01/2027** (motor trava; precisa da folha nova).
- Notas explicativas 1–13 da tabela de Notas não lidas.
- Rede lê pouco (filtro: só Google Docs começando por "MINUTA", um nível); profissão vem pela metade.
- Radar ainda não rodou em produção por uma semana; varredura lê só 6.000 caracteres da capa de cada fonte.
- Ajudante: JUCESP, ONR e Prefeitura foram montados a partir de relatórios de teste real, com pontos "não validados" listados no `CLAUDE.md`; individualização na Prefeitura (etapa 2) não feita.
- Pensão: "doze meses" ambíguo; pensão em divórcio sem partilha aceita como 🔵 (sem fonte); 40% da confissão sozinha.
- Nome do card ≠ nome da parte (agrupamentos por card).
- Cinco suítes ainda com porta fixa.
- Quadro: métricas ainda não medidas (tempo até virar dinheiro, mix por ato, cliente recorrente, comparação anual).

## 13. Avisos para quem envia o código a um terceiro

- O repositório pode conter **dados reais de cliente** em fixtures/testes ou
  comentários; confira antes de enviar (CPFs, nomes, valores de casos reais).
- Remova ou não inclua: `.env*`, chaves, tokens, conteúdo de Propriedades do
  script, exportações do Firebase.
- Envie também o histórico do git (`git log`): as mensagens dos commits explicam
  o "porquê" de muitas regras.
- `maison/`, `rafaela/` e `bussola/` são projetos distintos; envie só se a IA
  também for mantê-los.
