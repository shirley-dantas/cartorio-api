# Joaninha: conversa e ações nos cards

Ao clicar na mascote, o painel abre uma conversa com histórico, contexto do
card, campo para ditado e acesso às ferramentas anteriores. O histórico fica
neste navegador, separado pelo usuário escolhido no painel e pela conta do
Financeiro. Não é sincronizado entre aparelhos.

## O que está disponível

- Consultar cards e ler, em partes identificadas, os textos já extraídos dos documentos.
- Acrescentar observações, preservando as anteriores.
- Alterar nome, tipo, status, responsável, prazo, dependência, próxima ação e modalidade.
- Criar, editar e concluir tarefas da Joaninha vinculadas ao card.
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
Exclusões, envio externo de mensagens, movimentação financeira e alteração da
data de assinatura permanecem nos fluxos próprios do painel.

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

Não publicar antes do aval da Shirley sobre a aparência e o teste real. Não
é necessário alterar Maison ou o Caderno da Rafaela.

### Conector Google

O fluxo funciona com o conector OpenAI já instalado. Esta alteração também
inclui espera limitada para erros temporários 429 no arquivo
`apps-script/openai.js`. Para ativar essa melhoria no Google, substituir
**somente o conteúdo de OPENAI.gs**, salvar e atualizar a versão da mesma
implantação. Não trocar Código.gs nem cartorio-rede.gs e não alterar a chave.
Sem essa atualização, o conector instalado continua funcionando, mas uma
limitação temporária pode encerrar a geração em vez de aguardar.

## Validação automatizada

`node --test testes/openai.mjs testes/joaninha-assistente.mjs` verifica contratos,
erros, transações, idempotência, acesso financeiro, versões de orçamento,
minuta integral, resultados assíncronos e tarefas com serviços simulados.

`node testes/joaninha-tela.mjs` percorre o index real no computador e celular
com Firebase, Google e respostas da IA simulados. Não consome créditos nem
grava em produção. Imagens são geradas em `testes/saida/joaninha-*.png`.
As respostas reais do modelo e as permissões da conta devem ser verificadas
na prévia antes da publicação.
