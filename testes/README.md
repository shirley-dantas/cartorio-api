# Testes do financeiro e da Rede

Cinco suítes, todas rodando por cima do **index.html de verdade** — o
`montar.mjs` recorta o bloco financeiro do arquivo publicado a cada execução,
em vez de manter uma cópia que envelheceria em silêncio.

```bash
node testes/montar.mjs        # recorta o bloco e monta as páginas
node testes/calculo.gerado.mjs   # a conta: 93 verificações, sem navegador
node testes/navegador.mjs        # 24 caminhos completos no Chromium
node testes/celular.mjs          # a mesma tela num iPhone 13
node testes/rede.mjs             # a Rede no Chromium, e no celular no fim
node testes/rede-varredura.mjs   # a conta que identifica a pessoa, sem Google
```

E, para olhar o desenho com dados de verdade:

```bash
node testes/montar.mjs && node -e "import('./testes/servidor.mjs').then(m=>m.servir())"
# abre http://127.0.0.1:8199/preview.html
```

## O que cada uma protege

- **calculo** — a escada do dinheiro inteira, com a escritura da Tania degrau
  por degrau e as dezessete linhas do fechamento de agosto comparadas uma a
  uma com a planilha antiga. Também o calendário do fechamento (26 a 25, com
  feriados) e o cofre pessoal (criptografia, senha errada, recuperação).
- **navegador** — do login até o repasse: lançar pelo card, editar sem
  duplicar, a planilha, o bruto/líquido, a carteira, o cofre e o salário que
  se recalcula quando um lançamento muda.
- **celular** — que nada estoure a largura da tela e que a planilha role
  dentro da própria caixa.
- **rede** — quem entra (sem login pede senha, a Grazi esbarra na porta, só a
  conta dona vê), a fila que só traz gente do ramo, o lápis que corrige e não
  é desfeito pela próxima varredura, o cadastro único das construtoras, o mapa
  por estado e bairro, e duas coisas que **não** podem acontecer: CPF na tela e
  robô no LinkedIn. Termina medindo tudo num iPhone 13.
- **rede-varredura** — a única parte do `apps-script/cartorio-rede.js` que roda
  fora do Google: a impressão digital do CPF (mesma pessoa dá o mesmo código, o
  número não volta dele, trocar a chave duplica o cadastro) e a lista de quem
  nunca entra na teia. Carrega o arquivo do Apps Script com Drive, Firebase e
  IA fingidos.

O quadro do dinheiro (a seção **O mês em dinheiro**) entra nas três: a conta
dos fechamentos no `calculo`, o "não mostra valor sem login" e a leitura do
ciclo no `navegador`, e a largura no `celular`. Para olhar o desenho dele com
dois fechamentos no banco, abra o `preview-quadro.html` do mesmo servidor.

## Faz-de-conta

`faz-de-conta-navegador.js` e `faz-de-conta-node.js` são o Firebase, o Auth e
um card falsos. Nenhum teste toca o banco de verdade — e a senha do login de
mentira é literalmente `certa`.

A semente do `rede.mjs` são pessoas de duas minutas reais do Drive. Ela está
ali de propósito: além de exercitar as telas, é a documentação viva do formato
que a varredura precisa gravar em `/rede/pessoas`.
