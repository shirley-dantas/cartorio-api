const https = require("https");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Só lê .docx agora (campo textoBruto). PDF e imagem passavam por aqui até
// 09/09/2026, mas a leitura visual de um documento com muitas páginas passa
// dos 60s de teto da Vercel (plano Hobby) — foi o que derrubou vários
// anexos em produção com HTTP 504. Esse caminho foi movido pro Apps Script
// (ação "extrair-texto-arquivo" em cartorio-drive-api.js), que roda até 6
// minutos por chamada — ver extrairArquivo no index.html.

// Teto de saída de CADA chamada. O corte de 1.024 tokens de antes era o
// resumo virar o único material que a IA da minuta via — a matrícula, o RG,
// a certidão nunca eram lidos de verdade.
const EXTRACAO_MAX_TOKENS = 8000;
// Quantas chamadas no máximo, quando uma sozinha não basta. Documento comum
// de cartório nunca chega perto disso — é um teto de segurança, não o
// tamanho esperado.
const EXTRACAO_MAX_PASSADAS = 4;

// Uma chamada crua à API, sem continuação. Devolve {texto, truncou} —
// truncou=true quando a resposta bateu no teto de tokens desta chamada
// (stop_reason==="max_tokens").
function chamarClaudeMensagem(content) {
  const body = JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: EXTRACAO_MAX_TOKENS,
    messages: [{ role: "user", content }]
  });
  return new Promise((resolve) => {
    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({ texto: json?.content?.[0]?.text || null, truncou: json?.stop_reason === "max_tokens" });
        }
        catch { resolve({ texto: null, truncou: false }); }
      });
    });
    req.on("error", () => resolve({ texto: null, truncou: false }));
    req.write(body);
    req.end();
  });
}

function unirTexto(a, b) {
  if (!a) return b || "";
  if (!b) return a;
  const precisaEspaco = !/\s/.test(a.slice(-1)) && !/\s/.test(b.slice(0, 1));
  return a + (precisaEspaco ? " " : "") + b;
}

// Instrução da continuação — mesmo mecanismo já usado na geração da minuta
// (gerarMinutaCompleta, no Apps Script): manda de novo o documento, mas pede
// pra continuar exatamente de onde a extração parou, em vez de recomeçar.
function instrucaoContinuar(trechoFinal) {
  return "Você já extraiu/transcreveu o trecho abaixo a partir deste MESMO documento (é a mesma extração continuando — não é um novo pedido, e não repita os campos TIPO_DOCUMENTO/NOME_PESSOA já identificados no início, se houver). NÃO repita esse trecho — continue EXATAMENTE de onde ele parou, sem reintroduções.\n\nTRECHO JÁ ESCRITO (final dele):\n..." + trechoFinal + "\n\nCONTINUE A PARTIR DAQUI:";
}

// Chama `montarConteudo(pass, textoAcumulado)` repetidamente enquanto a
// resposta bater no teto de tokens, até completar (ou até esgotar
// EXTRACAO_MAX_PASSADAS — nesse caso raro, `truncou` continua true e quem
// chamou precisa saber, nunca em silêncio). Um documento comprido não trava
// mais no primeiro corte: ele continua sendo lido em pedaços.
async function extrairComContinuacao(montarConteudo) {
  let texto = "";
  let truncou = false;
  for (let i = 0; i < EXTRACAO_MAX_PASSADAS; i++) {
    const r = await chamarClaudeMensagem(montarConteudo(i, texto));
    // Falha na chamada (rede, parse): para aqui, mas mantém o que já tem e o
    // estado de truncou da rodada anterior — uma continuação que falhou não
    // apaga o que sabíamos (que o texto tinha ficado incompleto).
    if (!r.texto) break;
    texto = unirTexto(texto, r.texto);
    truncou = r.truncou;
    if (!truncou) break;
  }
  return { texto: texto || null, truncou };
}

// Extração jurídica objetiva, a partir de texto puro (usado depois do
// mammoth ler um .docx no navegador). Devolve {texto, truncou}.
function chamarClaudeTexto(textoBruto) {
  const instrucaoInicial = `Na primeira linha da resposta, identifique em poucas palavras o TIPO deste documento (ex: RG, CNH, Certidão de Nascimento, Certidão de Casamento, Certidão de Óbito, Matrícula do Imóvel, IPTU, Comprovante de Residência, Procuração, Contrato Social, Extrato Bancário, Guia de ITBI, Guia de ITCMD, etc.), no formato exato: "TIPO_DOCUMENTO: <tipo>". Depois, numa nova linha, transcreva com fidelidade as informações jurídicas relevantes deste documento: partes (nome, CPF, RG, estado civil, endereço), dados do imóvel (matrícula, endereço, área), valores, datas e qualquer dado importante para elaboração de minuta notarial. Não resuma nem selecione o que parece mais relevante — transcreva tudo que encontrar.\n\nDOCUMENTO:\n${textoBruto}`;

  return extrairComContinuacao((pass, textoAteAqui) =>
    pass === 0 ? instrucaoInicial : `${instrucaoContinuar(textoAteAqui.slice(-1500))}\n\nDOCUMENTO (o mesmo de antes, para referência):\n${textoBruto}`
  );
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });

  let dados;
  try { dados = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ ok: false, erro: "JSON inválido" }); }

  // O .docx já foi lido no navegador (mammoth.browser) — só o texto (bem
  // menor que o arquivo original) chega aqui pra passar pela extração
  // jurídica objetiva.
  if (dados.textoBruto) {
    try {
      const extraido = await chamarClaudeTexto(dados.textoBruto);
      return res.status(200).json({ ok: true, texto: extraido.texto || dados.textoBruto, truncou: extraido.truncou });
    } catch (err) {
      return res.status(500).json({ ok: false, erro: err.message });
    }
  }

  return res.status(400).json({ ok: false, erro: "Faltou o texto (campo textoBruto) — este endpoint só lê .docx. PDF e imagem passam pelo Apps Script." });
};
