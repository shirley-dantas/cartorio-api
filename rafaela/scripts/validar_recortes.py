"""Conferência dos recortes de uma prova: cada questão traz todas as alternativas e nenhum pedaço de outra questão.
Uso: python3 -I scripts/validar_recortes.py ID_DA_PROVA [...]"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
import recortar as R
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.load(open(os.path.join(RAIZ, "fontes.json")))
for pid in sys.argv[1:]:
    f = next(p for p in cfg["provas"] if p["id"] == pid)
    lay = dict(cfg["bancas"][f["banca"]]["layout"]); lay.update(f.get("layout", {}))
    qs = R.recortar(os.path.join(RAIZ, f["pdf"]), lay)
    nalt = cfg["bancas"][f["banca"]].get("alternativas", 5)
    ruins = []
    for q in qs:
        t = q["texto"]; n = q["numero"]
        letras = "ABCDE"[:nalt]
        if f["banca"] == "unicamp":
            falta = [l for l in letras.lower() if not re.search(r"(^|\n)\s*" + l + r"\)", t)]
        elif f["banca"] == "fuvest":
            falta = [l for l in letras if not re.search(r"(^|\n)\s*\(?" + l + r"\)", t)]
        else:
            falta = [l for l in letras if not re.search(r"(^|\n)\s*" + l + r"[\s\t]", t) and not re.search(r"(^|\n)\s*" + l + r"\s*$", t, re.M)]
        if f["banca"] == "fuvest": outros = {int(x) for x in re.findall(r"\{(\d{1,2})\}", t)} - {n}
        elif f["banca"] in ("enem", "unicamp"): outros = {int(x) for x in re.findall(r"QUEST[ãÃA]O\s+(\d{1,3})", t)} - {n}
        else: outros = set()
        if f["id"] == "fuvest-2024-1fase-k": outros = set()
        if falta or outros:
            ruins.append((n, q["variante"], "faltam alternativas " + ",".join(falta) if falta else "", "traz marcador de " + ",".join(map(str, sorted(outros))) if outros else ""))
    cortes = sorted({(n, p, w) for n, p, w in R.CORTES})
    R.CORTES.clear()
    print(f"{pid}: {len(qs)} questões, {len(ruins)} com problema, {len(cortes)} cortes de borda")
    for n, p, w in cortes: print("    borda: questão", n, "pág", p, w)
    for r in ruins: print("   ", *r)
