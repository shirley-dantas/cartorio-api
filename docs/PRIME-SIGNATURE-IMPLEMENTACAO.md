# PRIME Signature — atualização de 12/11/2026

Referência: [decisões aprovadas em 11/11](PRIME-SIGNATURE-DESIGN-APROVADO.md),
com autorização da usuária em 12/11 para verificar e implantar o layout.
A implementação parte da `main` atual, preservando as melhorias posteriores
da Joaninha e os dois provedores de IA. A antiga ramificação experimental
serviu de referência visual, sem incorporar suas alterações operacionais.

## Organização da interface

| Acesso | Comportamento preservado |
| --- | --- |
| Central | Agenda real, notas Shirley/Grazi e prioridades do motor atual |
| Casos | Resumos; abrir leva a página exclusiva, identificada no endereço |
| Agenda | Abas Hoje/Amanhã/Próximos dias e calendário mensal completo |
| Orçamentos/Radar/Modelos/Rede | Janelas existentes; Rede mantém restrição de acesso |
| Etapas/Arquivo | Filtros e arquivo existentes, com os mesmos estados |
| Financeiro | Login e planilha existentes |
| Relatórios | Quadro existente, sem novos cálculos |
| Configurações | Acesso às regras de minuta e troca da identificação local |
| Mais opções | Ferramentas adicionais existentes, inclusive categorias ainda em breve |

Na página do processo, `cardPartes` continua fornecendo os controles reais.
Status, responsável, assinatura e os cinco campos de registro usam os mesmos
manipuladores. Ferramentas por contexto: Documentos, Certidões, Minuta,
Orçamento, Pagamento, Drive e Histórico. Observações aparecem uma vez;
Histórico revela as notas anteriores e os registros do atendimento/Joaninha.
Capa fica em Mais ações, na mesma linha das outras
ferramentas. Excluir e Concluir/Reabrir ficam visíveis no rodapé. Atendimento
sai da página Signature, sem apagar os registros anteriores.

Na revisão solicitada em 12/11, a jornada deixa de ser renderizada nessa
página. O seletor Etapa continua como controle único, e dados, histórico e
motor de decisão permanecem disponíveis para a IA. Observações ficam dentro
do bloco Próxima ação, abaixo da orientação. O botão visível “Adicionar
observação” abre e foca o campo com instrução simples e “Salvar observação”.
Usa a gravação existente, preservando as observações anteriores e rascunhos.
Prévia aprovada pela usuária e publicação autorizada em 12/11/2026.

## Certidões — desenho aprovado e publicação autorizada em 12/11/2026

As ferramentas do caso usam somente os nomes, sem cabeçalhos repetidos.
Certidões oferece JUCESP (Ficha cadastral, Contrato social, Cartão CNPJ),
Matrícula (Visualização, Matrícula atualizada), Valor venal, Negativa de IPTU,
Dados cadastrais, Trabalhista, CND Receita Federal e Indisponibilidade.
Apenas o conteúdo do serviço selecionado aparece.

JUCESP permite escolher a empresa ou informar outro CNPJ, valida os dígitos
e exige conferência antes de iniciar. Ficha pode ser pedida isoladamente;
contrato mantém a dependência ficha → contrato do Ajudante existente.
RI Digital preserva a conferência de imóvel/cartório, login, captcha e
pagamento do fluxo anterior. Prefeitura mantém contribuinte e data, mostra
somente a ação escolhida e pede confirmação antes de solicitar. As rotinas
municipais continuam específicas da Prefeitura de São Paulo.

Cartão CNPJ, Trabalhista, CND Receita Federal e Indisponibilidade ficam
explicitamente manuais, com anexação real ao caso. Exigem identificação do
titular e PDF/imagem de até 10 MB. Usam o envio existente do Apps Script e a
fila existente de leitura; depois associam serviço, nome e titular por
transação no registro já criado, sem substituir os dados identificados pela
IA. Se essa associação falhar após o envio, avisam para conferir Documentos,
sem sugerir reenvio. Cartão CNPJ fica em JUCESP por preferência de organização,
com indicação de que o emissor é a Receita Federal.

A lista de certidões salvas é recolhida. Pedidos em andamento no estado atual
do Ajudante bloqueiam outro pedido no mesmo caso. Documentos anteriores com
serviço/titular identificado pedem confirmação antes de repetição; nenhuma
validade é presumida. Um arquivo de outro titular não impede a solicitação.
A conexão tardia do Ajudante atualiza a aba. Nenhuma chamada ocorre ao abrir
ou trocar pílulas. Não é necessário alterar o Apps Script ou a extensão.

Validação: Signature cobre oito serviços e subpílulas, navegação sem gravação,
ficha isolada/contrato com ficha, confirmação e cancelamento, bloqueio de
pedido concorrente no caso, matrícula, pedido de IPTU, anexo manual com
metadados preservados, recusa de repetição e celular. Ajudante, Prefeitura
e celular passaram. Desenho aprovado e publicação explicitamente autorizada.

## Refinamento visual das pílulas — aprovado em 12/11/2026

Proposta após o uso no tablet: todas as pílulas ganham texto mais contrastado,
bordas e seleção mais claras. Subpílulas de JUCESP e Matrícula ficam em um
bloco próprio, com botões de toque maiores e seleção preenchida em vinho.

Valor venal, Negativa de IPTU e Dados cadastrais usam uma apresentação compacta:
contribuinte, identificação da unidade/matrícula de origem e ação de solicitar.
Múltiplos contribuintes continuam selecionáveis; quando não há número lido,
permanece o campo manual. Documento e trechos de origem ficam em Mais detalhes.
Data de consulta do valor venal também fica recolhida, usando o dia atual por
padrão. Em inventário, a data do óbito permanece visível e não é inventada.
Área maior continua sinalizada e impede solicitação, como antes.

Os parâmetros e a validação dos pedidos permanecem nos manipuladores existentes.
A suíte Signature confere o vínculo imóvel/contribuinte das três consultas,
envio de IPTU e manutenção da data alterada em Mais detalhes no pedido de valor
venal. Prefeitura e celular passaram. A usuária aprovou a prévia e autorizou a publicação.

## Documentos — aprovado em 12/11/2026

A página Signature separa Anexar documentos, Recebidos e Pedir ao cliente no
mesmo padrão visual das subpílulas de Certidões. A usuária pediu Anexar como
primeira opção; ela também abre por padrão ao entrar pela primeira vez. Recebidos agrupa arquivos por
pessoa, empresa e imóvel; itens a confirmar aparecem abertos. Os demais grupos
ficam recolhidos e preservam sua abertura ao trocar de opção ou redesenhar.
Correção, releitura e exclusão ficam em Mais ações de cada documento elegível,
usando os manipuladores existentes. Arquivos legados sem origem também são
visíveis; modelos continuam no fluxo de Minuta. Links da versão compacta
exigem HTTPS. A apresentação clássica mantém seu filtro e controles atuais.

Anexar preserva arrastar, escolher arquivos, colar e o andamento da fila. Pedir
ao cliente abre o montador existente por Preparar pedido, sem criar ou enviar
solicitações ao simplesmente navegar. A pasta do Drive continua acessível em
Recebidos quando vinculada. Nenhum backend ou regra de leitura muda.

Validação: Signature cobre navegação sem gravação, grupos e ações preservados,
documentos legados, pedido existente e celular; docs-agrupados, solte-card e
celular passaram. A usuária aprovou a prévia com Anexar documentos em primeiro
lugar e autorizou a publicação em 12/11/2026.

## Somente subpílulas e orçamento simplificado — aprovado em 12/11/2026

A orientação final da usuária é preservar as pílulas principais exatamente
como publicadas. Somente as subpílulas de Documentos e Certidões adotam a
aparência dos botões atuais de Minuta/Orçamento: fundo branco, contorno fino,
texto discreto e destaque champagne para a seleção. O bloco rosa preenchido
sai das subpílulas. Nenhum botão de Minuta ou estilo de janela é alterado.

No Orçamento do card, confirmou somente três atalhos, nesta ordem: Novo,
Ver orçamento e Modo cliente. Não há situação, total, data, versão ou outros metadados nessa
área; eles continuam na janela existente do orçamento. Os três atalhos usam
os manipuladores anteriores e o último orçamento não cancelado. Quando ainda
não há orçamento, aparece Novo; autenticação e erro de leitura mantêm as
proteções existentes. Nenhum cálculo, documento, versão ou ação de backend
é apagado. As demais abas preservam sua organização publicada.

Validação: Signature compara os estilos calculados das subpílulas com os
botões atuais de Minuta e confere os três atalhos do orçamento, ausência de
metadados externos, conteúdo dentro da janela, versões salvas imutáveis,
proteção no logout e celular. A usuária aprovou a prévia com Novo em primeiro
lugar e autorizou a publicação em 12/11/2026.

## Cabeçalho do caso — aprovado em 13/11/2026

Proposta visual: títulos com separador `|` ganham nome principal e complemento
em duas linhas, apenas na apresentação. O nome completo permanece no cadastro,
no campo de edição e no rótulo acessível. Status vai para a coluna de metadados,
junto do tempo parado e prazo. Nome recebe peso mais leve e o lápis de edição
fica mais evidente, com contorno fino.

O tipo de ato ganha campo identificado. O sufixo técnico sobre texto antigo
sai apenas do rótulo visual; o valor legado continua selecionado sem conversão
automática. Adicionar ato mantém os mesmos checkboxes e manipuladores de atos
secundários. A apresentação clássica e os dados de produção não são alterados.

Signature confere edição do nome integral, mudança explícita do tipo, atos
adicionais, leitura sem gravação e tablet/celular. Celular também passou.
A usuária aprovou a apresentação, confirmou o separador `|` como critério do
subtítulo e autorizou a publicação em 13/11/2026.

## Seletores do caso — aprovado em 13/11/2026

Status, Etapa e Responsável recebem campos com contorno fino e menus no mesmo
estilo suave. A pedido da usuária, Etapa abre diretamente a lista, sem busca, com grupos de
preparação, pós-assinatura e pendências. Todos os valores existentes de etapa
e status permanecem disponíveis, com os mesmos manipuladores de alteração.

Somente Shirley e Grazi ficam disponíveis para novas atribuições. Um valor
legado de responsável permanece salvo e aparece como Responsável anterior
até uma escolha explícita; não há reatribuição automática nem alteração do
histórico. Gabriel sai também das opções da apresentação clássica.

Validação: testes unitários dos valores e escape, Signature com lista sem busca,
teclado, cancelamento sem gravação, alterações pelos manipuladores existentes,
responsável legado e limites do menu no tablet/celular. Card-topo e Celular
também passaram. A usuária aprovou a prévia sem busca e autorizou a publicação em 13/11/2026.

## Assinatura e registro no cabeçalho — aprovado em 13/11/2026

Os seis campos existentes de assinatura, registro, prenotação, livro, folha e
controle passam para o espaço à direita da identificação do caso. No computador,
ficam em duas linhas de três campos, com larguras proporcionais e a mesma altura.
O contorno e a tipografia seguem o restante do card, sem uma caixa adicional.

Quando o card tem menos de 800 px disponíveis, os campos ficam abaixo da
identificação. No celular, a assinatura ocupa uma linha e o registro usa duas
colunas. Nenhum campo é duplicado: os valores e os manipuladores de gravação,
agenda e Financeiro são os mesmos. A apresentação clássica permanece igual.

Signature confere seis campos únicos no cabeçalho, larguras e alturas iguais,
posição ao lado do nome no computador, edição de Livro pelo manipulador existente
e adaptação no tablet/celular. Celular também passou.
A usuária aprovou a prévia e autorizou a publicação em 13/11/2026.

## Acabamento do cabeçalho — aprovado em 13/11/2026

A pedido da usuária, todas as posições e dimensões do cabeçalho são mantidas.
O acabamento usa fundo marfim discreto nos campos, contornos mais claros,
rótulos neutros e ações secundárias com menor contraste. Nome, complemento,
tipo de ato, assinatura e registro mantêm os valores e controles existentes.
Nenhum HTML, manipulador ou regra de negócio muda nesta etapa.

A usuária aprovou o acabamento e autorizou a publicação em 13/11/2026.
Signature e Celular passaram.

## Documentos por identificar — aprovado em 13/11/2026

Na lista compacta de Recebidos, o grupo A confirmar passa para o final e se
chama Documentos que precisam de identificação. Uma frase explica que a IA
não conseguiu identificar os arquivos e orienta conferir nome e tipo.
As linhas desse grupo mostram Identificar documento. Os documentos, a
contagem, as ações e o estado aberto/fechado permanecem preservados.
A classificação salva e a apresentação clássica não mudam.

A usuária aprovou a prévia e autorizou a publicação em 13/11/2026.
Docs-agrupados, Signature e Celular passaram.

## Pílulas mais leves — prévia em 13/11/2026

A usuária pediu uma prévia de melhoria das pílulas. A navegação principal
recebe fundo claro e seleção em vinho suave, com contornos finos. Os serviços
de Certidões usam tons neutros e seleção champagne, com menor peso visual.
As subpílulas preservam o acabamento compacto de Minuta/Orçamento aprovado
anteriormente. Nomes, ordem, controles, disposição e funções permanecem iguais.

Signature e Celular passaram. Esta é uma prévia e aguarda aprovação antes
de publicar.

## Financeiro e privacidade

A faixa consulta apenas os lançamentos que a escuta financeira existente já
carregou. Exige autenticação e `acesso.nome`. Usa `finResumoCiclo().movimento`
do fechamento corrente, isto é, a parte do tabelião dos lançamentos do ciclo,
pagos ou pendentes. Não soma valores de registro, comissões ou DSR.
Os cálculos e o calendário de fechamento 26–25 permanecem intactos.

O olhinho começa fechado, não persiste a visibilidade e remove os valores
do DOM ao ocultar. Trocar/sair da conta volta a ocultar imediatamente.
Sem acesso, mostra somente o convite para entrar. Não há nova consulta
financeira nem alteração nas regras do banco.

A usuária definiu a meta mensal em R$ 80.000,00 em 12/11. O valor da meta
permanece oculto. O progresso é limitado a 100%; ao atingir ou superar
a meta, indica “Meta atingida”. A referência continua sendo o fechamento
corrente do Financeiro.

Em seguida, pediu para mostrar o valor acumulado antes da barra de progresso.
A prévia acrescenta esse valor em reais usando a mesma soma existente;
nenhuma regra de cálculo muda. O olhinho oculta valor, barra e percentual,
removendo-os do DOM. Logout ou perda de permissão também remove o valor.
A usuária aprovou a imagem e autorizou a publicação em 12/11/2026.

## Ajustes aprovados em 12/11

Busca ampliada, Joaninha com espaço reservado no cabeçalho e nome **Casos**
nos títulos e na navegação. A mascote mantém animações, passeio e clique;
a posição de repouso acompanha a área reservada, com alternativa no canto
quando o cabeçalho sai da tela. O calendário mantém os dias e a navegação.

A frase motivacional passa a ser gerada pela OpenAI, curta e em português,
sem dados dos casos no pedido. Usa a rota GET
`/api/perguntar-joaninha?acao=frase-dia`, sem adicionar função serverless.
Cache do navegador por data de São Paulo, cache da instância com junção de
chamadas concorrentes e cache HTTP até a virada do dia reduzem as gerações.
Não há promessa de uma única geração global entre instâncias frias.
Quando a IA ou a conexão falham, uma frase de reserva é escolhida para o
dia; não há repetição automática da chamada nesse dia no navegador.
A busca ocorre em segundo plano e o painel aberto confere a virada de data.
Não modifica Firebase, agenda, minutas, financeiro ou permissões.

## Prévia — horários das notas (12/11/2026)

Horários opcionais visíveis em cada nota e acesso direto para definir,
alterar ou remover data e hora. Notas datadas vêm primeiro em ordem de
horário; notas sem data preservam a ordem anterior. Atraso considera a hora
de São Paulo, inclusive no mesmo dia, com atualização visual a cada minuto.
A criação respeita a aba Shirley/Grazi selecionada. Usa o campo `quando`
já existente e preserva notas antigas que tinham somente data.

A edição do lembrete passa a explicar que ele fica apenas no Bloco de
Notas. A Agenda e os pontos do calendário continuam lendo exclusivamente
as assinaturas dos casos; salvar lembretes não chama o Google Calendar.
Testes cobrem criação, alteração, remoção, conclusão, ordem, atrasos,
datas antigas, desktop/celular e ausência de alteração das assinaturas.
Prévia aprovada e publicação autorizada pela usuária em 12/11/2026.

## Atenções do dia — aprovado (12/11/2026)

A usuária autorizou implementar a proposta de acompanhamento da Central.
A apresentação inicial mostra três prioridades, com motivo, ação sugerida
e responsável. “Ver todas” mantém acesso ao conjunto completo, inclusive
avisos adiados e a opção de reativá-los. O resumo da Joaninha descreve as
contagens verificadas pelas regras, sem chamada adicional à IA.

O modelo `lib/atencoes-dia.js` é puro: seleciona notas vencidas e casos sem
avanço além de `DEP_CONFIG.normalAte`. Usa dias corridos de São Paulo e a
última atividade registrada, considerando etapa, atualização, histórico,
documentos (`salvoEm` e datas equivalentes), auditoria e tarefas da Joaninha.
Datas futuras de assinatura não contam como atividade já realizada. Casos
concluídos, atualizados recentemente, sem prazo conhecido ou sem data de
referência não ganham cobrança inventada. Registro mantém seus 30 dias,
enquanto Minutando mantém os 2 dias da regra existente.

Adiamentos usam chaves `atc1_*` em `resolucoesCentral`, amarradas ao conteúdo
do aviso. Mudanças de etapa, documento ou conteúdo invalidam adiamentos
antigos; nenhum estado legado é apagado. O relógio reavalia os avisos a cada
minuto enquanto a página está visível. Adiar o aviso não altera o prazo da
nota nem a Agenda de assinaturas.

Registrar andamento usa transação por caso e identificador de operação para
preservar observações e evitar duplicação. Revalida a versão que originou o
aviso; mudança concorrente pede revisão. Acrescenta observação e histórico,
sem concluir etapas ou modificar assinatura/status. Concluir tarefa marca
`done:true` por transação, sem alternar uma tarefa já concluída para aberta.

Testes: prazos por etapa, atividade recente, fuso, vencimento por hora,
adiamento/retorno, chaves estáveis, limite de apresentação, conjunto completo,
leitura sem gravação, desktop/celular, navegação, conclusão, andamento
idempotente e alteração concorrente. Prévia com dados fictícios apresentada;
a usuária aprovou a versão mais leve e autorizou a publicação em 12/11/2026.

Após a primeira prévia, a usuária pediu um tom mais leve e fluido. A revisão
usa frases de conversa em um único parágrafo por cartão, datas como “ontem,
às 10h” quando adequadas, e botões “Anotar avanço”, “Já fiz” e “Me lembrar
depois”. Os critérios, os prazos e as ações permanecem iguais. O limite usual
da etapa continua no modelo, mas sai do texto principal para reduzir ruído.

## Alinhamento da Central — aprovado em 12/11/2026

Organização aprovada pela usuária: Agenda e Bloco de Notas dividem a
primeira linha em duas colunas iguais, com topo e base alinhados. Atenções
do dia ocupa a linha seguinte, com três prioridades lado a lado e ações
alinhadas na base. No celular, os quadros e as prioridades ficam empilhados.
Listas longas de assinaturas/notas têm rolagem interna; os formulários
continuam podendo expandir o quadro. Nenhuma regra, prazo ou gravação muda.

A suíte Signature confere a geometria dos quadros e ações, além dos fluxos
existentes. As imagens usam dados fictícios; a usuária aprovou a prévia e
autorizou a publicação. A verificação obrigatória `celular.mjs` também passou.

## Verificações gerais

- `testes/signature.mjs`: index real com Firebase simulado; desktop/celular,
  navegação, edição, abas sem gravação, registro, Etapa sem jornada duplicada, privacidade
  do olhinho/logout e Joaninha preservada.
- `testes/joaninha-tela.mjs`: fluxo completo de anotação, jurídico, orçamento,
  assinatura, minuta, acompanhamento e histórico.
- Financeiro: `montar.mjs`, `calculo.gerado.mjs`, `navegador.mjs`, `celular.mjs`.
- Regressões de esteira, topo, documentos, minutas e 56 verificações dos
  protocolos das IAs e das ações da Joaninha.

Dados e serviços de produção não são usados nos testes. `?layout=classico`
mantém o desenho anterior como alternativa de diagnóstico. A suíte da
esteirinha cobre essa alternativa; a Signature tem suíte própria.
