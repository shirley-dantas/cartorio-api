# Diagnóstico Estratégico e Roadmap de Automação — 20º Cartório de Notas

**Data:** 25/07/2026
**Escopo:** análise da operação atual (WhatsApp → Painel → IA → Drive/Calendar) e plano de evolução tecnológica.

Este documento foi escrito a partir da leitura completa do código em produção (`api/`, `apps-script/cartorio-drive-api.js`, `index.html`), não de suposições genéricas sobre "como um cartório funciona". Isso importa porque boa parte do que normalmente seria sugerido como "novidade" em uma consultoria de automação **já está implementado e funcionando** aqui — o que muda é o ponto de partida do roadmap.

---

## 0. Diagnóstico da operação atual

### O que já existe e funciona bem
- **Ingestão via WhatsApp**: um número operacional (Evolution API self-hosted) recebe mensagens da equipe; o sistema mantém uma "sessão ativa" (caso em foco) no Firebase, associa mídias recebidas (PDF, imagem, docx, áudio, vídeo) ao caso certo e salva automaticamente no Google Drive em estrutura `Cliente > Tipo de Ato`.
- **Extração automática de texto**: PDFs e imagens passam por Claude (visão) e `.docx` por `mammoth`, extraindo dados jurídicos relevantes (partes, CPF/RG, matrícula, valores, datas) como texto de apoio.
- **Classificação automática** de tipo de ato, modalidade (digital/presencial/híbrida) e urgência a partir do texto recebido — **hoje feita por regex de palavras-chave**, não por IA.
- **Geração automática de minuta** assim que o caso é criado: usa instruções específicas por tipo de ato (Compra e Venda, Inventário, Procuração, Doação, Testamento, etc.), respeita nomenclatura técnica correta das partes, e gera em rodadas sucessivas para não truncar minutas longas (até 6 chamadas encadeadas).
- **Biblioteca de modelos autoaprendida**: toda minuta gerada com sucesso vira referência de estilo automática para o próximo caso do mesmo tipo — sem a equipe precisar enviar um "modelo" manualmente. Isso é um mecanismo de aprendizado contínuo real, pouco comum em ferramentas do setor.
- **Painel operacional (PWA "Equipe Prime")**: cartões por caso com status (prioridade/crítico/atenção/em dia), dependências, dias parado, histórico de atendimentos com resumo gerado por IA e pendências extraídas automaticamente.
- **Foco do Dia**: lista de tarefas do dia, populada automaticamente com compromissos de hoje/amanhã, mais sugestão de próxima tarefa por IA considerando urgência, prazo e **carga de trabalho por responsável** (Shirley/Grazi/Gabriel).
- **Alertas inteligentes com aprendizado**: uma rotina em lote revisa todos os casos ativos e separa "alertas reais" (parado/esquecido) de "compromisso de hoje" e "compromisso de amanhã", evitando falsos positivos, e **incorpora correções passadas da equipe** (tabela `aprendizados` no Firebase) nas decisões futuras.
- **Google Calendar** sincronizado por caso (criação/atualização/exclusão de evento), com alerta visual se a sincronização falhar.

Isto é, na prática, um nível de automação bem acima da média do setor: já existe ingestão, classificação, geração de documento, aprendizado incremental e gestão operacional integrados. O próximo salto não é "começar a automatizar" — é **fechar lacunas estruturais específicas** e **elevar o que já existe de reativo para preditivo**.

### Lacunas concretas identificadas no código
1. **Classificação por regex, não por IA** (`classificarServico`, `classificarUrgencia`, `detectarModalidade` em `netlify/functions/salvar-caso.js`) — frágil a frases como "não é urgente" (contém "urgente" → classificado como crítico) ou múltiplos serviços numa mensagem.
2. **Checklists de documentos existem só dentro do prompt da IA**, não como lista rastreável no caso. As instruções por tipo de ato (`INSTRUCOES_POR_TIPO`) já descrevem exatamente o que verificar em cada ato — mas isso não vira um checklist interativo no cartão do caso.
3. **Nenhum cálculo de emolumentos/ITBI/ITCMD** — a minuta sempre deixa esses campos em `______`, mesmo quando o cálculo é determinístico e poderia ser preenchido automaticamente.
4. **Comunicação com o cliente final é 100% manual.** O bot só processa mensagens de um número operacional interno (uso da equipe); não há envio automático de confirmações, lembretes ou solicitação de documentos faltantes diretamente ao cliente.
5. **Modelo de "sessão única"**: o Firebase guarda um único `sessao_ativa` por vez — o fluxo é inerentemente serial (um caso em foco por vez). Isso funciona bem hoje, mas não escala para atendimento simultâneo de múltiplos clientes via bot.
6. **Credencial em texto puro no repositório** (chave da Evolution API) — risco de segurança real, não teórico.
7. **Prompt jurídico duplicado em 3 arquivos** (`api/analisar-caso.js`, `netlify/functions/analisar-caso.js`, `apps-script/cartorio-drive-api.js`), incluindo alíquotas de ITCMD (4% SP) e número de provimento do CNJ **hardcoded**. Se a lei mudar, é preciso lembrar de editar em três lugares — risco de defasagem silenciosa.
8. **Dados ricos sem camada analítica**: o Firebase já guarda dias parado, responsável, status, tipo — mas não há dashboard agregando isso em indicadores de produtividade.
9. **Sem previsão de prazos** baseada em histórico (nenhum caso conta "quanto tempo esse tipo de ato historicamente leva").
10. **Sem integrações externas** (consulta de matrícula, Central de Indisponibilidade, certidões da Receita Federal, status no e-Notariado) — tudo isso ainda é apurado manualmente fora do sistema.
11. **Log de diagnóstico temporário em produção** (`log_webhook` no Firebase, marcado no próprio código como temporário) — deveria virar observabilidade de verdade ou ser removido.
12. Um único prompt genérico enorme faz o trabalho de todos os tipos de ato — funciona, mas cresce de forma difícil de manter conforme aumentam os tipos e as regras específicas.

---

## 1–10. Respostas diretas às perguntas

**1) O que ainda pode ser automatizado:** cálculo de emolumentos/tributos, checklist de documentos faltantes, comunicação de rotina com o cliente (confirmações, lembretes, cobranças de documento), consolidação de dados extraídos em campos estruturados, geração de relatórios/dashboards, distribuição de tarefas por carga real da equipe (hoje é só sugestão, poderia ser semi-automática).

**2) Tarefas repetitivas que podem deixar de depender de humano:** digitar observações de atendimento (parcialmente já automatizado — falta voz→texto direto), cobrar cliente por documento pendente, atualizar status "parado há X dias" para follow-up, gerar pasta/nome de arquivo padronizado (já automatizado), preencher campos determinísticos da minuta (datas por extenso, cálculo de tributo, número de controle sequencial).

**3) Reduzir tempo por atendimento:** extração estruturada (não só texto solto) elimina releitura manual de documentos; checklist automático evita idas e vindas pedindo documento que já foi identificado como faltante; orçamento automático elimina cálculo manual repetido; resposta automática ao cliente com status elimina mensagens de "só confirmando que está tudo certo".

**4) Diminuir erros operacionais:** classificação por IA em vez de regex; checklist obrigatório antes de lavrar (bloqueia geração de minuta final se faltar documento crítico); centralizar regras jurídicas (tributos, provimentos) em uma única fonte, não em três arquivos; validação cruzada de dados extraídos (ex.: CPF em formato inválido, nome divergente entre documentos).

**5) Painel como centro de comando:** hoje é um Kanban operacional muito bom; falta a camada de indicadores (produtividade, gargalos, previsão de prazo), a camada financeira (emolumentos previstos x recebidos) e alertas preditivos (não só "está parado", mas "esse tipo de caso historicamente trava neste ponto — atenção").

**6) Integrações WhatsApp / Drive / Agenda / e-mail:** já existe WhatsApp→Drive→Calendar. Faltam: WhatsApp→cliente (outbound), e-mail transacional (confirmações formais, envio de minuta para revisão do cliente), e possivelmente integração com um provedor de assinatura/certificação para rastrear o ato até o registro no CRI.

**7) Antecipar problemas antes que aconteçam:** hoje o sistema alerta o que **já** está parado. O próximo nível é prever, pelo histórico de casos semelhantes, quais tendem a travar e em qual etapa — e avisar **antes**, não depois.

**8) O que a IA poderia executar sozinha, sem você pedir:** classificação e triagem inicial (já faz), geração do primeiro rascunho de minuta (já faz), checklist de documentos faltantes ao identificar o tipo de ato, lembrete automático ao cliente quando falta documento específico, cálculo de tributos quando os dados básicos já estão disponíveis, relatório semanal de produtividade sem precisar ser pedido.

**9) Rumo a uma operação quase autônoma:** o padrão certo é "IA decide e executa o reversível sozinha; humano só valida o irreversível" — ou seja, IA pode classificar, extrair, calcular, montar checklist e rascunhar minuta sem pedir permissão; mas **lavratura final, envio oficial ao cliente e qualquer ato que gere efeito jurídico externo continuam exigindo validação humana explícita**. Isso já é essencialmente o desenho atual (a minuta é rascunho, não lavratura) — é questão de estender esse mesmo princípio às novas automações.

**10) Tecnologias a incorporar:** modelo de linguagem para classificação semântica (substituindo regex), function calling/tools estruturados para preencher campos (em vez de texto livre), um serviço de regras determinísticas para tributos/emolumentos (não precisa de IA, precisa de tabela correta), camada de analytics sobre o Firebase existente, e — havendo abertura da equipe/clientes — canal de saída de WhatsApp (Business API oficial, mais robusto que a Evolution self-hosted para tráfego com clientes finais).

---

## 2. Catálogo de oportunidades

Cada item: **Problema → Como funcionaria → Tecnologia → Dificuldade → Impacto → Quando**

### Leitura e classificação de documentos

**Extração estruturada de dados (não só texto solto)**
- *Problema*: hoje o PDF/imagem vira um bloco de texto para a IA "ler de novo" a cada geração de minuta — não há campos estruturados reaproveitáveis (CPF, RG, matrícula, endereço, valor).
- *Como funcionaria*: ao extrair o documento, a IA retorna um JSON com campos nomeados (tool use / structured output), que populam o registro do caso no Firebase e ficam visíveis e editáveis no cartão.
- *Tecnologia*: Claude com "structured outputs"/tool use sobre o texto já extraído.
- *Dificuldade*: média (reaproveita extração existente, adiciona uma etapa de parsing).
- *Impacto*: alto — elimina releitura manual, permite validação cruzada entre documentos.
- *Quando*: agora/depois (base para vários outros itens abaixo).

**Classificação por IA em vez de regex**
- *Problema*: regras de palavras-chave (`urgente`, `hoje`, etc.) geram falsos positivos/negativos fáceis de prever.
- *Como funcionaria*: uma chamada rápida e barata à IA substitui `classificarServico`/`classificarUrgencia`/`detectarModalidade`, com poucos tokens e resposta em JSON.
- *Tecnologia*: Claude Haiku (rápido/barato) com prompt curto.
- *Dificuldade*: baixa.
- *Impacto*: alto — reduz erro de triagem, que é a porta de entrada de tudo.
- *Quando*: agora.

**Detecção de inconsistência entre documentos**
- *Problema*: nome grafado diferente entre RG e certidão, CPF com dígito trocado, endereço divergente — hoje só é pego se alguém notar manualmente.
- *Como funcionaria*: depois da extração estruturada, uma verificação automática compara os mesmos campos entre documentos do mesmo caso e sinaliza divergência no cartão.
- *Tecnologia*: regra determinística + IA para casos ambíguos (grafias parecidas).
- *Dificuldade*: média.
- *Impacto*: alto — pega exatamente o tipo de erro que gera problema em cartório (retrabalho, escritura com dado errado).
- *Quando*: depois (1–3 meses, depende da extração estruturada).

### Checklists e documentos faltantes

**Checklist interativo por tipo de ato**
- *Problema*: o conteúdo do checklist já existe (`INSTRUCOES_POR_TIPO`), mas vive só dentro do prompt da IA — ninguém vê isso como lista de tarefas no cartão do caso.
- *Como funcionaria*: ao classificar o tipo de ato, o sistema cria automaticamente os itens do checklist daquele tipo no cartão (ex.: "certidão de óbito", "regime de bens", "ITCMD calculado"), marcando como concluído conforme os documentos chegam.
- *Tecnologia*: reaproveita o dicionário já existente no código + lógica simples no painel (sem IA nova).
- *Dificuldade*: baixa — é essencialmente expor um dado que já existe.
- *Impacto*: alto, esforço baixo — provavelmente o item de melhor custo-benefício deste roadmap inteiro.
- *Quando*: agora.

**Detecção automática de documento faltante**
- *Problema*: só se percebe que falta um documento quando alguém revisa manualmente antes da lavratura.
- *Como funcionaria*: cruza o checklist do tipo de ato com os documentos já recebidos (por classificação do próprio arquivo) e gera alerta específico ("falta certidão de casamento do herdeiro X").
- *Tecnologia*: classificação de tipo de documento (IA leve) + comparação com checklist.
- *Dificuldade*: média.
- *Impacto*: alto.
- *Quando*: depois (depende do checklist interativo acima).

### Orçamentos e financeiro

**Geração automática de orçamento (emolumentos + tributos)**
- *Problema*: hoje nada calcula ITBI/ITCMD/emolumentos — a minuta deixa esses campos em branco.
- *Como funcionaria*: tabela de emolumentos do cartório + alíquotas vigentes (ITCMD SP 4%, ITBI municipal por cidade) aplicadas sobre valor do bem informado, gerando um orçamento estimado que pode ser enviado ao cliente antes mesmo da lavratura.
- *Tecnologia*: cálculo determinístico (não precisa de IA) — uma tabela de regras versionada, não hardcoded em prompt.
- *Dificuldade*: média (o trabalho real é levantar e manter a tabela correta, não a lógica).
- *Impacto*: muito alto — resolve uma dor real de atendimento ("quanto vai custar?") que hoje consome tempo humano toda vez.
- *Quando*: agora/depois.

**Painel financeiro da operação**
- *Problema*: não há visão de receita por tipo de ato, ticket médio, ou emolumentos previstos x realizados.
- *Como funcionaria*: cada caso concluído registra valor de emolumentos; painel agrega por período/tipo/responsável.
- *Tecnologia*: agregação sobre dados já existentes no Firebase + tela nova.
- *Dificuldade*: média.
- *Impacto*: médio-alto (gestão do negócio, não só da operação jurídica).
- *Quando*: depois.

### Prazos e alertas preditivos

**Previsão de prazo por tipo de ato**
- *Problema*: hoje a urgência é reativa (classificada na entrada), não há estimativa de "esse tipo de caso costuma levar X dias".
- *Como funcionaria*: usar o histórico de casos concluídos (tempo entre abertura e conclusão, por tipo de ato) para estimar prazo esperado de um caso novo e sinalizar quando ele está fora da curva.
- *Tecnologia*: estatística simples sobre dados históricos do Firebase (média/mediana por tipo) — não precisa de ML sofisticado para começar.
- *Dificuldade*: média.
- *Impacto*: alto — transforma alerta reativo em gestão preditiva.
- *Quando*: depois (precisa de volume histórico suficiente, que o sistema já vem acumulando).

**Alertas preventivos ("esse tipo de caso costuma travar aqui")**
- *Problema*: o sistema de alertas atual (`verificar-alertas.js`) já é sofisticado, mas reage ao que já parou — não antecipa pontos de risco típicos.
- *Como funcionaria*: ao identificar, por exemplo, que inventários com mais de 3 herdeiros historicamente atrasam na coleta de documentos, o sistema sinaliza esse risco assim que o caso é aberto, não quando já está parado.
- *Tecnologia*: reconhecimento de padrão sobre o histórico + o mesmo motor de IA de alertas já existente.
- *Dificuldade*: média-alta.
- *Impacto*: alto.
- *Quando*: depois/futuro.

### Acompanhamento automático de clientes

**Comunicação outbound com o cliente via WhatsApp**
- *Problema*: hoje o bot só processa mensagens *da equipe* para *o sistema* (ingestão); não há mensagem automática saindo *para o cliente* (confirmação de recebimento, lembrete de assinatura, solicitação de documento faltante).
- *Como funcionaria*: um número (ou a mesma instância, com lógica de destinatário diferente) envia mensagens padronizadas geradas por IA a partir do status do caso — ex.: "Recebemos seu RG, falta a certidão de casamento" — sempre com revisão/aprovação da equipe antes do primeiro envio de cada tipo de mensagem.
- *Tecnologia*: Evolution API (já em uso) ou WhatsApp Business API oficial (mais robusta e com menor risco de bloqueio para tráfego com clientes finais) + templates gerados por IA.
- *Dificuldade*: média-alta (é a mudança mais estrutural da lista: sai de "bot interno" para "bot que fala com o público", o que muda requisitos de confiabilidade e compliance).
- *Impacto*: muito alto — é provavelmente a maior alavanca de redução de tempo de atendimento humano em todo o roadmap.
- *Quando*: depois, com piloto controlado (ex.: só lembretes de agenda no início, expandindo aos poucos).

**Portal/status de acompanhamento para o cliente**
- *Problema*: cliente só sabe o status do seu caso perguntando por WhatsApp.
- *Como funcionaria*: link único por caso (sem necessidade de login) mostrando etapa atual e documentos pendentes.
- *Tecnologia*: página simples lendo do Firebase (somente leitura, com token por caso).
- *Dificuldade*: média.
- *Impacto*: médio — reduz volume de mensagens "só confirmando".
- *Quando*: futuro.

### Preenchimento automático de minutas (evolução do que já existe)

**Preenchimento de campos determinísticos**
- *Problema*: datas por extenso, cálculo de tributo e número de controle ainda dependem de digitação/verificação manual mesmo quando são 100% determináveis a partir de dados já conhecidos.
- *Como funcionaria*: uma etapa de pós-processamento (não IA — código determinístico) preenche esses campos automaticamente a partir dos dados estruturados do caso, deixando a IA focada só no texto jurídico não-trivial.
- *Tecnologia*: lógica determinística no Apps Script, reaproveitando o pipeline de geração já existente.
- *Dificuldade*: baixa-média.
- *Impacto*: médio-alto (reduz revisão manual repetitiva).
- *Quando*: agora/depois.

**Agentes especializados por tipo de ato**
- *Problema*: hoje um único prompt gigante concentra as regras de todos os tipos de ato — funciona, mas cresce difícil de manter e testar conforme mais regras específicas são adicionadas.
- *Como funcionaria*: modularizar em configurações por tipo (já existe o embrião disso em `INSTRUCOES_POR_TIPO`/`INSTRUCOES_MINUTA`) com validações e checklists próprios de cada ato, e um "roteador" que aciona a configuração certa — mantendo uma única fonte de verdade (hoje triplicada em 3 arquivos).
- *Tecnologia*: refatoração de arquitetura de prompt (sem trocar de modelo de IA).
- *Dificuldade*: média.
- *Impacto*: médio-alto (mais sobre manutenibilidade e redução de erro de longo prazo do que sobre um recurso novo visível no dia a dia).
- *Quando*: depois.

### Banco de conhecimento jurídico e modelos inteligentes

**Central de regras jurídicas versionada (fora do prompt)**
- *Problema*: alíquota de ITCMD, número de provimento do CNJ e outras regras estão hardcoded em texto de prompt, triplicadas em 3 arquivos — se a lei mudar, o risco é alguém esquecer de atualizar em todos os lugares.
- *Como funcionaria*: uma fonte única de regras (arquivo de configuração versionado, ou registro no Firebase) que os 3 pontos de geração de minuta consultam — muda uma vez, aplica em todo lugar.
- *Tecnologia*: refatoração simples de configuração.
- *Dificuldade*: baixa-média.
- *Impacto*: alto em redução de risco (erro jurídico silencioso é o pior tipo de erro num cartório).
- *Quando*: agora — é mais higiene técnica do que "novidade", mas é a base de segurança para tudo que vem depois.

**Biblioteca de modelos por cliente/caso recorrente**
- *Problema*: o autoaprendizado hoje é só "por tipo de ato" — não diferencia estilos por complexidade ou peculiaridade de caso.
- *Como funcionaria*: manter múltiplas variantes de modelo aprendido por tipo (ex.: "inventário simples" x "inventário com bens em outro estado"), escolhendo a mais próxima do caso atual.
- *Tecnologia*: extensão do mecanismo de `modelos aprendidos` já existente.
- *Dificuldade*: média.
- *Impacto*: médio.
- *Quando*: futuro.

### Dashboards, produtividade e distribuição de tarefas

**Dashboard de produtividade da equipe**
- *Problema*: dados de carga de trabalho já existem (usados na sugestão de próxima tarefa) mas não são visualizados como indicador de gestão.
- *Como funcionaria*: painel agregando casos concluídos/parados por responsável, tempo médio de resolução, taxa de alertas recorrentes por pessoa.
- *Tecnologia*: agregação sobre dados existentes no Firebase.
- *Dificuldade*: baixa-média.
- *Impacto*: médio-alto.
- *Quando*: agora/depois.

**Distribuição semi-automática de tarefas**
- *Problema*: hoje a IA só *sugere* redistribuição por sobrecarga, nunca decide.
- *Como funcionaria*: manter a sugestão (correto não automatizar decisão sobre pessoas sem revisão humana), mas facilitar a aceitação com um clique em vez de reatribuição manual.
- *Tecnologia*: ajuste de UI no painel existente.
- *Dificuldade*: baixa.
- *Impacto*: médio.
- *Quando*: agora.

### Reconhecimento de padrões entre atendimentos

**Análise de gargalos recorrentes**
- *Problema*: não há visão consolidada de "que tipo de caso mais trava, e em qual etapa" — cada alerta é visto isoladamente.
- *Como funcionaria*: revisão periódica (semanal/mensal) do histórico de alertas e pendências, agrupando por tipo de ato e motivo, virando um relatório de causa-raiz.
- *Tecnologia*: IA sobre os dados já coletados em `aprendizados` e histórico de casos.
- *Dificuldade*: média.
- *Impacto*: alto a médio prazo (melhoria de processo, não só de caso individual).
- *Quando*: depois.

### Voz e outras inovações "fora do óbvio"

**Ditado direto de observações por voz**
- *Problema*: registro de atendimento hoje depende de digitar ou copiar texto no painel.
- *Como funcionaria*: gravar um áudio curto (já suportado como mídia recebida via WhatsApp) e transcrever automaticamente para o campo de observação/histórico, sem digitação.
- *Tecnologia*: transcrição de áudio (Whisper ou equivalente) + o pipeline de resumo por IA já existente (`registrar-atendimento.js`).
- *Dificuldade*: baixa-média — o áudio já chega e é salvo, falta só o passo de transcrição.
- *Impacto*: médio-alto (ganho de tempo direto para quem registra).
- *Quando*: depois.

**Auditoria automática pós-lavratura**
- *Problema*: depois que a escritura é assinada, o acompanhamento até o registro no CRI é manual.
- *Como funcionaria*: checklist de pós-lavratura (arquivamento, DOI emitido, registro efetivado) como continuação natural do checklist pré-lavratura.
- *Tecnologia*: extensão do checklist interativo.
- *Dificuldade*: média.
- *Impacto*: médio.
- *Quando*: futuro.

**Observabilidade real de produção**
- *Problema*: o único "log" hoje é uma gravação temporária de diagnóstico no Firebase, explicitamente marcada no código como provisória.
- *Como funcionaria*: substituir por uma ferramenta de logging/observabilidade de verdade (ex.: algo simples como um log estruturado com retenção e alerta de falha), removendo o log temporário.
- *Tecnologia*: qualquer serviço de logging leve compatível com Vercel/Apps Script.
- *Dificuldade*: baixa.
- *Impacto*: médio (mais tranquilidade operacional do que recurso visível).
- *Quando*: agora.

---

## 3. Roadmap priorizado

### Onda 1 — Agora (0–30 dias, alto impacto / baixo esforço)
1. **Rotacionar e proteger a chave da Evolution API** (segurança — prioridade máxima, item já sinalizado acima).
2. Checklist interativo por tipo de ato (reaproveita conteúdo já existente no código).
3. Classificação por IA (substitui regex) para tipo/urgência/modalidade.
4. Centralizar as regras jurídicas (tributos, provimentos) numa única fonte, eliminando a triplicação de prompt.
5. Cálculo automático de emolumentos/ITBI/ITCMD (regra determinística).
6. Dashboard básico de produtividade sobre dados já existentes.
7. Remover/substituir o log temporário de diagnóstico.

### Onda 2 — Consolidação (1–3 meses)
8. Extração estruturada de dados dos documentos (campos, não só texto).
9. Detecção automática de documento faltante (cruza extração com checklist).
10. Previsão de prazo por tipo de ato com base no histórico.
11. Preenchimento automático de campos determinísticos na minuta.
12. Agentes/configurações especializadas por tipo de ato (refatoração de arquitetura).
13. Piloto controlado de comunicação outbound ao cliente via WhatsApp (começando por lembretes de agenda, já que o Calendar já existe).

### Onda 3 — Transformação (3–9 meses)
14. Expansão da comunicação outbound (solicitação de documento, orçamento automático enviado ao cliente).
15. Alertas preventivos por padrão histórico ("esse tipo de caso costuma travar aqui").
16. Análise de gargalos recorrentes (relatório de causa-raiz por tipo de ato).
17. Detecção de inconsistência entre documentos do mesmo caso.
18. Ditado por voz para registro de atendimento.
19. Painel financeiro completo da operação.

### Fronteira / Futuro (9+ meses, depende de maturidade e de parcerias externas)
20. Integrações com registros públicos (matrícula online, Central de Indisponibilidade, certidões, e-Notariado) — dependem de disponibilidade e permissão de acesso a essas plataformas, fora do controle direto do cartório.
21. Portal de status para o cliente.
22. Multi-sessão real no WhatsApp (atendimento simultâneo de múltiplos clientes pelo bot).
23. Auditoria automática pós-lavratura até o registro.
24. Biblioteca de modelos por variante de complexidade dentro do mesmo tipo de ato.

---

## Observação final

O maior risco deste roadmap não é técnico — é de **escopo do que a IA decide sozinha**. O desenho atual já acerta isso: a minuta é sempre rascunho revisável, nunca lavratura automática; a redistribuição de tarefa é sempre sugestão, nunca ordem. Essa mesma régua deve se aplicar a toda automação nova, especialmente à comunicação direta com clientes (Onda 2/3, itens 13–14): a IA deve poder **preparar e até enviar rotina de baixo risco** (lembrete de agenda, confirmação de recebimento), mas qualquer mensagem com conteúdo jurídico substantivo (valor, prazo, orientação) deve manter aprovação humana até haver histórico suficiente de confiança no padrão gerado.
