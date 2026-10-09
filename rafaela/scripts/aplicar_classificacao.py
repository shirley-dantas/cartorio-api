"""Grava classificacao/<prova>.json a partir de linhas 'numero|Matéria|Subtema|tag1,tag2' lidas da entrada padrão.
Para o ENEM, questões 1-5 têm variante: '1-in' (inglês) e '1-es' (espanhol).
Confere que toda questão da prova foi classificada, uma vez, com matéria conhecida.
Uso: python3 -I scripts/aplicar_classificacao.py ID_DA_PROVA < arquivo"""
import json, os, sqlite3, sys
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MATERIAS = {"Matemática", "Física", "Química", "Biologia", "Português", "Literatura", "História", "Geografia", "Filosofia", "Sociologia", "Inglês", "Espanhol", "Artes", "Educação Física"}
pid = sys.argv[1]
con = sqlite3.connect(os.path.join(RAIZ, "data", "acervo.db"))
ids = {}
for qid, n, v in con.execute("SELECT id,numero,variante FROM questoes WHERE fonte_id=?", (pid,)):
    ids[(n, (v or "")[:2])] = qid
out, vistos = {}, set()
for ln in sys.stdin:
    ln = ln.strip()
    if not ln or ln.startswith("#"):
        continue
    p = [x.strip() for x in ln.split("|")]
    assert len(p) >= 3, ("linha incompleta", ln)
    chave = p[0]
    n, v = (int(chave.split("-")[0]), chave.split("-")[1]) if "-" in chave else (int(chave), "")
    assert (n, v) in ids, ("questão inexistente", ln)
    assert (n, v) not in vistos, ("repetida", ln)
    assert p[1] in MATERIAS, ("matéria desconhecida", ln)
    vistos.add((n, v))
    tags = [t.strip() for t in p[3].split(",") if t.strip()] if len(p) > 3 else []
    assert all(t in MATERIAS or t for t in tags)
    out[ids[(n, v)]] = {"materia": p[1], "subtema": p[2], "tags": tags}
falta = sorted(set(ids) - vistos)
assert not falta, ("sem classificação:", falta)
json.dump(out, open(os.path.join(RAIZ, "classificacao", pid + ".json"), "w"), ensure_ascii=False, indent=0)
print(pid, len(out), "questões classificadas")
