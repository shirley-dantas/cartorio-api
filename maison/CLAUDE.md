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
- **Todo serviço exige anamnese** válida (vence em 6 meses). Retorno padrão: 20 dias.
- **Unidade do dia** vem do dia da semana: Florença quinta–sábado, Maison
  domingo–quarta. Tháriga não escolhe unidade à mão.
- **Cadastro de clientes começa vazio**, de propósito. Nada de dados fictícios.
- **Gravar e ler dependem do banco.** Toda gravação é esperada (`grava()`) e
  avisa se o banco recusar; toda leitura que falha mostra o motivo e o botão
  "Tentar de novo". Nunca "salvo" sem ter salvo.
- **Texto digitado vai por `esc()`** antes de entrar no HTML (são dados de clientes).
- A mensagem de aniversário **não promete desconto**: o texto do protótipo
  oferecia 15% que ninguém confirmou.

## Rodando
Sem `apiKey` em `firebaseConfig`, abre em **demonstração** (memória). Para
testar: `python3 -m http.server` dentro de `maison/` e abrir `index.html`.
Passo a passo do Firebase em `FIREBASE.md`.

## Na fila
- Logo: o arquivo `logo.jpg` não veio (estava embutido no protótipo); pedir em alta resolução.
- Upload das fotos da anamnese (Storage).
- Número novo da Mariana, lista de fornecedores/contas, dados de estoque.
- Roteiros de aula de cílios, lash lifting e brow lamination.
- Trava da Laís (só segunda) também nas regras do banco.
