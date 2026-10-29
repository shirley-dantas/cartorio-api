# Painel Operacional — 20º Tabelião de Notas

Painel de trabalho da Shirley e da Grazi. Um arquivo só: **`index.html`**
(CSS, markup e código no mesmo lugar), servido pela Vercel, com Firebase
Realtime Database por baixo. A minuta é gerada **dentro do painel**: as
funções em `api/` conversam com a IA (a chave mora nas variáveis de ambiente da
Vercel). O `apps-script/` cuida do Drive — pastas, documentos, agenda — e é
onde roda a varredura da Rede.

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
  + DSR do fechamento          (valor do mês, não da escritura)
    Shirley, metade                          ← as duas recebem igual
    Grazi,   metade
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
- **O DSR entra na conta desde outubro/2026** (antes ficava fora). É um valor
  **do mês, não da escritura**: fica em `financeiro/dsr/{ciclo}`, digitado no
  topo da planilha, e se divide em partes iguais **só entre a equipe** —
  parceiro não entra, porque o DSR vem do cartório pelo mês trabalhado e não
  de um caso que alguém trouxe.
- **O IR só é retido no repasse a parceiro.** Desde outubro/2026 a equipe não
  tem IR retido aqui: o tabelião já recolhe antes de pagar, e descontar de
  novo tiraria 27,5% de um valor já tributado. Isso **mora no código**
  (`finDivisao`: `retemIR = tipo==='parceiro' && descontaIR!==false`), não na
  caixinha de Ajustes — a config salva em agosto ainda traz a Grazi com IR, e
  depender de alguém lembrar de desmarcá-la faria o fechamento sair 27,5%
  menor para ela sem ninguém perceber. A caixinha só aparece em linha de
  parceiro.
- **Cada parte é arredondada por si**, como na planilha que ela conferia à
  mão: metade de R$ 621,69 vira R$ 310,85 para as duas. Isso faz as partes
  somarem até um centavo além do repasse; a diferença aparece declarada
  ("Arredondamento das partes"), nunca escondida.

### Os arranjos

A divisão é por **quotas iguais**, e quem entra depende do parceiro que
trouxe o caso. Quem tem o mesmo número divide a mesma quota:

Shirley e Grazi recebem **igual** desde outubro/2026.

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

- **Lançamentos** — planilha, uma linha por escritura. No topo, acima dos
  nomes, duas linhas: o **DSR do fechamento** (digitável ali mesmo, dividido
  entre a equipe) e o **total**, em vermelho, já com o DSR somado. Mais o
  botão LÍQUIDO/BRUTO.
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

O salário **não se digita**: é a soma das comissões do fechamento mais a
parte dela no DSR, calculada na hora a partir das escrituras já pagas. Corrigir um lançamento no painel
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

### O caminho até a conversa

Conectar não é o fim: é a porta destrancada, e ninguém entrou ainda. Lista de
contato não é captação — captação é ter conversado. Por isso o convite não
encerra a pessoa, ele a devolve:

```
A olhar → Convite enviado → (3 dias) "Aceitaram?" → Conectado → Conversado
                    ↑                    │
                    └──── Ainda não ─────┘
```

- **Nada aqui descobre sozinho que a pessoa aceitou.** O LinkedIn não tem porta
  que devolva conexões, e raspar a tela logada põe a conta dela em risco — a
  mesma razão de o robô nunca entrar lá. Quem sabe é ela; o painel pergunta, e
  a resposta é um toque.
- **Quem aceitou volta para cima da fila**, ordenado por número de atos: a
  porta já está aberta, e falar com quem assina toda semana vale mais que um
  convite novo.
- **Convite com mais de 21 dias aparece marcado como sem resposta.** O LinkedIn
  limita convites pendentes, e convite morto ocupando a fila é ruído.
- **A mensagem vem escrita**, com o ato, a data e quantas vezes — tudo lido da
  minuta. O gargalo de quem não é captadora profissional nunca é achar gente, é
  saber o que dizer. O texto nasce **editável**: o "de onde veio" às vezes é só
  o nome da pasta, e frase montada em cima de palpite passa pelo olho dela
  antes de sair. O nome da empresa fica fora da frase de propósito — escrito
  por extenso, o recado ganha cara de mala direta.
- **Anotar não desfaz o caminho.** Escrever uma linha sobre quem já aceitou não
  pode jogar a pessoa de volta para o começo.

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

## O Radar Jurídico

O jornal da manhã. Ela atende o dia inteiro e não sobra tempo para ler
Corregedoria, CNJ e Diário Oficial — e norma de extrajudicial muda sem avisar
ninguém. O Radar é o painel fazendo a leitura que ela faria se tivesse tempo:
**o que mudou hoje na mesa, e o que continua como era.**

Quem varre é a função da Vercel (`api/radar-juridico.js`), no cron das seis da
manhã de São Paulo, dia útil. Ela lê as dez fontes oficiais, manda o conteúdo
para a IA com o prompt do `lib/radar-prompt.js` e grava o dia. O painel só lê.

A faixa **Jornal da equipe** fica no topo da Central de Comando, fora do
cabeçalho — o cabeçalho fecha, e saber que uma norma mudou hoje não pode
depender de a saudação estar aberta. A faixa toda é botão: clicou, abre o Radar.

### As quatro faixas

Cada item ganha um selo, e um só:

| | |
|---|---|
| 🔴 **Muda hoje** | Se a equipe não souber, uma escritura sai errada. |
| 🟠 **Muda em breve** | Publicado, mas com vacância, condição ou regulamentação pendente. |
| 🟢 **Bom saber** | Confirma o que já se fazia. Muda a segurança de quem explica ao cliente. |
| ⚪ **Fora do escopo** | Encostou no filtro e não toca a rotina de Notas da Capital. |

Regras que **não devem ser mexidas sem perguntar**:

- **Notícia não é norma.** Cada item declara se é norma, decisão ou notícia.
  Matéria de portal sem o ato localizado nunca aparece como mudança
  confirmada — e nunca sobe a 🔴, nem que a IA insista. Manchete tratada como
  norma vira exigência errada no balcão.
- **Dispensa nunca aparece sozinha.** Item que fala em liberação mostra,
  colado nele, o que continua exigido — etapa por etapa. Se o material lido
  não disse, o item é rebaixado a **⚠️ aplicação parcial — confirmar** antes
  de chegar à tela. Isso é código (`conferirItem`), não só instrução no
  prompt: regra que só existe no prompt depende de o modelo ter lembrado dela
  naquela manhã.
- **Fonte que não respondeu aparece escrita.** Silêncio de site não é ausência
  de novidade, e dia que falhou não pode ter cara de dia calmo. Varredura que
  não leu nada grava `status: falhou` e diz isso na faixa.
- **O ⚪ fica escrito.** Uma linha no fim: "visto e descartado". Descarte
  calado é onde a informação boa se perde — a mesma razão do *duvidoso* da Rede.
- **A memória vem junto.** O pedido do dia leva os últimos sete dias já
  reportados. Sem isso a mesma mudança seria novidade todo dia até alguém
  desconfiar; com isso ela volta como **andamento**, dizendo o que mudou desde
  a última vez.

### O critério do ITCMD

O caso que deu origem à regra, e que vale a pena guardar inteiro: em
18/08/2026 o Plenário do CNJ revogou o trecho do art. 15 da Resolução 35/2007
que exigia o ITCMD antes de lavrar inventário e partilha. Verdade — **e só
metade da verdade**. O Registro de Imóveis continua exigindo a comprovação do
imposto para transferir o imóvel, porque isso é lei tributária estadual mais o
art. 289 da Lei de Registros Públicos, e o CNJ não tem competência sobre nem
um nem outro.

Daí as três perguntas obrigatórias antes de dizer que algo mudou:

1. **Competência** — o órgão que publicou tem poder sobre essa matéria?
2. **Etapas** — o ato tem mais de uma (escritura, registro, averbação)? A
   mudança vale para todas?
3. **Alcance e vigência** — vale para todo ato? Já está valendo?

E a proibição que sai delas: **nunca escrever "está liberado" sem dizer, na
mesma frase, o que continua exigido.**

### A Base de Regras

O que o cartório sabe e não muda toda semana — o chão em que a mesa pisa,
enquanto o Radar é o jornal do dia. Seis temas entram prontos, pesquisados um
a um: ITCMD no inventário, dispensa de certidões, baixa de hipoteca,
individualização de matrícula, IPTU nos atos e HIS/HMP.

Cada tema traz o resumo, o que fazer **na mesa**, as etapas, os fundamentos e
um bloco **Atenção** com o que a pesquisa deixou em aberto. O bloco Atenção não
é rodapé:

- a numeração do item das Normas de Serviço aparece em duas versões nas fontes
  (117.1 e 119.1) — **conferir no TJSP antes de usar numa exigência formal**;
- a LC municipal 227/2026 colide com o STJ Tema 1.113 na base de cálculo do
  ITBI, e o ponto **não está pacificado**;
- fala-se num Provimento CGJ 17/2026 alinhando São Paulo à decisão do CNJ
  sobre CNDs — **a pesquisa não localizou esse ato**. Não citar até confirmar.

Regra que **não deve ser mexida sem perguntar**: **o Radar nunca escreve por
cima do que foi conferido à mão.** O que ele aprende entra como linha datada em
`atualizacoes`, dentro do tema; o `resumo` e o `naMesa` da carga inicial ficam
intactos. É o mesmo lápis da Rede, do outro lado.

### A Joaninha jurídica

Uma aba nova no painel dela, com dois modos em cima da mesma base:

- **Para mim** — a pergunta de quem está com a escritura na mão ("posso lavrar
  sem a CND?"). Resposta seca, no máximo seis frases, sem formatação de
  cliente. Quando a base não tem, ela diz que não tem — e diz onde olhar.
- **Para o cliente** — ela digita o assunto em duas ou três palavras e volta a
  mensagem pronta para colar no WhatsApp, no tom da que ela mesma aprovou:
  abertura curta, a resposta direta, *um detalhe importante* com o que
  continua exigido, *na prática* com o que o cliente faz agora.

Duas coisas valem para os dois modos:

- **O critério da hierarquia normativa vai no prompt dos dois.** Nenhum deles
  pode dizer "já pode aplicar" sem dizer o que continua exigido.
- **O texto nasce editável e a resposta é texto, nunca HTML.** A mensagem
  passa pelo olho dela antes de sair — como a da Rede, e pela mesma razão:
  frase montada em cima de leitura de máquina não vai para cliente sem
  conferência.

Cada tema da base tem dois botões que levam para lá com o assunto já escrito:
*Escrever para o cliente* e *Perguntar sobre isto*.

### Quem abre

O Radar **não tem tranca**, e é a única tela nova assim. Aqui mora norma
publicada, que é informação pública — nada de nome, CPF ou valor de cliente.
A Grazi abre igual à Shirley, e quem entra sem login também. Foi o que decidiu
o caminho no banco: `/radar-juridico` e `/base-regras` ficam abertos como
`/casos`, e não trancados como `/rede`.

---

## Os Orçamentos

Quanto a cliente vai pagar. Era conta de mão, tabela aberta ao lado, uma faixa
de cada vez — e o número saía do papel direto para o WhatsApp, sem ninguém
conseguir refazer depois de onde ele veio.

O que mora aqui **não é uma calculadora**: é uma escada de conhecimento com
quatro degraus, e a ordem entre eles é a regra que segura todo o resto.

```
🟢 CONFIRMADA   fonte oficial vigente, ou ela disse que sim
🔵 OPERACIONAL  jeito de trabalhar do cartório
🟡 APRENDIDA    padrão visto nos orçamentos, à espera de confirmação
🔴 INCERTA      precisa de confirmação — nunca vale como definitiva
```

Degrau de baixo nunca vence degrau de cima. Se ela cobrar de um jeito e a
tabela disser outro, o painel **mostra os dois e pergunta** — nunca aprende o
jeito dela em silêncio. "Ela fez assim três vezes, então é a regra" é o erro
que este bloco existe para não cometer, e nada sobe de degrau sozinho: hipótese
vira regra quando ela aperta o botão, e a promoção fica datada com quem
validou.

### As duas tabelas

Lidas dos PDFs oficiais que ela entregou em 27/08/2026, faixa por faixa: 32
faixas do item 1.1 de Notas e as 48 da **Tabela de Custas do Registro de
Imóveis — 2026**, mais os itens de valor fixo. As duas valem **até
01/01/2027**, confirmado por ela.

A tabela de custas veio como imagem, sem camada de texto, e a transcrição foi
conferida por três invariantes que um dígito trocado quebraria: as faixas
encaixam sem buraco, as colunas crescem, e — a mais forte — **em todas as 48
faixas a coluna "registro com matrícula" é o registro mais R$ 76,54**, que é a
certidão do rodapé da mesma folha.

Quatro decisões que **não devem ser mexidas sem perguntar**:

- **O registro sai da coluna "REGISTRO COM MATRÍCULA".** Foi dela que saiu o
  R$ 3.133,28 do apartamento 1301: R$ 2.833,28 da faixa j mais os R$ 300,00 de
  taxa embutida. Ler a coluna do lado erra o orçamento em R$ 76,54 sem que nada
  pareça errado.
- **A vigência vence, e vencer trava.** A partir de 02/01/2027 o motor recusa
  fechar e manda procurar a tabela do exercício novo. Tabela vencida é pior que
  tabela sem data: ela parece certa.
- **A conta inteira é em centavos inteiros.** Um orçamento soma dez a quinze
  linhas saídas de tabelas diferentes; meio centavo por linha vira um total que
  não bate com a conferência dela. Só a tela converte para reais.
- **A quarta coluna da tabela de Notas é a parte do tabelião**, e é ela — não o
  total que a cliente paga — que vira `parteTabeliao` no Financeiro. Sem essa
  coluna, a passagem do orçamento para o dinheiro seria um palpite, e a
  comissão nasceria do número errado.

As faixas de **incorporação e condomínio** são a única coisa que não vem da
folha de 2026: continuam sendo as da tabela ARISP entregue antes, de vigência
não declarada. Nenhum ato usa esse bloco hoje; ele fica marcado como tal, em
vez de apagado ou misturado com o resto.

### As regras de cobrança

Vinte e um atos (eram vinte; o de imóveis distintos entrou em 29/09/2026),
cada um com a frase dela junto (`comoElaEscreveu`), para que a
conferência seja contra o original e não contra o que o painel entendeu.
Compra e venda em seis variações, doação com e sem usufruto, inventário com e
sem meação e com partilha desigual, divórcio em três formas, dação, confissão,
procuração, ata e escritura declaratória.

- **A pensão acresce à base, e vem em parcelas.** Uma pensão raramente é um
  número só: o caso que trouxe esta regra tinha um salário mínimo por doze
  meses **e** dois salários mínimos até dezembro de 2029. Cada parcela é
  escrita do jeito dela — em salários mínimos ou em reais, por N meses ou até
  um mês final — e a **soma acresce à base da escritura**, saindo uma escritura
  só na faixa do total. Não são duas escrituras em duas faixas: somadas, dariam
  mais do que ela cobra. Contando de agosto/2026 a dezembro/2029 são **41
  meses** — os dois extremos entram —, e o salário mínimo (R$ 1.621,00, o mesmo
  que a conta dela devolve) é configurável em Ajustes, como a UFESP.
- **O usufruto da doação paga 1/4 da tabela, não os 40% do ato secundário
  comum.** Era tratado como qualquer outro ato secundário (garantia, novação)
  até ela trazer a regra certa em 20/10/2026, contra outro sistema de
  cálculo: a nua-propriedade (2/3) sai pelo **valor cheio** da escritura, e o
  usufruto (1/3) por **1/4 da tabela — 75% de desconto**, não os 40%. O
  **registro não leva desconto nenhum** nos dois lados — sempre foi assim, e
  continua. O caso dela fecha linha por linha: imóvel de R$ 369.576,00, nua-
  propriedade de R$ 246.384,00 pelo valor cheio, usufruto de R$ 123.192,00
  pelo 1/4 (`ORC_DESCONTO_USUFRUTO = 75`, `ORC_AVISO_DESCONTO_USUFRUTO`). A
  base de cálculo também virou **lista** (`imoveisDoacao`) — ela pode lançar
  vários imóveis doados juntos.
  **A ESCRITURA e o REGISTRO não somam do mesmo jeito.** A escritura é uma
  só, sobre a SOMA de todos os imóveis doados (2/3 e 1/3 da soma) — é um
  negócio jurídico, como no ato das vagas. O registro, não: cada imóvel é a
  sua própria matrícula (a mesma regra 29/09/2026, "cada matrícula é um
  imóvel"), então ganha o SEU par de registros — 1 sobre os 2/3 DAQUELE
  imóvel, 1 sobre o 1/3 DAQUELE imóvel, cada um na sua faixa. Cinco imóveis
  dão dez linhas de registro, nunca duas sobre a soma. Confirmado por ela em
  20/10/2026, depois do susto dos imóveis distintos: a tabela é regressiva,
  então registrar pela soma daria um número diferente do certo.
- **Onde há um total digitado, a lista de imóveis pode virar ele.** No divórcio
  com partilha e no inventário, a escritura sai de um total à parte enquanto os
  imóveis alimentam os registros. Somar três imóveis à mão para redigitar o
  resultado logo acima é trabalho que o painel já tem na tela — e é onde entra
  o erro de digitação. O botão *"Usar como Valor total da partilha"* aparece na
  linha da soma e some quando os dois já são o mesmo número.
- **Outro ato lavrado junto entra pelo valor cheio.** A escritura sai com uma
  procuração, ou com uma ata. Os vinte atos cobrem as *combinações* conhecidas
  (garantia, novação, usufruto), e o que ficasse fora delas não tinha lugar
  nenhum. Agora a etapa 1 tem uma lista dos itens de valor fixo da tabela de
  Notas — procuração com e sem valor econômico, ata, escritura sem valor
  declarado, convenção de condomínio —, cada um com a sua quantidade. **A
  redução de 40% NÃO se aplica**: ela é regra dela para atos com valor
  declarado (item 1.1), e estendê-la a um item de valor fixo seria decisão
  nova. Confirmado por ela em 28/08/2026. O ato a mais soma na escritura e na
  parte do tabelião — que é o que vira comissão —, e não inventa registro nem
  tributo. A regra especial (ZEIS, FGTS) substitui a escritura inteira mas
  **não engole** o ato lavrado junto: ele é outro ato, com item próprio.
- **Ato secundário na mesma escritura leva 40%** — garantia, novação,
  confissão, cláusula resolutiva. É regra dela: a nota explicativa da
  tabela que a fundamentaria veio só com o título no PDF, e por isso cada linha
  reduzida nasce marcada como 🔵 operacional, não como fonte oficial. O
  usufruto da doação **saiu desta lista em 20/10/2026** — tem desconto
  próprio, de 75% (ver a regra logo abaixo), não os 40% genéricos.
- **A linha debaixo do título é dela.** O que sai embaixo de ESTIMATIVA DE
  CUSTOS costuma ser a rua do imóvel, ou o nome do de cujus no inventário —
  coisas que o nome do card não carrega. É um campo (`identificacao`), guardado
  em cada versão; em branco, cai no nome do card, que é o que sempre foi.
- **A via do cliente sai como imagem.** Texto colado no WhatsApp perde o
  alinhamento dos valores, a hierarquia e o ar entre as linhas — e é justamente
  a aparência que faz o orçamento parecer o que é: trabalho de cartório, não
  recado de mão. A folha é desenhada em canvas, à mão e sem biblioteca, em duas
  passadas (a primeira mede, a segunda pinta), então fica igual em qualquer
  telefone, sem depender das fontes do aparelho.
- **A base que a cliente lê é o valor do negócio.** Não a base da primeira
  linha da tabela. Numa doação com reserva de usufruto de R$ 500.000,00 a
  tabela cobra a nua-propriedade sobre dois terços e o usufruto sobre um terço,
  e a via da cliente saía dizendo "BASE CONSIDERADA R$ 333.333,33" — a cliente
  doou meio milhão, e o dois terços é regra interna da tabela. Na ZEIS era
  pior: a escritura vira item de valor fixo, a primeira linha não tem base, e a
  folha não mostrava valor nenhum. O motor declara `baseDeclarada` (o primeiro
  campo do ato, somado quando é lista, mais a pensão quando há), e há teste
  cobrando que nos vinte atos a base mostrada seja sempre um valor digitado.
- **E precisa ser lida à distância de um polegar.** A primeira folha era clean
  demais para o meio em que ela vive: cinza médio nos nomes dos custos, filete
  de 0,8px entre as linhas e muita margem branca. Na tela do computador ficava
  elegante; no WhatsApp, que entrega a imagem reduzida à largura do telefone,
  chegava apagada. Daí as três regras do desenho: **o que a cliente precisa ler
  sai na tinta cheia** (o cinza fica só para as maiúsculas pequenas e a
  ressalva), **as linhas se separam por faixa e não por filete** — filete
  desaparece na compressão, e sem ele o olho perde o caminho do nome até o
  valor —, e **a tarja escura no topo e no total** dá à folha uma âncora que
  sobrevive à redução. Elegância que não chega ao olho da cliente não é
  elegância, é desperdício de papel. **Isso vale para a prévia na tela também**
  — e ela ficou para trás quando a imagem foi escurecida, então a folha chegou
  apagada duas vezes. As duas seguem as mesmas três regras, e há teste medindo
  a tinta (luminância do texto, corpo mínimo, as tarjas do título e do total):
  cor de texto é coisa que se afrouxa sem ninguém notar.
- **E o botão mostra a foto, em vez de enviá-la.** A primeira versão abria a
  folha de compartilhamento do sistema — a lista de aplicativos. No celular
  isso é prático; no computador, onde ela passa o dia, é um desvio: ela não
  quer escolher um aplicativo, quer a imagem na mão para colar onde a conversa
  já está aberta. Agora o botão **desenha a imagem na tela**, como uma foto
  qualquer: clique com o botão direito e *Copiar imagem* (no telefone, toque e
  segure). Embaixo ficam os atalhos — *Copiar imagem*, *Baixar* e, só onde
  existe de verdade, *Compartilhar*. **Nada sai sem ela mandar**, e botão que o
  aparelho não sabe cumprir não é desenhado.
- **A via da cliente fecha, sempre.** As linhas impressas somam o total
  impresso — é a única tela do painel que sai do cartório, e uma conta que não
  bate na mão da cliente é pior que nenhuma conta. A receita das linhas mora
  num lugar só (`orcLinhasCliente`), lida pela tela e pela imagem, e há teste
  cobrando a soma nos vinte atos.
- **Cada matrícula é um imóvel, e imóvel se conta.** Apartamento com duas vagas
  individualizadas são **três** imóveis: três registros (cada um na sua faixa),
  três prenotações e três certidões. A escritura é uma só, sobre o valor global,
  e o ITBI também. Somar tudo e registrar de uma vez daria outro número, e
  cobrar uma prenotação para três matrículas daria outro — os dois erros aparecem
  exatamente nesse caso e somem no caso de imóvel único. O botão *"Tem mais de
  uma matrícula?"* vale em **qualquer** ato com registro, não só no ato das
  vagas: matrícula separada é característica do imóvel, não do ato.
  **Vagas e imóveis distintos não são o mesmo cálculo**, e 29/09/2026 quase
  virou o erro que esta regra existe para não deixar passar. O ato das vagas
  (`compra-venda-vagas`) primeiro ganhou um nome mais largo — "Compra e venda
  com mais de um imóvel" — porque ela não achava onde lançar uma escritura
  de vários imóveis separados (caso da Dra. Iara, 5 imóveis). Mas a conta
  **não é a mesma**: no apartamento com vagas é **um** negócio jurídico, uma
  escritura só sobre o global; em imóveis distintos são **vários** negócios,
  cada um com escritura própria, na sua faixa. Como a tabela é regressiva
  (faixa maior paga proporcionalmente menos), somar antes de aplicar a faixa
  dá um número **menor** do que é: 5 imóveis de R$ 40.000,00 deram
  R$ 3.400,86 pelo caminho do global contra R$ 9.538,00 pela soma das cinco
  escrituras — e ela conferiu à mão que o certo é R$ 9.538,00. O nome do ato
  das vagas voltou ao original, e o caso dela ganhou ato próprio,
  **`compra-venda-imoveis-distintos`**: escritura e registro, um por imóvel,
  cada um na sua faixa; só o ITBI continua sobre o valor global. O
  reconhecimento pelo card (regra 10) aprendeu o padrão "N imóveis"
  (`/\d+\s*im[oó]veis?/`) e manda para o ato certo — o das vagas continua
  reconhecido só por "vaga".
- **Fora da Capital o painel procura, mas não decide.** ITBI é municipal e
  ITCMD é estadual. Antes o imposto simplesmente ficava sem valor, e ela tinha
  de procurar à mão no meio do atendimento — foi o que aconteceu com um imóvel
  em Extrema-MG. Agora o `api/aliquota-municipal.js` lê a fonte oficial na web
  e traz a alíquota. **O que vem da busca é hipótese, nunca fonte:** entra na
  conta para o orçamento existir, sai marcada 🔴 com o fundamento e o link ao
  lado, e o **CHECK FINAL não fecha** enquanto ela não apertar *"Confere — pode
  usar"*. Digitada à mão já nasce confirmada, porque quem digitou foi ela. Não
  achar é resposta legítima e aparece escrita: alíquota chutada seria o erro
  mais caro deste orçamento, e o mais silencioso — o total pareceria certo.
  Cada município é procurado uma vez e fica guardado.
  **A busca não pode redesenhar a janela inteira enquanto ela digita** — foi
  o defeito que ela relatou em 23/10/2026 (um imóvel em Sorocaba: "NÃO ESTÁ
  CALCULANDO"). `orcBuscarAliquota`, `orcAliquotaNaMao` e `orcConfirmarAliquota`
  chamavam `renderOrcamentoDoCaso()` — o redesenho cheio — ao terminar a busca
  ou gravar a alíquota; se isso acontecesse no MEIO da digitação do valor do
  negócio, o campo era refeito do zero e as teclas seguintes se perdiam, sem
  erro nenhum na tela. É o mesmo defeito que a soma dos imóveis já teve (ver
  `orcRedesenharAcessorios`, logo abaixo), só que ninguém tinha notado aqui
  porque o `api/aliquota-municipal.js` de teste sempre respondia na hora — a
  Vercel de verdade demora o suficiente para a digitação alcançá-la no meio.
  As três funções agora chamam `orcRedesenharResultado()`, o redesenho
  estreito, e há teste simulando a demora de verdade (`testes/orcamento-tela.mjs`).
- **A tabela é do lugar do ato, não do lugar do imóvel.** Se o ato sai em São
  Paulo, valem as tabelas de São Paulo — **sem exceção**, e o painel nunca vai
  procurar tabela de emolumentos de outro município. Só o imposto acompanha o
  imóvel. Por isso imóvel de fora deixou de travar a *Jurisdição* no CHECK
  FINAL: não faltava tabela nenhuma, e a linha agora diz por que passa.
- **Isenção nunca é aplicada sozinha.** Ela depende de declaração da parte e de
  documento. O painel aponta ("está dentro do teto do primeiro imóvel"), mantém
  o imposto na conta e devolve a decisão. Zerar imposto por engano é o erro mais
  caro que este orçamento poderia cometer.
  A do ITBI ganhou um botão em 23/09/2026, a pedido dela: o teto da primeira
  aquisição residencial (Lei 13.402/2002 — R$ 245.527,77 em 2026, tabela por
  ano dentro de `ORC_TRIBUTOS.itbi.isencaoPrimeiroImovel`) é conferido
  sozinho, contra o valor e a data, sem precisar marcar nada antes — é conta
  objetiva, disso o motor pode desconfiar por conta própria. O que ele não
  sabe — se é mesmo a primeira aquisição da parte (ou PMCMV), e se o imóvel é
  residencial — continua sendo dela: o aviso vem com "✅ Isenta — é a primeira
  aquisição / PMCMV" (`orcConfirmarIsencaoItbi`), e só esse clique zera o
  ITBI (`isencaoItbiConfirmada` nos `flags`) — com "Desfazer" ao lado, se ela
  marcar por engano. A Declaração ITBI-IV dispensa o cartório de exigir outro
  documento (Lei 13.402/2002, art. 3º; Decreto 55.196/2014, art. 26 c/c 32) —
  é por isso que um clique já basta, sem pedir upload de nada. O ITCMD
  continua só apontado, sem botão: a isenção dele depende da UFESP e do
  enquadramento no art. 6º da Lei 10.705/2000, que o painel nunca confere
  sozinho.
- **A taxa adicional é R$ 300 por padrão**, sem precisar perguntar. Até
  16/09/2026 ela travava o CHECK FINAL esperando resposta a cada orçamento;
  virou regra fixa a pedido dela — R$300 já entra sozinho, e o campo continua
  visível para trocar o valor ou marcar "Não incluir" quando o caso pedir.
  No modo cliente ela vai **somada ao registro, sem linha própria** — que é
  só isso o que "sem que o cliente perceba" significa: nada é cobrado a mais,
  apenas não ganha linha. E por isso ela **só existe onde há registro**:
  trocar o ato depois de incluí-la deixava R$ 300 de "despesa do registro"
  numa procuração, somados no total e sem linha nenhuma na via da cliente,
  que então deixava de fechar.
- **O registro é opcional.** A cliente pode preferir levar a matrícula a
  outro cartório — decisão dela, não uma exceção rara. Um toggle
  (`despesas.registro`, `false` para dispensar) zera o registro inteiro: a
  faixa da tabela de custas, a prenotação, a certidão de matrícula e a taxa
  adicional, que são despesas do registro e não fazem sentido sem ele. A
  **escritura e os tributos (ITBI/ITCMD) continuam cobrados normalmente** —
  são devidos independentemente de quem faz o registro. O toggle fica sempre
  visível na tela, mesmo com o registro já dispensado, para ela poder voltar
  atrás. Pedido por ela em 16/09/2026.

### Ver detalhes técnicos

A janela do orçamento tinha informação demais para quem só quer o número: de
onde veio cada dado, a frase interna da regra de cobrança, o CHECK FINAL
linha a linha, quem fez o orçamento. Ela foi clara em 16/09/2026: **"essas
informações são somente para a IA saber fazer o orçamento, não precisam
aparecer para mim."**

Um botão só — **"Ver detalhes técnicos"** (`orcVerTecnico`, fechado por
padrão) — esconde de uma vez:

- o box "Veio do card" (`orcHtmlHerdado`);
- a frase "Regra de cobrança" sob o select do ato;
- "Regra especial da tabela" e "Imóvel residencial?" (nunca usadas na
  prática — continuam existindo para o caso raro que precisar, mas atrás do
  botão, com os padrões de sempre: nenhuma regra especial, não residencial);
- o CHECK FINAL inteiro;
- Status do orçamento / Responsável / Observações — o responsável já é
  gravado sozinho a partir de quem está logada (`localStorage.painel_usuario`),
  então esconder não perde a informação.

Nada foi apagado: é o mesmo dado, a mesma conta, só que fora da vista por
padrão. Reabrir a janela sempre volta a fechado — não é uma preferência que
se guarda entre orçamentos.

Duas coisas que **não são só visuais** e saíram do mesmo pedido dela:

- **A "Coluna do registro na tabela" virou regra fixa**: sempre "com
  matrícula" (a certidão já somada). O select sumiu — quem quiser conferir
  que é essa a coluna usada ainda vê a frase atrás de "Ver detalhes
  técnicos", mas não há mais escolha a fazer.
- **A taxa adicional não é mais uma pergunta que trava** — ver a regra logo
  acima, na seção da taxa.

### O desenho em duas colunas

A janela virou duas colunas: à esquerda o formulário, cartão por cartão, cada
um numerado sozinho (contador de CSS — a ordem dos blocos já é a ordem que
ela preenche, então o número nunca fica fora de sincronia quando um ato pede
uma etapa a mais que outro); à direita, um **resumo que acompanha a
rolagem** (`position:sticky`) — cliente, ato, local, data, valor do negócio,
o total em caixa verde e a divisão por Escritura/Registro/Despesas/Tributos,
com os botões de salvar sempre à mão. No celular as duas colunas empilham,
resumo embaixo do formulário — pedido dela em 16/09/2026, a partir de um
desenho que ela mandou como referência.

O nome da cliente que aparece no resumo continua vindo do card
(`e.casoNome`) — não virou campo digitável novo, porque isso inventaria um
dado que o painel não tem hoje. A divisão do total ficou na mesma granularidade
de sempre (Escritura/Registro/Despesas/Tributos, a que bate com o
Financeiro), em vez do detalhamento fino de Registro/Prenotação/Matrícula/Taxa
que apareceu na referência.

### Por onde se orça

**Pelo card, como o dinheiro.** A faixa 💰 Orçamento fica logo abaixo da do
Financeiro, e *Novo orçamento* abre a janela já sabendo o que o card sabe:
cliente, tipo de ato (que vira o ato reconhecido), livro, prenotação. Só se
pergunta o que falta — formulário enorme foi o que ela pediu para não existir.

- **Um card tem várias versões, e nenhuma come a anterior.** Cada uma guarda o
  resultado inteiro, para continuar mostrando o número que mostrou no dia mesmo
  depois de a tabela mudar. Salvar de novo cria a versão seguinte; corrigir em
  cima só enquanto o orçamento está *em elaboração*.
- **A comparação diz por que mudou**, não só quanto: faixa que virou, ato que
  entrou, despesa que passou a ser cobrada.
- **Divergência com caso semelhante não fica escondida.** Mesmo ato, mesma
  faixa, total diferente: o painel mostra os dois e diz de que orçamento veio o
  outro número.
- **Duplicar não copia número.** A data vira hoje e a conta é refeita na tabela
  de agora.
- **O que ela está olhando é o que tem de mudar.** A conta mora no bloco do
  resultado, mas a linha que soma os imóveis e a quantidade das despesas ficam
  em cima, coladas nos campos que ela digita — e ficavam paradas, porque a tela
  não pode se refazer inteira a cada tecla (o cursor salta para fora do campo).
  Ela acrescentava a vaga, o total lá embaixo subia, e a linha debaixo da mão
  dela continuava dizendo "1 imóvel". Parecia que a soma não estava
  acontecendo. Esses pedaços agora são trocados **no lugar**
  (`orcRedesenharAcessorios`), e nunca o campo que está debaixo do dedo dela.
- **Onde há lista de imóveis, há soma.** São três listas, e o primeiro conserto
  cobriu uma só: a do botão *Acrescentar imóvel* (`unidadesRegistro`). Mas o ato
  **"Compra e venda com vagas individualizadas"** pede a lista dele (`unidades`)
  e o inventário pede a dele (`imoveis`) — e o ato das vagas é justamente o que
  ela escolhe quando há vagas. Nesses dois não havia soma nenhuma, e o conserto
  passou ao lado do caminho dela: publicou-se uma correção que, para quem
  reclamou, não mudou nada. A soma agora nasce dentro do `orcListaHtml`, que é
  por onde toda lista passa — corrigir no lugar comum, e não no caso que
  apareceu, é o que faz o conserto valer para os três.
- **Comparação só onde o motor também compara.** A soma se confronta com o valor
  do negócio apenas na lista de matrículas, que é onde o motor levanta o mesmo
  aviso. No ato das vagas a lista **é** o valor do negócio, e no inventário o
  monte pode legitimamente não ser a soma dos imóveis — apontar divergência ali
  seria alarme falso todo dia, e alarme falso é o que faz alarme de verdade ser
  ignorado.
- **Duas listas de imóveis no mesmo formulário, nunca.** O bloco *Imóveis a
  registrar* não aparece em ato que já pede uma lista: a dúvida sobre em qual
  dos dois digitar é pior que a falta do bloco.

A **memória de cálculo** mostra, linha por linha, o item da tabela, a faixa (a
mesma letra da folha impressa), a base, o valor de tabela, a redução e o
fundamento. O **modo cliente** não mostra nada disso: ato, base, as linhas de
custo e a ressalva de valores estimados — e é a única tela do painel que sai do
cartório.

### Do orçamento para o dinheiro

"A escritura foi assinada" faz nascer o lançamento no Financeiro, com a parte
do tabelião vinda da coluna dele e o registro inteiro indo para a carteira
virtual. **Orçado e realizado nunca viram a mesma linha**: o orçado fica
guardado ao lado, e corrigir o que foi de fato cobrado não mexe no orçamento.

### O gabarito, reconciliado inteiro

O orçamento do apartamento 1301 que veio nas instruções de cobrança fecha
linha por linha, e é o gabarito da suíte:

| | | |
|---|---|---|
| ESCRITURA | R$ 4.176,24 | faixa l da tabela de Notas |
| REGISTRO | R$ 3.133,28 | faixa j com matrícula (2.833,28) + R$ 300,00 |
| PRENOTAÇÃO | R$ 80,14 | rodapé da tabela de custas |
| MATRÍCULA | R$ 76,54 | certidão, no mesmo rodapé |
| ITBI | R$ 9.056,01 | 3% sobre R$ 301.867,16 |
| **TOTAL** | **R$ 16.522,21** | |

### As duas certidões de matrícula

Reconciliar o gabarito levantou uma pergunta: a certidão aparece **duas vezes**
— dentro da coluna "registro com matrícula" e outra vez na linha Matrícula. Ela
respondeu que é de propósito: **pede uma para dar início ao trabalho e outra no
fim dele.** Não é duplicidade de conta, são duas certidões pedidas de fato.

Por isso a pergunta saiu dos alertas — decisão tomada não pode ficar pedindo
decisão todo dia — mas não virou silêncio: a explicação ficou colada na linha da
matrícula, na memória de cálculo, que é onde alguém pergunta "por que duas?".

### A UFESP, que confere a tabela

R$ 38,42 em 2026. Ela é a régua de quase tudo que a tabela do registro mede:
**45 das 48 faixas têm teto múltiplo exato dela** — 500, 1.000, 3.000, 5.000
UFESP e assim por diante (só as três primeiras fogem, por serem valores
arredondados que vêm da lei). Isso faz o valor confirmar a tabela e a tabela
confirmar o valor, e virou teste: um dígito trocado num teto quase certamente
quebraria o múltiplo.

É nela que se contam as isenções de ITCMD (2.500 UFESP na doação, ou
R$ 96.050,00) e o teto de interesse social em ZEIS (4.705 UFESP, R$ 180.766,10).

### O banco pode dizer não, e das duas formas

Gravar e ler dependem do banco, e as duas primeiras versões erraram do mesmo
jeito: em silêncio.

**Gravar** era disparado sem `await`. Quando a regra recusava — o que acontece
enquanto as regras do Firebase não foram publicadas —, o painel dizia "salvo" e
não salvava nada. Dizer que guardou o que não guardou é pior que não guardar,
porque some sem deixar rastro.

**Ler** era pior ainda: o erro da escuta caía num `() => {}`. A tela ficava
vazia, como se não houvesse orçamento nenhum — a mentira mais fácil de
acreditar. E o Firebase **não** tenta de novo depois de um `permission denied`:
a escuta morre, então nem publicar as regras consertava, sem recarregar a
página.

E havia um terceiro, que só o primeiro consertar deixou aparecer: o resultado
guardava a tabela apagando as faixas com `faixas: undefined`, e **o Firebase
recusa `undefined` em qualquer profundidade — a gravação inteira, por causa de
um só**. A mensagem falava de uma propriedade que ninguém tinha escrito. Agora a
tabela entra pela identidade (`orcIdentidadeDaTabela`), escolhendo o que fica em
vez de apagar o que sai, e um saneador (`orcSemUndefined`) passa em tudo antes
de gravar — porque um campo que um dia nasça sem valor não pode derrubar o
orçamento da mesa.

Agora os três falam. A gravação espera e diz o que houve; a leitura mostra o
motivo com um **Tentar de novo** ao lado, porque quem acabou de publicar as
regras não deveria ter de adivinhar que precisa recarregar. O
`faz-de-conta-navegador.js` sabe recusar as duas coisas
(`window.__recusarEscrita`, `window.__recusarLeitura`) para que os dois
caminhos tenham teste em vez de só existirem na vida real.

### Onde paramos — 28/08/2026

Tudo o que está descrito acima **está no ar**. A `main` foi de `6d5378d` a
`3049c4c` em cinco entregas (#65 a #69), e a Vercel subiu cada uma sozinha.

**As regras do banco já foram publicadas** por ela no console do Firebase, e o
primeiro orçamento gravou depois disso. O passo do `FIREBASE.md` está cumprido —
não precisa ser refeito, a menos que os caminhos mudem.

O que **ela já confirmou funcionando** na tela de verdade: o cálculo, a memória,
o modo cliente e a gravação.

O que **entrou depois disso e ela ainda não conferiu em uso**: o bloco dos
imóveis sempre à vista, a quantidade de prenotações e certidões corrigível à
mão, o campo da taxa que parou de saltar, a via do cliente como imagem e a
identificação editável. Se algo aqui estiver errado, é o primeiro lugar a olhar.

**O que ela relatou em 28/08/2026, e foi consertado:** que a soma não acontecia
ao acrescentar imóveis (era a linha da soma parada, não a conta — a conta estava
certa; ver *Por onde se orça*), e que a imagem da cliente chegava apagada no
WhatsApp (ver *A via do cliente sai como imagem*). No caminho apareceu um
terceiro, que ela não tinha visto: a taxa de R$ 300 respondida antes de trocar o
ato ficava no total sem linha na via da cliente, e a folha não fechava.

**E a lição do conserto que não consertou.** Publicado o primeiro, ela voltou
com "A SOMA NÃO FUNCIONOU" — e estava certa. O defeito tinha sido reproduzido
num caminho (o botão *Acrescentar imóvel*) e consertado ali, enquanto ela estava
noutro: o ato **"Compra e venda com vagas"**, cuja lista é outra e não tinha
soma nenhuma. Os testes novos passavam, e passavam no caminho errado.
Duas coisas ficam disso: **reproduzir pelo caminho que ela descreveu**, não pelo
primeiro que reproduz o sintoma — o ato das vagas está no nome do que ela
relatou; e **procurar os irmãos do defeito antes de fechar** — havia três listas
de imóveis na tela, e a pergunta "e as outras duas?" custava um `grep`. O
conserto certo não foi consertar a segunda lista: foi levar a soma para dentro
do `orcListaHtml`, por onde as três passam.

**A lição da noite, que vale para o resto do painel:** os três defeitos que
chegaram à mesa dela eram do mesmo tipo — o painel dando por certo o que
dependia do banco. Um dizia "salvo" sem ter salvado, outro mostrava tela vazia
em vez de "trancado", o terceiro mandava ao Firebase um valor que ele não
aceita. Nenhuma das nove suítes pegava, porque **todas rodavam com o banco
sempre dizendo sim**. Agora o faz-de-conta sabe dizer não, nas duas direções, e
os três caminhos têm teste. Onde houver escrita ou leitura nova no painel, vale
perguntar antes: e se o banco recusar?

### O que ainda está em aberto

Entra na base como 🔴 ou 🔵, escrito, do mesmo jeito que as ressalvas da Base de
Regras do Radar — pergunta que não fica escrita é pergunta que se perde:

- **os doze meses da pensão**: "por doze meses, mais a quantidade de tempo
  estipulada" admite duas leituras. Deixou de atrapalhar no caminho normal —
  ela escreve o prazo de cada parcela, e os 12 só valem para orçamento antigo
  que não tinha prazo nenhum —, mas a frase continua sem leitura definida;
- **a pensão no divórcio SEM partilha**: esse ato é de valor fixo (item 6.2),
  e não há base a que acrescer. O motor põe a pensão como base. Perguntada em
  28/08/2026, ela respondeu **"pode ser"** — o que entra como 🔵 operacional, e
  não 🟢: é aceite do jeito de trabalhar, não a nota da tabela que o
  fundamentaria. Parou de pedir decisão todo dia, mas continua sem fonte;
- **os 40% da confissão de dívida sozinha na escritura**, que a redução de ato
  secundário não cobre por si;
- **as notas explicativas da tabela de Notas**, que vieram só com o título.

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
  escreve neles não é o navegador — as funções da Vercel e o Apps Script gravam
  por REST, sem conta. Ver `FIREBASE.md` para o que falta.
- O `/rede` é a exceção do Apps Script: ele é fechado na regra `dono`, e a
  varredura entra com o token da própria conta da Shirley (daí os escopos do
  passo 6). Nenhuma conta de serviço.

---

## O Bússola (planner pessoal dela)

Mora em `bussola/`, publicado num projeto próprio da Vercel
(https://bussola-mu.vercel.app). Tem o próprio `CLAUDE.md` lá dentro — **para
continuar o Bússola, comece pela seção "Onde paramos" de `bussola/CLAUDE.md`**. Três
coisas dele encostam no painel:

- **Ele escreve em `/focos`**: tarefa profissional anotada no Bússola vira
  lembrete no Bloco de Notas, aba Shirley (`origem: "bussola"`), e concluir
  vale nos dois lados. Ele só acrescenta, marca ou apaga o item — nunca
  regrava a lista.
- **Ele lê o `/financeiro`** (com a conta dela) para mostrar o salário, e a
  conta vem recortada daqui: `bussola/fin-motor.js` é gerado do `index.html`
  por `scripts/gerar-bussola-fin.mjs`. **Mexeu no financeiro, rode o script**
  — o `testes/bussola.mjs` acusa se ficou para trás.
- **Ele usa `lib/ler-letra.js`**, daqui, pela porta da Joaninha
  (`api/perguntar-joaninha.js?acao=ler-letra`): a escrita à mão dela vira
  texto pela IA (a chave mora no projeto do painel). Só atende às origens do
  Bússola e do painel. O `@anthropic-ai/sdk` entrou no `package.json` por ela.

O convite da agenda do Bússola **não** usa o Apps Script do cartório: sai de
um script separado na conta pessoal dela (`apps-script/bussola-agenda.js`).

**A Vercel aceita no máximo 12 funções em `api/`, e o painel está no limite.**
Em 22/09/2026 uma 13ª fez a Vercel recusar a publicação do painel inteiro —
sem aviso nenhum na tela, o painel só ficou parado na versão anterior. Função
nova entra em `lib/` e é atendida por uma porta que já existe; o
`testes/bussola.mjs` acusa se `api/` passar de 12.

## Pedir documentos

A faixa **Documentos** do card abre o montador (`pedido-docs.js`, carregado pelo
`index.html`): ela escolhe **para quem** é o pedido (cliente, advogado, corretor
ou comprador de construtora), o **ato** (vem do card) e, nos atos de dois lados,
**quem vai receber** (vendedor, comprador ou os dois). A lista nasce marcada pelo
ato, ela ajusta caixa por caixa, e a mensagem sai **editável** para copiar, abrir
no e-mail ou no WhatsApp. Nada sai sem ela mandar.

Regras dela que **não devem ser mexidas sem perguntar**:

- **Os dados pessoais vão numa linha só** — RG, CPF, certidão de estado civil,
  endereço e profissão, e do cônjuge se casado(a). Pedido comprido é trabalho
  para a equipe; há teste limitando o tamanho.
- **Só se pede o que o caso tem.** No inventário e na partilha, só os documentos
  dos bens que ela marcar: a casa pede a matrícula, não o carro.
- **A certidão de casamento é uma só** para o casal, e nunca se escreve
  "atualizada" — ela confere isso depois de receber.
- **Pacto antenupcial:** num ato em que o casal declara regime que exige pacto, pede-se
  o pacto e o registro dele no RI do primeiro domicílio. Na escritura *de* pacto
  não se fala em registro, só nas certidões do casal.
- **União estável não é estado civil da lista**: quem não é casado marca "Vivo em união estável" no link e o
  espaço da escritura (RCPN, Livro E) abre nos documentos dele. A janela não pede mais para marcar união nem pacto.
- **Comprador de construtora** só informa os próprios dados — a construtora e o
  vendedor ela identifica pela matrícula. Testamento ela não faz; as certidões que
  ela busca na internet nascem desmarcadas.
- **Valor e dados bancários são um pedido só — "Pagamento"** — e nunca pedimos conta
  sem dizer por quê: a escritura descreve como o pagamento foi feito. O comprador
  informa o valor da transação, se houve sinal (e quanto), quanto fica para o ato,
  se foi TED ou PIX e a conta de onde sai; o vendedor, só a conta que recebe. Um
  campo livre cobre a transação que foi diferente (financiamento, cheque, permuta).
- **Não existe campo de CPF avulso**: o RG ou a CNH já traz. Quando o RG não trouxer,
  a página avisa para anexar o CPF junto.
- **Mandar para um lado só** (comprador, donatário…) tira do pedido o que é do
  outro: o valor da transação é só do comprador, a matrícula nasce desmarcada para ele.

### O link de envio: o cliente sobe os documentos

Na mesma janela, **Gerar link** grava um pedido em `/pedidos/{código}` (a lista
já resolvida em formulário, `PEDIDO.formulario()`) e devolve `enviar.html?t=…`.
O cliente abre no celular, sem login, preenche os dados (estado civil,
profissão, endereço com CEP; do cônjuge se casado; banco, valor, filhos… conforme
a lista que ela marcou) e sobe os documentos. A página fala direto com o Apps
Script (`cliente-arquivo`, `cliente-dados`): cada arquivo vai para a **pasta do
caso** com nome `Papel_Nome_Tipo_AAAA-MM-DD_n.ext`, é lido pela IA e vira
documento do card (`origem: "link do cliente"`); os dados digitados viram o
documento `DADOS_INFORMADOS_PELO_CLIENTE`. A minuta lê tudo isso sozinha — o
`MINUTAR` não mudou. A faixa Documentos do card lista o que chegou.

Regras que **não devem ser mexidas sem perguntar**:

- **A certidão de estado civil vem do estado civil que o cliente escolhe:**
  solteiro → nascimento; casado → casamento (mais os dados do cônjuge);
  divorciado/separado → casamento com averbação; viúvo → casamento e óbito do
  cônjuge. Regime que exige pacto (universal, separação convencional,
  participação final) pede o pacto e o registro dele no RI.
- **O caso é o do código do link**, nunca um id mandado pela página. Link vence
  em 15 dias; só PDF e imagem, até 10 MB.
- **Cada arquivo sobe assim que é anexado**, enquanto a pessoa preenche o resto; os dados (a ficha) só vão
  no fim, depois de todos os arquivos. Arquivo que falha fica marcado em vermelho, com *Tentar de novo*, e a
  ficha não é enviada como se estivesse tudo certo. **Tirar um arquivo já enviado também o tira do Drive**
  (`cliente-remover`, só enquanto o link está aberto e só com o selo certo). Enquanto o cliente não conclui,
  os arquivos ficam **provisórios** (`provisorio: true`) e o card diz "aguardando o cliente concluir o envio":
  é por ali que se limpa o que sobrar de um link abandonado (o botão de excluir da lista).
- **Arquivo "sem leitura" tem botão "Ler de novo"** no card (`relerDocCliente()` → ação `cliente-reler` do Apps Script,
  que lê o arquivo do Drive outra vez, só com o selo certo). Se a IA falha, **o motivo aparece escrito** — antes o item
  ficava "sem leitura" sem ninguém saber por quê. Word antigo (`.doc`) e outros formatos que a IA não lê são recusados
  **antes** do envio, com a instrução de salvar como `.docx` ou PDF (iam para a leitura de imagem e voltavam com o erro
  de `media_type`).
- **O que o cliente digita é "ainda não conferido".** Quebras de linha e texto
  longo são cortados antes de entrar na minuta, para um recado não forjar um
  documento novo no meio do pedido da IA.
- **Dá para excluir o que o cliente mandou errado**, em cada item da lista recebida
  (`excluirDocCliente()` → ação `cliente-excluir` do Apps Script): o arquivo vai para a
  **lixeira do Drive** (volta em até 30 dias) e o registro sai do card, então a minuta
  deixa de usá-lo. **O Drive só é tocado quando o selo confere** — um HMAC com segredo
  que só existe no Apps Script (`CLIENTE_SEGREDO`), gravado em cada arquivo recebido —,
  porque o banco é aberto e um registro forjado poderia apontar para outro arquivo
  (a minuta, por exemplo). Sem selo (envio antigo ou forjado), o item sai do card e o
  arquivo fica no Drive, e o painel avisa. Só se exclui o que veio pelo link.
- **O link já nasce personalizado por quem recebe; a página não explica o ato.** Vendedor: dados
  pessoais e documentos (a conta bancária dele virou pedido a mais, desmarcado). Comprador: isso mais
  valor da transação e forma de pagamento. A escolha *quem vai receber* vale em todo ato de duas
  pontas — vendedor/comprador, doador/donatário, devedor/credor, outorgante/procurador — e também
  divórcio, união estável e pacto (parte 1, parte 2 ou os dois). **"Os dois" é o link do responsável**
  (advogado, corretor, inventariante): tudo junto. A prévia do WhatsApp mostra o **endereço do link** —
  para ele não dizer `cartorio-api`, basta preencher `ENVIO_BASE_URL` (`index.html`).
- **"Pedir mais alguma coisa"** (Mais opções): ela escreve o item e escolhe se a pessoa **sobe um
  arquivo** ou **só escreve a informação**, e, quando o link vai para os dois lados, se é para todos ou
  para um só. Informação cai na ficha `DADOS_INFORMADOS_PELO_CLIENTE` com o rótulo escrito por ela.
- **O link abre numa primeira página: a lista do que separar** (`#intro`, `PEDIDO.introDocs()`), no mesmo visual do
  formulário, com ícone e uma frase por documento, agrupada por pessoa (os seus, os do cônjuge, os do falecido, os bens…),
  o aviso da **data do óbito** no inventário e o botão *Clique aqui para começarmos*. **A lista sai dos mesmos blocos
  do formulário**, então só traz os bens que ela marcou na janela do card (o extrato bancário é o único "na data do
  óbito") e nunca diverge do que a página pede depois. Bens do mesmo tipo vão **num arquivo só** ("se forem vários,
  pode juntar tudo"). Quem já começou (rascunho) ou já viu a página não passa por ela de novo. **A mesma lista sai em
  texto** para mandar à parte, antes do link: botão *Só a lista de documentos* na janela do card (`PEDIDO.listaEmTexto()`).
- **Documento que falta não trava o envio; dado que falta, sim.** Faltando só documento, o botão continua *Conferir e
  enviar* e a conferência pergunta *"Enviar sem estes documentos?"* — só o *Sim, enviar sem eles* envia. A ficha leva
  `documentosFaltando` (o Apps Script escreve "DOCUMENTOS QUE O CLIENTE NÃO TINHA NA HORA DO ENVIO") e o aviso do topo
  do painel diz "Enviou sem N documentos". Nome, estado civil, endereço, regime, pagamento etc. continuam travando.
- **O envio é definitivo, e tem trava.** O botão da página mostra "Faltam N itens" e, tocado, lista o
  que falta; só com tudo preenchido vira "Conferir e enviar", que abre uma conferência ("este link fecha")
  com *Voltar e revisar* / *Enviar agora*. Ao enviar, o Apps Script grava `concluidoEm` no pedido: **o link
  expira** (a página diz "já foi usado" e as ações `cliente-arquivo`/`cliente-dados` recusam), para um
  segundo preenchimento não confundir o card. Gerar/atualizar a lista com o mesmo código reabre o link.
- **O aviso chega no topo do painel**, junto do Jornal (`renderEnvios()`): o Apps Script grava
  `/casos/{id}/envioCliente` (`em`, `arquivos`, `visto:false`); *Abrir o card* leva ao card e marca visto.
- **Data em texto, não calendário** (`dd/mm/aaaa` com máscara; data impossível trava o envio). **CEP manda
  no endereço** (a cada CEP novo a rua/bairro/cidade/UF vêm dele). **"Acrescentar" em ato de duas pontas** cria a outra ponta (Convivente 2,
  Divorciando(a) 2, Noivo(a) 2) — o papel vai para a ficha e para o nome do arquivo.
- **A IA copia números de documento dígito por dígito** (`lerDocumentoComIA`) e marca `?` no que não
  estiver nítido; as fotos saem com até 2400 px, qualidade .85, para o 6 não virar 8.
- **A ordem do cartão da pessoa é fixa:** nome, profissão, estado civil; se é casada, o regime de bens e os dados do
  cônjuge **logo em seguida**; só então CEP e endereço, e por último os documentos. **Os documentos de cada pessoa ficam no cartão dela**, depois disso, com o nome na frase ("Certidão de casamento de José e Maria"), que se atualiza ao
  digitar; cada um mostra "Falta anexar" / "✓ Anexado". O cartão final **"Mais documentos"** guarda só o que não
  é de uma pessoa (matrícula, bens a inventariar). **Regime de bens: só três** — comunhão parcial,
  comunhão universal e separação total (universal e separação total pedem o pacto e o registro dele).
- **A IA só lê depois do envio concluído** (`cliente-ler`, disparado pela página logo após a ficha e
  mantido pelo navegador mesmo se a página fechar): nada dela corre durante o envio.
- **O envio é rápido porque a IA não segura a fila e o servidor não lê o caso inteiro.** O Apps Script lê só o
  nome e a pasta do caso (antes trazia todos os documentos com o texto da IA a cada arquivo) e a trava cobre só
  o número do nome e a pasta — criar o arquivo no Drive e gravar o registro correm em paralelo. A
  leitura pela IA sai numa chamada à parte (`cliente-ler`, também depois de o link fechar) e o card mostra
  "lendo…" até terminar. A numeração dos nomes vem de um contador pequeno em `/pedidos/{código}/contagem`.
- **A prévia do WhatsApp tem imagem** (`og-envio.png`, 1200×630, com a marca PRIME) e o link é curto
  (`/e/{código}`, reescrita no `vercel.json`; a imagem usa o mesmo grafite e a faixa champagne). Com o link, **a mensagem é curta** (recado + link): a lista já
  está na página. O endereço do link ainda é o do projeto até haver um domínio neutro (`ENVIO_BASE_URL`).
- **O topo não leva o nome PRIME**: o arco champagne, *Envio de documentos*, *20º Tabelião de Notas* e, por
  último, a escrevente (Shirley Dantas, WhatsApp (11) 95492-9643, com link), tudo na tarja grafite.
- **Casado, em qualquer ato, abre o regime de bens** (3 opções, obrigatório); os dados do cônjuge vêm junto
  onde o ato os pede. **Viúvo**: certidão de casamento com averbação do óbito; a de óbito do cônjuge só na
  lista de inventário. **O falecido do inventário** (`k:'falecido'`) pergunta o estado civil **na data do
  óbito**: solteiro → nascimento; casado → regime, dados do cônjuge, casamento (e pacto + registro se o regime
  exige); viúvo/divorciado/separado → casamento com averbação; certidão de óbito e RG/CPF sempre.
- **Preenchimento do celular**: os campos levam o `autocomplete` certo (nome, CEP, rua, cidade…), e o que
  responde depois (o CEP) troca **só o bloco do endereço**, sem mexer no campo em que a pessoa está.
- **O advogado informa estado civil, profissão e endereço** (e o nome), **sem número da OAB**, e sobe a carteira
  da OAB (`adv:true` no catálogo; não pede RG nem certidão) — **e nunca regime de bens nem dados do cônjuge**: ele não é parte (há teste cobrindo inventário, divórcio e as três pontas da procuração, onde ninguém pede regime nem cônjuge). **Procuração: sem certidão de estado civil de
  ninguém** (outorgante e procurador só RG/CPF; o estado civil continua como dado); os documentos do bem
  (imóvel/veículo) são pedidos quando ela marca, e há sempre um espaço **opcional** para outro arquivo (a
  procuração geral não exige nenhum). **Pacto e união estável
  são decididos pelo cliente**: o pacto abre na pílula de quem é casado em regime com pacto; a escritura de união
  estável, na de quem marcou que vive nela (quem já é convivente, noivo ou divorciando não é perguntado).
- **O visual segue a folha do orçamento**: papel branco, tarja grafite `#1F2A33` com faixa champagne de 5 px,
  blocos recuados `#F4F1EA`, linhas em faixa em vez de filete, tinta cheia, cantos quase retos; o rodapé é a
  tarja de baixo e a tela final é um recibo. Sem frase explicativa no topo. Letra de 17 px; alvos de toque ≥ 48 px.
- **"Acrescentar" diz quem entra**: *herdeiro(a)* no inventário, *vendedor(a)*/*comprador(a)* na compra e venda
  (um botão por papel quando o link vai para os dois, **cada um logo depois da última pílula do seu papel**: vendedores juntos, compradores juntos). No inventário, os documentos dos bens ficam sob **"Bens a
  inventariar"** (no divórcio, "Bens a partilhar").
- **O link só fecha quando o envio é concluído**: sair da página e voltar continua valendo, e o que foi digitado
  fica guardado **neste aparelho** (rascunho de 3 dias, `localStorage`), com aviso e "Começar de novo"; os
  arquivos que já tinham subido voltam como "✓ Enviado" (estão no Drive). **No celular o rodapé some enquanto o teclado está aberto**, o campo
  vem para o meio da tela e Enter passa ao próximo campo.
- **A certidão de estado civil aparece desde o início** (genérica até ela escolher o estado civil) e o
  endereço se recolhe depois do CEP (rua/bairro/cidade/UF viram uma linha com *Editar*).
- **"Tirar foto" no computador abre a webcam** (`abrirCamera()`); no celular continua o `capture` nativo.
- A faixa Documentos também tem **Abrir pasta no Drive** (`pedidoPastaHtml()`).
- **Mudar a lista depois de gerar o link** avisa que o link está velho e pede
  *Atualizar a lista* — o código continua o mesmo.

Passos manuais (regras do banco com `/pedidos` e Apps Script novo): `FIREBASE.md`,
seção 11. Testes: `testes/enviar-tela.mjs` (a página), `testes/cliente-envio.mjs`
(o Apps Script com o Google fingido), `testes/pedido-tela.mjs` (o botão e o card).

### Arrastar o que veio pelo WhatsApp para o card

Nem todo cliente preenche link (a clientela dela não é tecnológica): muita gente manda foto e PDF pelo WhatsApp. A faixa
**Documentos** do card tem uma caixa, *"Solte aqui os arquivos recebidos do cliente"* (`solteHtml()`, `solteReceber()`), com
o botão *Escolher arquivos* para quem não arrasta. Cada arquivo vai ao Apps Script (`painel-arquivo`), que **cria a pasta do
caso se ainda não existe**, guarda o arquivo, a IA lê e identifica o **tipo e de quem é**, e o arquivo ganha o nome padrão
`Pessoa_Tipo_AAAA-MM-DD_n.ext`. O registro nasce em `/casos/{id}/documentos` com `origem: "arrastado no card"` (chave `pnl_…`,
selo, texto lido) — a minuta lê como lê os do link.

Regras dela, de 28/10/2026, que **não devem ser mexidas sem perguntar**:

- **Pasta plana**: todos os arquivos na pasta do caso, sem subpasta por pessoa (a minuta continua lendo igual).
- **Salva direto e corrige depois.** Não há tela de revisão antes. O que a IA não tem certeza — tipo `OUTRO`, confiança que
  não é alta, documento de pessoa sem nome, formato que ela não lê (HEIC) — fica salvo e **marcado "confirmar o nome"** no card,
  com o lápis (`renomearDocCard()` → `painel-renomear`) para escolher o tipo e escrever o nome; o Drive é renomeado junto.
  **A IA nunca chuta nome**: sem nome, o arquivo fica como `Recebido_…` até alguém dizer.
- **O Drive só é tocado pelo selo** (como nos arquivos do link). *Ler de novo* e *Excluir* valem também para o que foi
  arrastado (`ORIGENS_ARQUIVO`).
- **Copiar e colar também vale**: copiou a foto no WhatsApp Web (ou o arquivo na pasta), clica na caixa do card e aperta
  Ctrl+V. A caixa ativa é a última em que ela clicou (o card se redesenha sem perder o lugar); texto colado e Ctrl+V dentro de
  um campo de outro lugar nunca são interceptados, e sem caixa escolhida o painel não adivinha o card.
- **Compartilhar do WhatsApp (celular/tablet Android, com o painel instalado):** ela seleciona as mensagens (várias de uma
  vez), toca em *Compartilhar* e escolhe *Equipe Prime*. O `manifest.json` declara o `share_target` (POST em `/compartilhar`),
  o `service-worker.js` guarda os arquivos no aparelho (cache `painel-compartilhado`, nada vai para a rede ainda) e abre o painel
  em `/?compartilhado=N`; ali a janela **"Para qual caso?"** (`compartilhadoAbrir()`, busca por nome) manda tudo pelo mesmo
  caminho de `solteReceber()`. Só existe onde o navegador oferece o *share target* (Android; **não** iPhone, **não** WhatsApp Web
  no computador, que não tem botão Compartilhar). O painel precisa estar **instalado** (não só um atalho) e reinstalado uma vez
  depois desta versão, para o Android aprender que ele recebe arquivos. Teste: `testes/solte-card.mjs`.
- **A caixa de entrada do WhatsApp (número só de documentos, API oficial da Meta).** O cliente — ou ela, encaminhando — manda PDF
  e foto para o número do cartório; a Vercel (`lib/whatsapp-entrada.js`, pela porta da Joaninha, `/whatsapp`) confere a assinatura da
  Meta, baixa o arquivo e o entrega ao Apps Script (`entrada-receber`), que o guarda na pasta de espera **ENTRADA WHATSAPP**. O topo do
  painel avisa (*"Chegaram N arquivos pelo WhatsApp"*, `#cc-entrada`); ela escolhe o caso (a janela "Para qual caso?") e cada arquivo
  segue o caminho de sempre (`entrada-atribuir`). **Nada vira caso sozinho**, e quem descarta manda para a lixeira do Drive. A mensagem
  repetida (a Meta reentrega) entra uma vez, pelo id dela. **Nunca por WhatsApp Web automatizado (Evolution/Baileys): é o que bane
  número** — o bot antigo, no número pessoal 11 94785-1816, foi desligado por ela em 28/10/2026 e o código dele (`api/salvar-caso.js`)
  fica parado. A `/entrada` é aberta nas regras, como `/casos` (quem escreve é o Apps Script, por REST). Passo a passo na Meta, na
  Vercel e no Apps Script: `FIREBASE.md`, seção 13. Testes: `testes/whatsapp-entrada.mjs`, `testes/cliente-envio.mjs`, `testes/solte-card.mjs`.
- Só PDF e imagem, até 10 MB; áudio, vídeo e Word são recusados **antes** de sair, com o motivo escrito. No máximo dois
  arquivos sobem por vez. Arrastar só existe no computador; no celular fica o *Escolher arquivos*.
- Passo manual: o Apps Script precisa do código novo (`painel-arquivo`, `painel-renomear`). Se não tiver, o motivo aparece
  escrito na caixa. Testes: `testes/solte-card.mjs` (o painel) e `testes/cliente-envio.mjs` (o Apps Script).

### O link de pagamento: o cliente confere, paga e anexa o comprovante

Pelo card, **Pagamento → Gerar link de pagamento** cria `/p/{código}` (`pagar.html`, reescrita no `vercel.json`).
Pela **primeira vez** o cartório cobra em duas partes que o cliente precisa enxergar como duas: a **escritura** (paga ao
20º Tabelião, por Pix ou transferência) e o **registro de imóveis** (paga por **boleto**, de outro beneficiário — hoje a
Prime Assessoria). O que mora aqui está no `index.html` (`pagFaixaHtml`, `abrirPagamento`, `pagGerarLink`,
`imprimirComprovante`), em `pagar.html` e no Apps Script (`pagamento-arquivo`, `pagamento-concluir`, `pagamento-ver`).

Regras dela que **não devem ser mexidas sem perguntar**:

- **Uma tela só** (ver a regra da tela única, mais abaixo): os dois valores, o Pix e o código de barras, o botão de rever o orçamento — só se ela
  escolher uma versão na janela; **o status "Aprovado pelo cliente" não é exigido**, ela usa os status para outras coisas — e os
  comprovantes. O recibo abre em *Ver o recibo*, o boleto em *Ver o boleto*. Ela anexa os dois ao gerar o link (viram imagem leve no
  banco; o boleto em PDF também guarda o PDF, se couber). **Dá para colar o print (Ctrl+V) ou arrastar o arquivo** na caixa de cada um.
- **Dois pagamentos, nunca somados**: cada um no seu cartão. O aviso de segurança que ela pediu no começo **saiu da tela por decisão dela** (22/10/2026).
- **O comprovante é obrigatório para enviar.** O botão *Enviar comprovantes* fica apagado até chegar **um para cada pagamento, no mínimo**, e o link **só fecha assim** (o Apps Script confere, não só a página).
- **Link só da escritura ou só do registro**: o cartão que não foi escolhido some, e um comprovante basta.
- **Os textos são dela**: o objeto `D` no começo do script de `pagar.html` (códigos A…F, na lista que ela editou em
  22/10/2026). Linha em branco no `D` some da tela — foi assim que ela tirou o vencimento ("Vence em") e a frase "este pagamento
  é por boleto"; o vencimento continua gravado na cobrança.
- **O comprovante não vira documento do card.** A minuta lê tudo em `/casos/{id}/documentos`, e um arquivo sem texto lido
  trava a geração; por isso ele mora em `/cobrancas/{código}/meta/comprovantes`, com selo, e o card tem só o resumo em
  `/casos/{id}/pagamento` (`status`: aguardando → recebido).
- **A baixa é da equipe.** O painel avisa no topo ("Cliente enviou os comprovantes de pagamento") e o card mostra
  *Imprimir comprovantes* (um botão só, todos os arquivos juntos): ela imprime e leva ao financeiro do cartório, que dá baixa no sistema
  dele. Nada marca "pago" sozinho.
- **Anexar o recibo e o boleto preenche a janela, mas o que a IA leu é hipótese.** Apps Script `pagamento-ler` devolve JSON; o painel só
  usa o que as contas confirmam (`pagConferirRecibo`: os dois totais iguais e a soma das linhas igual ao total; `pagLerLinhaDigitavel`:
  três dígitos verificadores, e dela saem o valor e o vencimento — não da IA). Só preenche campo em branco (o que ela digitou vale),
  cada campo lido leva "lido do documento — confira", e a falha da leitura nunca trava: aparece escrita e ela digita à mão.
- **O cliente aprova o orçamento por um link, com um botão só.** Na linha de cada versão do orçamento, *Link para aprovar*
  (`orcLinkAprovacao`) grava `/cobrancas/{código}` com `meta.tipo:'orcamento'` (a folha do cliente como imagem) e devolve
  `/o/{código}` (`orcamento.html`, reescrita no `vercel.json`). A página mostra a folha e **só "Aprovo este orçamento"** — ela
  decidiu em 22/10/2026 que não há "tenho uma dúvida". Tocar chama o Apps Script `orcamento-aprovar`, que grava
  `/casos/{id}/orcAprovacao` (`orcId`, `versao`, `em`, `visto:false`): é um campo **próprio**, que não mexe no status do orçamento
  (ela usa os status para outras coisas). O card mostra "✅ Cliente aprovou", o topo do painel avisa, e a janela do link de
  pagamento já nasce com a versão aprovada. A aprovação vale só para a versão que o cliente viu: versão nova, link novo.
  Link de orçamento nunca serve de link de pagamento (e o contrário): `meta.tipo` é conferido nos dois Apps Script/páginas.
- **Dá para juntar mais de um recibo e mais de um boleto.** Na janela do card, a caixa de colar aceita quantos arquivos ela precisar (cada um com
  miniatura e *× Tirar*). **Com mais de um recibo, o valor da escritura é a SOMA**, mas só quando cada recibo fechou as próprias contas
  (`pagConferirRecibo`); um que não fecha impede a soma e o motivo diz qual. O valor digitado à mão nunca é trocado (`valEManual`). Com mais
  de um boleto, o código de barras, o valor e o vencimento são **os do primeiro** — o aviso diz isso, e se o cliente paga cada um à parte, o
  jeito certo é um link para cada. O banco guarda `imagens.recibos`/`imagens.boletos` (listas) e, por compatibilidade, o primeiro em
  `imagens.recibo`/`imagens.boleto`; a página do cliente mostra todos, legendados "Recibo 1 de N".
- **O comprovante parece instantâneo, mas o link só fecha com tudo enviado.** Na página do cliente, o arquivo aparece como anexado assim que a foto
  está reduzida (1600 px, qualidade .8) e o envio ao Drive segue em segundo plano (`fila` em `pagar.html`); o *Enviar comprovantes* espera a fila e,
  se algum envio falhou, não fecha o link e mostra o motivo escrito. O Apps Script lê as duas coisas do caso numa viagem só
  (`firebaseLerVarios`) e não usa a trava quando a pasta do caso já é conhecida.
- **A página do cliente é uma tela só (redesenhada em 22/10/2026), leve e arredondada.** Os dois pagamentos ficam em cartões
  brancos de cantos redondos — o Pix com **Copiar**, o TED **recolhido** num botão, o código de barras com **Copiar** —, depois o botão do
  orçamento e **"Anexe os comprovantes"**: um botão só, "+ Adicionar comprovante", sem texto explicativo. **Os comprovantes ficam num
  lugar só**: o cliente anexa quantos precisar (cada um numa linha com **×** para tirar o que anexou errado), e o botão *Enviar
  comprovantes* só liga com **no mínimo um para cada pagamento** (o Apps Script confere também). Cada arquivo vai com um código novo
  (`c…`) para `/cobrancas/{código}/meta/comprovantes`; `pagamento-remover` tira da lista e põe o arquivo na lixeira do Drive **só com o
  selo certo**, e só enquanto o link está aberto. No card, **um botão só imprime todos** (`pagamento-ver` com `qual:'todos'`), porque o
  link não sabe qual arquivo é de qual pagamento. Foi ela quem decidiu tirar da tela: o rótulo do ato, os três passos, a saudação, o
  aviso de segurança, o "Começar", o favorecido, a dúvida com o WhatsApp, o beneficiário do registro e o botão de baixar o boleto
  (o boleto continua em "Ver o boleto"). Links antigos, com comprovante por `escritura`/`registro`, continuam valendo.
- **"2.000" é dois mil** (`pagCentavos`): o mesmo erro do financeiro, que já aconteceu uma vez.
- Passo manual: regras do banco com `/cobrancas` e Apps Script novo (`FIREBASE.md`, seção 12). Testes:
  `testes/pagar-tela.mjs` (a página), `testes/pagamento-envio.mjs` (o Apps Script) e `testes/pagamento-painel.mjs` (a janela,
  a faixa, o aviso e a impressão).

## O Ajudante do painel (extensão do Chrome)

Mora em `ajudante/` (não é uma função da Vercel: não conta nas 12). Entra nos sites com o **navegador e o certificado digital que a Shirley já usa**
e traz o PDF para o card; o painel só desenha o bloco *Buscar na JUCESP* (dentro da caixa de soltar arquivos, `ajudanteHtml()`) quando a extensão
responde ao "tem Ajudante?" — botão que o navegador não sabe cumprir não é desenhado. Instalação e uso: `ajudante/LEIA-ME.md`. O zip que ela baixa (`/ajudante-do-painel.zip`, na raiz, servido pela Vercel) é refeito com `zip -X -r ajudante-do-painel.zip ajudante` — o `testes/ajudante.mjs` acusa se ficar para trás.

Decisões dela, de 28/10/2026, que **não devem ser mexidas sem perguntar**:

- **Nenhuma senha é guardada**, em lugar nenhum: quem identifica é o certificado instalado no computador (e o PIN, se houver, é ela que digita).
- **Nada é pago sozinho.** Hoje só existe leitura e escolha. Quando entrarem serviços pagos (ONR), o robô **para antes do pagamento** com um aviso
  "vou pagar R$ X, confirmar?" — só o clique dela paga. Cópia digitalizada com tarifa na JUCESP: o Ajudante para e deixa com ela.
- **O contrato social é o ato de CONSOLIDAÇÃO mais recente.** Lê-se nos DETALHES de cada linha da *Cópia Digitalizada* (`escolherConsolidacao`);
  sem consolidação, ele não escolhe: avisa e deixa para ela (e ainda pega o PDF que ela abrir).
- **O que não reconhece, não adivinha.** Tela diferente, botão que sumiu, três tentativas iguais: faixa vermelha com *Fazer à mão* e
  *Copiar relatório* (só a forma da tela, sem o ticket `sc` do endereço). O erro da página não encerra o pedido.
- **O endereço do Apps Script mora no `background.js`**, não vem do pedido, e a ponte (`painel.js`) só atende a própria página do painel
  (mesma origem e janela). O tipo (`FICHA_CADASTRAL_JUCESP`, `CONTRATO_SOCIAL`) vem do pedido — a IA não adivinha — e o arquivo segue o caminho de
  sempre (`painel-arquivo`: pasta do caso, leitura, nome `Pessoa_Tipo_AAAA-MM-DD_n`).
- O fluxo da JUCESP foi montado a partir de **fotos das telas**, sem acesso ao site: a primeira rodada de verdade é com ela olhando, e é provável
  que peça ajuste (os testes usam páginas simuladas). Em aberto: se o endereço do PDF (`VisualizaTicket.aspx?sc=…`) pode ser baixado uma segunda
  vez pela extensão; se não puder, o erro diz isso e a saída é salvar o PDF e arrastar para a caixa.
- **Os CNPJs vêm do próprio caso, ela não digita** (29/10/2026: "cada caso pode vir com um CNPJ ou mais, de ambas as partes"). O painel lê o texto dos
  documentos já lidos do card (`ajEmpresasDoCaso`) e lista cada empresa com os seus botões; só CNPJ de dígito verificador certo, sem os do
  cartório e da Prime, sem os de documento-modelo, o mesmo CNPJ de vários papéis junto. *Buscar os dois documentos das N empresas* roda **uma de
  cada vez** (a próxima só sai quando a anterior termina de vez — o aviso `fim` do fundo); empresa que a JUCESP não tem (outro estado) termina o
  pedido sozinha e a fila segue. O campo *Outro CNPJ* continua, recolhido. **É o painel lendo o que está escrito, não a IA chutando número.**
- **O captcha da JUCESP ninguém resolve por ela.** Depois do Buscar a JUCESP pede o código da imagem; o Ajudante reconhece, avisa ("digite as
  letras e clique em CONTINUAR") e **espera** — não é erro e não tem prazo curto. Resolver captcha por robô burla a proteção do site e os termos
  de uso: decisão fechada. Para ela digitar o mínimo, o Ajudante **aprende o NIRE de cada CNPJ** na primeira busca (`nires` no armazenamento da
  extensão, só do que veio do resultado da busca) e da segunda vez abre direto a empresa, pulando pesquisa e captcha; se a JUCESP não deixar,
  cai na pesquisa de sempre. Ainda não se sabe, sem teste real, se a JUCESP deixa entrar direto.
- **O PDF pode abrir noutra aba.** No primeiro teste real o Ajudante marcou a opção, clicou em OK e acusou "a página não mudou": a JUCESP provavelmente
  abre o PDF numa aba nova. O fundo agora pega o `VisualizaTicket.aspx` tanto na aba do pedido quanto numa aba aberta por ela (`openerTabId`), fecha a
  aba extra depois de guardar e avisa a aba do pedido (`pdf`, `fim`) para a faixa parar de vigiar. A escolha da opção passou a ser um **clique de verdade**
  (`radio.click()`), porque a JUCESP guarda a escolha no clique. Ainda sem confirmação real de qual dos dois acontece.
- **A ficha e a cópia são pedidas pelo formulário, não por clique.** No segundo teste real o relatório que ela copiou mostrou a tela certa, a opção marcada
  e o botão `btnEmitir` (submit de um formulário ASP.NET), mas nada abria: o Chrome **bloqueia o pop-up** que o clique de um programa faz abrir.
  Agora a aba do pedido monta o POST a partir do próprio formulário (viewstate, a opção marcada, o botão), lê a resposta e, se for o PDF — ou uma
  página que aponta para `VisualizaTicket.aspx?sc=…` —, entrega os bytes ao fundo (`pdf-bytes`). O endereço do PDF é buscado **uma vez só**,
  o que também elimina a dúvida do ticket de uso único. Se a resposta não for PDF, volta ao clique de sempre. O contador de "tentei 3 vezes" é
  **por pedido** (a mesma aba atende várias empresas).
- **O Chrome não deixa a extensão clicar em link `javascript:`.** Os links da tabela de resultados da JUCESP (o NIRE) são `javascript:__doPostBack('alvo','')`;
  clicar neles dá "violates Content Security Policy" e nada acontece (achado no relatório de erros da extensão, 28/10/2026). `clicarSemScript()` preenche
  `__EVENTTARGET` e `__EVENTARGUMENT` e envia o formulário, que é tudo o que o link faria. Outro `javascript:` que não seja postback: erro escrito, nunca tentativa.
- **A versão da extensão sobe a cada mudança** (`manifest.json` e `VERSAO` do `painel.js`, que o teste obriga a andar juntas): ela instala a extensão trocando
  arquivos numa pasta, e sem número novo ninguém sabe se o Chrome leu os arquivos novos. O *Copiar relatório* leva a versão, a frase da faixa e — quando o pedido do PDF pelo formulário recebe uma resposta que não é PDF — o que a JUCESP respondeu (`diagnostico`: status, tipo, tamanho, os nomes dos campos enviados, os trechos da resposta que mencionam abrir janela/ticket/redirecionar e o fim do texto — sem números longos, sem tokens de 40+ caracteres e sem campos escondidos). No terceiro teste real (0.1.2) a resposta ao pedido pelo formulário foi **a mesma página** (HTML, 200, `/Pre_Visualiza.aspx`, 52 KB), sem PDF e sem endereço de ticket que a busca achasse; o diagnóstico da 0.1.3 existe para ver onde a JUCESP avisa que o documento está pronto.
- **Depois do captcha tudo é dele (0.1.4): clicar em OK, esperar o PDF e guardar** — pedido dela, 29/10/2026 (ela não quer clique extra). O que parava a faixa no OK
  ("a página não mudou") é, com toda a probabilidade, o **bloqueio de pop-up do Chrome**: a JUCESP abre o PDF com uma janela nova, e o Chrome a bloqueia quando o clique é de
  programa. O fundo libera, enquanto há pedido andando, **os pop-ups só do site da JUCESP** (`chrome.contentSettings.popups`, padrão `https://www.jucesponline.sp.gov.br/*`,
  desfeito ao terminar o último pedido; permissão `contentSettings`). Reserva: se, mesmo assim, a página não muda em 15 s, a faixa mostra **"Gerar o PDF (clique aqui)"** — um
  clique dela, que o Chrome sempre aceita — em vez de acusar erro. O PDF aberto é pedido **primeiro à aba da JUCESP** (`buscar-pdf`: sessão e cookies da própria aba, só
  endereço `VisualizaTicket.aspx` da mesma origem) e só depois pelo fundo. Em aberto: se o endereço do PDF vale uma vez só (o primeiro "O que veio não é um PDF" no card
  sugere que sim); se valer, a saída seguinte é forçar o download (`declarativeNetRequest` + `downloads`, com "Permitir acesso a URLs de arquivo" ligado uma vez) em vez de
  buscar de novo.
- **0.1.4 não bastou (29/10/2026):** com os pop-ups liberados, o OK clicado sozinho ainda não fez a página mudar e a faixa caiu na reserva — então o bloqueio de pop-up
  **não** explica tudo. A 0.1.5 faz o *Copiar relatório* (agora também na faixa da reserva) levar o que o **fundo** viu: se `contentSettings` foi aceito (`popups`), as abas que
  a página abriu (`abaCriada`, só o caminho, sem o ticket), o PDF visto (`pdfEm`) e como foi buscado (`buscaPelaAba`/`buscaPeloFundo`). É esse relatório que diz se o OK nem
  dispara, se abre aba, ou se o PDF abre e o que falha é baixá-lo.
- **O endereço do PDF vale UMA vez (confirmado no teste real, 29/10/2026):** ela clicou, o PDF abriu para ela e o card disse "O que veio não é um PDF" — o Chrome já tinha
  gasto o endereço. E **não havia pop-up bloqueado**: a liberação de pop-ups da 0.1.4 não era a causa (fica, é inofensiva). A 0.1.6 faz o Ajudante chegar antes do Chrome: enquanto
  há pedido andando, a **navegação** a `VisualizaTicket.aspx` é bloqueada (`declarativeNetRequest`, regra 7001, só `main_frame`/`sub_frame`; a busca do Ajudante é outro tipo e passa),
  o `webNavigation.onBeforeNavigate` avisa o endereço **antes** do pedido, e o PDF é baixado **uma vez só** pela aba da JUCESP (`buscar-pdf`, mesma origem, cookies dela); a aba
  bloqueada é fechada. A regra sai ao terminar o último pedido e ao acordar sem pedido andando (uma regra esquecida bloquearia os PDFs dela). Permissões novas: `declarativeNetRequest`
  e `webNavigation`. Em aberto: se a **navegação na mesma aba** (sem aba nova) deixa o Ajudante sem aba para buscar — então o fundo tenta por conta própria (cookies `SameSite` podem
  impedir); e por que o OK clicado **sem gesto dela** não gera o PDF (o relatório da 0.1.5 traz `fundo.eventos` para ver).
- **O bloqueio funcionou, e a aba do pedido virou a página de erro (0.1.7).** No teste da 0.1.6 ela viu "www.jucesponline.sp.gov.br está bloqueado — ERR_BLOCKED_BY_CLIENT" com o
  endereço do PDF: o PDF tenta abrir **na própria aba do pedido**, e o bloqueio a deixa numa página que não roda o content script, então a busca pela aba não tinha quem fizesse. Agora,
  se a aba do pedido não responde, o fundo abre uma **aba auxiliar** da JUCESP (inativa, `/Default.aspx`), busca o PDF **de dentro dela** (`scripting.executeScript`, mundo da página:
  mesma origem, cookies `SameSite` dela), fecha a auxiliar e só então tenta por conta própria. Ao terminar, a aba do pedido volta a `/Default.aspx` em vez de ficar na página de erro.
  Permissão nova: `scripting`.
- **O clique automático no OK é ignorado também no passo do contrato (0.1.8).** O relatório da 0.1.6 (passo `contrato`, `fundo.eventos` vazio, sem pop-up, sem aba, sem PDF) mostra que
  nem a passagem para a lista de cópias — uma navegação comum — acontece quando o Ajudante clica; o clique dela, sim. Ou seja: **não é só pop-up**. Sem saber como o site decide, não se
  tenta burlá-lo (o captcha e um possível controle de "clique de gente" são proteções do site): a reserva — **um clique dela, que o Chrome e o site aceitam** — agora vale para
  os dois passos (`escolher` e `baixar`), e o relatório traz `botaoPorDentro` (tipo, `onclick`, `onsubmit` e `target` do formulário e os trechos dos scripts da página sobre OK/janela)
  para a próxima rodada mostrar o que o site faz com o clique. Se o site realmente exigir clique humano no OK, o fluxo possível é: ela digita o captcha e dá um clique por documento;
  todo o resto (empresa, opção, PDF, nome, card) é do Ajudante.
- **O contrato consolidado se acha pelo número da ficha (0.1.9, 29/10/2026).** A lista da *Cópia Digitalizada* quase não tem descrição (só a 1ª linha; 24 linhas em 3 páginas, "Mostrando 1 - 10 de 24"), então procurar a palavra "consolidação" nela não escolhe nada. A regra dela: ler a **ficha cadastral**, achar o **último ato com "CONSOLIDAÇÃO CONTRATUAL"** e pegar o `NUM.DOC` dele (ex.: `034.366/21-0`, sessão 22/01/2021) — é o mesmo número da coluna **Nº Registro** da lista. O Apps Script (`consolidacaoDoPdf`, pergunta própria à IA, porque a leitura geral resume e pode largar os NUM.DOC; `consolidacaoDaFicha` é a conta, sem IA) devolve `consolidacao` na resposta do `painel-arquivo` da ficha; o fundo guarda no pedido (`consolidacao`, `fichaLida`) e o `planejar` acha a linha por esse número, **paginando em "Próximo >"** até achar. Não achou na última página: para e escreve o número, nunca escolhe outra linha. Quem pede só o **Contrato** recebe a **ficha antes** (ela fica no card). Precisa do Apps Script novo.
- **A lista de cópias abre numa ABA NOVA (0.1.10, 29/10/2026).** O relatório do teste da 0.1.9 mostrou o botão OK por dentro: `aspnetForm.target='_blank'` com POST para `SelecionaProduto.aspx`. Ou seja, o OK do contrato abre a lista **noutra aba**, filha da do pedido — e o Ajudante só respondia à aba do pedido (`jobDaAba`), então a lista aparecia sem faixa e sem ninguém trabalhando (e a aba do pedido ficava com a faixa velha "não respondeu ao meu clique"). Agora as abas filhas (`filhas`, as que o `onCreated` já registrava) também recebem o pedido; a do pedido é avisada (`seguiu`) e para de vigiar; ao guardar o PDF as abas extras fecham.
- Próximos: ONR (matrícula atualizada, com a confirmação antes de pagar) e prefeitura (valor venal).

Testes: `node testes/ajudante.mjs` (manifesto, ponte, fundo, as telas da JUCESP simuladas, a faixa e o bloco do card).

## O Caderno da Rafaela (projeto à parte)

Mora em `rafaela/`, num projeto próprio da Vercel (*Root Directory*
`rafaela/painel`), com o próprio `package.json` e a própria função de IA — por
isso **não conta** nas 12 funções do painel e não encosta em nada daqui.
É o painel de estudos de vestibular dela (acervo de questões, erros e dúvidas
com correção por IA, estatísticas, macetes e um mural de post-its). **Para
continuar, comece por `rafaela/CLAUDE.md`.**

## Onde as coisas estão

Tudo no `index.html`. O bloco financeiro vai do comentário
`// ── Quem pode ver o dinheiro` até o registro do service worker, e é ele que
o `testes/montar.mjs` recorta.

| O quê | Onde procurar |
|---|---|
| A conta inteira | `finConta()` |
| O DSR do mês | `finDsrDoCiclo()`, `finPartesDsr()`, `finSalvarDsr()` |
| Quotas dos arranjos | `finQuotas()`, `finDividirCentavos()` |
| Calendário do fechamento | `finCicloPorChave()`, `finDataFechamento()`, `finFeriados()` |
| A planilha | `finHtmlLancamentos()` |
| A janela do card | `renderFinanceiroDoCaso()`, `finFaixaDoCaso()` |
| O mês no quadro | `finQuadroHtml()`, `finResumoCiclo()`, `finComparativoCiclo()` |
| Quem é o cliente | `finClienteDe()` |
| Cofre pessoal | `finCriarCofre()`, `finDestrancar()`, `finMeuSalario()` |
| Regras do banco | `database.rules.json` · passo a passo em `FIREBASE.md` |
| As tabelas de emolumentos | `ORC_TABELA_NOTAS`, `ORC_TABELA_REGISTRO`, `ORC_TRIBUTOS` |
| As regras de cobrança, ato a ato | `ORC_ATOS`, `orcLinhaEscritura()`, `orcLinhaRegistro()` |
| Outro ato na mesma escritura | `ORC_ATOS_AVULSOS`, `orcLinhaOutroAto()`, `orcHtmlOutrosAtos()` |
| As dezessete etapas | `orcCalcular()` |
| A busca na faixa | `orcFaixa()`, `orcLetraFaixa()` |
| O CHECK FINAL | `orcCheckFinal()` |
| A escada de conhecimento | `ORC_CONFIANCAS`, `ORC_CONHECIMENTO_INICIAL` |
| Comparar versões e achar divergência | `orcComparar()`, `orcDivergencias()`, `orcSemelhantes()` |
| A faixa do card e a janela | `orcFaixaDoCaso()`, `renderOrcamentoDoCaso()` |
| A memória e o modo cliente | `orcHtmlMemoria()`, `orcHtmlCliente()` |
| Mais de uma matrícula | `orcHtmlImoveis()`, `ORC_CAMPOS.unidadesRegistro` |
| Dispensar o registro (cliente registra em outro cartório) | `despesas.registro` em `orcCalcular()`, `orcHtmlDespesas()` |
| Esconder as informações "só para a máquina" | `orcVerTecnico`, `orcAlternarTecnico()` |
| O desenho em duas colunas e o resumo lateral | `.orc-layout`, `.orc-coluna-lateral`, `orcHtmlResumoTopo()` |
| A folha do cliente em imagem | `orcDesenharFolha()`, `orcLayoutFolha()`, `ORC_FOLHA` |
| A foto na tela, para copiar | `orcVerImagem()`, `orcCopiarImagem()`, `orcFecharImagem()` |
| As linhas que a cliente lê | `orcLinhasCliente()` |
| O que se refaz sem redesenhar a tela | `orcRedesenharAcessorios()` |
| A soma de qualquer lista de imóveis | `orcHtmlListaSoma()`, dentro do `orcListaHtml()` |
| A soma que vira a base | `orcSomaDaLista()`, `orcUsarSomaComoBase()` |
| A pensão em parcelas | `orcPensaoParcelas()`, `orcPensaoDetalhe()`, `orcMesesAte()`, `orcHtmlPensao()` |
| A alíquota de fora da Capital | `orcAplicarAliquotaDeFora()`, `orcChaveAliquota()`, `orcHtmlAliquotas()` |
| A busca da alíquota | `api/aliquota-municipal.js` |
| A isenção do ITBI (primeiro imóvel / PMCMV) | `orcConferirIsencoes()`, `orcTetoIsencaoItbi()`, `orcConfirmarIsencaoItbi()` |
| Do orçamento para o Financeiro | `orcParaFinanceiro()` |
| Pedir documentos (lista por ato e público) | `pedido-docs.js` → `PEDIDO.montar()`, `comporTexto()`, `formulario()`, `abrirJanela()` |
| O link de envio e o que chegou no card | `criarLinkEnvio()`, `pedidoRecebidosHtml()` (index.html) · `enviar.html` · `clienteArquivo()`, `clienteDados()` (Apps Script) |
| O link de pagamento (janela, faixa do card, aviso, impressão) | `abrirPagamento()`, `pagGerarLink()`, `pagFaixaHtml()`, `pagAvisosHtml()`, `imprimirComprovante()` (index.html) · `pagar.html` · `pagamentoArquivo()`, `pagamentoConcluir()`, `pagamentoVer()` (Apps Script) |
| O Ajudante (JUCESP) — a extensão | `ajudante/` → `jucesp.js` (`planejar()`, `escolherConsolidacao()`), `background.js` (`capturar()`), `painel.js` · no painel `ajudanteHtml()`, `ajudantePedir()` |
| A Rede, na tela | `renderRede()`, `redeHtmlFila()`, `redeHtmlConstrutoras()` |
| O caminho até a conversa | `redeHtmlPergunta()`, `redeConvidei()`, `redeAceitou()`, `redeHoraDePerguntar()` |
| A mensagem sugerida | `redeMensagemSugerida()`, `redeAtoNaFrase()` |
| O mapa | `redeMontarMapa()`, `redeVerUF()`, `redeVerCapital()`, `REDE_RUMOS` |
| Quem é a mesma pessoa | `impressaoDigital()`, `redeChaveDaPessoa()` (Apps Script) |
| A varredura das minutas | `apps-script/cartorio-rede.js` → `varrerRede()` |
| A ordem da Agenda | `agendaPorHorario()`, dentro de `renderAgenda()` |
| O Jornal da equipe | `renderJornal()`, `radarSelosHtml()` |
| O Radar, na tela | `renderRadar()`, `radarHtmlDia()`, `radarHtmlItem()`, `radarHtmlDias()` |
| A Base de Regras, na tela | `radarHtmlBase()`, `radarHtmlTema()` |
| A Joaninha jurídica | `joaninhaJuridico()`, `joaninhaModoJuridico()`, `radarLevarPraJoaninha()` |
| A varredura das fontes | `api/radar-juridico.js` → `varrer()` |
| O guarda-corpo da triagem | `lib/radar-triagem.js` → `conferirItem()` |
| O prompt do Radar | `lib/radar-prompt.js` |
| As fontes e o filtro do DO | `lib/radar-fontes.js` |
| A carga inicial da base | `lib/base-regras-inicial.js` |

## Testes

```bash
node testes/montar.mjs && node testes/calculo.gerado.mjs
node testes/navegador.mjs && node testes/celular.mjs
node testes/rede.mjs && node testes/rede-varredura.mjs
node testes/radar.mjs && node testes/radar-triagem.mjs
node testes/orcamento.gerado.mjs && node testes/orcamento-tela.mjs
node testes/bussola.mjs
node testes/pedido-docs.mjs && node testes/pedido-tela.mjs
node testes/enviar-tela.mjs && node testes/cliente-envio.mjs && node testes/solte-card.mjs && node testes/whatsapp-entrada.mjs
node testes/ajudante.mjs
node testes/orcamento-link-tela.mjs && node testes/pagar-tela.mjs && node testes/pagamento-envio.mjs && node testes/pagamento-painel.mjs
```

O `montar.mjs` também gera o `preview-quadro.html`, que é o desenho da seção
do dinheiro com dois fechamentos no banco.

Rodam por cima do `index.html` publicado. Ver `testes/README.md`.

**O Chromium muda de lugar entre sessões.** O caminho do executável
(`chromium-1194` virou `chromium-1243`, e muda de novo) já quebrou nove
suítes de uma vez em 23/10/2026, por um motivo que não é do painel.
`testes/navegador-de-teste.mjs` → `abrirChromium()` procura o Chromium em
vez de supor o caminho, e toda suíte de tela usa ele hoje — nova suíte que
nascer com `chromium.launch({executablePath: '/opt/pw-browsers/...'})`
direto no código vai quebrar na próxima sessão.
A porta do servidor de teste tem o mesmo risco pela metade: `servidor.mjs`
→ `servir()` sem argumento deixa o sistema escolher uma porta livre
(`servidor.url` tem o endereço certo), e é assim que `montar.mjs`,
`navegador.mjs`, `celular.mjs`, `orcamento-tela.mjs`, `radar.mjs` e
`rede.mjs` fazem — mas `enviar-tela.mjs`, `orcamento-link-tela.mjs`,
`pagamento-painel.mjs`, `pagar-tela.mjs` e `pedido-tela.mjs` ainda pedem a
porta fixa `8199` (`servir(8199)`) e escrevem `http://127.0.0.1:8199/...`
no código — funciona enquanto a porta estiver livre, mas é o mesmo
`EADDRINUSE` que fez a porta virar aleatória nas outras. Vale trazer essas
cinco para `servidor.url` também, quando mexer nelas de novo.

A Rede tem harness próprio (`harness-rede.html`), montado pelo mesmo
`montar.mjs`: ela mora depois do registro do service worker no `index.html`,
fora do recorte do financeiro. O `rede.mjs` termina medindo tudo num iPhone 13,
e o `rede-varredura.mjs` roda o arquivo do Apps Script com o Google fingido.

Os Orçamentos saem em dois pedaços, porque a conta e a tela têm exigências
diferentes. O motor (tabelas, regras de cobrança, as dezessete etapas, a base
de conhecimento) é puro — não toca em DOM nem em Firebase — e vira o
`orcamento.gerado.mjs`, que roda sem navegador: é ali que a conferência de
dinheiro tem de morar. A tela vira o `harness-orcamento.html`, e o
`orcamento-tela.mjs` percorre o caminho da mão até o número, terminando num
iPhone 13. **Antes de publicar qualquer mudança no motor, rode os dois** —
vários daqueles testes existem porque o número já foi conferido à mão uma vez:
o orçamento do apartamento 1301 é o gabarito de que a leitura da tabela está
certa.

O Radar também (`harness-radar.html`), pelo mesmo motivo: ele mora entre o
service worker e a Rede, fora dos dois recortes. O `radar.mjs` cobre a faixa
do cabeçalho, as quatro faixas de triagem, a base e a Joaninha jurídica — e
termina medindo tudo num iPhone 13. O `radar-triagem.mjs` roda sem navegador e
sem internet: é ele que cobra que dispensa sem contrapartida vire "confirmar",
que notícia não suba a 🔴 e que as três ressalvas em aberto da base
(117.1 × 119.1, LC 227/2026 × Tema 1.113, o provimento não localizado) não
sumam dela em silêncio.

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

- **A tabela vence em 01/01/2027.** Em janeiro o motor trava sozinho e pede a
  folha nova — as duas, Notas e Registro.
- **As notas explicativas das tabelas não foram lidas.** As notas 1 a 13 da
  tabela de Notas vieram só com o título no PDF; o texto delas ficou fora. É de
  lá que sairiam os fundamentos da redução de 40% e das condições especiais.
- **O orçamento ainda não sabe o valor venal.** O card não tem esse campo, e
  algumas contas (ITBI em município que usa o maior entre venal e negociado)
  dependem dele. Hoje ele é digitado; vale medir se compensa virar campo do
  card, como a matrícula.

- **A Rede leu pouco, e o filtro do nome é o motivo.** Instalada em 26/08/2026:
  a primeira varredura achou 10 minutas e 25 pessoas, 6 do ramo. Dez é pouco
  para o Drive dela — a varredura só enxerga **documentos do Google Docs cujo
  nome começa com MINUTA**, e só um nível abaixo da pasta de minutas. Minuta em
  Word ou PDF, com outro nome, ou dentro de subpasta, fica invisível. Vale
  medir quanto do Drive está sendo perdido antes de mexer no filtro.
- **A profissão vem pela metade.** Nas duas minutas lidas à mão, uma trazia a
  profissão do cliente e a outra tinha o campo em branco — o bot pergunta, mas
  nem sempre a resposta chega antes da minuta ser gerada. Vale insistir mais
  nessa pergunta: ela deixou de ser burocracia e virou o dado mais valioso da
  Rede.
- **O Radar ainda não passou uma vez.** Três coisas ficaram por confirmar
  antes de a base virar exigência formal: a **numeração vigente** do item das
  Normas de Serviço (117.1 ou 119.1) direto com a Corregedoria; se a **ANOREG/SP
  precisa mesmo de leitura na cara do site** (no teste manual ela não apareceu
  em busca genérica — hoje todas as fontes são lidas por fetch direto, então
  isso está coberto, mas vale medir o que sobra dela depois da peneira); e se
  existe mesmo um **Provimento CGJ 17/2026** alinhando São Paulo à decisão do
  CNJ sobre CNDs, que a pesquisa não localizou.
- **A varredura lê a capa, não o Diário inteiro.** Cada fonte entra com os
  primeiros 6.000 caracteres da página inicial — o que dá as manchetes do dia,
  não o texto do ato. Depois da primeira semana no ar vale medir quanto está
  sendo perdido antes de mexer no limite ou em ir atrás do link de cada
  publicação.
- **A Joaninha ainda não reage ao Radar.** As poses (`joaninha.play`) não estão
  ligadas a evento nenhum do painel — nem ao 🔴 do dia. É trabalho à parte, e
  vale junto com os outros eventos (Firebase, WhatsApp).

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
