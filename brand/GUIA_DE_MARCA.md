# Identidade Visual — PRIME

Guia de uso da marca PRIME, desenvolvido a partir da referência de logotipo fornecida, mantendo fidelidade ao conceito original: um arco fino sobre o wordmark, remetendo a proteção e acolhimento de forma abstrata — sem símbolos jurídicos literais (balança, martelo, colunas, casas, chaves, prédios, apertos de mão).

## Arquivos

| Arquivo | Uso |
|---|---|
| `logo-primario.svg` | Logotipo colorido para fundos claros (branco, off-white). Uso principal em site, documentos, apresentações, papelaria. |
| `logo-reverso.svg` | Logotipo em off-white/champagne para fundos escuros (petróleo, preto, fotos escuras). |
| `logo-mono-petroleo.svg` | Versão em cor única, para aplicações de baixo contraste: carimbos, marca d'água, impressão em preto e branco, fax/scan. |
| `marca-icone.svg` | Versão do logotipo completo ("PRIME" + arco) ajustada para o formato quadrado — favicon, ícone de app, avatar de redes sociais. A marca não tem versão reduzida a uma letra isolada: em qualquer tamanho, "PRIME" por extenso é o único símbolo da PRIME. |
| `paleta.css` | Tokens de cor em CSS custom properties, para uso em produtos digitais (site, app). |

## Logotipo

- **Área de proteção**: mantenha ao redor do logotipo um espaço livre mínimo equivalente à altura da letra "P" do wordmark. Nenhum outro elemento (texto, imagem, borda) deve invadir essa área.
- **Tamanho mínimo**: 120px de largura para o logotipo horizontal completo; 48px para a versão quadrada (`marca-icone.svg`). Em favicon (32px) a palavra "PRIME" fica pequena mas ainda legível — é uma limitação aceita conscientemente, já que a marca não usa uma versão reduzida a uma única letra.
- **Não fazer**:
  - Não distorcer, inclinar ou espelhar o logotipo.
  - Não alterar as cores fora da paleta definida.
  - Não adicionar sombras, contornos, brilho ou efeitos 3D.
  - Não reduzir o espaçamento entre letras do wordmark.
  - Não usar o arco isoladamente como elemento decorativo genérico — ele pertence à marca e deve sempre remeter ao logotipo.
  - Não usar nenhuma letra isolada (ex.: só o "P") como símbolo da marca, em nenhum contexto ou tamanho.

## Paleta de cores

| Cor | Hex | Uso |
|---|---|---|
| Branco | `#FFFFFF` | Fundos, espaço negativo |
| Off-white | `#F7F5F0` | Fundo alternativo, mais quente que o branco puro |
| Azul-petróleo profundo | `#16283A` | Texto do logotipo, títulos, textos de alto contraste |
| Azul-petróleo | `#1F3B4D` | Superfícies escuras (cabeçalhos, rodapés, cartões de destaque) |
| Azul acinzentado | `#5B6B78` | Textos secundários, ícones, bordas |
| Azul acinzentado claro | `#A9B4BC` | Elementos terciários, textos desabilitados |
| Champagne fosco (escuro) | `#A9895A` | Extremidades do gradiente do arco, detalhes discretos |
| Champagne | `#DCC493` | Arco, acentos, hover states |
| Champagne claro | `#F1E4C6` | Ponto alto do gradiente do arco (brilho) |

Contraste e intensidade sempre suaves — evitar preto puro, branco puro em grandes áreas de texto, e qualquer cor saturada fora dessa paleta.

## Tipografia

- **Wordmark / display** (logotipo, títulos de destaque, capas de apresentação): **Jost**, peso 200 (Thin) a 300 (Light), com letter-spacing generoso (~19–22px em textos grandes). Geométrica, atemporal, com a mesma personalidade de fontes premium como Futura ou Century Gothic — que são as alternativas de fallback quando Jost não estiver disponível (ex.: Word, PowerPoint).
- **Interface / produto** (app, painel, textos longos, formulários): **Inter**, pesos 400–600. Jost em peso thin não é recomendada para blocos de texto ou telas pequenas — prioriza-se legibilidade sobre o efeito editorial do wordmark.
- Em documentos e propostas, usar Jost apenas em títulos e capas; corpo de texto sempre em uma fonte de leitura (Inter ou a fonte padrão do editor).

## Aplicações

- **App/painel**: `marca-icone.svg` como ícone (favicon, home screen); logotipo reverso no cabeçalho sobre fundo petróleo.
- **Site**: logotipo primário sobre branco/off-white no topo; reverso no rodapé se o fundo for escuro.
- **Documentos e propostas**: logotipo primário no cabeçalho da primeira página; `logo-mono-petroleo.svg` em cabeçalhos/rodapés subsequentes.
- **Apresentações**: capas com logotipo primário ou reverso conforme o fundo; slides internos podem usar apenas `marca-icone.svg` no canto.
- **Redes sociais**: `marca-icone.svg` como foto de perfil; logotipo primário ou reverso em posts/capas.
- **Papelaria e assinatura de e-mail**: logotipo primário, tamanho reduzido (mín. 120px de largura), sempre com a área de proteção respeitada.

## Aplicado neste repositório

- `index.html` — logotipo reverso no cabeçalho do painel operacional; cor do cabeçalho e `theme-color` atualizados para azul-petróleo.
- `manifest.json` — `theme_color`/`background_color` atualizados para `#16283A`.
- `icons/` — favicon, ícone Apple e ícones PWA (192/512) regenerados a partir de `marca-icone.svg`.

As demais cores funcionais do painel (indicadores de status, prioridade, alertas) foram mantidas — não fazem parte da identidade de marca e têm significado operacional próprio (ex.: verde = conectado, vermelho = alerta).

## Possíveis refinamentos futuros (não aplicados)

Fica registrado para avaliação futura, caso a PRIME queira revisitar o tema mais adiante — nada disso foi aplicado nesta entrega, que priorizou fidelidade à referência original:

- Afinar as pontas do arco (efeito de traço com espessura variável, mais fino nas extremidades) para um acabamento ainda mais artesanal.
- Um azul-petróleo ligeiramente mais claro no wordmark (`#1F3B4D` em vez de `#16283A`), para um tom mais suave e menos próximo do preto.
