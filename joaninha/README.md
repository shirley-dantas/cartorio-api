# Joaninha no painel do PRIME

Esse pacote tem tudo pronto pra colocar a Joaninha animada no painel.
Não precisa de build, npm, nem nada disso — são só 3 arquivos + uma pasta de imagens.

## O que tem aqui

```
joaninha/
├── joaninha.js       ← o "cérebro" dela (controla qual imagem mostrar e quando)
├── joaninha.css      ← o visual (tamanho, posição na tela, flutuação, fade)
├── assets/           ← as 6 imagens dela, uma para cada estado
│   ├── idle.png
│   ├── walk.png
│   ├── fly.png
│   ├── thinking.png
│   ├── happy.png
│   └── sleep.png
└── README.md         ← este arquivo
```

## Como instalar (passo a passo)

1. Copie a pasta `joaninha/` inteira para dentro do repositório do painel
   (`Cartorio-API`), na raiz do projeto ou dentro de uma pasta `public/` /
   `static/` — o mesmo lugar onde já ficam outras imagens ou scripts do site.

2. No HTML principal do painel, logo antes do fechamento da tag
   `</body>`, adicione estas duas linhas:

   ```html
   <link rel="stylesheet" href="joaninha/joaninha.css">
   <script src="joaninha/joaninha.js"></script>
   ```

   (Se a pasta `joaninha/` estiver em outro caminho, ajuste o `href` e o
   `src` de acordo.)

3. Pronto! Ao abrir o painel, a Joaninha já aparece no canto inferior
   direito da tela, paradinha e respirando (flutuando levemente).

## Como controlar ela pelo código do painel

Em qualquer lugar do JavaScript do painel, depois que a página carregar,
você pode chamar:

```js
joaninha.play("idle");      // parada (padrão)
joaninha.play("walk");      // andando
joaninha.play("fly");       // voando
joaninha.play("thinking");  // pensativa - use enquanto algo está processando
joaninha.play("happy");     // comemorando - use quando algo dá certo
joaninha.play("sleep");     // descansando - use após um tempo sem atividade
```

Exemplo prático: quando chegar uma mensagem nova do WhatsApp e o painel
começar a processar:

```js
joaninha.play("thinking");
// ... código que processa a mensagem ...
joaninha.play("happy");
```

Ela troca de imagem sozinha, com uma transição suave (fade), e depois de
alguns segundos volta para o estado "idle" automaticamente (isso é
ajustável dentro de `joaninha.js`, na constante `AUTO_RETURN_TO_IDLE_MS`).

### Seguir o cursor

```js
joaninha.followCursor(true);  // liga
joaninha.followCursor(false); // desliga
```

## O que dá pra ajustar facilmente

- **Tamanho e posição na tela**: arquivo `joaninha.css`, dentro de
  `#joaninha-wrapper` (comentários mostram o que mexer).
- **Tempo até voltar para "idle" sozinha**: arquivo `joaninha.js`,
  constante `AUTO_RETURN_TO_IDLE_MS` (em milissegundos).
- **Adicionar um novo estado no futuro**: colocar a nova imagem dentro de
  `assets/` e adicionar uma linha no objeto `POSES` em `joaninha.js`.

## O que isso NÃO faz (ainda)

Esse pacote só cuida da parte visual (mostrar a imagem certa, na hora
certa, com efeito bonito). Ele não decide sozinho quando chamar
`joaninha.play("thinking")` ou `"happy"` — isso precisa ser conectado
ao código que já existe no painel (por exemplo, no ponto onde o painel
recebe uma mensagem nova do Firebase). Essa parte de conectar aos
eventos reais do sistema é o próximo passo, depois que você testar essa
base.
