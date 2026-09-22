# Bússola — planner pessoal de Shirley

## O que é
Planner digital pessoal para tablet, feito para unir vida pessoal e profissional
num só lugar — separado do painel do cartório (Equipe Prime / Cartorio-API), que
é compartilhado com a assistente dela e não pode ter compromissos pessoais.
Desenhado pensando em uma pessoa com TDAH e tendência à procrastinação: captura
rápida sem fricção, "Foco do dia" limitado a 3 itens, linguagem não-punitiva para
tarefas atrasadas.

## Estado atual
Arquivo único autocontido: `index.html` (HTML + CSS + JS vanilla, sem build
step, sem dependências externas além de fontes do Google Fonts). Servido pela
Vercel num **projeto próprio**, `bussola` (Root Directory `bussola`, mesmo
repositório), em **https://bussola-mu.vercel.app** — é esse o endereço
instalado no tablet dela. Sobe sozinho a cada junção na `main`, junto com o
painel. Também responde em `cartorio-api.vercel.app/bussola/`, mas ali o
navegador dela confunde com o app do painel: não usar para instalar.

**Confirmado por ela em 22/09/2026:** instalou pelo `bussola-mu.vercel.app`,
apareceu como Bússola (sem a mensagem do painel) e as assinaturas do painel
vieram. Primeiro teste com os casos de verdade.

Tudo funciona 100% no navegador, sem backend: os dados ficam em
`localStorage` sob a chave `bussola-planner-v1`.

### Funcionalidades prontas
- **Views**: Dia / Semana / Mês, alternáveis por abas no topo
- **Captura rápida**: barra fixa no topo, tarefa com categoria (pessoal/profissional)
- **Foco de hoje**: até 3 tarefas marcadas com ★ por dia
- **Compromissos**: título, data, hora, categoria; as assinaturas do cartório
  chegam sozinhas do painel (ver "Compromissos do painel" abaixo)
- **Tarefas**: lista do dia + pendentes de dias anteriores aparecem com aviso
  neutro; filtro por categoria
- **Agenda** (antes "Linha do tempo"): compromissos do dia, assinaturas do
  painel e as contas que vencem no dia ("💸 Pagar: …")
- **Página livre + Bloco de notas, lado a lado**: o que se escreve à mão na
  página vira cartão no bloco ("Guardar no bloco →"); cada nota tem data e
  "→ amanhã" a leva para o dia seguinte. 📌 fixa em todos os dias; nota
  antiga sem data aparece todo dia.
- **Diário** (no lugar dos Hábitos — ver abaixo)
- **Finanças** e **Contas a pagar** (aba própria — ver abaixo)
- **Desenho à mão / caneta**: componente `Sketchpad` (dentro do `<script>`)
  captura eventos de pointer (mouse, touque, caneta com pressão), guarda os
  traços como pontos normalizados (0–1) por canvas, então é responsivo a
  redimensionamento. Usado em Notas (modo Desenho) e na Página livre.
- **Temas trocáveis**: três paletas — Rosé, Lavanda, Pêssego — via atributo
  `data-palette` na tag `<html>`, escolha salva no state. Suporte automático a
  dark mode do sistema em cada paleta.
- **Visual**: estilo romântico/delicado — fonte script (Parisienne) na marca,
  serifada elegante (Cormorant Garamond) nos títulos, corpo em Quicksand
  (arredondada). Símbolos ♡ Pessoal / ✦ Profissional além da cor.

### Modelo de dados (localStorage)
```js
{
  tasks: [{ id, text, category: "pessoal"|"profissional", done, date: "YYYY-MM-DD"|null, focus, createdAt,
            painel?: { id: "bussola-<id>", estado: "enviando"|"ok"|"removida", ultimoDone, erro } }],
  appointments: [{ id, title, date, time, category, source: "manual"|"painel", painelKey?, createdAt }],
  notes: [
    { id, type: undefined /* texto */, text, pinned, createdAt },
    { id, type: "drawing", strokes: [{color, width, erase, points:[[fx,fy],...]}], pinned, createdAt }
    // as duas ganharam `date` ("YYYY-MM-DD"): o bloco é do dia
  ],
  habits: [...],   // não aparece mais na tela; ficou guardado, não foi apagado
  diario: { v, senha:{salt,embrulho}, rec:{salt,embrulho}, face:{cred,salt,embrulho}|null, dados:{iv,ct} } | null,
  financas: { lancamentos: [{ id, data, descricao, categoria, tipo: "entrada"|"saida", valor, contaId? }] },
  contas: [{ id, nome, valor|null, venc, dia, repete: "nao"|"semana"|"quinzena"|"mes"|"ano", ativa, pagamentos:[{venc,pagoEm,valor}] }],
  pages: { "YYYY-MM-DD": { strokes: [...] } },
  lastCategory: "pessoal"|"profissional",
  palette: "rose"|"lavanda"|"pessego",
  painelHidden: { "<painelKey>": true },   // o que ela tirou só do Bússola
  painelSync: { ok: timestamp|null, erro: string|null }
}
```

## Compromissos do painel (feito em 22/09/2026)
As assinaturas vêm sozinhas do painel do cartório, com o nome do cliente no
título — autorizado por ela. O Bússola **só lê**, nunca escreve no painel.

- **De onde:** `https://painel-cartorio-default-rtdb.firebaseio.com`, por REST
  (`/casos.json` e `/resolucoesCentral.json`). Os dois caminhos já são de
  leitura aberta nas regras do painel — nada precisou mudar lá.
- **O que entra:** o mesmo que a Agenda do painel mostra — a assinatura da
  escritura (`agendado`) e a da 2ª parte (`segundaParte.data` com status
  `data_definida`), de caso não concluído e que não foi tirado da agenda lá
  (`resolucoesCentral` com estado `excluido`/`concluido`). A regra do painel
  está em `renderAgenda()` e `chaveAgendaEvento()` do `index.html`.
- **Quando:** ao abrir, ao voltar para a aba, a cada 10 minutos e no botão
  ↻ Atualizar da Linha do tempo.
- **Remarcar:** a chave (`painelKey` = caso|tipo|data) carrega a data; mudou lá,
  a antiga some e a nova entra. Só se refaz de hoje em diante — dia que passou
  fica congelado, para o mês não perder o histórico quando o caso é concluído.
- **Tirar daqui:** o ✕ numa assinatura do painel pergunta antes e grava em
  `painelHidden`; no painel ela continua.
- **Se falhar:** a linha diz "Não consegui falar com o painel agora" e mostra
  o que veio da última vez — nunca uma semana vazia com cara de calma.
- A caixinha manual "veio do painel" saiu do formulário.

## Um aplicativo só dele (22/09/2026)
O painel é instalado como aplicativo com escopo `"/"` — o site inteiro. Na
primeira publicação o Bússola não tinha manifesto, e o "Instalar" do navegador
disse que ele já estava "dentro do painel" e abriu o painel. Agora ele tem
identidade própria: `manifest.json` com `id` e `scope` em `/bussola/`, ícone
próprio e um service worker (`sw.js`) com o mesmo escopo, que só repassa as
requisições. Escopo mais específico vence o do painel. **Não mexer no escopo
do manifesto do painel** para resolver isso: é o que mantém o painel instalado
nos aparelhos dela e da Grazi.

**E não bastou.** Mesmo com manifesto próprio, o navegador do tablet dela
seguiu dizendo que era "o mesmo app já instalado do painel": dentro do mesmo
domínio, alguns navegadores não aceitam um app aninhado no escopo de outro.
A saída foi um **projeto próprio na Vercel**, com Root Directory `bussola`,
ou seja, outro domínio. Por isso os caminhos do manifesto, dos ícones e do
service worker são **relativos** (`./`, `icons/`, `sw.js`): o mesmo arquivo
serve em `/bussola/` no domínio do painel e na raiz do projeto próprio. Não
voltar a caminho absoluto `/bussola/...`, que quebra no projeto próprio.

Os dados ficam no `localStorage` do domínio, então o que ela escreveu em
`/bussola/bussola.html` continua lá em `/bussola/`.

## Pedidos de 22/09/2026

### Tarefa profissional vai para o painel
Tarefa ✦ Profissional vira lembrete no **Bloco de Notas do painel, aba
Shirley** (`/focos`, o nó que o formulário do painel grava, com
`resp: "shirley"` e `origem: "bussola"`). **Concluir vale nos dois lados**, a
pedido dela. O painel grava `/focos` como uma lista inteira; o Bússola nunca
regrava a lista — só acrescenta no fim (`PUT /focos/<n>`), marca `done` no
índice (`PATCH`) ou apaga o índice. `ultimoDone` é o último estado em que os
dois concordaram: mudou no painel, vale o painel; mudou aqui, sobe na próxima
conferência. Se o banco recusar, a linha diz "ainda não chegou ao painel" e a
conferência seguinte tenta de novo. Só vai tarefa criada depois desta
mudança; pessoal nunca vai.

### Diário
Ideias, insights, sonhos e pensamentos, pelo dia em que foram escritos. Na
aba Diário, o mês marca os dias escritos e a busca por palavra ignora acento
e caixa. **Trancado por padrão**: aparece como um véu opaco, e o texto nem
está na página. Cifrado no aparelho (AES-GCM, chave da senha por PBKDF2 com
250 mil voltas, como o cofre do painel); a chave que cifra é sorteada uma vez
e embrulhada pela senha, pelo **código de recuperação** (mostrado uma vez, na
criação) e, se o aparelho deixar, pelo **rosto** (passkey com a extensão PRF
do WebAuthn — onde não houver, o botão não aparece e a senha vale sempre).
Tranca sozinho ao sair do app e após 5 minutos parado. Sem senha e sem código,
ninguém lê — nem quem fez o Bússola.

### Finanças do mês e contas a pagar
Planilha do mês do calendário (entrou / saiu / sobrou, por categoria). O
**salário do cartório vem do painel**, pedido dela: é o `finMeuSalario()` do
painel, recortado do `index.html` para `fin-motor.js` por
`scripts/gerar-bussola-fin.mjs` — **nunca editar o fin-motor.js à mão**, e
rodar o script depois de mexer no financeiro do painel (o
`testes/bussola.mjs` falha se ele ficar para trás). O salário do mês é o do
fechamento que termina nele (setembro = 26/08 a 25/09). Ler o Financeiro exige
entrar com a conta dele (Firebase Auth por REST); fica guardado só o token de
renovação (`bussola-fin-sessao`), nunca a senha nem os lançamentos.

**Serviços extras do Meu financeiro (pedido de 22/09/2026, depois de usar)**:
"o salário deve ler também os extras do Meu financeiro". Os extras moram no
cofre cifrado do painel (`/financeiro/pessoal`, só a conta dona lê). O Bússola
lê o cofre junto com os lançamentos e pede a **senha do Meu financeiro** para
abrir — a chave fica só na memória e tranca quando o app sai da tela. O
destrancar e as somas são **recortados do painel** (`finDestrancar`,
`finPessoalDoCiclo`, `finSomaPessoal`), no mesmo `fin-motor.js`. Aberto, o
salário passa a somar o salário lançado à mão lá (como o painel faz) e os
extras do fechamento entram numa **linha só, com o total** — sem a descrição
de cada um, a pedido dela ("não precisa trazer de onde saiu o extra, apenas o
valor"). **As despesas do Meu financeiro
ficam fora** — ela pediu os extras, e as despesas dela já são lançadas na
planilha do Bússola; somar as duas contaria em dobro.

**A cursiva aparece já no campo**, assim que a letra volta da IA — antes só
aparecia depois de salvar, e ela achou que não tinha funcionado.

**Contas a pagar**: cada conta tem o próximo vencimento e a repetição.
Vencida ou vencendo em até 3 dias, aparece no topo do Dia ("venceu há 28
dias", sem bronca) e na Agenda do dia do vencimento. "Paguei" lança a saída na
planilha (pergunta o valor se a conta não tem valor fixo) e empurra o
vencimento; conta de uma vez só se encerra.

**Sem cópia de segurança, por decisão dela (22/09/2026)**: tudo fica só no
tablet. Se ela mudar de ideia, a pergunta foi: botão de baixar cópia, ou
cópia cifrada no banco com a conta do Financeiro.

### Mercado (pedido junto, 22/09/2026)
Quadro no Dia, entre Tarefas e Diário. Acabou, anota; pegou, risca ("tirar os
já pegos" limpa). Tudo o que já entrou fica em `mercado.historico` e volta como
atalho "Acabou de novo?" (os oito mais frequentes que não estão na lista). O
mesmo item não entra duas vezes (a chave ignora acento e caixa). Como a lista
mora no tablet, "Enviar a lista" manda o texto pela folha de compartilhar do
aparelho (ou copia, onde ela não existe) — nada sai sem ela tocar.

### Escrever à mão em qualquer campo
Todo campo com `data-caneta` ganha um ✍️ (um `MutationObserver` equipa também
os campos redesenhados, como o do Diário). O quadro é o mesmo `Sketchpad` da
Página livre; em "Pronto" a escrita vai como PNG de fundo branco para
**`lib/ler-letra.js`, no projeto do painel** (cartorio-api.vercel.app — é lá
que mora a chave da IA), e o texto volta para o campo. O item salvo leva
`aMao: true` e aparece em **cursiva** (Dancing Script) — só o que veio da
caneta, por decisão dela; o digitado fica na letra de sempre. A marca é
consumida ao salvar (`foiAMao()`), para não vazar para o próximo digitado.
Ela autorizou a leitura pela IA **em todos os campos, inclusive o Diário**
(22/09/2026): o texto passa pela IA e volta, nada fica guardado lá; no Bússola
ele continua cifrado. Letra ilegível ou sem internet: a janela avisa e não
fecha. O aparelho dela é **Android com caneta** — o teclado de escrita à mão do
próprio Android continua funcionando nos campos, como alternativa.

**A causa, achada com um print dela**: o endereço dava **404**. O painel já
tinha 12 funções em `api/`, e o plano da Vercel aceita no máximo 12 — a
13ª (`api/ler-letra.js`) fez a Vercel recusar a publicação do painel inteiro,
em silêncio. Por isso a leitura mora em `lib/ler-letra.js` e entra pela porta
da Joaninha (`api/perguntar-joaninha.js?acao=ler-letra`), e o
`testes/bussola.mjs` falha se `api/` passar de 12 arquivos.

**No primeiro uso de verdade (22/09/2026) a leitura falhou** com a mensagem
genérica, que só aparece quando o servidor nem responde direito (função fora
do ar, quebra ao carregar, tempo esgotado ou recusa de origem). Daqui não dá
para abrir a Vercel, então a causa não foi achada. Desde então a janela diz o
motivo ("sem resposta do servidor", "erro 404", "demorou demais") e a função
responde a um **GET** — abrir `https://cartorio-api.vercel.app/api/perguntar-joaninha?acao=ler-letra`
no navegador mostra se ela está no ar e se tem a chave da IA (`chaveDaIA`),
sem revelar a chave.

A função só responde às origens do Bússola e do painel (e ao teste local),
recusa imagem acima de 2 MB e usa `claude-opus-5` com esforço baixo e
`fallbacks: "default"` (se o modelo recusar por engano, o servidor tenta outro).

## Testes
`node testes/bussola.mjs` — banco do painel e leitura da letra fingidos,
passa por todos os pedidos acima e termina com fotos em
`testes/saida/bussola-*.png`, num tablet e num iPhone 13. Sem internet as
fontes não chegam e as fotos saem na letra de reserva; para foto fiel (a
cursiva, principalmente), aponte `BUSSOLA_FONTES` para um CSS local com as
mesmas fontes em `@font-face` (dá para montar com os pacotes `@fontsource/*`).

## Arquivos
- `index.html` — o app completo
- `bussola.html` — só redireciona para `./` (o primeiro endereço publicado)
- `../lib/ler-letra.js` — a leitura da letra de mão (no projeto do painel, atendida por `api/perguntar-joaninha.js?acao=ler-letra`)
- `fin-motor.js` — GERADO: a conta do salário, recortada do painel
- `manifest.json`, `sw.js`, `icons/` — o que faz dele um aplicativo separado
  do painel. Os ícones são uma rosa-dos-ventos nas cores da paleta Rosé.
