"""Gera painel/data.json e painel/q/<id>.webp (uma imagem por questão) a partir do banco. Rode após importar/classificar.
Cada imagem é um arquivo à parte: o navegador baixa só as questões que aparecem na tela (antes eram pacotes de 9 MB)."""
import io, json, os, re, shutil, sqlite3
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(R, "painel")
Q = os.path.join(D, "q")
shutil.rmtree(Q, ignore_errors=True); os.makedirs(Q)
shutil.rmtree(os.path.join(D, "packs"), ignore_errors=True)  # formato antigo, não é mais usado
cfg = json.load(open(os.path.join(R, "fontes.json")))
con = sqlite3.connect(os.path.join(R, "data", "acervo.db")); con.row_factory = sqlite3.Row
qs = []
for r in con.execute("SELECT * FROM questoes ORDER BY banca, ano, fonte_id, numero, variante"):
    origem = os.path.join(R, r["imagem"])
    w, h = Image.open(origem).size
    shutil.copyfile(origem, os.path.join(Q, r["id"] + ".webp"))
    txt = re.sub(r"\s+", " ", re.sub(r"^\s*(\{\d+\}|QUEST[ÃãA]O\s+\d+)", "", r["enunciado"] or "")).strip()
    qs.append({"id": r["id"], "b": r["banca"], "a": r["ano"], "f": r["fonte_id"], "n": r["numero"], "v": r["variante"],
               "m": r["materia"], "s": r["subtema"], "t": json.loads(r["tags"] or "[]"), "r": r["resposta"], "x": r["anulada"],
               "u": f"q/{r['id']}.webp", "w": w, "h": h, "tx": txt})
fontes = [dict(r) for r in con.execute("SELECT id,banca,ano,edicao,prova,n_questoes FROM fontes ORDER BY banca, ano, id")]
bancas = [{"id": i, "nome": b["nome"], "alts": b.get("alternativas", 5), "cor": b.get("cor", "#555")} for i, b in cfg["bancas"].items()]
json.dump({"bancas": bancas, "fontes": fontes, "q": qs}, open(os.path.join(D, "data.json"), "w"), ensure_ascii=False, separators=(",", ":"))
tam = sum(os.path.getsize(os.path.join(Q, f)) for f in os.listdir(Q))
print(len(qs), "questões;", len(os.listdir(Q)), "imagens;", tam // 10**6, "MB")
