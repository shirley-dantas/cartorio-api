# PRIME Signature — decisões de design aprovadas
Data: 2026-11-11
Status: **APROVADO COMO REFERÊNCIA VISUAL E ARQUITETURA DE EXPERIÊNCIA**; ainda não implementado. Esta aprovação NÃO autoriza publicação, mudança no código de produção ou alterações nas regras operacionais.

## Card / Página do processo — APROVADO
A usuária aprovou a direção **PRIME Signature (opção 1)**, com aparência de planner executivo feminino, vinho profundo, champagne, rosé suave e marfim, boa hierarquia e elegância. O processo deve abrir em **página exclusiva**, e não em painel lateral ou card expandido na listagem. Preservar todas as funcionalidades atuais.

Elementos acordados:
- Cabeçalho do caso: cliente/nome, ato, status, assinatura quando houver, responsável e tempo na etapa.
- Contexto imediato: **última observação, etapa atual e próxima ação** em destaque, sem duplicar a observação em outro bloco decorativo.
- Acessos ao trabalho, uma única entrada por função: **Documentos, Certidões, Minuta, Orçamento, Pagamento, Drive e Histórico**. Os conteúdos aparecem de forma contextual na página, sem expor todos os comandos simultaneamente.
- Dados de registro: **Registro, Prenotação, Livro, Folha e Controle** juntos, prontamente acessíveis; não criar pílula duplicada "Livro, folha e controle".
- Documentos incluem anexos; não criar aba separada de Anexos duplicando Documentos. Histórico acessado por sua própria função, sem duplicatas. Não criar bloco redundante "Em espera" se a etapa/status já comunica a condição.
- Esteirinha / jornada completa **uma única vez**, discreta, **mais abaixo/ao final da página**, nunca protagonista do topo. Preservar etapas, estados e operações.
- Capa do dossiê, ações avançadas, observações, atendimento, registros e controles existentes devem permanecer acessíveis em seu contexto adequado; não excluir nem inventar comportamento.
- Joaninha permanece preservada e integrada, sem impedir uso.
- Nenhuma mudança de cálculos, Firebase, permissões, processos, contratos ou lógica dos estados nesta etapa de UI/UX.

## Central de Comando — EM EXPLORAÇÃO, NÃO APROVADA
- Explorar composições alternativas ao primeiro mockup Signature, mantendo a linguagem visual aprovada para o card.
- **Agenda, Bloco de Notas e "O que dá pra fazer agora" pertencem à Central de Comando, nunca à página individual do processo**.
- Agenda deve mostrar visivelmente as abas **Hoje | Amanhã | Próximos dias** e conter compromissos reais; não confundir com lembretes.
- Bloco de Notas com abas Shirley/Grazi e os recursos existentes.
- "O que dá pra fazer agora" deve manter as visões "Fazer agora" e "Parece esquecido?" com o motor determinístico do painel, sem substituir por IA.
- Manter acesso a indicadores, busca, calendário mensal, Jornal da Equipe, lista de processos e ferramentas reais.
- Evitar adições fictícias de recursos como alertas inteligentes, assinaturas, gráficos ou reuniões que não correspondam ao produto; mockups podem usar dados demonstrativos identificados.
- Para a Central, proposta visual ainda exige escolha/aprovação específica.

## Critérios antes da implementação
Inventariar funções de `index.html` e rotas do sistema; mapear cada comando no novo layout; protótipo navegável com dados fictícios; testes desktop/mobile, de regressão e permissões; revisão da usuária. Sem merge em `main`, sem Vercel ou Firebase de produção sem autorização explícita.

Referência: conversas e mockups de 11/11/2026. A imagem Signature opção 1 foi aprovada como direção estética/conceitual, não como especificação pixel-perfect.


## Central de Comando — direcionamento confirmado em 11/11/2026
A usuária decidiu avançar à etapa de protótipo visual da Central, mantendo **EXATAMENTE a paleta atual do painel**, e não as novas paletas exploradas nas imagens:
- Fundo off-white quente `#F2EFE9`; branco `#FFFFFF`; superfícies `#FAF8F4`; champagne `#A9895A`; tinta azul-escuro `#1F2A33`. Cores funcionais de status continuam discretas.
- Central minimalista, feminina, moderna, com respiro visual e um ou outro pequeno elemento floral, sem ilustrações grandes, flores em excesso, caderno, selo “Aprovado”, fundos escuros ou repetições decorativas.
- Estrutura preferida: **Agenda, Bloco de Notas e O que dá pra fazer agora** como os três módulos protagonistas; números de resumo compactos, Jornal da Equipe em faixa discreta; evitar Processos Recentes/Indicadores duplicados como módulos grandes e não inventar dados ou serviços.
- **Agenda com três abas obrigatórias, VISÍVEIS: Hoje / Amanhã / Próximos dias**, e mostra apenas compromissos existentes, sem confundir tarefas.
- Bloco de Notas preserva alternância Shirley / Grazi.
- O que dá pra fazer agora preserva alternância Fazer agora / Parece esquecido?, sem alterar o motor de decisões.
- Joaninha existente é flutuante, livre da grade dos cards, interativa; não substituir sua implementação por ilustração fixa.
- Esta é aprovação de DIREÇÃO PARA PROTÓTIPO, **não aprovação de implementação nem autorização de publicação**. Card PRIME Signature aprovado anteriormente continua sem mudanças.
- Próxima etapa: protótipo local com dados fictícios para validação de UX, desktop/celular, sem Firebase e sem deploy.
