# Troca da IA do painel para OpenAI

Esta mudança mantém páginas, banco, endereços e contratos das funções do painel.
As chamadas da Vercel e dos scripts `cartorio-drive-api` e `cartorio-rede` passam
a usar a Responses API da OpenAI. O projeto separado `rafaela/painel` não faz
parte desta troca. Não há migração de dados do Firebase.

## Estado

Código preparado e testes com serviços simulados executados. A usuária configurou
a chave na Vercel e nas propriedades do Apps Script. O teste manual do Apps Script
retornou a confirmação de conexão real com a OpenAI, conforme captura enviada.
Os arquivos principais e da Rede foram substituídos e a usuária confirmou a
atualização da implantação existente do Google. A atualização da Vercel e os
testes dos fluxos completos com a OpenAI ainda estão pendentes. Os testes
manuais iniciais do painel validaram a versão anterior da IA.

## Configuração necessária

- Uma conta da API OpenAI com faturamento ativo e acesso ao modelo.
  A assinatura do ChatGPT não inclui créditos da API.
- Vercel, projeto `cartorio-api`: adicionar `OPENAI_API_KEY` em Production e
  Preview. Não compartilhar o valor em chat, repositório ou logs.
- Google Apps Script, projeto que já contém `cartorio-drive-api` e
  `cartorio-rede`: adicionar a mesma variável às propriedades do script.
- `OPENAI_MODEL` é opcional nos dois lugares; padrão `gpt-4.1`. Usar o mesmo
  modelo nos dois para comparar resultados. Este adaptador foi preparado
  para esse modelo; outro modelo exige nova validação de capacidades e limites.
- Acesso HTTPS a `api.openai.com`. Nenhum segredo é enviado ao navegador.

O parâmetro `store: false` é enviado nas chamadas. Isso desativa o armazenamento
da resposta para recuperação via API; não equivale a prometer retenção zero.

## Ativação acompanhada

1. Guardar a versão atual da Vercel e a versão implantada do Apps Script para
   poder reverter. Manter a chave Anthropic enquanto a transição é validada.
2. Adicionar as variáveis acima, sem mudar o banco ou o endereço do painel.
3. Preparar um Preview na Vercel com este código e executar uma pergunta
   fictícia na Joaninha; conferir resposta, latência, custos e mensagens de erro.
4. No Apps Script, adicionar um arquivo chamado `openai` com o conteúdo de
   `apps-script/openai.js`; atualizar os arquivos `cartorio-drive-api` e
   `cartorio-rede` com as versões deste repositório. Preservar os outros
   arquivos, propriedades, escopos e gatilhos. A nova dependência deve ser
   adicionada antes de ativar os scripts alterados.
5. Atualizar a implantação existente do Apps Script para uma nova versão,
   preservando a URL usada pelo painel. Não criar uma nova URL por engano.
   Fazer isso sem jobs de geração de minuta em andamento.
6. Com um caso fictício, validar extração de PDF e imagem, geração de minuta
   completa (incluindo continuação), auditoria e leitura da Rede. Não enviar
   avisos para destinatários reais durante essa conferência.
7. Validar consulta jurídica e pesquisa de alíquota, incluindo links de fontes
   oficiais. Resultados da IA exigem revisão; testes de protocolo não comprovam
   equivalência de qualidade jurídica entre modelos.
8. Com a aprovação da usuária, publicar a mudança na Vercel pelo fluxo usual
   de PR e merge, e repetir o teste fictício no endereço de produção.
9. Só considerar a troca concluída depois da confirmação real dos dois lados.
   Então avaliar a remoção das chaves antigas.

Se algo falhar, restaurar a implantação anterior da Vercel e do Apps Script,
incluindo a versão dos scripts usada pelos gatilhos, antes de remover credenciais.

## Verificações locais executadas

`npm ci --cache /workspace/.npm-cache --no-audit --no-fund`

`node --test testes/openai.mjs`

Suítes existentes: `minuta`, `regras-minuta`, `cliente-envio`, `pagamento-envio`,
`whatsapp-entrada`, `pedido-docs`, `radar-triagem` e `rede-varredura` em `testes/`.

Os testes novos cobrem autenticação, payloads de texto/PDF/imagem, streaming
dividido e UTF-8, fontes da pesquisa, recusas, respostas incompletas e falhas
HTTP. Não usam créditos nem alteram dados reais.

Na validação do Preview, a chave foi reconhecida, mas a pergunta à Joaninha
retornou `rate_limit_exceeded` por volume excessivo. O contexto passou a ser
enviado como tabela JSON com uma única legenda, preservando todos os casos e
os mesmos campos e observações enviados antes. Não muda o modelo nem elimina
registros. A confirmação real dessa correção ainda depende de um novo teste
no Preview autenticado pela usuária.

Verificação adicional: `testes/bussola.mjs` executou, com uma falha pré-existente
na comparação de `bussola/fin-motor.js` com o motor do `index.html`. Esses arquivos
e o gerador não foram alterados por esta migração. Os demais passos da suíte,
incluindo os de chave ausente e leitura da escrita, passaram. A correção do
arquivo gerado está fora desta troca de provedor.
