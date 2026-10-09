# WhatsApp da Tháriga: como configurar o WhatsApp Business

O painel **não lê** as conversas do WhatsApp (o app Business não deixa). O caminho é levar a cliente
para a página de pedido, `https://cartorio-api-maison.vercel.app/p`, onde ela escolhe a unidade, o serviço e os dias.
O pedido cai na aba **Hoje**, em *Pedidos de horário*: só a equipe da unidade vê (o do Florença é só da Tháriga).

Tudo abaixo é feito **no celular da Tháriga**, no app WhatsApp Business. Os nomes dos menus mudam um pouco
entre Android e iPhone: Android, três pontinhos → *Ferramentas comerciais*; iPhone, *Configurações* → *Ferramentas comerciais*.

## 1. Perfil comercial
*Configurações → Perfil comercial*: nome, descrição (cite as duas unidades), endereço, horário e, em **Site**, o link `/p`.

## 2. Mensagem de saudação (a que responde ao primeiro "oi")
*Ferramentas comerciais → Mensagem de saudação*: ativar, destinatários **Todos que me enviarem mensagem** (ou "Quem não está nos meus contatos") e colar:

> Oi! Que bom ter você por aqui 💛 Aqui é a Maison Beauty / Estúdio Florença.
> Para eu te atender mais rápido, escolha o serviço e os melhores dias por aqui, leva menos de 1 minuto:
> https://cartorio-api-maison.vercel.app/p
> Se preferir, é só me contar o que você precisa.

## 3. Mensagem de ausência (fora do horário)
*Ferramentas comerciais → Mensagem de ausência*: ativar, **Enviar fora do horário de atendimento**, e colar:

> Oi! Neste momento estamos fora do horário. Deixe o seu pedido de horário aqui e respondo assim que voltar 💛
> https://cartorio-api-maison.vercel.app/p

## 4. Respostas rápidas
*Ferramentas comerciais → Respostas rápidas → +*. Atalhos úteis:
- `/pedido`: o mesmo texto da saudação, para mandar a quem já está conversando.
- `/endereco`: endereço e dias das duas unidades.
- `/ficha`: lembrar a cliente de preencher a ficha (o link de cada cliente é gerado no painel).

Na conversa, digite `/` e escolha o atalho.

## 5. Etiquetas (para não perder ninguém)
*Ferramentas comerciais → Etiquetas*: `Novo pedido`, `Aguardando resposta`, `Agendado`. Marque a conversa e troque a etiqueta conforme avança.

## Onde divulgar o link
Instagram (bio), cartão, QR code na recepção. O mesmo link serve para as duas unidades: a cliente escolhe lá.

## O que o painel faz sozinho
Reconhece pelo telefone quem já é cliente, cadastra quem é nova, sugere a primeira data nos dias que ela marcou e deixa a resposta pronta
(só envia o que a Tháriga mandar). Nada é enviado automaticamente.
