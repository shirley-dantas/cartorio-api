"""Recorta cada questão de uma prova em PDF como imagem fiel à página original.

Funcionamento (genérico, configurável por banca em fontes.json -> "layout"):
  1. Divide cada página em colunas (detecta a linha vertical divisória).
  2. Monta um "fluxo de leitura" (página 1 coluna esq., coluna dir., página 2...).
  3. Localiza os marcadores de questão (regex) e os prefácios de textos compartilhados
     ("Texto para as questões 29 e 30").
  4. Cada questão vai do seu marcador até o próximo marcador, atravessando colunas/páginas.
  5. Prefácios (texto/imagem compartilhado) são anexados acima de cada questão do intervalo.
Nada é reescrito: a imagem é um recorte da própria página (renderização do PDF).
"""
import re
import pymupdf
from PIL import Image

ESCALA = 2.5  # ~180 dpi


def _divisoria(page):
    W = page.rect.width
    for d in page.get_drawings():
        r = d["rect"]
        if r.width < 3 and r.height > 300 and 0.4 * W < r.x0 < 0.6 * W:
            return (r.x0 + r.x1) / 2
    return None


def _segmentos(doc, lay):
    """Lista de segmentos (colunas) em ordem de leitura. Página sem divisória = 1 segmento largo."""
    segs = []
    for pno, page in enumerate(doc):
        W = page.rect.width
        dx = _divisoria(page)
        duas = dx is not None
        top, bot = lay["y_top"], lay["y_bot"]
        xm = lay.get("x_margem", 8)
        dxx = dx if duas else None
        xs_l = [[], []]
        for blk in page.get_text("dict")["blocks"]:
            for ln in blk.get("lines", []):
                if top <= ln["bbox"][1] <= bot and "".join(s["text"] for s in ln["spans"]).strip():
                    xs_l[0 if (not duas or ln["bbox"][0] < dxx) else 1].append(ln["bbox"][0])
        for im in page.get_image_info():
            b = im["bbox"]
            if top <= b[1] <= bot:
                xs_l[0 if (not duas or b[0] < dxx) else 1].append(b[0])
        seps = []
        for im in page.get_image_info():
            b = im["bbox"]
            if (b[3] - b[1]) < 15 and (b[2] - b[0]) > 150:
                seps.append((b[1], b[3], b[0]))
        cols = [(xm, dxx - 2), (dxx + 2, W - xm)] if duas else [(xm, W - xm)]
        for col, (x0, x1) in enumerate(cols):
            if xs_l[col]:  # alinha o recorte pela margem do texto da coluna
                x0 = max(x0, min(xs_l[col]) - 6)
            segs.append({"pno": pno, "col": col, "ncols": len(cols), "rect": pymupdf.Rect(x0, top, x1, bot),
                         "dx": dxx, "seps": [(a, b) for a, b, x in seps if x0 - 5 <= x <= x1]})
    return segs


def _itens(doc, segs, lay):
    """Marcadores, prefácios e fins de seção, em ordem de leitura."""
    rx_m = re.compile(lay["marcador"])
    rx_p = re.compile(lay["prefacio"]) if lay.get("prefacio") else None
    rx_f = re.compile(lay["fim_secao"]) if lay.get("fim_secao") else None
    rx_fp = re.compile(lay["fim_pagina"]) if lay.get("fim_pagina") else None
    pag_seg = {}
    for i, sg in enumerate(segs):
        pag_seg.setdefault(sg["pno"], []).append(i)
    itens, fp_feito = [], set()
    for pno, page in enumerate(doc):
        idxs = pag_seg[pno]
        dx = segs[idxs[0]]["dx"]
        for blk in page.get_text("dict")["blocks"]:
            for ln in blk.get("lines", []):
                t = "".join(s["text"] for s in ln["spans"]).strip()
                x0, y0 = ln["bbox"][0], ln["bbox"][1]
                col = 0 if (len(idxs) == 1 or x0 < dx) else 1
                si = idxs[col]
                if rx_fp and pno not in fp_feito and rx_fp.match(t):
                    fp_feito.add(pno)
                    itens.append({"tipo": "f", "seg": idxs[0], "y": segs[idxs[0]]["rect"].y0})
                    continue
                if not (segs[si]["rect"].y0 - 3 <= y0 <= segs[si]["rect"].y1):
                    continue
                m = rx_m.match(t)
                if m:
                    itens.append({"tipo": "q", "seg": si, "y": y0, "num": int(m.group(1))})
                    continue
                if rx_f and rx_f.match(t):
                    itens.append({"tipo": "f", "seg": si, "y": y0})
                    continue
                if rx_p:
                    mp = rx_p.search(t)
                    if mp:
                        nums = [int(n) for n in re.findall(r"\d+", mp.group(0))]
                        if re.search(r"\d+\s+a\s+\d+", mp.group(0)) and len(nums) == 2:
                            nums = list(range(nums[0], nums[1] + 1))
                        itens.append({"tipo": "p", "seg": si, "y": y0, "nums": nums})
    itens.sort(key=lambda i: (i["seg"], i["y"]))
    return itens


def _corte_antes(seg, y, pad):
    """Y de corte acima de um marcador, subindo se houver separador decorativo logo acima."""
    yc = y - pad
    for a, b in seg["seps"]:
        if y - 45 < a < y:
            yc = min(yc, a - 6)
    return yc


def _pecas(segs, ini, fim, lay):
    """Retângulos (seg, rect) do intervalo ini=(seg,y) -> fim=(seg,y)."""
    pad = lay.get("pad", 3)
    (s0, y0), (s1, y1) = ini, fim
    out = []
    for s in range(s0, s1 + 1):
        r = pymupdf.Rect(segs[s]["rect"])
        if s == s0:
            r.y0 = max(r.y0, y0)
        if s == s1 and y1 is not None:
            r.y1 = min(r.y1, y1)
        if r.height > 6:
            out.append((s, r))
    return out


def _renderizar(page, rect):
    pix = page.get_pixmap(matrix=pymupdf.Matrix(ESCALA, ESCALA), clip=rect, alpha=False)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    g = img.convert("L").point(lambda v: 255 if v < 245 else 0)
    bb = g.getbbox()
    if not bb:
        return None
    pad = int(4 * ESCALA)
    y0, y1 = max(0, bb[1] - pad), min(img.height, bb[3] + pad)
    return img.crop((0, y0, img.width, y1))


def _empilhar(imgs, gap=14):
    W = max(i.width for i in imgs)
    H = sum(i.height for i in imgs) + gap * (len(imgs) - 1)
    out = Image.new("RGB", (W, H), "white")
    y = 0
    for i in imgs:
        out.paste(i, (0, y))
        y += i.height + gap
    return out


def recortar(pdf_path, lay):
    """Retorna lista de dicts: numero, variante, paginas, imagem (PIL), texto."""
    doc = pymupdf.open(pdf_path)
    segs = _segmentos(doc, lay)
    itens = _itens(doc, segs, lay)
    pad = lay.get("pad", 3)
    qs = [i for i in itens if i["tipo"] == "q"]
    resultado, vistos = [], {}
    for idx, it in enumerate(itens):
        if it["tipo"] != "q":
            continue
        seg = segs[it["seg"]]
        ini_y = it["y"] - pad
        for a, b in seg["seps"]:  # separador decorativo logo acima do marcador não entra na questão
            if it["y"] - 45 < a < it["y"] + 2:
                ini_y = max(ini_y, b + 5)
        ini = (it["seg"], ini_y)
        if idx + 1 < len(itens):
            nx = itens[idx + 1]
            fim = (nx["seg"], _corte_antes(segs[nx["seg"]], nx["y"], pad))
        else:  # última questão: só o seu segmento (+ coluna direita se estiver na esquerda)
            fim = (it["seg"] + (1 if seg["col"] == 0 and seg["ncols"] == 2 else 0), None)
        pecas = _pecas(segs, ini, fim, lay)
        # prefácios que cobrem esta questão
        pref = []
        for p in itens:
            if p["tipo"] == "p" and it["num"] in p["nums"]:
                j = itens.index(p)
                nx = itens[j + 1]
                pref += _pecas(segs, (p["seg"], p["y"] - pad),
                               (nx["seg"], _corte_antes(segs[nx["seg"]], nx["y"], pad)), lay)
        imgs, textos, pags = [], [], []
        for s, r in pref + pecas:
            im = _renderizar(doc[segs[s]["pno"]], r)
            if im is not None:
                imgs.append(im)
                textos.append(doc[segs[s]["pno"]].get_text("text", clip=r).strip())
                pags.append(segs[s]["pno"] + 1)
        n = it["num"]
        variante = None
        if lay.get("variantes_ate") and n <= lay["variantes_ate"]:
            k = vistos.get(n, 0)
            variante = ["ingles", "espanhol"][k]
        vistos[n] = vistos.get(n, 0) + 1
        resultado.append({"numero": n, "variante": variante, "paginas": sorted(set(pags)),
                          "imagem": _empilhar(imgs), "texto": "\n".join(textos)})
    return resultado
