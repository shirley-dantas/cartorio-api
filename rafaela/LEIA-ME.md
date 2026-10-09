# Acervo de Vestibulares (ENEM / UNICAMP / FUVEST)

O painel agora é o **Caderno da Rafaela** (`painel/`) — ver `CLAUDE.md` desta pasta. O acervo original continua dentro dele, na aba Acervo.
Versão antiga, só do acervo, publicada como Artifact: https://claude.ai/artifact/KufsE9cDqJbh3ECjNyB1uf

## Estrutura
- `pdfs/<banca>/` provas e gabaritos originais
- `fontes.json` cadastro das provas (pdf + gabarito) e layout de cada banca (regex dos marcadores, margens)
- `scripts/recortar.py` recorta cada questão da página do PDF (imagem fiel)
- `scripts/gabaritos.py` leitores de gabarito (FUVEST conferido com a tabela de correspondência; ENEM com inglês/espanhol; UNICAMP)
- `scripts/importar.py` importa sem duplicar (sha256) -> `data/acervo.db` + `img/` (WebP lossless)
- `classificacao/*.json` matéria/subtema/tags por questão (feito à mão); aplicar com `scripts/classificar.py`
- `scripts/gerar_painel.py` gera `painel/data.json` + `painel/packs/` (imagens em base64)
- `painel/index.html` o painel (jsPDF para o PDF; o arquivo baixa pelo navegador)

## Fluxo para adicionar uma prova
1. Colocar prova + gabarito em `pdfs/<banca>/` e adicionar entrada em `fontes.json` (ajustar layout se for banca nova).
2. `pip install --break-system-packages pymupdf pillow`; `python3 -I scripts/importar.py`
3. Criar `classificacao/<id-da-prova>.json` (ids como `fuvest-2027-sim2-s1-q07`) e rodar `python3 -I scripts/classificar.py`
4. `python3 -I scripts/gerar_painel.py` — escreve direto em `painel/`. Junte na `main` e a Vercel sobe sozinha.
Obs: importar leva ~3 s por questão (WebP lossless). Rodar em background.

## Pendências / ideias
- Mais provas (a filha vai enviando uma de cada vez); outras bancas (VUNESP, UNIFESP, UERJ, ITA, IME)
- Revisar classificação de matéria/subtema

## Versão leve
Este pacote leve NÃO inclui `pdfs/`, `img/` nem `data/`. Coloque os PDFs originais em `pdfs/fuvest|enem|unicamp/` com os nomes de `fontes.json` e rode `python3 -I scripts/importar.py` (recria banco e imagens), depois `classificar.py` e `gerar_painel.py`.
