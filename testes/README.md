# Testes do financeiro, dos Orçamentos, da Rede e do Radar

Nove suítes, todas rodando por cima do **index.html de verdade** — o
`montar.mjs` recorta o bloco financeiro do arquivo publicado a cada execução,
em vez de manter uma cópia que envelheceria em silêncio.

```bash
node testes/montar.mjs        # recorta o bloco e monta as páginas
node testes/calculo.gerado.mjs   # a conta: 93 verificações, sem navegador
node testes/navegador.mjs        # 24 caminhos completos no Chromium
node testes/celular.mjs          # a mesma tela num iPhone 13
node testes/rede.mjs             # a Rede no Chromium, e no celular no fim
node testes/rede-varredura.mjs   # a conta que identifica a pessoa, sem Google
node testes/radar.mjs            # o Radar Jurídico no Chromium, e no celular no fim
node testes/radar-triagem.mjs    # a peneira do Radar, sem navegador e sem internet
node testes/orcamento.gerado.mjs # o motor de orçamentos: tabelas e conta, sem navegador
node testes/orcamento-tela.mjs   # o ambiente de Orçamentos no Chromium, e no celular no fim
```

E, para olhar o desenho com dados de verdade:

```bash
node testes/montar.mjs && node -e "import('./testes/servidor.mjs').then(m=>m.servir())"
# abre http://127.0.0.1:8199/preview.html        (o financeiro)
#      http://127.0.0.1:8199/preview-quadro.html (o mês no quadro)
#      http://127.0.0.1:8199/preview-radar.html  (o Radar, com um dia de verdade)
```

## O que cada uma protege

- **orcamento** — as duas tabelas de emolumentos lidas inteiras (sem faixa
  faltando e sem degrau com buraco), a conta de cada um dos vinte atos em
  centavos inteiros, os 40% do ato secundário, o ITBI e o ITCMD só onde eles
  valem, a taxa adicional que nunca entra sem ser perguntada e a vigência que
  trava o "definitivo". O gabarito é o orçamento do apartamento 1301, que veio
  nas instruções de cobrança e ela já tinha conferido à mão.
- **orcamento-tela** — o caminho da mão até o número: a faixa do card que não
  mostra valor sem login, o ato reconhecido pelo tipo escrito no card, a
  memória com faixa e item de cada linha, o modo cliente que não deixa escapar
  faixa nem hipótese, a versão nova que não come a anterior, e o "escritura
  assinada" que leva a PARTE DO TABELIÃO para o Financeiro — nunca o total que
  a cliente paga.

- **calculo** — a escada do dinheiro inteira, com a escritura da Tania degrau
  por degrau e as dezessete linhas do fechamento de agosto comparadas uma a
  uma com a planilha antiga. Também o calendário do fechamento (26 a 25, com
  feriados) e o cofre pessoal (criptografia, senha errada, recuperação).
- **navegador** — do login até o repasse: lançar pelo card, editar sem
  duplicar, a planilha, o bruto/líquido, a carteira, o cofre e o salário que
  se recalcula quando um lançamento muda.
- **celular** — que nada estoure a largura da tela e que a planilha role
  dentro da própria caixa.
- **rede** — quem entra (sem login pede senha, a Grazi esbarra na porta, só a
  conta dona vê), a fila que só traz gente do ramo, o lápis que corrige e não
  é desfeito pela próxima varredura, o cadastro único das construtoras, o mapa
  por estado e bairro, e duas coisas que **não** podem acontecer: CPF na tela e
  robô no LinkedIn. Termina medindo tudo num iPhone 13.
- **radar** — a faixa do Jornal (que não aparece sem varredura, e que não deixa
  dia falhado passar por dia calmo), as quatro faixas de triagem na tela, e as
  duas coisas que o Radar existe para não deixar acontecer: notícia com cara de
  norma e dispensa sem o que continua exigido. Também a base de regras, os
  botões que levam para a Joaninha e a resposta da IA que precisa sair como
  texto, nunca como HTML. Termina medindo tudo num iPhone 13.
- **radar-triagem** — a peneira, sem navegador: o relógio de São Paulo, a
  limpeza do HTML, o desembrulho do JSON da IA e o `conferirItem`, que é o
  guarda-corpo escrito em código porque regra que só existe no prompt depende
  de o modelo ter lembrado dela naquela manhã. Cobra também que as três
  ressalvas em aberto da carga inicial (a numeração 117.1 × 119.1, a
  LC 227/2026 contra o Tema 1.113, o provimento não localizado) não sumam da
  base em silêncio.
- **rede-varredura** — a única parte do `apps-script/cartorio-rede.js` que roda
  fora do Google: a impressão digital do CPF (mesma pessoa dá o mesmo código, o
  número não volta dele, trocar a chave duplica o cadastro) e a lista de quem
  nunca entra na teia. Carrega o arquivo do Apps Script com Drive, Firebase e
  IA fingidos.

O quadro do dinheiro (a seção **O mês em dinheiro**) entra nas três: a conta
dos fechamentos no `calculo`, o "não mostra valor sem login" e a leitura do
ciclo no `navegador`, e a largura no `celular`. Para olhar o desenho dele com
dois fechamentos no banco, abra o `preview-quadro.html` do mesmo servidor.

## Faz-de-conta

`faz-de-conta-navegador.js` e `faz-de-conta-node.js` são o Firebase, o Auth e
um card falsos. Nenhum teste toca o banco de verdade — e a senha do login de
mentira é literalmente `certa`.

Os dois também **congelam o dia**: `isoHoje()` devolve sempre uma data dentro
do fechamento de agosto de 2026, que é o mês da semente e o das datas que os
testes digitam nos formulários. Sem isso a suíte envelhecia sozinha — em 26 de
agosto o ciclo virou, a planilha do fechamento corrente amanheceu vazia e dez
verificações passaram a falhar sem nada ter sido quebrado. Todo o calendário
do financeiro sai do `isoHoje()`, então congelar aquela linha congela o mês
inteiro.

O Radar é a exceção: ele tem relógio próprio (`radarHojeISO()`, no fuso de São
Paulo, porque a varredura roda em UTC na Vercel), e o `radar.mjs` semeia o
banco com a data de hoje de verdade.

A semente do `rede.mjs` são pessoas de duas minutas reais do Drive. Ela está
ali de propósito: além de exercitar as telas, é a documentação viva do formato
que a varredura precisa gravar em `/rede/pessoas`.
