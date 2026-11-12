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

## Verificação dos ajustes

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
