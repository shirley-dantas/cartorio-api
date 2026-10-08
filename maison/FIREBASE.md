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
| `/maison/atendimentos` | lê, cria, corrige e cancela | lê e cria (**não corrige nem cancela**) |
| `/florenca/*` | lê e escreve | **negado** |
| `/financeiro/valores` (valor cobrado) | lê e escreve | só **cria** ao concluir; não lê nem corrige |
| `/admin/*` (fornecedores, contas, cursos, aulas, config, pagamentos) | lê e escreve | **negado** |

Cliente da unidade Florença mora em `/florenca/clientes`; "Maison" e "As duas"
moram em `/maison/clientes`.

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

## Ainda não feito
- Fotos em alta resolução (Firebase Storage): hoje as fotos são reduzidas a no máximo 1280 px e guardadas no próprio banco. Migrar para o Storage só se o volume crescer.
- A Laís só atende às segundas: hoje a trava está na tela, ainda não nas regras.
- Estoque (aguarda os dados da Tháriga).
