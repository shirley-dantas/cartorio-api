"""Divide os PDFs grandes (um por banca, com várias provas e gabaritos juntos) nos PDFs de cada prova.
Uso: python3 -I scripts/dividir_pdfs.py DIRETORIO_COM_OS_PDFS_GRANDES
As páginas de cada peça vêm de scripts/divisao.json (números de página começando em 1).
Saída: pdfs/<banca>/<nome>.pdf — os nomes que o fontes.json espera."""
import json, os, sys
import pymupdf

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "divisao.json")))
origem = sys.argv[1]
for arq, pecas in cfg.items():
    src = pymupdf.open(os.path.join(origem, arq))
    for nome, (banca, a, b) in pecas.items():
        out = pymupdf.open()
        out.insert_pdf(src, from_page=a - 1, to_page=b - 1)
        pasta = os.path.join(RAIZ, "pdfs", banca)
        os.makedirs(pasta, exist_ok=True)
        out.save(os.path.join(pasta, nome))
        print(f"{banca}/{nome}: páginas {a}-{b} ({b - a + 1})")
