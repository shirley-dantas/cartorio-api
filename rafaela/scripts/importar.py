"""Importa provas para o acervo (idempotente).
Uso: python3 scripts/importar.py            -> importa só o que ainda não foi processado
     python3 scripts/importar.py --refazer  -> reprocessa tudo
Cada prova nova = uma entrada em fontes.json (pdf + gabarito). Nada é duplicado (sha256)."""
import hashlib, json, os, sqlite3, sys
sys.path.insert(0, os.path.dirname(__file__))
from recortar import recortar
from gabaritos import PARSERS

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(RAIZ, "data", "acervo.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS fontes(id TEXT PRIMARY KEY, banca TEXT, ano INT, edicao TEXT, prova TEXT,
  pdf TEXT, gabarito_pdf TEXT, sha_pdf TEXT, sha_gab TEXT, n_questoes INT, importado_em TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS questoes(id TEXT PRIMARY KEY, fonte_id TEXT, banca TEXT, ano INT, edicao TEXT, prova TEXT,
  numero INT, variante TEXT, materia TEXT, subtema TEXT, tags TEXT, enunciado TEXT, imagem TEXT, pagina TEXT,
  resposta TEXT, anulada INT DEFAULT 0, pdf_origem TEXT);
"""


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def main(refazer=False):
    cfg = json.load(open(os.path.join(RAIZ, "fontes.json")))
    con = sqlite3.connect(DB)
    con.executescript(SCHEMA)
    img_cfg = cfg.get("imagem", {"qualidade": 82, "metodo": 4})
    for f in cfg["provas"]:
        pdf = os.path.join(RAIZ, f["pdf"])
        gab = os.path.join(RAIZ, f["gabarito"]) if f.get("gabarito") else None  # prova sem gabarito (UNICAMP 2023): entra sem resposta
        if not os.path.exists(pdf):
            print("PDF ausente, pulando (já está no painel):", f["id"]); continue
        s1, s2 = sha(pdf), (sha(gab) if gab else "")
        ja = con.execute("SELECT 1 FROM fontes WHERE sha_pdf=? AND sha_gab=?", (s1, s2)).fetchone()
        if ja and not refazer:
            print("já importada, pulando:", f["id"]); continue
        con.execute("DELETE FROM questoes WHERE fonte_id=?", (f["id"],))
        con.execute("DELETE FROM fontes WHERE id=?", (f["id"],))
        gabarito = PARSERS[f.get("gabarito_parser", f["banca"])](gab, **f.get("gab_args", {})) if gab else None
        lay = dict(cfg["bancas"][f["banca"]]["layout"]); lay.update(f.get("layout", {}))  # cada prova pode ajustar o layout da banca
        qs = recortar(pdf, lay)
        if f.get("esperadas"):
            assert len(qs) == f["esperadas"], f"{f['id']}: {len(qs)} questões recortadas, esperava {f['esperadas']}"
        pasta = os.path.join(RAIZ, "img", f["banca"], f["id"])
        os.makedirs(pasta, exist_ok=True)
        vistos = set()
        for q in qs:
            n, v = q["numero"], q["variante"]
            assert (n, v) not in vistos, f"duplicada {n} {v}"
            vistos.add((n, v))
            resp = gabarito[(n, v)] if gabarito else None
            qid = f"{f['id']}-q{n:02d}" + (f"-{v}" if v else "")
            rel = f"img/{f['banca']}/{f['id']}/{qid}.webp"
            if img_cfg.get("sem_perdas"):
                q["imagem"].save(os.path.join(RAIZ, rel), "WEBP", lossless=True, quality=100, method=6)
            else:  # com perdas quase invisíveis em texto: 3 a 4 vezes menor, e o painel carrega no tablet
                q["imagem"].save(os.path.join(RAIZ, rel), "WEBP", quality=img_cfg["qualidade"], method=img_cfg["metodo"])
            con.execute("INSERT INTO questoes(id,fonte_id,banca,ano,edicao,prova,numero,variante,enunciado,imagem,pagina,resposta,anulada,pdf_origem)"
                        " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (qid, f["id"], f["banca"], f["ano"], f["edicao"], f["prova"], n, v, q["texto"], rel,
                         ",".join(map(str, q["paginas"])), resp, int(resp == "*"), f["pdf"]))
        if gabarito:
            assert set(gabarito) == vistos, ("gabarito x questões", set(gabarito) ^ vistos)
        con.execute("INSERT INTO fontes(id,banca,ano,edicao,prova,pdf,gabarito_pdf,sha_pdf,sha_gab,n_questoes) VALUES(?,?,?,?,?,?,?,?,?,?)",
                    (f["id"], f["banca"], f["ano"], f["edicao"], f["prova"], f["pdf"], f["gabarito"], s1, s2, len(qs)))
        con.commit()
        print("importada:", f["id"], len(qs), "questões")
    con.close()


if __name__ == "__main__":
    main("--refazer" in sys.argv)
