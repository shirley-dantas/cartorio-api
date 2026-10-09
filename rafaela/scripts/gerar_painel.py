"""Gera painel/data.json + painel/packs (imagens em base64, em lotes <= 9 MB). Rode após importar/classificar."""
import base64, io, json, os, re, sqlite3, shutil
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(R, "painel")
shutil.rmtree(os.path.join(D, "packs"), ignore_errors=True); os.makedirs(os.path.join(D, "packs"))
cfg = json.load(open(os.path.join(R, "fontes.json")))
con = sqlite3.connect(os.path.join(R, "data", "acervo.db")); con.row_factory = sqlite3.Row
LIM = 9_000_000
packs, cur, curname, k = {}, [], None, 0
def novo():
    global cur, curname, k
    flush(); k += 1; curname = f"packs/p{k:02d}.txt"; cur = []
def flush():
    if cur: open(os.path.join(D, curname), "w").write("".join(cur))
off = 0; novo(); size = 0
qs = []
for r in con.execute("SELECT * FROM questoes ORDER BY banca, ano, fonte_id, numero, variante"):
    raw = open(os.path.join(R, r["imagem"]), "rb").read()
    w, h = Image.open(io.BytesIO(raw)).size
    b64 = base64.b64encode(raw).decode()
    if size + len(b64) > LIM: novo(); size = 0
    cur.append(b64)
    txt = re.sub(r"\s+", " ", re.sub(r"^\s*(\{\d+\}|QUEST[ÃãA]O\s+\d+)", "", r["enunciado"] or "")).strip()
    qs.append({"id": r["id"], "b": r["banca"], "a": r["ano"], "f": r["fonte_id"], "n": r["numero"], "v": r["variante"],
               "m": r["materia"], "s": r["subtema"], "t": json.loads(r["tags"] or "[]"), "r": r["resposta"], "x": r["anulada"],
               "k": [curname, size, len(b64)], "w": w, "h": h, "tx": txt})
    size += len(b64)
flush()
fontes = [dict(r) for r in con.execute("SELECT id,banca,ano,edicao,prova,n_questoes FROM fontes ORDER BY banca, ano, id")]
bancas = [{"id": i, "nome": b["nome"], "alts": b.get("alternativas", 5), "cor": b.get("cor", "#555")} for i, b in cfg["bancas"].items()]
json.dump({"bancas": bancas, "fontes": fontes, "q": qs}, open(os.path.join(D, "data.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print(len(qs), "questões;", len(os.listdir(os.path.join(D, "packs"))), "packs;", sum(os.path.getsize(os.path.join(D, "packs", f)) for f in os.listdir(os.path.join(D, "packs")))//10**6, "MB")
