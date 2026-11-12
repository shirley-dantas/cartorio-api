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


## DECISÃO FINAL MAIS RECENTE — APROVAÇÃO DA CENTRAL DE COMANDO (11/11/2026)
**STATUS: DESIGN VISUAL DA CENTRAL APROVADO PELA USUÁRIA.** Esta decisão substitui as explorações visuais anteriores da Central (inclusive a orientação preliminar de manter apenas a paleta original clara); o card PRIME Signature já aprovado permanece aprovado e inalterado.

**Referência visual escolhida:** última versão do mockup PRIME Signature com lateral vinho, fundo creme/marfim, champagne/rosé/dourado discreto, orquídeas delicadas e Joaninha flutuante; distribuição da Central mostrada em 11/11/2026 com calendário mensal completo à direita, métricas compactas, Agenda e Prioridades ao centro, avisos de clientes, Jornal da Equipe, Bloco de Notas, e faixa Financeiro na parte inferior. A usuária aprovou o desenho **com uma única adição**: botão de olho para mostrar/ocultar o conteúdo financeiro.

### Requisitos de interface obrigatórios
- **Lateral vinho com navegação completa:** Central, Processos, Agenda, Orçamentos, Radar Jurídico, Rede, Modelos; filtros por etapa Minutando, Falta assinatura, Aguardando TQ, Aguardando traslado, No registro, Nota de exigência, Prefeitura e Arquivo; depois Financeiro, Relatórios e Configurações. Não apagar nem renomear categorias reais sem aprovação.
- **Calendário do mês inteiro**, com navegação; Agenda independente com **Hoje, Amanhã, Próximos dias** sempre visíveis, somente compromissos.
- **Avisos operacionais** de documentos entregues por link pelo cliente (a faixa original `cc-envios`), pagamentos (`cc-pagamentos`) e entradas (`cc-entrada`), preservando comportamento e acesso aos casos; Jornal da Equipe (`cc-jornal`) com natureza de Radar Jurídico, não confundir com avisos de recebimento.
- Bloco de Notas com abas Shirley/Grazi; prioridades com Fazer agora/Parece esquecido?, usando motor existente.
- Joaninha **solta/flutuante/interativa**, não somente imagem fixa.
- **Financeiro:** mostrar apenas o título **“Financeiro”**, o valor mensal já lançado **da parte do tabelião** (sem escrever “tabelião” na UI), barra de progresso intuitiva e **percentual que falta** para atingir a meta mensal. **Não revelar o valor absoluto da meta, nem a diferença em reais, nem entradas/saídas/comissões.** O valor exemplificativo `R$ 79.463,59` e os percentuais vistos nos mockups NÃO são dados financeiros de produção.
- **Novo requisito aprovado:** botão **olhinho** na faixa Financeiro, que alterna entre conteúdo visível e oculto (mascara valor e progresso/percentual quando ocultos). A visibilidade não pode escapar das regras de autenticação e autorização do Financeiro: dados não devem ser buscados/revelados a pessoas sem permissão, independentemente do olhinho. Evitar que estado visível reapareça após uma sessão sem autorização; comportamento exato de persistência a validar em testes.
- Manter o design de página exclusiva do processo anteriormente aprovado, sem modificar seus fluxos, estados ou controles.

### Governança
**Aprovação do desenho não é autorização para alterar `main`, Firebase, Vercel ou dados reais.** Próximo passo: inventário dos controles no código, protótipo funcional isolado, testes de regressão e mobile; solicitar aprovação separada antes de qualquer publicação. Este registro tem prioridade cronológica sobre o direcionamento inicial da Central anotado acima.

## Direcionamento da lateral — 12/11/2026

A usuária pediu a retirada dos atalhos Central, Casos, Agenda, Orçamentos,
Radar Jurídico, Modelos aprendidos e Total ativos da lateral, por repetirem
acessos e informações da Central ou dos próprios casos. Esta decisão
substitui a exigência anterior de exibir esses atalhos na lateral.

Etapas e Arquivo passam a iniciar a navegação. Rede fica depois das etapas,
seguida das ferramentas existentes, mantendo a autorização atual. O pedido
é de apresentação: não apagar casos, orçamentos ou modelos aprendidos, nem
alterar o aprendizado da IA. A rodada fica em prévia até aprovação visual.
