# Joaninha: conversa e ações nos cards

## Consulta jurídica na conversa principal

`consultar_juridico` é uma consulta sem gravação, disponível mesmo sem card
aberto. O assistente deve usá-la antes de responder o mérito de dúvidas
jurídicas. Ela é executada separadamente de qualquer alteração no caso.
A resposta do serviço é apresentada diretamente, com fontes e ressalvas,
sem outra chamada ao modelo para reescrevê-la.
O estilo padrão é uma resposta de conversa, em dois ou três parágrafos curtos,
com fundamento essencial e ressalvas indispensáveis. Pedidos de aprofundamento
podem receber análise extensa. O limite de saída permanece suficiente para
essa análise: a concisão é uma orientação de escrita, sem cortar a resposta.

O serviço recupera a Base de Regras e os últimos 14 dias do Radar a cada
pergunta e recebe os padrões internos dos 12 tipos de ato existentes no
gerador de minutas, sem configurações nem chaves do Apps Script. Os padrões
de redação são prática interna, não fonte de lei. Esses dados não equivalem
a um treinamento sobre toda a legislação ou a um cadastro completo de todos
os procedimentos do escritório.

A pesquisa web da OpenAI é limitada a fontes governamentais e judiciais
oficiais configuradas no serviço. Notícias continuam sujeitas a confirmação
no texto normativo. A orientação deve distinguir competência, território,
vigência e etapas de escritura e registro. As ressalvas de temas relacionados
na base também são apresentadas fora do texto gerado pelo modelo.

Ausência de fonte oficial é avisada; sem base nem fonte, a resposta não é
apresentada como orientação confirmada. Não há atualização automática da base
por uma consulta nem envio ao cliente. Falhas e limites da OpenAI continuam
possíveis, e a qualidade jurídica depende da consulta e da revisão profissional.
As fontes são links para conferência, não uma certificação automática de todos
os fundamentos.

Essa integração é implantada pela Vercel e não exige substituir os arquivos
no Google. `testes/joaninha-juridico-integrado.mjs` cobre fontes, atualidade da
base, ressalvas, API anterior, contratos e ausência de gravações. A suíte de
tela cobre o fluxo na conversa e os links no computador e no celular.

## Divisão autorizada entre as IAs

Anthropic lê PDF/imagens e gera/revisa as minutas no Apps Script, usando
`ANTHROPIC_API_KEY` e o modelo anterior `claude-sonnet-4-6` (ou
`ANTHROPIC_MODEL`, quando configurado). Limites de saída e continuação são
preservados. O texto dos documentos não é cortado antes da geração.
Word é extraído localmente, preservado integralmente e recebido pela Anthropic
na geração, sem chamada à OpenAI para ler esse arquivo.

OpenAI gerencia a Joaninha, os comandos e a conferência posterior da minuta.
O motor existente continua calculando os orçamentos. O documento é entregue
antes da chamada de auditoria; enquanto ela não terminar, o card mostra
“Conferência OpenAI pendente”. Uma falha dessa auditoria mantém o aviso,
preservando o documento e sem anunciar conferência concluída.

Para ativar no Google: substituir somente **Código.gs** por
`apps-script/cartorio-drive-api.js`, salvar e executar `testarAnthropicCartorio`.
Esse teste usa uma chamada pequena com texto fictício e não grava cards nem
documentos. Confirmado o teste, atualizar a mesma implantação com Nova versão.
**OPENAI.gs e cartorio-rede.gs permanecem nos respectivos arquivos.**
É necessário que a chave Anthropic ainda seja válida e a conta tenha capacidade
e saldo; isso não pode ser confirmado pelos testes com serviços simulados.

Ao clicar na mascote, o painel abre uma conversa com histórico, contexto do
card, campo para ditado e acesso às ferramentas anteriores. O histórico fica
neste navegador, separado pelo usuário escolhido no painel e pela conta do
Financeiro. Não é sincronizado entre aparelhos.

## O que está disponível

- Consultar cards e ler, em partes identificadas, os textos já extraídos dos documentos.
- Acrescentar observações, preservando as anteriores.
- Alterar nome, tipo, status, responsável, prazo, dependência, próxima ação e modalidade.
- Criar, editar e concluir tarefas da Joaninha vinculadas ao card.
- Agendar a assinatura da escritura, mostrando data completa e horário de São
  Paulo para confirmação. Uma troca exige conferir a data anterior. A data no
  card e a confirmação do evento no Google Calendar têm resultados separados.
- Preparar nova versão de orçamento com o motor e as tabelas existentes,
  mantendo as versões anteriores e oferecendo a imagem da via do cliente.
- Gerar ou revisar minuta pelo fluxo existente do Google Drive, usando os
  documentos integrais do card, as instruções e a modalidade escolhida.
- Acompanhar a geração, mostrar o link recebido e criar a tarefa de revisão.

A IA propõe ações com IDs reais. O painel valida o plano e mostra o card e os
dados antes de executar. Consultas podem ser automáticas; gravações exigem
confirmação pelo botão ou por uma resposta como “pode fazer”. Outra solicitação
substitui o plano pendente. Cada execução tem um identificador persistido para
evitar duplicação ao clicar novamente ou recarregar a página.

Os cálculos nunca são feitos pelo modelo. Acesso a valores e gravação dos
orçamentos continuam dependendo do Financeiro e das regras do Firebase.
Recibos operacionais públicos não incluem valores nem imagens de orçamento.

## Acompanhamento e limites

Documentos recebidos, aprovação de orçamento e atualização de auditoria geram
avisos com o painel aberto. Uma aprovação pode concluir apenas a tarefa da
Joaninha que aguardava aquela aprovação. A revisão humana continua pendente.
Não há inferência de conclusão de tarefas da equipe por mera observação.

A conclusão de uma minuta depende do resultado real do job. Cortes e avisos
são exibidos, e a conferência automática não equivale à aprovação jurídica.
Os limites de 16.000 tokens por rodada e a continuação da minuta são preservados.
O último comando original é anexado sem depender de uma paráfrase do modelo.

O acompanhamento usa o navegador e retoma jobs pendentes ao reabrir o painel.
Não há notificações push com o navegador fechado. O ditado depende do suporte
do navegador. A conversa não transmite respostas em streaming nesta versão.
Exclusões, envio externo de mensagens e movimentação financeira permanecem
nos fluxos próprios do painel. Assinatura é uma ação específica: nunca se
confunde com prazo de tarefa ou com datas citadas em uma simples anotação.

## Testar antes de publicar

1. Abrir a prévia da PR, entrar no Financeiro se for testar orçamento e escolher
   um **card de teste**. A prévia usa o mesmo Firebase da produção; ações
   confirmadas salvam dados reais. A tela exibe esse aviso nas prévias Vercel.
2. Pedir uma anotação, conferir o card e cancelar. Repetir e confirmar; verificar
   que a anotação anterior foi preservada.
3. Pedir orçamento de compra e venda por R$ 500.000,00, informar os dados
   indispensáveis que faltarem e conferir a via do cliente antes de enviar.
4. Pedir uma minuta com os documentos fictícios do card. Conferir o link,
   os avisos e as tarefas de geração e revisão.
5. Reabrir a conversa e conferir o histórico, também no celular.
6. Pedir assinatura para amanhã às 14h no card de teste. Conferir a data
   completa antes de confirmar. Se houver data anterior, conferir a troca.
   Verificar separadamente o card e o evento confirmado no Google Calendar.

Não publicar antes do aval da Shirley sobre a aparência e o teste real. Não
é necessário alterar Maison ou o Caderno da Rafaela.

### Conector Google

O conector OpenAI já instalado permanece responsável pela conferência. Ele
inclui espera limitada em erros temporários e diferencia limite diário de
volume excessivo. Para ativar a divisão entre as IAs, seguir a substituição
de **Código.gs** descrita no início deste documento. Não substituir OPENAI.gs
pelo código principal nem colar o conector no lugar de Código.gs.

Envios de documentos pelo card, atribuição da entrada, releituras e anexos
de minuta usam uma fila compartilhada por aba, evitando rajadas simultâneas
contra o serviço de leitura. Isso não substitui o limite da conta nem coordena abas
ou aparelhos diferentes. O arquivo já salvo deve ser relido por “Ler de novo”,
sem novo upload; envios de arquivos não são repetidos automaticamente.

## Validação automatizada

A janela tradicional de Gerar/Reeditar também registra o identificador antes
do envio e retoma a mesma execução após recarregar. O botão passa a “Verificar
andamento” quando existe um pedido pendente. O acompanhamento aceita resultados
que chegam após sete minutos, consulta somente a contagem de partes já
confirmadas e mantém o job final para consulta. Após vinte minutos sem resposta
final, informa que falta confirmação, preservando o pedido para nova consulta.
Esse ajuste não acelera a OpenAI nem confirma que um processo está ativo.
Pedidos feitos antes dessa atualização não têm o registro local para retomar.

`node --test testes/minuta-acompanhamento.mjs` cobre envio único, recuperação
após recarregar, rede incerta, rejeição explícita, resultado tardio e fim da
janela de acompanhamento sem falsa confirmação de falha.

`node --test testes/openai.mjs testes/joaninha-assistente.mjs` verifica contratos,
erros, transações, idempotência, acesso financeiro, versões de orçamento,
minuta integral, resultados assíncronos e tarefas com serviços simulados.

`node testes/joaninha-tela.mjs` percorre o index real no computador e celular
com Firebase, Google e respostas da IA simulados. Não consome créditos nem
grava em produção. Imagens são geradas em `testes/saida/joaninha-*.png`.
As respostas reais do modelo e as permissões da conta devem ser verificadas
na prévia antes da publicação.
