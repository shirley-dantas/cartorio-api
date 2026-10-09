"""Lista, numa linha por questão, o que é preciso para classificar matéria e assunto (id, número e o começo do texto).
Uso: python3 -I scripts/listar_para_classificar.py ID_DA_PROVA [tamanho]   (só questões ainda sem classificação)"""
import os, re, sqlite3, sys
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
con = sqlite3.connect(os.path.join(RAIZ, "data", "acervo.db"))
tam = int(sys.argv[2]) if len(sys.argv) > 2 else 230
for qid, n, v, txt in con.execute("SELECT id,numero,variante,enunciado FROM questoes WHERE fonte_id=? AND materia IS NULL ORDER BY numero, variante", (sys.argv[1],)):
    t = re.sub(r"\s+", " ", re.sub(r"^\s*(\{\d+\}|QUEST[ÃãA]O\s+\d+)", "", txt or "")).replace("¬", "").strip()
    t = re.sub(r"(Texto|TEXTO) (para|PARA) as quest[õÕo]es[^.]{0,30}\.?", "", t)
    print(f"{n}{'-'+v[:2] if v else ''}|{t[:tam]}")
