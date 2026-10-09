"""Leitores de gabarito por banca. Cada função retorna {(numero, variante): letra_ou_'*'}.
'*' = questão anulada."""
import re
import pymupdf


def _tokens(path):
    d = pymupdf.open(path)
    return [t.strip() for p in d for t in p.get_text("text").split("\n") if t.strip()], d


def fuvest(path, prova="S1"):
    """Tabela por prova (S1..S4): linhas de 16 tokens; confere com a página de correspondência."""
    d = pymupdf.open(path)
    tk = [t.strip() for t in d[0].get_text("text").split("\n") if t.strip()]
    i = tk.index("PROVA S4") + 1
    rows = tk[i:]
    col = {"S1": 0, "S2": 1, "S3": 2, "S4": 3}[prova]
    res = {}
    for r in range(0, len(rows) - 15, 16):
        blk = rows[r:r + 16][col * 4:col * 4 + 4]
        for n, l in ((blk[0], blk[1]), (blk[2], blk[3])):
            res[(int(n), None)] = l
    # conferência com "Gabarito de correspondência"
    t2 = [t.strip() for t in d[1].get_text("text").split("\n") if t.strip()]
    tt = [t for t in t2[5:] if "PROVA" not in t]
    cor = {}
    for k in range(0, len(tt) - 9, 10):
        for off in (0, 5):
            b = tt[k + off:k + off + 5]
            if len(b) == 5 and b[1].isdigit():
                cor[int(b[1 + col])] = "*" if b[0].startswith("*") else b[0]
    assert len(cor) == 80, len(cor)
    for n, l in res.items():
        c = cor[n[0]]
        assert c == l, f"FUVEST gabarito diverge Q{n[0]}: tabela={l} correspondência={c}"
    assert len(res) == 80, len(res)
    return res


def enem(path):
    """Caderno 2: 1-5 = inglês/espanhol (3 tokens), 6-45 Linguagens, 46-90 Humanas (2 tokens)."""
    tk, _ = _tokens(path)
    # bloco Humanas vem primeiro (46..90), depois Linguagens
    res = {}
    i = tk.index("GABARITO") + 1
    while i + 1 < len(tk) and tk[i].isdigit() and 46 <= int(tk[i]) <= 90:
        res[(int(tk[i]), None)] = tk[i + 1]
        i += 2
    j = tk.index("ESPANHOL") + 1
    while j < len(tk) and tk[j].isdigit() and int(tk[j]) <= 45:
        n = int(tk[j])
        if n <= 5:
            res[(n, "ingles")] = tk[j + 1]
            res[(n, "espanhol")] = tk[j + 2]
            j += 3
        else:
            res[(n, None)] = tk[j + 1]
            j += 2
    assert len(res) == 90 + 5, len(res)
    return res


def unicamp(path):
    tk, _ = _tokens(path)
    res = {}
    for k in range(len(tk) - 1):
        if re.fullmatch(r"\d{2}", tk[k]) and re.fullmatch(r"[A-E*]", tk[k + 1]):
            res[(int(tk[k]), None)] = tk[k + 1]
    assert len(res) == 72, len(res)
    return res


PARSERS = {"fuvest": fuvest, "enem": enem, "unicamp": unicamp}
