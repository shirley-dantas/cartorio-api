# Bússola — planner pessoal de Shirley

## O que é
Planner digital pessoal para tablet, feito para unir vida pessoal e profissional
num só lugar — separado do painel do cartório (Equipe Prime / Cartorio-API), que
é compartilhado com a assistente dela e não pode ter compromissos pessoais.
Desenhado pensando em uma pessoa com TDAH e tendência à procrastinação: captura
rápida sem fricção, "Foco do dia" limitado a 3 itens, linguagem não-punitiva para
tarefas atrasadas.

## Estado atual
Arquivo único autocontido: `bussola.html` (HTML + CSS + JS vanilla, sem build
step, sem dependências externas além de fontes do Google Fonts). Já publicado
como artifact em claude.ai; este arquivo é a cópia de trabalho.

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
- **Notas rápidas**: modo texto OU desenho (ver abaixo)
- **Hábitos**: checkbox diário com sequência dos últimos 7 dias
- **Página livre**: uma folha em branco por dia para escrever/desenhar
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
  tasks: [{ id, text, category: "pessoal"|"profissional", done, date: "YYYY-MM-DD"|null, focus, createdAt }],
  appointments: [{ id, title, date, time, category, source: "manual"|"painel", painelKey?, createdAt }],
  notes: [
    { id, type: undefined /* texto */, text, pinned, createdAt },
    { id, type: "drawing", strokes: [{color, width, erase, points:[[fx,fy],...]}], pinned, createdAt }
  ],
  habits: [{ id, name, category, history: { "YYYY-MM-DD": true } }],
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

**Atenção à hospedagem:** página publicada como artifact no claude.ai pode ter
a saída de rede bloqueada. Se a linha mostrar a falha lá, a saída é servir o
`bussola.html` pela Vercel.

## Arquivos
- `bussola.html` — o app completo
