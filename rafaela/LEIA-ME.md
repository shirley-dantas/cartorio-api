# Acervo de Vestibulares (ENEM / UNICAMP / FUVEST)

O painel agora é o **Caderno da Rafaela** (`painel/`) — ver `CLAUDE.md` desta pasta. O acervo original continua dentro dele, na aba Acervo.
Versão antiga, só do acervo, publicada como Artifact: https://claude.ai/artifact/KufsE9cDqJbh3ECjNyB1uf

## Estrutura
- `pdfs/<banca>/` provas e gabaritos originais (fora do git)
- `scripts/dividir_pdfs.py` + `divisao.json` separam PDFs que vieram juntos (várias provas num arquivo só) em um PDF por prova
- `fontes.json` cadastro das provas (pdf + gabarito) e layout de cada banca (regex dos marcadores, margens, colunas, textos-base compartilhados, `esperadas` = quantas questões a prova tem)
- `scripts/recortar.py` recorta cada questão da página do PDF (imagem fiel); `validar_recortes.py` e `testar_recorte.py` conferem cortes e contagem
- `scripts/gabaritos.py` leitores de gabarito (FUVEST conferido com a tabela de correspondência; ENEM dia 1 e dia 2; UNICAMP). Prova sem gabarito entra mesmo assim: aparece e resolve, mas fora da conta de acertos (hoje: UNICAMP 2023)
- `scripts/importar.py` importa sem duplicar (sha256) -> `data/acervo.db` + `img/` (WebP com perda, qualidade em `fontes.json["imagem"]`); pula prova cujo PDF não está na pasta
- `scripts/listar_para_classificar.py` + `scripts/aplicar_classificacao.py` classificam (matéria/subtema/tags) -> `classificacao/<prova>.json`; `scripts/classificar.py` grava no banco
- `scripts/gerar_painel.py` gera `painel/data.json` + `painel/q/<id>.webp` (uma imagem por questão, carregada só quando aparece)
- `scripts/restaurar_banco.py` refaz `data/` e `img/` a partir do `painel/` quando só o repositório está à mão
- `painel/index.html` o painel (jsPDF para o PDF; o arquivo baixa pelo navegador)

## Fluxo para adicionar uma prova
1. Colocar prova + gabarito em `pdfs/<banca>/` (se vierem juntos, `dividir_pdfs.py`) e adicionar entrada em `fontes.json` (ajustar layout se for banca nova).
2. `pip install --break-system-packages pymupdf pillow`; `python3 -I scripts/importar.py` e `python3 -I scripts/validar_recortes.py`
3. `scripts/listar_para_classificar.py <id>` para ler, `scripts/aplicar_classificacao.py <id>` para gravar; depois `python3 -I scripts/classificar.py`
4. `python3 -I scripts/gerar_painel.py` — escreve direto em `painel/`. Junte na `main` e a Vercel sobe sozinha.
Obs: o texto da FUVEST 2026 vem do PDF sem espaços entre palavras — só afeta a busca por texto; a imagem é fiel.

## Pendências / ideias
- Mais provas (a filha vai enviando uma de cada vez); outras bancas (VUNESP, UNIFESP, UERJ, ITA, IME)
- Revisar classificação de matéria/subtema

## Versão leve
Este pacote leve NÃO inclui `pdfs/`, `img/` nem `data/`. Coloque os PDFs originais em `pdfs/fuvest|enem|unicamp/` com os nomes de `fontes.json` e rode `python3 -I scripts/importar.py` (recria banco e imagens), depois `classificar.py` e `gerar_painel.py`.
