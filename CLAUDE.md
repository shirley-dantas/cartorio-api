# Painel Operacional — 20º Tabelião de Notas (PRIME)

Painel interno usado todo dia pela Shirley, Grazi e Gabriel. É produção: qualquer
mudança aqui aparece na tela da equipe no próximo push.

## Como rodar e verificar

Não há build. `index.html` é servido como está, e o deploy sai sozinho a cada
push na `main` (Vercel e Netlify, ambos ligados ao repositório).

**Antes de commitar qualquer mudança no `index.html`, rode a verificação:**

```bash
node dev/verificar-painel.mjs
```

Ela carrega o `index.html` de verdade no Chromium com o Firebase substituído por
um banco em memória, e confere o que os olhos não pegam: que nenhuma função
sumiu, que todo `onclick` resolve, que os campos e botões dos cards continuam
lá, e que o estado de painéis abertos sobrevive a um re-render. Ver
`dev/README.md`.

## A armadilha deste arquivo

`index.html` tem ~3.500 linhas e **funções não relacionadas moram coladas umas
nas outras**. Já aconteceu de uma substituição de `renderCasos()` levar junto
`mudarCampo`, `abrirSegundaParte` e `fecharSegundaParte`, que ficavam logo
abaixo — sem `mudarCampo`, nenhum campo de card salva, e nada disso aparece numa
olhada na tela.

Por isso a verificação compara a lista de funções contra o commit anterior.
Ao recortar um trecho por índice, confira o que estava no fim do intervalo.

Outra armadilha, da mesma família: **`onclick` inline roda no escopo global**,
onde as funções de módulo não existem. `onclick="f(isoHoje())"` lança
`isoHoje is not defined` e o botão não faz nada, em silêncio. Resolva o valor na
montagem do HTML — `onclick="f('${isoHoje()}')"` — ou exponha em `window`.
Isso deixou o botão "⏸ Aguardando" quebrado por muito tempo sem ninguém notar.

## Linguagem visual

Neutros quentes, tipografia editorial, muito respiro. A referência foi um
planner pessoal, adaptado para um cartório. Duas decisões que sustentam o resto:

- **O arco é a marca.** O `GUIA_DE_MARCA.md` descreve o logo como "um arco fino
  sobre o wordmark, remetendo a proteção e acolhimento". Ele é o cabeçalho da
  Central, não enfeite.
- **Gravidade é filete, não fundo.** Antes a linha inteira de um caso crítico
  era pintada de vermelho — ~40% dos pixels da tela. Hoje é um filete de 3px na
  borda esquerda mais uma etiqueta pequena, perto de 2%. Se você se pegar
  pintando fundo por status, é regressão.

Fontes: **Jost** (200–400) para display e títulos de seção; **Inter** (400–600)
para interface e texto. É o que o guia de marca manda.

### Cores — não escolha no olho

Os hexadecimais abaixo saíram de um validador (faixa de luminosidade, chroma,
separação sob protanopia/deuteranopia, contraste). Trocar sem revalidar quebra a
leitura para quem tem daltonismo — ~8% dos homens. Três achados que mudaram
valores, e que é fácil desfazer sem querer:

| Onde | Valor | Por quê |
|---|---|---|
| Crítico e Atenção no quadro | `#BC2020` / `#EDA100` | Os `#C62828` / `#B45309` dos badges têm ΔE 8,3 entre si — colados numa barra empilhada viram a mesma cor |
| Cliente (quem segura a etapa) | `#A9761A` | O champagne `#A9895A` da marca tem chroma 0,075, abaixo do piso: como preenchimento de barra lê como cinza |
| Indefinido | `#414C55` | O cinza médio óbvio some dentro do verde-azulado de "Terceiro" sob deuteranopia (ΔE 2,0) |

Tokens da interface ficam em `:root` no topo do bloco `/* CENTRAL DE COMANDO */`
(`--cc-*`). Fundo da página: `#F2EFE9`. Texto: `#1F2A33`.

## Mapa do `index.html`

| Região | O que é |
|---|---|
| `<style>` | Tudo. Blocos marcados por comentário: base, Central (`.cc-*`), quadro (`.dash-*`), lista de casos (`.cx-*`), lateral |
| `.central-nova` | Cabeçalho, faixa-resumo, Mesa de hoje, indicadores, Incêndios/Esquecidos, Próximas ações, gavetas |
| `#view-casos` | Filtros, formulário de novo caso, lista de cards |
| `motorDecisao()` | Função pura: dado um caso, devolve nível, dias na etapa e próxima ação. **Regra de negócio — não mexer por motivo visual** |
| `calcularCentralComando()` | Uma passada só sobre os casos ativos; alimenta todas as seções |
| `renderCentralComando()` | Orquestra. A ordem das chamadas é a hierarquia da tela |
| `DEP_CONFIG` | As ~20 etapas, com prazos e quem segura a bola. Fonte da verdade do funil |

## Regras que não são visuais

- **Um caso não aparece em duas áreas.** Cada seção recebe os ids já usados
  acima e desconta. Se um caso sumiu de onde você esperava, ele está sendo
  mostrado com mais destaque em outro lugar.
- **Estado de UI aberta vive fora do HTML.** O painel redesenha inteiro a cada
  mudança no Firebase, feita por qualquer pessoa da equipe a qualquer momento.
  Guardar "aberto" numa classe do HTML faz o painel fechar sozinho na cara de
  quem está usando. Ver `ccItensAbertos`, `ccGavetas`, `cxRegAbertos`.
- **Chaves de resolução derivam do conteúdo**, não de posição em array — assim a
  resolução para de valer sozinha quando o fato muda. Ver `chaveResolucaoDep`.
- **`criadoEm` / `concluidoEm`** alimentam o gráfico de Ritmo. Casos antigos não
  têm — não invente data para eles, o gráfico conta a partir de 08/2026.

## Em aberto

- Quando "Esquecidos" tem pouca coisa, sobra um vazio grande à direita. Uma
  saída é empilhar "Próximas ações" naquela coluna.
- Os modais (Minuta, Reeditar, Atendimento, 2ª parte) ainda estão na aparência
  antiga — são o próximo passo para fechar a linguagem visual.
- O gráfico de Ritmo só fica útil depois de algumas semanas acumulando dados.
