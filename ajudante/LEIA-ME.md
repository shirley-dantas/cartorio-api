# Ajudante do painel — como instalar e usar

Uma extensão do Chrome que busca documentos nos sites que a Shirley já usa e guarda no card do painel. Hoje: **JUCESP** (ficha cadastral
completa e contrato social consolidado). Quem identifica ela é o **certificado digital do próprio computador** — a extensão não guarda senha nenhuma.

## Instalar (uma vez só)

1. Guarde esta pasta (`ajudante`) num lugar fixo, por exemplo `Documentos\Ajudante do painel`. **Não apague nem mude de lugar depois.**
2. No Chrome, digite na barra de endereço: `chrome://extensions` e aperte Enter.
3. Ligue **Modo do desenvolvedor** (canto de cima, à direita).
4. Clique em **Carregar sem compactação** e escolha a pasta do passo 1.
5. Recarregue o painel (**F5**). Dentro de cada card, na caixa de soltar arquivos, aparece **Buscar na JUCESP**.

## Usar

1. No card, digite o **CNPJ** da empresa e clique em **Ficha cadastral**, **Contrato consolidado** ou **Os dois**.
2. Abre uma aba da JUCESP. Se ela pedir o certificado ou o PIN, faça como sempre — o Ajudante espera e continua sozinho.
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
