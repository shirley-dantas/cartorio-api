# Ajudante do painel — como instalar e usar

Uma extensão do Chrome que busca documentos nos sites que a Shirley já usa e guarda no card do painel. Hoje: **JUCESP** (ficha cadastral
completa e contrato social consolidado). Quem identifica ela é o **certificado digital do próprio computador** — a extensão não guarda senha nenhuma.

## Instalar (uma vez só)

0. Baixe pelo próprio painel: abra `https://cartorio-api.vercel.app/ajudante-do-painel.zip` no Chrome. Clique com o botão direito no arquivo baixado → **Extrair tudo**.
1. Guarde a pasta `ajudante` que saiu do zip num lugar fixo, por exemplo `Documentos\Ajudante do painel`. **Não apague nem mude de lugar depois.**
2. No Chrome, digite na barra de endereço: `chrome://extensions` e aperte Enter.
3. Ligue **Modo do desenvolvedor** (canto de cima, à direita).
4. Clique em **Carregar sem compactação** e escolha a pasta do passo 1.
5. Recarregue o painel (**F5**). Dentro de cada card, na caixa de soltar arquivos, aparece **Buscar na JUCESP**.

## Usar

1. No card, o painel já lista as **empresas achadas nos documentos** (com o CNPJ). Clique em **Buscar ficha e contrato** na empresa, ou em **Buscar os dois documentos das N empresas** para fazer uma de cada vez. Se não achar nenhuma, use **Outro CNPJ**.
2. Abre uma aba da JUCESP. Se ela pedir o certificado, o PIN ou o **código da imagem**, faça como sempre — o Ajudante espera e continua sozinho. (Ele não resolve o código da imagem por você; da segunda vez em diante, com a mesma empresa, ele tenta ir direto e pular a pesquisa.)
3. Não mexa nessa aba por uns 30 segundos. Na faixa escura, no canto, ele conta o que está fazendo.
4. O PDF vai para a pasta do caso no Drive e aparece na lista de documentos do card.

**Contrato consolidado:** ele abre a *Cópia Digitalizada* e escolhe o ato de **consolidação mais recente**. Se não achar consolidação, ou se a cópia
tiver tarifa, ele para e avisa — **nunca paga nada**.

## Se travar

A faixa fica vermelha. Duas saídas:
- **Fazer à mão**: continue você mesma; quando o PDF abrir, o Ajudante o pega e guarda no card.
- **Copiar relatório**: copia um resumo da tela (só os nomes dos botões e campos, sem senha nem dados) para colar na conversa.

## Atualizar

Quando vier uma versão nova, troque os arquivos da pasta e, em `chrome://extensions`, clique no botão de recarregar (↻) do Ajudante.


## RI Digital (matrícula) — versão 0.2.0

No card, o bloco **RI Digital — matrícula** tem dois botões:
- **Visualização de matrícula** (para minutar) — uma matrícula por vez.
- **Matrícula atualizada** (para a data de assinatura) — pode ser mais de uma, desde que do mesmo registro de imóveis.

O painel preenche estado, cidade, cartório e número da matrícula **lendo a matrícula que já está no card**; você confere e clica em **Abrir a RI Digital**. A extensão escolhe a finalidade (sempre "titular de algum direito real"), preenche o pedido e **para na hora de pagar**:
- certidão: clique você em **Saldo em Créditos** — o PDF baixa e a extensão o leva para o card;
- visualização: marque o **"Não sou um robô"** e clique no botão que confirma — o crédito é gasto nesse clique.

Se o arquivo não chegar ao card, ele está na pasta **Downloads**: arraste para a caixa do card. Nesse caso (ou em qualquer erro), clique em **Copiar relatório** e mande.
