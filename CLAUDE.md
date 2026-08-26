# Painel Operacional — 20º Tabelião de Notas

Painel de trabalho da Shirley e da Grazi. Um arquivo só: **`index.html`**
(CSS, markup e código no mesmo lugar), servido pela Vercel, com Firebase
Realtime Database por baixo. As funções em `api/` atendem o bot do WhatsApp,
e `apps-script/` gera as minutas.

A Shirley não é da área técnica. Ela descreve o problema em termos do
cartório, não de software — e prefere ver uma imagem da tela antes de a coisa
ir para o ar.

---

## O financeiro

### A escada do dinheiro

O dinheiro não se reparte num bolo só: desce degraus, e cada degrau tem dono.

```
Parte do tabelião              R$ 3.427,23   ← só sobre isto incide comissão
  Repasse de 25%               R$   856,80   ← o que vem para a mesa
    Shirley, metade            R$   428,40   ← passa inteira
    Grazi, metade              R$   428,40   − IR 27,5% → R$ 310,59 na mão
  Fica com o tabelião          R$ 2.570,43
```

Regras que custaram conversa e **não devem ser mexidas sem perguntar**:

- **A comissão nasce da parte do tabelião**, nunca do valor cheio da
  escritura. O valor que a cliente pagou não é pedido nem exibido — ela não
  precisa dele. (O campo `valorEscritura` ainda existe em lançamentos
  antigos; só não aparece mais.)
- **O repasse é truncado, não arredondado.** 25% de 3.427,23 dá 856,8075 e o
  que chega é R$ 856,80. Arredondar inventaria um centavo que o tabelião não
  pagou.
- **O DSR fica fora da conta**, a pedido dela.
- **O IR é retido no repasse, não no bolo.** É atributo de quem recebe
  (`descontaIR`): a parte da Shirley passa bruta — o imposto dela é recolhido
  por fora —, a da Grazi e a dos parceiros saem descontadas.
- **Cada parte é arredondada por si**, como na planilha que ela conferia à
  mão: metade de R$ 621,69 vira R$ 310,85 para as duas. Isso faz as partes
  somarem até um centavo além do repasse; a diferença aparece declarada
  ("Arredondamento das partes"), nunca escondida.

### Os arranjos

A divisão é por **quotas iguais**, e quem entra depende do parceiro que
trouxe o caso. Quem tem o mesmo número divide a mesma quota:

| Arranjo | Divisão | Sobre R$ 856,80 |
|---|---|---|
| Direto | Shirley \| Grazi | 428,40 cada |
| Renato | Shirley \| Grazi \| Renato | 285,60 cada |
| Vinicius | Shirley \| Grazi \| Vinicius | 285,60 cada |
| Basiotti | (Shirley+Grazi) \| Basiotti \| Renato | 142,80 · 142,80 · 285,60 · 285,60 |

No do Basiotti, Shirley e Grazi entram **juntas como uma sócia só**. O
Gabriel não entra no rateio.

### O fechamento

Não é mês de calendário: abre dia 26 e fecha dia 25, **antecipando** quando o
25 cai em fim de semana ou feriado (Páscoa calculada, feriados nacionais e os
de São Paulo). O ciclo é batizado pelo mês em que fecha.

### O registro de imóveis

A cliente paga junto, mas **não é receita de ninguém**: nenhuma comissão
encosta nele. Fica na *carteira virtual* até o registro ficar pronto e ser
pago ao RI. Por isso mora numa aba só dele.

### Por onde se lança

**Pelo card, não pela aba.** Ao digitar o número de controle num card que
ainda não tem lançamento, abre a janela pedindo valor ao tabelião, situação,
data, valor do registro e a divisão. Salvou, a aba Financeiro se alimenta
sozinha (cliente, tipo de ato e vínculo vão junto). A faixa do card mostra o
resultado e o botão Editar reabre a **mesma** janela — nunca cria outro
lançamento.

A aba Financeiro é onde se **lê o fechamento**:

- **Lançamentos** — planilha, uma linha por escritura, com o total em
  vermelho no topo (acima dos nomes) e o botão LÍQUIDO/BRUTO. Em bruto as
  colunas das pessoas batem com a planilha antiga dela.
- **Quem recebe** — uma pílula por pessoa com o valor final. Só quem tem IR
  retido ganha a nota explicando que aquilo é líquido, e só o parceiro lista
  de que casos veio a participação dele (a equipe está em todos).
- **Carteira do registro** — o saldo que ainda não foi pago ao RI.
- **Ajustes** — percentuais, pessoas e arranjos.

### O mês no quadro

O quadro (lateral, em *Mais opções*) lia os casos em quatro cortes e não sabia
nada de dinheiro. Agora leva embaixo uma seção **O mês em dinheiro**, com o
fechamento escolhido num seletor:

- **Quanto entrou** — o repasse recebido, a parte do tabelião e o que ainda
  está a receber, cada um com a variação contra o fechamento anterior.
- **Escrituras do fechamento** — quantas saíram, de quantos clientes, e a
  escritura média (parte do tabelião ÷ escrituras), que separa mês que cresceu
  por volume de mês que cresceu por tamanho.
- **Clientes do fechamento** — quem mais voltou, as cinco maiores e quanto do
  mês depende do maior deles.
- **De onde veio o repasse** — quanto veio de cada arranjo.

Três regras que **não devem ser mexidas sem perguntar**:

- **A comparação é da parte do tabelião e do repasse**, nunca do valor cheio da
  escritura — esse campo não é mais pedido, e uma série montada em cima dele
  despencaria sozinha no mês em que ele saiu.
- **Meio ciclo se compara com meio ciclo.** Enquanto o fechamento está aberto,
  o anterior é cortado no mesmo número de dias corridos; senão a seta ficaria
  vermelha todo dia 26, sem nada ter piorado. O total cheio do mês anterior
  aparece do lado, escrito.
- **Sem mês anterior não existe "subiu 100%"** — o cartão diz que não há com o
  que comparar.
- **O dinheiro só aparece para quem entrou no Financeiro.** Sem login, a seção
  mostra o convite para entrar e nenhum valor. O painel operacional não tem
  senha de propósito, e um cartão de receita solto seria a única coisa dele a
  vazar valor.

O cliente é agrupado pelo **nome escrito antes do travessão** na descrição
("TANIA — compra e venda" é a Tania), sem acento e sem caixa. Dois jeitos de
escrever o mesmo cliente continuam sendo dois clientes: quem agrupa é o nome,
não um cadastro que não existe.

### Meu financeiro (só da Shirley)

O salário **não se digita**: é a soma das comissões do fechamento, calculada
na hora a partir das escrituras já pagas. Corrigir um lançamento no painel
corrige o salário junto — não há cópia para envelhecer. À mão ficam serviços
extras de fora do cartório, despesas e um ajuste eventual.

O conteúdo vai para o banco **cifrado** (AES-GCM, chave derivada da senha por
PBKDF2, 250 mil voltas). A chave que cifra os dados é sorteada uma vez e
guardada em duas cópias embrulhadas — uma pela senha, outra pela chave de
recuperação —, o que permite trocar a senha sem re-cifrar tudo.

---

## A Rede

A prospecção. Ela atende muita gente e não sobra tempo para o network: a Rede
é o painel fazendo a triagem que ela faria se tivesse tempo — **quem já foi
atendido e nunca virou conversa**.

O motor não é o LinkedIn. Não existe API que devolva conexões, e raspar a tela
põe a conta dela em risco — então o robô nunca entra lá. O motor é a
**qualificação da minuta**, que já traz profissão, cônjuge, estado civil e
endereço de cada parte. O botão do LinkedIn só abre a busca pelo nome numa aba
nova; quem olha o perfil, vê as conexões em comum e decide falar é ela.

A veia mais rica não estava no plano: a minuta de empreendimento traz os
**funcionários da incorporadora nominalmente, com cargo** — gerente de
carteira, relacionamento com cliente. São eles que escolhem o cartório, e
assinam escritura atrás de escritura sem nunca terem virado conversa.

Três regras que **não devem ser mexidas sem perguntar**:

- **Cada pessoa entra uma vez.** A mesma gerente assina dezenas de escrituras.
  Quem já está no cadastro não é relido: só ganha mais um ato no contador e a
  data nova. É o que faz a varredura ficar mais barata a cada rodada.
- **Só entra na fila quem tem cara de ramo imobiliário.** A bibliotecária e o
  aposentado ficam gravados, marcados como fora — não somem, só não ocupam a
  fila da manhã. Cargo que a IA não soube julgar vira **duvidoso** e espera
  decisão na tela: descarte calado é onde a rede perde gente boa.
- **O CPF não vem para o banco.** Ele já mora na minuta, no Drive. Serve só
  para saber que a Letícia de hoje é a mesma de março: passa por uma conta de
  mão única (HMAC com a `REDE_CHAVE`) e o que fica guardado é o resultado. Do
  resultado não se volta ao número.

**De onde a pessoa veio** é lido em três degraus, do mais firme ao mais
frouxo: o **empreendimento**, quando quem vende é a incorporadora que o
edificou (vale para todo mundo daquela escritura, dos dois lados da mesa); a
**empresa** por quem ela comparece, quando é procuradora ou sócia; e só então
o **nome da pasta** do Drive. A pasta leva o nome do cliente, então usá-la
sozinha fazia a gerente da incorporadora "vir pelo comprador" — o contrário do
que acontece. Em revenda entre pessoas ela continua sendo o melhor palpite que
sobra, e às vezes traz mesmo o parceiro ("JOSÉ LUIZ - ABG - CÉSAR BRITO").

A correção dela vence a leitura da máquina, sempre. O lápis grava em
`/correcoes` e a varredura seguinte **nunca** escreve por cima.

**Só a Shirley entra.** Diferente do Financeiro, que a Grazi abre, o `/rede`
está na regra `dono` do banco — a mesma do Meu financeiro.

O mapa é do Brasil, nas cores da bandeira, com os estados clicáveis (formas do
`@svg-maps/brazil`, CC BY 4.0, em `lib/br-uf.json`). Estado abre em cidades, e
o pino da capital desce para os bairros. Duas honestidades no desenho: no
nível do estado o pino fica no meio do estado, porque não existe coordenada de
cidade aqui; e o nível dos bairros é um **esquema por região** — não existe
planta de bairro disponível, então cada um fica no rumo certo em relação ao
centro, e bairro fora da tabela de rumos aparece na lista **sem pino**, em vez
de ganhar um lugar inventado.

Quem enche o `/rede` é o `apps-script/cartorio-rede.js`, que roda no Apps
Script de madrugada. Passo a passo em `FIREBASE.md`.

---

## Quem entra

O painel operacional **não tem login**, de propósito. Só o `/financeiro` é
fechado nas regras do banco, e por isso pede conta e senha do Firebase.

- `/acesso/{uid}` = `{nome, dono}` diz quem pode ver o financeiro. O
  `dono: true` é o que abre o Meu financeiro.
- Quem entra e ainda não está liberado vê **"Falta liberar esta conta"** e
  grava a própria liberação — enquanto as regras não estiverem publicadas.
  Depois disso, `/acesso` fica somente-leitura e liberar conta nova é tarefa
  do console.
- **A dona é decidida pelo e-mail** (`FIN_EMAIL_DONA`), nunca por ordem de
  chegada: "primeiro a liberar vira dona" abria uma corrida em que a conta
  errada levaria o cofre.
- `/casos`, `/jobs` e os caminhos do bot continuam abertos porque quem
  escreve neles não é o navegador — o bot do WhatsApp e o Apps Script gravam
  por REST, sem conta. Ver `FIREBASE.md` para o que falta.

---

## Onde as coisas estão

Tudo no `index.html`. O bloco financeiro vai do comentário
`// ── Quem pode ver o dinheiro` até o registro do service worker, e é ele que
o `testes/montar.mjs` recorta.

| O quê | Onde procurar |
|---|---|
| A conta inteira | `finConta()` |
| Quotas dos arranjos | `finQuotas()`, `finDividirCentavos()` |
| Calendário do fechamento | `finCicloPorChave()`, `finDataFechamento()`, `finFeriados()` |
| A planilha | `finHtmlLancamentos()` |
| A janela do card | `renderFinanceiroDoCaso()`, `finFaixaDoCaso()` |
| O mês no quadro | `finQuadroHtml()`, `finResumoCiclo()`, `finComparativoCiclo()` |
| Quem é o cliente | `finClienteDe()` |
| Cofre pessoal | `finCriarCofre()`, `finDestrancar()`, `finMeuSalario()` |
| Regras do banco | `database.rules.json` · passo a passo em `FIREBASE.md` |
| A Rede, na tela | `renderRede()`, `redeHtmlFila()`, `redeHtmlConstrutoras()` |
| O mapa | `redeMontarMapa()`, `redeVerUF()`, `redeVerCapital()`, `REDE_RUMOS` |
| Quem é a mesma pessoa | `impressaoDigital()`, `redeChaveDaPessoa()` (Apps Script) |
| A varredura das minutas | `apps-script/cartorio-rede.js` → `varrerRede()` |

## Testes

```bash
node testes/montar.mjs && node testes/calculo.gerado.mjs
node testes/navegador.mjs && node testes/celular.mjs
node testes/rede.mjs && node testes/rede-varredura.mjs
```

O `montar.mjs` também gera o `preview-quadro.html`, que é o desenho da seção
do dinheiro com dois fechamentos no banco.

Rodam por cima do `index.html` publicado. Ver `testes/README.md`.

A Rede tem harness próprio (`harness-rede.html`), montado pelo mesmo
`montar.mjs`: ela mora depois do registro do service worker no `index.html`,
fora do recorte do financeiro. O `rede.mjs` termina medindo tudo num iPhone 13,
e o `rede-varredura.mjs` roda o arquivo do Apps Script com o Google fingido.

**Antes de publicar qualquer mudança no financeiro, rode as três primeiras.** Vários
dos testes existem porque o erro já aconteceu uma vez: `2.000` lido como
R$ 2,00, o IR saindo do bolo inteiro, a linha de parceiro que sumia ao ser
criada, o salário que não acompanhava a correção do lançamento.

## Como ela gosta de trabalhar

- Mudança de tela: **desenhar antes**, mandar a imagem, publicar depois do
  aval. `node testes/montar.mjs` e o `preview.html` servem para isso.
- Publicar é abrir PR e juntar na `main` — a Vercel sobe sozinha.
- Ela testa pelo **celular**. Toda mudança de layout precisa passar pelo
  `celular.mjs`.

## Na fila

- **A Rede ainda não leu nada de verdade.** O painel e a varredura estão
  prontos e testados, mas o `cartorio-rede.js` precisa ser colado no Apps
  Script e configurado (`FIREBASE.md`, passo 6) para o `/rede` começar a
  encher. Até lá a aba abre e diz que a leitura não passou.
- **A profissão vem pela metade.** Nas duas minutas lidas à mão, uma trazia a
  profissão do cliente e a outra tinha o campo em branco — o bot pergunta, mas
  nem sempre a resposta chega antes da minuta ser gerada. Vale insistir mais
  nessa pergunta: ela deixou de ser burocracia e virou o dado mais valioso da
  Rede.
- **O nome do card não é o nome da parte.** A pasta "GUSTAVO BERTOLA (CASO:
  VENDA E COMPRA)" tem a Tânia como compradora. Quem vale é o nome da
  qualificação, não o da pasta — a Rede já faz assim, mas o resto do painel
  agrupa pelo nome do card.

- Enxugar o formulário da aba (hoje só serve para receita sem card).
- Decidir se a coluna Registro fica na planilha ou vai só para a Carteira.
- Trazer Carteira e Meu financeiro para a mesma cara de planilha.
- O controle de repasse ("já repassado / a repassar") saiu junto com a lista
  do Quem recebe; o dado continua gravado e pode voltar como botão na pílula.
- No quadro, o que ainda dá pra medir e ainda não é medido: **quanto tempo o
  caso leva do começo até virar dinheiro** (a esteira já grava as datas), **o
  mix por tipo de ato**, **quanto do repasse vem de cliente que já era da
  casa** e a **comparação com o mesmo mês do ano passado** — esta só faz
  sentido quando houver um ano de lançamento no banco.
