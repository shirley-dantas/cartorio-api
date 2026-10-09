"""Confere o recorte de uma prova sem gravar nada: quais números achou, o que falta, o que sobrou, e salva uma folha de contato.
Uso: python3 -I scripts/testar_recorte.py ID_DA_PROVA [pasta_de_saida]"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import recortar as R
from recortar import recortar
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.load(open(os.path.join(RAIZ, "fontes.json")))
f = next(p for p in cfg["provas"] if p["id"] == sys.argv[1])
lay = dict(cfg["bancas"][f["banca"]]["layout"]); lay.update(f.get("layout", {}))
qs = recortar(os.path.join(RAIZ, f["pdf"]), lay)
nums = [(q["numero"], q["variante"]) for q in qs]
achou = sorted(n for n, v in nums)
print(f["id"], "questões:", len(qs), "| esperadas:", f.get("esperadas"))
dup = sorted({n for n in achou if achou.count(n) > 1 and not (f["banca"] == "enem" and n <= 5)})
if dup: print("  repetidas:", dup)
if f["banca"] == "enem" and f["ano"] and "d2" in f["id"]: esp = set(range(91, 181))
elif f["banca"] == "enem": esp = set(range(1, 91))
else: esp = set(range(1, (f.get("esperadas") or 0) + 1))
print("  recorte vazio:", sorted(R.VAZIAS))
print("  faltam:", sorted(esp - set(achou)), "| sobram:", sorted(set(achou) - esp))
if len(sys.argv) > 2:
    out = sys.argv[2]; os.makedirs(out, exist_ok=True)
    for q in qs: q["imagem"].save(os.path.join(out, f"q{q['numero']:02d}{'-' + q['variante'] if q['variante'] else ''}.png"))
    alt = [q["imagem"].height for q in qs]
    print("  altura média px:", sum(alt) // max(1, len(alt)), "| menores:", sorted(alt)[:3], "| maiores:", sorted(alt)[-3:])
