"""Aplica classificacao/*.json ao banco (matéria, subtema, tags). Pode rodar quantas vezes quiser."""
import glob, json, os, sqlite3
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
con = sqlite3.connect(os.path.join(R, "data", "acervo.db"))
n = 0
for p in glob.glob(os.path.join(R, "classificacao", "*.json")):
    for qid, c in json.load(open(p)).items():
        n += con.execute("UPDATE questoes SET materia=?, subtema=?, tags=? WHERE id=?",
                         (c["materia"], c["subtema"], json.dumps(c.get("tags", []), ensure_ascii=False), qid)).rowcount
con.commit()
sem = con.execute("SELECT count(*) FROM questoes WHERE materia IS NULL").fetchone()[0]
print("classificadas:", n, "| sem classificação:", sem)
