# Firebase do Maison Beauty — passo a passo

O Maison Beauty usa um projeto Firebase **só dele**, separado do cartório: são
dados de outra pessoa e de clientes que nada têm a ver com o 20º Tabelião.

1. No console do Firebase, crie um projeto novo (ex.: `maison-beauty`).
2. **Authentication** → *Sign-in method* → ligue **E-mail/senha**. Crie quatro
   usuários: Tháriga, Rafael, Laís e Mariana (a Mariana quando houver o contato novo).
3. **Realtime Database** → criar banco (região São Paulo, se houver).
4. **Regras** → cole o conteúdo de `database.rules.json` e publique.
5. **Quem é quem** — no banco, em `acesso`, crie um nó com o UID de cada usuário
   (o UID aparece na aba Authentication):

   ```
   /acesso/<uid da Tháriga>  = { "nome": "Tháriga", "perfil": "admin",       "pro": "tha" }
   /acesso/<uid do Rafael>   = { "nome": "Rafael",  "perfil": "funcionaria", "pro": "rafael" }
   /acesso/<uid da Laís>     = { "nome": "Laís",    "perfil": "funcionaria", "pro": "lais" }
   /acesso/<uid da Mariana>  = { "nome": "Mariana", "perfil": "funcionaria", "pro": "mariana" }
   ```

   O painel nunca escreve em `/acesso`: ninguém se libera sozinho.
6. **Configurações do projeto** → *Seus apps* → app da Web → copie o
   `firebaseConfig` para o início do `<script>` do `index.html`.
   Enquanto o `apiKey` estiver vazio, o painel abre em **demonstração**
   (dados só na memória).
7. Em **Authentication → Configurações → Domínios autorizados**, inclua o
   endereço onde o painel for publicado.

## Quem lê o quê (nas regras, não só na tela)

| Caminho | Tháriga | Funcionárias |
|---|---|---|
| `/maison/clientes`, `agenda`, `anamneses` | lê, cria, corrige e apaga | lê, cria e corrige (**não apaga**) |
| `/maison/registros` (registro do atendimento) | lê, cria, corrige e apaga | lê, cria e corrige (**não apaga**) |
| `/maison/fotos` | lê, envia e apaga | lê e envia (**não apaga**) |
| `/maison/servicos` (preços) | lê e altera | lê (**não altera**) |
| `/maison/convites`, `/maison/pendentes` (anamnese por link) | lê, cria, integra e apaga | lê, cria, integra e apaga |
| `/maison/suporte` | lê e envia | só envia |
| `/maison/atendimentos` | lê, cria, corrige e cancela | lê e cria (**não corrige nem cancela**) |
| `/florenca/*` | lê e escreve | **negado** |
| `/financeiro/valores` (valor cobrado) | lê e escreve | só **cria** ao concluir; não lê nem corrige |
| `/admin/*` (fornecedores, contas, cursos, aulas, config, pagamentos) | lê e escreve | **negado** |

Cliente da unidade Florença mora em `/florenca/clientes`; "Maison" e "As duas"
moram em `/maison/clientes`.

## A Laís só atende às segundas
O agendamento leva `ts` (a data em milissegundos, à meia-noite UTC) e as regras do banco recusam agendamento da Laís que não caia numa segunda. A conta é `(dias desde 1970 + 4) % 7 = 1`. Agendamento antigo, sem `ts`, continua podendo ser atualizado. **Republique as regras** depois desta versão.

## Corrigir e cancelar
- **Agendamento:** remarcar e cancelar (fica guardado como "Cancelado").
- **Atendimento concluído:** só a Tháriga corrige valor e forma de pagamento, ou cancela. Cancelar **não apaga**: fica marcado como cancelado, sai do financeiro e das comissões, e o horário volta a "Agendado".
- **Cliente:** editar dados; excluir só pela Tháriga, e só quem nunca teve atendimento.
- **Conta a pagar:** editar e cancelar (guardada como cancelada). **Fornecedor e curso:** editar e excluir.
- **Se mudar a regra de quem pode o quê, republique** `database.rules.json` no console.

## Fotos e registro do atendimento
- As fotos são **reduzidas no aparelho** (lado maior de 1280 px, JPEG) e gravadas em `/{unidade}/fotos/{cliente}/{foto}`; as regras recusam foto com mais de ~700 mil caracteres.
- Só se envia foto de cliente que **autorizou na anamnese**.
- O registro (página 2 da ficha) é por atendimento, em `/{unidade}/registros/{atendimento}`. Todas preenchem; o nome e a data de quem preencheu ficam gravados.
- **Republique as regras** depois desta versão: sem isso o banco recusa registros e fotos.

## Anamnese por link
- A cliente abre `anamnese.html?t=CÓDIGO` no celular, **sem conta**. O painel gera o código (32 caracteres, impossível de adivinhar), com validade de **7 dias** e **uso único**.
- Para isso, em **Authentication → Método de login**, ligue **Anônimo**. Só a página da ficha usa isso; a cliente não vê nada do painel.
- O que a cliente envia vai para `/maison/pendentes/{código}`, que só a equipe lê. A equipe confere em **Anamnese → Recebidas pelo link** e toca em **Integrar**. Só aí o link fecha.
- **Fotos pela ficha:** se a cliente marcar "Autorizo", pode tirar ou escolher até 3 fotos no próprio celular. Na conferência (**Recebidas pelo link**) a equipe vê as miniaturas, desmarca as que não quer e toca em **Integrar**: as marcadas viram "foto inicial" no cadastro. **Republique as regras** depois desta versão: elas limitam a 3 fotos e só aceitam foto de quem autorizou.
- A cliente só consegue gravar **uma vez** e **enquanto o convite estiver aberto**: isso é checado pelas regras do banco.
- Disponível para clientes da Maison; clientes do Florença seguem pelo preenchimento na tela.

## Pedido de ajuda por e-mail
O botão **Preciso de ajuda** grava o pedido em `/maison/suporte` (nunca se perde) e, se o endereço estiver configurado, manda e-mail para `dantasshy@gmail.com`.
1. Abra **script.google.com**, na conta que vai receber (`dantasshy@gmail.com`), e crie um projeto novo.
2. Cole o conteúdo de `apps-script/suporte.js`.
3. **Implantar → Nova implantação → Tipo: App da Web.** *Executar como:* eu. *Quem pode acessar:* qualquer pessoa. Autorize quando pedir.
4. Copie o endereço que termina em `/exec` e coloque em `SUPORTE_URL`, no começo do `<script>` do `index.html`.
- **Limite:** o Gmail comum deixa o Apps Script mandar cerca de **100 e-mails por dia**. Para um estúdio, sobra.
- A chave que acompanha o pedido só barra mensagens aleatórias; não é senha. Os pedidos também ficam no banco.

## Avisar a cliente do horário
Ao agendar ou remarcar, o painel abre uma mensagem pronta para a cliente, com **WhatsApp** e **e-mail** (se houver telefone e e-mail no cadastro) e um link que salva o horário na agenda dela. Não precisa de script nem de configuração. Também dá para avisar depois, pelo botão **Avisar a cliente** no cartão da agenda.

## Convites pela Google Agenda (opcional)
Quando a cliente tem **e-mail** no cadastro, ao agendar sai um convite da Google Agenda **em nome da Tháriga** (thariga.pmu@gmail.com). A cliente aceita ou recusa pelo próprio e-mail, e a resposta aparece no cartão da agenda (*Aceitou*, *Recusou*, *sem resposta*). Remarcar atualiza o mesmo evento; cancelar avisa a cliente. Sem e-mail, o agendamento segue normal, sem convite. O evento leva só serviço, unidade e horário.
**Jeito mais simples (sem a Tháriga criar nada):**
1. A Tháriga, em calendar.google.com, abre **Configurações e compartilhamento** da agenda dela e, em **Compartilhar com pessoas específicas**, adiciona `dantasshy@gmail.com` com a permissão **Fazer alterações em eventos**.
2. Quem dá suporte (`dantasshy@gmail.com`) abre **script.google.com**, cria um projeto e cola `apps-script/agenda.js`.
3. No menu da esquerda, ao lado de **Serviços**, clique em **+**, escolha **Google Calendar API** e **Adicionar**.
4. **Implantar → Nova implantação → App da Web.** *Executar como:* eu. *Quem pode acessar:* qualquer pessoa. Autorize.
5. Copie o endereço que termina em `/exec` e coloque em `AGENDA_URL`, no começo do `<script>` do `index.html`.
- O primeiro convite de teste mostra como o e-mail aparece para a cliente. Se ficar estranho, os mesmos passos valem rodando o script direto na conta da Tháriga (sem o passo 1).
- Se o convite não sair, o cartão mostra **Convite não enviado** e o botão **Reenviar convite**. O agendamento nunca se perde.
- A chave `AGENDA_CHAVE` só barra mensagem aleatória; não é senha.

## Serviços e preços
A aba **Serviços e preços** (só administradora) muda valor, nome, duração e observação, ativa ou desativa e cria serviços. O que for mudado vale por cima da tabela de partida do painel. Atendimentos já registrados mantêm o valor cobrado. Serviço já usado não é excluído, só desativado.

## Ainda não feito
- Fotos em alta resolução (Firebase Storage): hoje as fotos são reduzidas a no máximo 1280 px e guardadas no próprio banco. Migrar para o Storage só se o volume crescer.
- Estoque (aguarda os dados da Tháriga).
