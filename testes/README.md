# Testes do financeiro

Três suítes, todas rodando por cima do **index.html de verdade** — o
`montar.mjs` recorta o bloco financeiro do arquivo publicado a cada execução,
em vez de manter uma cópia que envelheceria em silêncio.

```bash
node testes/montar.mjs        # recorta o bloco e monta as páginas
node testes/calculo.gerado.mjs   # a conta: 93 verificações, sem navegador
node testes/navegador.mjs        # 24 caminhos completos no Chromium
node testes/celular.mjs          # a mesma tela num iPhone 13
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

O quadro do dinheiro (a seção **O mês em dinheiro**) entra nas três: a conta
dos fechamentos no `calculo`, o "não mostra valor sem login" e a leitura do
ciclo no `navegador`, e a largura no `celular`. Para olhar o desenho dele com
dois fechamentos no banco, abra o `preview-quadro.html` do mesmo servidor.

## Faz-de-conta

`faz-de-conta-navegador.js` e `faz-de-conta-node.js` são o Firebase, o Auth e
um card falsos. Nenhum teste toca o banco de verdade — e a senha do login de
mentira é literalmente `certa`.
