"""Leitores de gabarito por banca. Cada função retorna {(numero, variante): letra_ou_'*'}.
'*' = questão anulada."""
import re
import pymupdf


def _tokens(path):
    d = pymupdf.open(path)
    return [t.strip() for p in d for t in p.get_text("text").split("\n") if t.strip()], d


def fuvest(path, prova="S1", total=80):
    """Tabela por versão da prova (S1..S4, V1..V4, V/K/Q/X/Z): linhas com 4 tokens por versão (n, letra, n+metade, letra).
    Confere cada resposta com a página 'Gabarito de correspondência' (a mesma questão nas outras versões)."""
    d = pymupdf.open(path)
    tk = [t.strip() for t in d[0].get_text("text").split("\n") if t.strip()]
    heads = [i for i, t in enumerate(tk) if re.fullmatch(r"PROVA [A-Z]\d?", t)]
    versoes = [tk[i].split()[1] for i in heads]
    nv, meta = len(versoes), total // 2
    assert prova in versoes, (prova, versoes)
    rows = tk[heads[-1] + 1:]
    todas = {v: {} for v in versoes}
    for r in range(meta):
        linha = rows[r * 4 * nv:(r + 1) * 4 * nv]
        assert len(linha) == 4 * nv, ("tabela curta", r)
        for k, v in enumerate(versoes):
            n1, l1, n2, l2 = linha[k * 4:k * 4 + 4]
            assert int(n1) == r + 1 and int(n2) == r + 1 + meta, ("ordem da tabela", v, r, n1, n2)
            todas[v][int(n1)] = l1
            todas[v][int(n2)] = l2
    # conferência com "Gabarito de correspondência": [resposta, nº na versão 1, nº na versão 2, ...] x total
    t2 = [t.strip() for t in d[1].get_text("text").split("\n") if t.strip()]
    h2 = [i for i, t in enumerate(t2) if t.startswith("RESPOSTA PROVA")]
    dados = t2[h2[-1] + 1:]
    grupo = 1 + nv
    assert len(dados) >= total * grupo, ("correspondência curta", len(dados), total * grupo)
    for g in range(total):
        b = dados[g * grupo:(g + 1) * grupo]
        letra = "*" if b[0].startswith("*") else b[0]
        for k, v in enumerate(versoes):
            n = int(b[1 + k])
            assert todas[v][n] == letra, f"FUVEST gabarito diverge versão {v} Q{n}: tabela={todas[v][n]} correspondência={letra}"
    res = {(n, None): l for n, l in todas[prova].items()}
    assert len(res) == total, len(res)
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


def enem_dia2(path, primeira=91, ultima=180):
    """2º dia do ENEM: duas tabelas 'QUESTÃO GABARITO n letra' (91-135 e 136-180)."""
    tk, _ = _tokens(path)
    res = {}
    for k in range(len(tk) - 1):
        if tk[k].isdigit() and primeira <= int(tk[k]) <= ultima and re.fullmatch(r"[A-E*]", tk[k + 1]):
            res[(int(tk[k]), None)] = tk[k + 1]
    assert len(res) == ultima - primeira + 1, len(res)
    return res


def unicamp(path):
    tk, _ = _tokens(path)
    res = {}
    for k in range(len(tk) - 1):
        if re.fullmatch(r"\d{2}", tk[k]) and re.fullmatch(r"[A-E*]", tk[k + 1]):
            res[(int(tk[k]), None)] = tk[k + 1]
    assert len(res) == 72, len(res)
    return res


PARSERS = {"fuvest": fuvest, "enem": enem, "enem_dia2": enem_dia2, "unicamp": unicamp}
