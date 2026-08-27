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

Vinte atos, cada um com a frase dela junto (`comoElaEscreveu`), para que a
conferência seja contra o original e não contra o que o painel entendeu.
Compra e venda em cinco variações, doação com e sem usufruto, inventário com e
sem meação e com partilha desigual, divórcio em três formas, dação, confissão,
procuração, ata e escritura declaratória.

- **Ato secundário na mesma escritura leva 40%** — garantia, novação,
  confissão, usufruto, cláusula resolutiva. É regra dela: a nota explicativa da
  tabela que a fundamentaria veio só com o título no PDF, e por isso cada linha
  reduzida nasce marcada como 🔵 operacional, não como fonte oficial.
- **Vaga individualizada é registro à parte, na faixa dela.** Somar apartamento
  e vaga e registrar de uma vez daria outro número — é a diferença que essa
  regra existe para não deixar passar.
- **Fora da Capital o painel não chuta.** ITBI é municipal e ITCMD é estadual:
  fora de São Paulo o imposto fica sem valor e a razão aparece escrita, com a
  frase dela ("checar o código tributário").
- **Isenção nunca é aplicada sozinha.** Ela depende de declaração da parte e de
  documento. O painel aponta ("está dentro do teto do primeiro imóvel"), mantém
  o imposto na conta e devolve a decisão. Zerar imposto por engano é o erro mais
  caro que este orçamento poderia cometer.
- **A taxa adicional de R$ 300 nunca entra sozinha.** É perguntada antes de
  fechar todo orçamento, e o CHECK FINAL trava até haver resposta. No modo
  cliente ela vai **somada ao registro, sem linha própria** — que é só isso o
  que "sem que o cliente perceba" significa: nada é cobrado a mais, apenas não
  ganha linha.

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

### A certidão que entra duas vezes

Reconciliar o gabarito trouxe uma pergunta junto: a certidão de matrícula
aparece **duas vezes** — dentro da coluna "registro com matrícula" e outra vez
na linha Matrícula. O motor faz igual ao exemplo, porque é assim que ela cobra,
**mas escreve o aviso em todo orçamento** e o CHECK FINAL pede conferência
naquela linha. Cobrar duas vezes de propósito e cobrar duas vezes por engano são
coisas diferentes, e só ela pode dizer qual das duas é esta. Trocando a coluna
do registro ou tirando a linha, o orçamento do 1301 cai para R$ 16.445,67.

### O que ainda está em aberto

Entra na base como 🔴 ou 🟡, escrito, do mesmo jeito que as ressalvas da Base de
Regras do Radar — pergunta que não fica escrita é pergunta que se perde:

- **a certidão de matrícula em duplicidade**, acima — 🟡, à espera de decisão;
- **os doze meses da pensão**: "por doze meses, mais a quantidade de tempo
  estipulada" admite duas leituras, e o motor faz a segunda (12 quando não há
  prazo);
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
| As tabelas de emolumentos | `ORC_TABELA_NOTAS`, `ORC_TABELA_REGISTRO`, `ORC_TRIBUTOS` |
| As regras de cobrança, ato a ato | `ORC_ATOS`, `orcLinhaEscritura()`, `orcLinhaRegistro()` |
| As dezessete etapas | `orcCalcular()` |
| A busca na faixa | `orcFaixa()`, `orcLetraFaixa()` |
| O CHECK FINAL | `orcCheckFinal()` |
| A escada de conhecimento | `ORC_CONFIANCAS`, `ORC_CONHECIMENTO_INICIAL` |
| Comparar versões e achar divergência | `orcComparar()`, `orcDivergencias()`, `orcSemelhantes()` |
| A faixa do card e a janela | `orcFaixaDoCaso()`, `renderOrcamentoDoCaso()` |
| A memória e o modo cliente | `orcHtmlMemoria()`, `orcHtmlCliente()` |
| Do orçamento para o Financeiro | `orcParaFinanceiro()` |
| A Rede, na tela | `renderRede()`, `redeHtmlFila()`, `redeHtmlConstrutoras()` |
| O caminho até a conversa | `redeHtmlPergunta()`, `redeConvidei()`, `redeAceitou()`, `redeHoraDePerguntar()` |
| A mensagem sugerida | `redeMensagemSugerida()`, `redeAtoNaFrase()` |
| O mapa | `redeMontarMapa()`, `redeVerUF()`, `redeVerCapital()`, `REDE_RUMOS` |
| Quem é a mesma pessoa | `impressaoDigital()`, `redeChaveDaPessoa()` (Apps Script) |
| A varredura das minutas | `apps-script/cartorio-rede.js` → `varrerRede()` |
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
```

O `montar.mjs` também gera o `preview-quadro.html`, que é o desenho da seção
do dinheiro com dois fechamentos no banco.

Rodam por cima do `index.html` publicado. Ver `testes/README.md`.

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

- **A certidão de matrícula entra duas vezes no orçamento.** É a decisão em
  aberto mais cara dos Orçamentos: R$ 76,54 por orçamento. Está inteira na
  seção deles, e o painel avisa em toda tela até ela decidir.
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
