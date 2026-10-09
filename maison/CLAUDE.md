# Painel Maison Beauty

Painel da Tháriga Brito (sobrancelhas, cílios, micropigmentação), feito pela
Shirley em permuta. Um arquivo só — `index.html` — com Firebase Realtime
Database e Auth, no mesmo padrão do painel do cartório. Mora em `maison/`
deste repositório por enquanto; a ideia é mudar para um repositório próprio
(`thariga`) quando a conta do GitHub estiver resolvida.

Especificação original: protótipo aprovado pela Tháriga (`painel-thariga.html`).
Valores, durações, anamnese e roteiros de aula vieram dele, sem mudança.

## Regras que não devem ser mexidas sem perguntar
- **Duas permissões.** Tháriga (`admin`) vê as duas unidades e o dinheiro.
  Rafael, Laís e Mariana (`funcionaria`) veem só a Maison Beauty, com a agenda
  de todas, e **nunca** financeiro, comissões, fornecedores, cursos ou Florença.
  A trava é das **regras do banco** (`database.rules.json`); esconder aba é só cortesia.
- **O valor cobrado mora em `/financeiro/valores/{id}`**, longe do registro do
  atendimento: a funcionária só cria, nunca lê.
- **Nada que mexe em dinheiro é apagado de vez.** Atendimento cancelado e conta
  cancelada ficam guardados com a marca e quem cancelou, e saem das contas
  (`histAll()` esconde cancelados por padrão). Só a Tháriga corrige valor ou
  cancela atendimento; as regras do banco impedem a funcionária de apagar
  cliente ou mexer em atendimento já registrado.
- **Comissão:** Rafael e Mariana 50% do valor cheio (sem desconto de cartão ou
  material). Laís não tem comissão: paga R$ 500/mês de aluguel da sala, só
  às segundas, e fica com 100% do que cobra.
- **Fechamento quinzenal:** 1–15 pago dia 20; 16–31 pago dia 5 do mês seguinte.
- **Florença:** o percentual do acerto com a dona do estúdio **não está
  confirmado** (40% é provisório) — fica configurável, nunca travado no código.
- **A anamnese segue a ficha oficial da Maison Beauty** (PDF da Tháriga, página 1): identificação, serviço solicitado, 12 perguntas de saúde com Sim/Não **todas obrigatórias**, detalhes, autorização de foto e assinatura. A página 2 (registro do atendimento) é por atendimento, preenchida por todas, com o nome e a data de quem preencheu (sem nova assinatura da cliente). **Fotos só de quem autorizou**, reduzidas no aparelho e guardadas no próprio banco.
- **Cada unidade fica com os seus clientes.** A funcionária da Maison lança sempre na Maison; a Tháriga vê a unidade já escolhida pelo filtro da tela (ou, sem filtro, pelo dia de hoje: Florença quinta a sábado, Maison domingo a quarta) e pode trocar. Cliente do Florença mora em `/florenca` e a equipe da Maison nunca lê.
- **Foto pela ficha é obrigatória para quem autoriza:** quem marca "Autorizo" na anamnese por link tira a foto na hora (câmera do celular, sem galeria; de 1 a 3 fotos, reduzidas no aparelho) e a ficha só é enviada com ela. Quem marca "Não autorizo" não manda foto e a ficha segue normal. A equipe confere e marca "Anexar" ao integrar; viram "foto inicial" do cadastro. As regras do banco exigem foto quando há autorização e recusam foto quando não há.
- **Anamnese por link:** a cliente abre `/f/CÓDIGO` (a Vercel serve `anamnese.html`; o `?t=` antigo continua valendo), sem conta (login anônimo). O link mostra a logo da Maison Beauty na prévia do WhatsApp (`og-ficha.png` e as tags `og:` do `anamnese.html`). Código de 22 caracteres, 7 dias, uso único; o envio vai para `/maison/pendentes` e **só vale na ficha depois que a equipe integra**. O convite guarda o primeiro nome e o que já está no cadastro (nascimento, telefone, e-mail) para a ficha vir preenchida, e a lista de serviços das duas unidades. Vale também para clientes do Florença: o convite e o envio ficam em `/florenca/convites` e `/florenca/pendentes` (a página procura primeiro em `/maison`, depois em `/florenca`), a ficha é integrada em `/florenca/anamneses` e só a Tháriga vê a fila. Única abertura anônima do `/florenca`; o resto continua só admin.
- **Preços e serviços** são editáveis pela Tháriga (`/maison/servicos`, sobre a tabela de partida `SERV`). Valor cobrado de atendimento já registrado nunca muda sozinho.
- **Suporte:** botão "Preciso de ajuda" grava em `/maison/suporte` e manda e-mail pelo Apps Script (`apps-script/suporte.js`, `SUPORTE_URL` no `index.html`).
- **Instagram (fase 1, aba só da administradora):** plano da semana (um tema por dia: seg dicas, ter bastidores, qua conversa, qui cuidados, sex autocuidado, sáb horários, dom descanso; ★ = mínimo se a semana apertar), com banco de ideias recolhido embaixo; legenda, hashtags e o que fotografar; nada é publicado pelo painel. A troca de ideia do dia fica em `/admin/instagram/plano/{data}`. Sem promessa de resultado, sem preço e sem foto de cliente. O que ela edita e o que marca como postado fica em `/admin/instagram`.
- **A Agenda é um calendário do mês** (bolinha nos dias com horário, na cor da unidade; tocar no dia mostra os horários; "Hoje" volta). A equipe só vê as bolinhas da Maison Beauty. Substituiu a faixa de 7 dias, que escondia o que estava mais longe.
- **Avisar a cliente do horário (sem script):** ao agendar ou remarcar abre a mensagem pronta e editável, com botões **WhatsApp** (como a anamnese) e **e-mail**, e um link para uma **página própria** (`horario.html`, atalho `/h`) que mostra o horário com a logo na prévia do WhatsApp e tem os botões de salvar no Google Agenda e baixar o `.ics`. A página não leva nome, telefone nem valor, só serviço, dia, hora, unidade e profissional. Também há o botão "Avisar a cliente" em cada cartão da agenda. A mensagem não leva valor. É o caminho principal; o convite pela Google Agenda é opcional.
- **Convite da agenda:** o evento leva só serviço, unidade e horário (nunca ficha, anamnese ou valor). Remarcar atualiza o mesmo evento, nunca cria outro.
- **A Laís só atende às segundas, na tela e nas regras do banco** (o agendamento leva `ts` e a regra confere o dia da semana).
- **Agendar para cliente sem anamnese válida:** o alerta traz o botão que envia o link da ficha (as duas unidades), e volta ao agendamento sem perder o que já foi escolhido. A ficha que a cliente preencher aparece na aba **Hoje** ("Fichas recebidas pelo link") até a equipe integrar.
- **Cursos têm agenda:** a aba Cursos mostra, abaixo da pílula "Formato do curso" (que não muda), quantas alunas há por dia nos próximos 60 dias, "dia 1 de 2" para curso de vários dias (contados em sequência), os cursos sem data e um lembrete de curso que já passou da data sem ser concluído. Hoje e amanhã também aparecem na aba **Hoje** da Tháriga.
- **Cadastro repetido pergunta antes de duplicar** (cliente por nome ou telefone, fornecedor, conta, serviço, curso, tema). Cliente, fornecedor e conta podem ser cadastrados na hora, dentro do agendamento ou da conta. O cadastro da cliente guarda a data de nascimento completa; a foto inicial vira a foto pequena da cliente nas listas (`avatar`). Fornecedor tem unidade.
- **Todo serviço exige anamnese** válida (vence em 6 meses). Retorno padrão: 20 dias.
- **Unidade do dia** vem do dia da semana: Florença quinta–sábado, Maison
  domingo–quarta. Tháriga não escolhe unidade à mão.
- **Cadastro de clientes começa vazio**, de propósito. Nada de dados fictícios.
- **Gravar e ler dependem do banco.** Toda gravação é esperada (`grava()`) e
  avisa se o banco recusar; toda leitura que falha mostra o motivo e o botão
  "Tentar de novo". Nunca "salvo" sem ter salvo.
- **Texto digitado vai por `esc()`** antes de entrar no HTML (são dados de clientes).
- **Mensagem de aniversário:** são 8 textos que se alternam (o ponto de partida muda por cliente e por ano; o botão "Outra mensagem" passa para a próxima), todos fechando com o **brinde que a Tháriga escreve** em *Serviços e preços* (`/maison/config/brinde`). O painel **não inventa desconto**: sem brinde definido usa um texto neutro ("um mimo especial no seu próximo atendimento"). O protótipo oferecia 15% que ninguém confirmou.

## Rodando
Sem `apiKey` em `firebaseConfig`, abre em **demonstração** (memória). Para
testar: `python3 -m http.server` dentro de `maison/` e abrir `index.html`.
Passo a passo do Firebase em `FIREBASE.md`.

## Na fila
- **Google Agenda (opcional)** já está no painel (`apps-script/agenda.js`, `AGENDA_URL` no `index.html`): só falta a Tháriga autorizar o script na conta dela. Convite só sai para cliente com e-mail; falha aparece escrita, com "Reenviar convite".
- **Instagram, fase 2:** conectar a conta profissional (Página do Facebook + app da Meta) e publicar pelo painel; e ideias geradas pela IA (precisa de chave da API na Vercel). Foto de cliente só com termo de divulgação, que a ficha atual não dá.
- Mariana (mariibriit00@gmail.com): criar a conta e o cadastro em `acesso`.
- Logo e ícones já estão no painel (`logo.png`, `icon-192.png`, `icon-512.png`), tirados do PDF que a Tháriga mandou.
- Fotos em alta resolução (Storage), só se o volume crescer.
- Número novo da Mariana, lista de fornecedores/contas, dados de estoque.
- Roteiros de aula de cílios, lash lifting e brow lamination.

## Brinde de aniversário como voucher (rascunho, ainda não publicado)

Desconto só existe por **código liberado pela Tháriga**: `NIVER-XXXXXX`, um por cliente por ano, uso único, com prazo (`/maison/vouchers`, `/florenca/vouchers`). A regra de percentual (5% ou 10% conforme o valor do serviço, limite em R$, dias de validade) fica em `/maison/config/brindeRegra`, e cada código guarda a regra de quando foi criado.

- Quem atende **não digita desconto**: ao concluir, o painel acha o código da cliente (ou o digitado, que precisa ser dela), calcula e **trava o valor**. O código é marcado como usado e ligado ao atendimento (`atend`).
- Valor abaixo da tabela **sem voucher** exige motivo e detalhe (`desc.tipo = manual`); sem isso o atendimento aparece em vermelho no relatório.
- `financeiro/valores` guarda `tabela` e `desc`. Regras: só admin cria o código; a funcionária só marca "usado" uma vez; um valor com `desc.tipo = brinde` só é aceito se o código já está ligado àquele atendimento.
- Relatório **Descontos dados** em Financeiro (só Tháriga): total, brinde, com motivo, sem motivo, e a lista de códigos.
- Limite honesto: o painel controla o que é registrado; cobrar um valor e registrar outro ele não vê. Por isso desvios aparecem.

## Pedido de horário pela página pública (rascunho, ainda não publicado)

Um número de WhatsApp só para as duas unidades. A saudação do WhatsApp Business leva a cliente para `/p` (`pedido.html`): ela escolhe a unidade, o serviço, os dias (só os da unidade) e o período, e o pedido vai para `/maison/pedidos` ou `/florenca/pedidos`. Aparece em **Pedidos de horário**, na aba Hoje, só para a equipe da unidade (Florença: só a Tháriga). Botões: *Agendar* (reconhece a cliente pelo telefone ou cadastra, abre o agendamento preenchido e resolve o pedido ao salvar), *Responder* (WhatsApp com o horário a preencher) e *Já resolvi*.

- O painel **não lê** conversas do WhatsApp; só recebe o que a cliente preenche. Passo a passo do app em `maison/WHATSAPP.md`.
- Regras do banco: a cliente (anônima) só CRIA o pedido, com campos limitados; ler, resolver e apagar é da equipe. Campo escondido (`site`) barra robô. Spam se apaga na mão.
- A lista de serviços da página é copiada do painel; serviço novo criado em *Serviços e preços* só aparece no campo "Outro".
