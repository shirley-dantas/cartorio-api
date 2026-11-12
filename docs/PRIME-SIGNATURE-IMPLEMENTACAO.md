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
Capa, atendimento, exclusão e conclusão ficam em Mais ações. Jornada única
ao final, com todas as etapas e os controles anteriores.

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

A usuária definiu a meta mensal em R$ 80.000,00 em 12/11. A faixa mostra
somente barra e percentual que falta, sem valores monetários no DOM ou nos
atributos acessíveis. O progresso é limitado a 100%; ao atingir ou superar
a meta, indica “Meta atingida”. O olhinho oculta também barra e percentual.
A referência continua sendo o fechamento corrente do Financeiro.

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

## Verificações gerais

- `testes/signature.mjs`: index real com Firebase simulado; desktop/celular,
  navegação, edição, abas sem gravação, registro, jornada única, privacidade
  do olhinho/logout e Joaninha preservada.
- `testes/joaninha-tela.mjs`: fluxo completo de anotação, jurídico, orçamento,
  assinatura, minuta, acompanhamento e histórico.
- Financeiro: `montar.mjs`, `calculo.gerado.mjs`, `navegador.mjs`, `celular.mjs`.
- Regressões de esteira, topo, documentos, minutas e 56 verificações dos
  protocolos das IAs e das ações da Joaninha.

Dados e serviços de produção não são usados nos testes. `?layout=classico`
mantém o desenho anterior como alternativa de diagnóstico. A suíte da
esteirinha cobre essa alternativa; a Signature tem suíte própria.
