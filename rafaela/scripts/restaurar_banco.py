"""Recria data/acervo.db e img/ a partir do que já está publicado em painel/ (data.json + imagens).
Serve para quem não tem o banco (ele não vai para o repositório): sem isso, só dá para acrescentar provas
novas depois de refazer o que já existia. Rode UMA vez, antes de importar/gerar. Idempotente.
Uso: python3 -I scripts/restaurar_banco.py"""
import base64, json, os, shutil, sqlite3
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAINEL = os.path.join(RAIZ, "painel")
os.makedirs(os.path.join(RAIZ, "data"), exist_ok=True)
sys_path = os.path.dirname(os.path.abspath(__file__))
import sys; sys.path.insert(0, sys_path)
from importar import SCHEMA
d = json.load(open(os.path.join(PAINEL, "data.json")))
con = sqlite3.connect(os.path.join(RAIZ, "data", "acervo.db"))
con.executescript(SCHEMA)
packs = {}
def pack(nome):
    if nome not in packs:
        packs[nome] = open(os.path.join(PAINEL, nome)).read()
    return packs[nome]
fontes = {f["id"]: f for f in d["fontes"]}
for f in d["fontes"]:
    if con.execute("SELECT 1 FROM fontes WHERE id=?", (f["id"],)).fetchone():
        continue
    con.execute("INSERT INTO fontes(id,banca,ano,edicao,prova,pdf,gabarito_pdf,sha_pdf,sha_gab,n_questoes) VALUES(?,?,?,?,?,?,?,?,?,?)",
                (f["id"], f["banca"], f["ano"], f["edicao"], f["prova"], "", "", "", "", f["n_questoes"]))
n = 0
for q in d["q"]:
    if con.execute("SELECT 1 FROM questoes WHERE id=?", (q["id"],)).fetchone():
        continue
    f = fontes[q["f"]]
    rel = f"img/{q['b']}/{q['f']}/{q['id']}.webp"
    dest = os.path.join(RAIZ, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if q.get("u"):
        shutil.copyfile(os.path.join(PAINEL, q["u"]), dest)
    else:  # pacote antigo: a imagem está em base64 dentro do pack
        nome, ini, tam = q["k"]
        open(dest, "wb").write(base64.b64decode(pack(nome)[ini:ini + tam]))
    con.execute("INSERT INTO questoes(id,fonte_id,banca,ano,edicao,prova,numero,variante,materia,subtema,tags,enunciado,imagem,pagina,resposta,anulada,pdf_origem)"
                " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (q["id"], q["f"], q["b"], q["a"], f["edicao"], f["prova"], q["n"], q.get("v"), q["m"], q["s"],
                 json.dumps(q.get("t", []), ensure_ascii=False), q.get("tx", ""), rel, "", q.get("r"), int(bool(q.get("x"))), ""))
    n += 1
con.commit()
print("restauradas", n, "questões;", con.execute("SELECT count(*) FROM questoes").fetchone()[0], "no banco")
