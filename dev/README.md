# Ferramentas de desenvolvimento

## `verificar-painel.mjs`

```bash
npm run verificar
```

Carrega o `index.html` de verdade no Chromium, com o Firebase substituído por um
banco em memória, e confere seis coisas. Sai com código 1 se algo falhar.

**Não toca no Firebase de produção.** Os dados são fictícios e vivem só na
memória da aba.

### O que ele pega

| # | Checagem | Por que existe |
|---|---|---|
| 1 | **Paridade de funções** contra o `HEAD` | O `index.html` tem ~3.500 linhas e funções não relacionadas moram coladas. Uma edição já levou junto `mudarCampo` — sem ela nenhum campo de card salva, e a tela continua parecendo perfeita |
| 2 | **Handlers inline** resolvem em `window` | `onclick` roda no escopo global; chamar uma função de módulo ali lança erro em silêncio e o botão não faz nada. Foi assim que o "⏸ Aguardando" ficou quebrado sem ninguém notar |
| 3 | **Campos e botões do card** | 10 campos editáveis e 9 botões, condicionais inclusive. Reescrever a marcação do card é fácil; esquecer um campo no meio, também |
| 4 | **Estado aberto sobrevive a re-render** | O painel redesenha inteiro quando qualquer pessoa da equipe edita algo. O que o usuário deixou aberto não pode fechar sozinho na cara dele |
| 5 | **Layout** em 1440px e 390px | Sem rolagem horizontal, sem rótulo cortado na lateral |
| 6 | **Console limpo** | Nenhum erro de JS |

### Quando ele mente

Ele confere estrutura e comportamento, **não estética**. Barra na cor errada,
espaçamento feio ou hierarquia confusa passam batido. Para isso, tire um
screenshot e olhe — vários bugs desta base só apareceram assim: a barra mais
longa empurrando o número para fora do cartão, as colunas do gráfico sem
altura nenhuma, o numeral colidindo com nomes longos.

### Ajustando o conjunto de dados

Os casos fictícios ficam em `DADOS`, no próprio arquivo. Se você reduzir muito
a quantidade, "A mesa de hoje" (teto de 4 cartões) absorve quase todos os casos
e as seções abaixo ficam vazias de verdade — aí a checagem 4 não tem o que
testar e acusa isso em vez de passar em silêncio.

Para cobrir um caso novo (uma etapa, um estado de segunda parte, um campo),
acrescente um caso em `DADOS.casos` com essa forma.
