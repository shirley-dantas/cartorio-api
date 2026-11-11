# PRIME — Diagnóstico inicial da Central de Comando
Data: 2026-11-11
Estado: análise estática do código; SEM teste executado; SEM alterações na interface publicada.
Fonte: `index.html` e instruções de passagem do projeto.

## Objetivo da etapa
Preservar a Central atual e confirmar, antes de qualquer redesenho, se ela entrega com segurança a resposta principal: o que a equipe precisa fazer agora, o que foi esquecido e o que está agendado.

## Mapa confirmado no código
- Cabeçalho acolhedor com saudação, busca, calendário mensal e sincronização (`cdc2-topo`).
- Indicadores: Críticos, Atenção, No dia, Aguardando cliente; atalho para todos os atendimentos (`cdc2-indicadores`).
- Jornal da equipe (Radar) e faixas de recebimentos de clientes, pagamentos e entradas.
- Três cartões: Agenda; Bloco de Notas por Shirley/Grazi; O que dá pra fazer agora, com abas Fazer agora / Parece esquecido.
- Motor determinístico `motorDecisao` baseado em etapa, responsável pela dependência, janela de dias e bloqueio da segunda parte. Não trocar por classificação livre de IA.
- Quadro analítico separado em modal (funil, carga, atrasos comparáveis por etapa e ritmo semanal), com números/tabelas acessíveis.
- Fluxo de cards concluídos via Arquivo; histórico e notas mantidos na mesma base de dados.

## Pontos de verificação prioritários (hipóteses, NÃO falhas confirmadas)
1. **Firebase e erros de gravação:** listeners de `focos`, `resolucoesCentral` e `meta/historicoDesde` não exibem no trecho inspecionado uma rotina de recuperação após `permission_denied`; escritas de inicialização e de backfill usam `set/update` sem tratamento explícito de rejeição. Verificar regras, comportamento e testes antes de corrigir.
2. **Tela refeita em tempo real:** a Central é renderizada de novo quando mudam casos/focos/resoluções. Validar que os campos em edição, menus abertos, foco do teclado e rolagem não são perdidos com atualização recebida de outra pessoa.
3. **Indicadores coerentes:** verificar se os números da faixa, da lateral e das listas abertas concordam para os mesmos casos; respeitar a regra já documentada de reutilizar os mesmos agregadores.
4. **Dias e fusos:** `isoHoje()` usa America/Sao_Paulo; testar virada de dia, fins de semana, feriados e compromisso da segunda parte.
5. **Uso no celular:** conferir largura do cabeçalho, calendário, abas, notas e modais em telas pequenas; não deduzir qualidade mobile apenas do CSS.
6. **Privacidade:** usar somente casos fictícios nos testes e imagens; não inserir dados reais de clientes em capturas, logs ou prompts externos.

## O que NÃO fazer nesta etapa
- Não redesenhar a Central sem comparar a versão atual com uma prévia e obter aprovação.
- Não mudar `DEP_CONFIG`, critérios de prazo, cálculos financeiros, emolumentos ou relatórios jurídicos.
- Não escrever no Firebase de produção durante testes.
- Não criar outra função `api/`, não atualizar `main` nem publicar na Vercel.
- Não intervir nos projetos Bússola, Rafaela ou Maison.
- Não acoplar a OpenAI à Central nesta primeira etapa.

## Aceite para futura alteração
1. Rodar suíte de testes do relatório de passagem, com resultado registrado.
2. Testes específicos de Central (dados vazios, prazos críticos, equipe, notas e duas sessões simultâneas).
3. Imagem ou vídeo de prévia com dados fictícios; aprovação da usuária.
4. Verificação desktop + celular.
5. Alteração pequena, reversível, em branch; comparação explícita antes/depois.
6. Deploy de produção somente após autorização específica.

## Próxima ação técnica
Montar ambiente de teste isolado, executar testes existentes, verificar eventuais reproduções e produzir uma primeira prévia visual sem acessar a base real.
