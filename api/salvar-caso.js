const https = require("https");

// ══ CONFIGURAÇÕES ══════════════════════════════════════════════
const EVOLUTION_INSTANCE = "escritorio";
const EVOLUTION_API_KEY  = "escritorio@2025#EvAPI";
const EVOLUTION_HOST     = "evolution-api-production-59b1.up.railway.app";
const FIREBASE_HOST      = "painel-cartorio-default-rtdb.firebaseio.com";
const DRIVE_URL          = "https://script.google.com/macros/s/AKfycbz6NoiizP5ThvPWZ1ZZ_HAvJworawPrmfzCAXyCfY2n9oB8Qx4oFfYw0trGgm5liXHY/exec";
const NUMERO_OPERACIONAL = "5511947851816";
const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY;
// ═══════════════════════════════════════════════════════════════

function detectarModalidade(texto) {
  const t = (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/hibrida|hibrido|videoconferencia.*presencial|presencial.*videoconferencia/.test(t)) return "hibrida";
  if (/presencial/.test(t)) return "presencial";
  return "digital"; // padrão
}

function classificarServico(texto) {
  const t = (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/inventario|espolio|faleceu|falecimento|heranca|herdeiro|partilha|sobrepartilha/.test(t)) return "Inventário";
  if (/compra|venda|escritura|imovel|apartamento|terreno|casa/.test(t)) return "Escritura de Compra e Venda";
  if (/procuracao|procurador/.test(t)) return "Procuração";
  if (/uniao estavel|convivencia|companheiro|companheira/.test(t)) return "União Estável";
  if (/divorcio|separacao|dissolucao/.test(t)) return "Divórcio";
  if (/ata notarial|ata de/.test(t)) return "Ata Notarial";
  if (/doacao|doou|doar/.test(t)) return "Doação";
  if (/cessao|direitos hereditarios|ceder direitos/.test(t)) return "Cessão de Direitos";
  if (/pacto|antenupcial/.test(t)) return "Pacto Antenupcial";
  if (/testamento/.test(t)) return "Testamento";
  if (/reconhecimento de firma|reconhecer firma|firma/.test(t)) return "Reconhecimento de Firma";
  if (/autenticacao|autenticar|copia autenticada/.test(t)) return "Autenticação";
  if (/renuncia|renunciar|renunciante/.test(t)) return "Renúncia";
  if (/dacao|dacao em pagamento/.test(t)) return "Dação em Pagamento";
  if (/alienacao fiduciaria/.test(t)) return "Alienação Fiduciária";
  if (/usucapiao/.test(t)) return "Usucapião";
  if (/regularizacao/.test(t)) return "Regularização Imobiliária";
  return "A classificar";
}

function classificarUrgencia(texto) {
  const t = (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const alta  = ["urgente","urgencia","hoje","agora","imediato","imediata","amanha","prazo","vencendo","vencido","vence","emergencia","rapido","rapida","preciso ja","preciso hoje"];
  const baixa = ["quando puder","sem pressa","consulta","informacao","quanto custa","valor","preco","tabela","gostaria de saber","quero saber"];
  const a = alta.find(p => t.includes(p));
  if (a) return { status: "critico", motivo: `Urgência alta: "${a}"` };
  const b = baixa.find(p => t.includes(p));
  if (b) return { status: "emdia", motivo: `Consulta/informação: "${b}"` };
  return { status: "atencao", motivo: "Urgência padrão" };
}

function httpReq(url, method, body, headers = {}) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = { method, headers: { "Content-Type": "application/json", ...headers } };
    if (payload) options.headers["Content-Length"] = Buffer.byteLength(payload);
    const r = https.request(url, options, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    r.on("error", () => resolve(null));
    if (payload) r.write(payload);
    r.end();
  });
}

async function getSessao() {
  return httpReq(`https://${FIREBASE_HOST}/sessao_ativa.json`, "GET");
}
async function setSessao(sessao) {
  return httpReq(`https://${FIREBASE_HOST}/sessao_ativa.json`, "PUT", sessao);
}
async function clearSessao() {
  return httpReq(`https://${FIREBASE_HOST}/sessao_ativa.json`, "DELETE");
}
async function buscarCasoPorNome(texto) {
  const data = await httpReq(`https://${FIREBASE_HOST}/casos.json`, "GET");
  if (!data || typeof data !== "object") return null;
  const norm = texto.toLowerCase().trim();
  const entrada = Object.entries(data).find(([, c]) =>
    c && !c.concluido && c.nome && c.nome.toLowerCase().includes(norm)
  );
  if (!entrada) return null;
  return { ...entrada[1], id: entrada[0] };
}
async function baixarMidia(dadosEvt) {
  return httpReq(
    `https://${EVOLUTION_HOST}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`,
    "POST",
    { message: dadosEvt, convertToMp4: false },
    { apikey: EVOLUTION_API_KEY }
  );
}
async function salvarNoDrive(nome, nomeArquivo, base64, mimetype) {
  return httpReq(DRIVE_URL, "POST", { acao: "salvar-arquivo", nome, nomeArquivo, base64, mimetype });
}
async function criarPastaDrive(nome, tipo) {
  return httpReq(DRIVE_URL, "POST", { acao: "criar-pasta", nome, tipo });
}

// ══ GERAÇÃO AUTOMÁTICA DE MINUTA ════════════════════════════════

const SYSTEM_PROMPT_MINUTA = `Você é o Assistente Jurídico-Cartorário do 20º Cartório de Notas de São Paulo.

Ao analisar um caso, você simula simultaneamente o trabalho de um Registrador de Imóveis, Tabelião de Notas, Escrevente altamente qualificado e Analista Documental Imobiliário.

Gere a minuta notarial completa e profissional do ato, no padrão de escritura pública brasileira, realizando análise documental completa com todos os apontamentos necessários.

REGRAS FUNDAMENTAIS:
- Nunca assuma informações inexistentes
- Nunca preencha lacunas sem evidência documental
- Preencha todos os campos que tiverem informação disponível
- Campos desconhecidos: use apenas traços: ______
- NÃO use colchetes ou texto descritivo para campos em branco — apenas ______

NOMENCLATURA DAS PARTES (use sempre a correta para o ato):
- Compra e Venda: VENDEDOR(A) e COMPRADOR(A)
- Doação: DOADOR(A) e DONATÁRIO(A)
- Procuração: OUTORGANTE e OUTORGADO(A)
- Inventário: INVENTARIANTE, HERDEIRO(A), VIÚVO(A) MEEIRO(A)
- Divórcio: PRIMEIRO(A) DIVORCIANDO(A) e SEGUNDO(A) DIVORCIANDO(A)
- União Estável: PRIMEIRO(A) COMPANHEIRO(A) e SEGUNDO(A) COMPANHEIRO(A)
- Cessão: CEDENTE e CESSIONÁRIO(A)
- Renúncia: RENUNCIANTE
- Dação em Pagamento: DEVEDOR(A) e CREDOR(A)
- Ata Notarial: REQUERENTE
- Anuência conjugal: ANUENTE

FORMATAÇÃO:
- Use **negrito** para: título, nomes das partes, CPF, RG, matrícula, valores, datas e informações de destaque
- NÃO deixe linhas em branco entre parágrafos
- Use # para título principal e ## para seções/cláusulas
- Pendências: insira 【PENDÊNCIA: descrição objetiva】 imediatamente após o trecho afetado

ABERTURA DA MINUTA (escolha conforme MODALIDADE):

Se DIGITAL:
Aos ______ (______) dias do mês de ______ (______) do ano de dois mil e vinte e seis (2026), nesta cidade e Capital do Estado de São Paulo, República Federativa do Brasil, perante mim, **Shirley Dantas da Silva**, Escrevente autorizada do **20º Tabelião de Notas** desta Capital, compareceram partes entre si, por meio de **VIDEOCONFERÊNCIA**, nos termos do **Provimento nº 149/2023** do Conselho Nacional de Justiça, cujas identidades foram por mim confirmadas, conforme os documentos abaixo mencionados, a mim apresentados, corroborados por sua declaração justas e contratadas, a saber:

Se HÍBRIDA:
Aos ______ (______) dias do mês de ______ (______) do ano de dois mil e vinte e seis (2026), nesta cidade e Capital do Estado de São Paulo, República Federativa do Brasil, perante mim, **Shirley Dantas da Silva**, Escrevente autorizada do **20º Tabelião de Notas** desta Capital, compareceram partes entre si, por meio de **VIDEOCONFERÊNCIA**, e **PRESENCIALMENTE** nos termos do **Provimento nº 149/2023** do Conselho Nacional de Justiça, cujas identidades foram por mim confirmadas, conforme os documentos abaixo mencionados, a mim apresentados, corroborados por sua declaração justas e contratadas, a saber:

Se PRESENCIAL:
Aos ______ (______) dias do mês de ______ (______) do ano de dois mil e vinte e seis (2026), nesta cidade e Capital do Estado de São Paulo, República Federativa do Brasil, perante mim, **Shirley Dantas da Silva**, Escrevente autorizada do **20º Tabelião de Notas** desta Capital, compareceram partes entre si, cujas identidades foram por mim confirmadas, conforme os documentos abaixo mencionados, a mim apresentados, corroborados por sua declaração justas e contratadas, a saber:

ENCERRAMENTO (escolha conforme MODALIDADE):

Se DIGITAL ou HÍBRIDA:
**IMPOSTOS DE TRANSMISSÃO** - Que apresentam a guia de Imposto sobre Transmissão de Bens Imóveis e de direitos a eles relativos, recolhido através da guia sob nº ______ no valor de **R$______**, devidamente paga, a qual fica arquivada nestas notas; **INDISPONIBILIDADE:** CONSULTA com resultado negativo à Central de Indisponibilidade de Bens conforme código: **HASH: ______.** **DOI:** EMITIDA DOI - Declaração Sobre Operação Imobiliária, conforme Instrução Normativa da Secretaria da Receita Federal vigente. **ARQUIVAMENTO:** Todos os documentos de arquivamento obrigatório mencionados neste ato notarial ficam arquivados digitalmente, pelo prazo legal, neste **20º Tabelionato de Notas**, sob o número de controle: ______ **CERTIFICAÇÃO:** Escritura assinada digitalmente com certificado digital, pela plataforma do e-Notariado, por: ______ ///______[SE HÍBRIDA: e presencialmente por ______ /// ______]. Eu, escrevente autorizada indicada no fluxo de assinaturas, a lavrei, li realizei a videoconferência e assino com meu certificado digital. Eu, Substituto Legal do Tabelião, indicado no fluxo de assinaturas, subscrevo e assino com meu certificado digital padrão ICP-Brasil, encerrando este ato. Data e horário das assinaturas digitais, bem como matrícula notarial eletrônica (MNE) constantes do manifesto impresso na última página desta. De tudo dou fé. O adquirente adimpliu com os emolumentos notariais ao final consignados, mediante transferência à conta desta Serventia **(CNPJ: 45.566.502/0001-12)** junto ao banco **Itaú S/A**, agência **0350**, c/c: **72195-7.** O adquirente dispensa expressamente este Cartório e seu Tabelião do encaminhamento desta escritura a registro, pelo que isenta-o de qualquer responsabilidade. De como assim o disseram, dou fé, a pedido das partes, lavrei esta escritura, a qual feita e lhes sendo lida em voz alta, acharam-na conforme, aceitaram, outorgaram e assinam.

Se PRESENCIAL:
**IMPOSTOS DE TRANSMISSÃO** - Que apresentam a guia de Imposto sobre Transmissão de Bens Imóveis e de direitos a eles relativos, recolhido através da guia sob nº ______ no valor de **R$______**, devidamente paga, a qual fica arquivada nestas notas; **INDISPONIBILIDADE:** CONSULTA com resultado negativo à Central de Indisponibilidade de Bens conforme código: **HASH: ______.** **DOI:** EMITIDA DOI - Declaração Sobre Operação Imobiliária, conforme Instrução Normativa da Secretaria da Receita Federal vigente. **ARQUIVAMENTO:** Todos os documentos de arquivamento obrigatório mencionados neste ato notarial ficam arquivados digitalmente, pelo prazo legal, neste **20º Tabelionato de Notas**, sob o número de controle: ______ O adquirente adimpliu com os emolumentos notariais ao final consignados, mediante transferência à conta desta Serventia **(CNPJ: 45.566.502/0001-12)** junto ao banco **Itaú S/A**, agência **0350**, c/c: **72195-7.** O adquirente dispensa expressamente este Cartório e seu Tabelião do encaminhamento desta escritura a registro, pelo que isenta-o de qualquer responsabilidade. De como assim o disseram, dou fé, a pedido das partes, lavrei esta escritura, a qual feita e lhes sendo lida em voz alta, acharam-na conforme, aceitaram, outorgaram e assinam.

NOTA: Substitua "adquirente" pelo nome correto da parte principal do ato. Para atos sem transferência imobiliária (procuração, testamento, ata notarial), omita IMPOSTOS DE TRANSMISSÃO e DOI.`;

const INSTRUCOES_MINUTA = {
  "Inventário": "Verificar certidão de óbito, herdeiros, regime de bens, bens do espólio, ITCMD SP (4%), meação × herança.",
  "Escritura de Compra e Venda": "Verificar matrícula, certidões negativas do vendedor, ITBI, forma de pagamento, anuência conjugal.",
  "Procuração": "Identificar outorgante e outorgado, poderes específicos, substabelecimento, prazo, imóvel se aplicável.",
  "Divórcio": "Verificar certidão de casamento, ausência de filhos menores, partilha de bens, nome após divórcio.",
  "União Estável": "Verificar documentos dos companheiros, regime de bens, data de início, cláusulas especiais.",
  "Doação": "Identificar bem doado, ITCMD, cláusulas restritivas, anuência conjugal, usufruto se aplicável.",
  "Renúncia": "Identificar bem/direito, natureza da renúncia (translativa ou abdicativa), impacto registral, tributos.",
  "Cessão de Direitos": "Identificar cedente, cessionário, direitos cedidos, valor, ITBI ou ITCMD conforme o caso.",
  "Pacto Antenupcial": "Verificar regime de bens escolhido, bens pré-nupciais, data do casamento, registro no CRI.",
  "Testamento": "Verificar capacidade civil, legítima (50%), quota disponível, legatários, testamenteiro.",
  "Ata Notarial": "Identificar fato a ser constatado, requerente, finalidade. Descrever objetivamente, sem opinião jurídica.",
  "Dação em Pagamento": "Identificar dívida original, bem dado em pagamento, ITBI, quitação expressa, certidões do devedor."
};

function instrucoesMinimasPorTipo(tipo) {
  if (!tipo) return "";
  const chave = Object.keys(INSTRUCOES_MINUTA).find(k => tipo.toLowerCase().includes(k.toLowerCase()));
  return chave ? `ATENÇÃO — ATO: ${chave.toUpperCase()}\n${INSTRUCOES_MINUTA[chave]}` : "";
}

function callClaudeMinuta(mensagem) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 5000,
      system: SYSTEM_PROMPT_MINUTA,
      messages: [{ role: "user", content: mensagem }]
    });
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
        try { resolve(JSON.parse(data)?.content?.[0]?.text || null); }
        catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}

function httpPostComRedirect(url, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const options = {
      hostname: u.hostname, path: u.pathname + u.search, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
    };
    const r = https.request(options, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        const lu = new URL(res.headers.location, url);
        const gr = https.request({ hostname: lu.hostname, path: lu.pathname + lu.search, method: "GET" }, (gres) => {
          let data = "";
          gres.on("data", d => data += d);
          gres.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
        });
        gr.on("error", () => resolve(null));
        gr.end();
        return;
      }
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    r.on("error", () => resolve(null));
    r.write(payload);
    r.end();
  });
}

async function gerarECriarMinuta(caso) {
  try {
    const instrucoes = instrucoesMinimasPorTipo(caso.tipo);
    const mod = (caso.modalidade || "digital").toUpperCase();
    const mensagem = `CASO: ${caso.nome}
TIPO DE ATO: ${caso.tipo || "Não informado"}
MODALIDADE: ${mod}
${instrucoes ? instrucoes + "\n" : ""}
OBSERVAÇÕES DO CASO: ${caso.obs || "Nenhuma"}

Por favor, gere a minuta completa conforme as informações disponíveis, usando a abertura e o encerramento correspondentes à modalidade ${mod}.`;

    const resposta = await callClaudeMinuta(mensagem);
    if (!resposta) return { driveUrl: null, docUrl: null };

    const comentarios = [];
    const regex = /【PENDÊNCIA: ([^】]+)】/g;
    let match; let num = 1;
    while ((match = regex.exec(resposta)) !== null) {
      comentarios.push(`Pendência ${num}: ${match[1].trim()}`);
      num++;
    }
    const minuta = resposta.replace(/【PENDÊNCIA: [^】]+】/g, "").replace(/\n{3,}/g, "\n\n").trim();

    const driveResp = await httpPostComRedirect(DRIVE_URL, {
      acao: "criar-minuta-doc",
      nome: caso.nome,
      tipo: caso.tipo || "",
      minuta,
      comentarios
    });

    return {
      driveUrl: driveResp?.folderUrl || null,
      docUrl: driveResp?.url || null
    };
  } catch (e) {
    return { driveUrl: null, docUrl: null };
  }
}

// ════════════════════════════════════════════════════════════════

async function extrairTextoPDF(base64, mimetype) {
  const body = JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: [
        {
          type: "document",
          source: { type: "base64", media_type: mimetype, data: base64 }
        },
        {
          type: "text",
          text: "Extraia as informações jurídicas relevantes deste documento: partes (nome, CPF, RG, estado civil, endereço), dados do imóvel (matrícula, endereço, área), valores, datas e qualquer dado importante para elaboração de minuta notarial. Seja objetivo e liste tudo que encontrar."
        }
      ]
    }]
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
        try { resolve(JSON.parse(data)?.content?.[0]?.text || null); }
        catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}

// ══ HANDLER VERCEL ══════════════════════════════════════════════
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Método não permitido");
  }

  let corpo;
  try {
    corpo = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).send("JSON inválido");
  }

  // Suporta tanto campo em português (dados/chave) quanto inglês (data/key)
  const dadosEvt    = corpo?.data   || corpo?.dados   || {};
  const chaveEvt    = dadosEvt?.key || dadosEvt?.chave || {};
  const destinatario = chaveEvt?.remoteJid || chaveEvt?.remotoJid || "";
  const numeroDestino = destinatario.replace(/[^0-9]/g, "");
  if (numeroDestino !== NUMERO_OPERACIONAL) {
    return res.status(200).send("Mensagem ignorada");
  }

  const mensagemObj  = dadosEvt?.message  || dadosEvt?.mensagem  || {};
  const tipoMensagem = dadosEvt?.messageType || dadosEvt?.tipoMensagem || "";
  const texto = (
    mensagemObj?.conversation ||
    mensagemObj?.conversa ||
    mensagemObj?.extendedTextMessage?.text ||
    mensagemObj?.mensagemTextoEstendida?.texto ||
    mensagemObj?.imageMessage?.caption ||
    mensagemObj?.documentMessage?.caption ||
    corpo.Resumo || ""
  ).trim();

  const isMedia = ["imageMessage","documentMessage","videoMessage","audioMessage","documentWithCaptionMessage"].includes(tipoMensagem);
  const isFim   = texto.toLowerCase() === "fim";
  const isTexto = !isMedia && texto.length > 0;

  // LOG TEMPORÁRIO DE DIAGNÓSTICO
  await httpReq(`https://${FIREBASE_HOST}/log_webhook.json`, "POST", {
    ts: new Date().toISOString(),
    tipoMensagem,
    isMedia,
    isTexto,
    isFim,
    texto: texto.slice(0, 100),
    destinatario,
    chaves: Object.keys(mensagemObj)
  });

  if (isFim) {
    await clearSessao();
    return res.status(200).send("Sessão encerrada");
  }

  if (isMedia) {
    const sessao = await getSessao();
    if (!sessao?.nome) return res.status(200).send("Sem sessão ativa");
    const resultado = await baixarMidia(dadosEvt);
    await httpReq(`https://${FIREBASE_HOST}/log_webhook.json`, "POST", {
      ts: new Date().toISOString(), etapa: "apos-baixar-midia",
      temBase64: !!(resultado?.base64),
      tamanhoBase64: resultado?.base64?.length || 0,
      chavesResultado: resultado ? Object.keys(resultado) : [],
      sessaoNome: sessao?.nome, sessaoCasoId: sessao?.casoId
    });
    if (resultado?.base64) {
      const ext  = tipoMensagem.includes("image") ? "jpg" : tipoMensagem.includes("audio") ? "mp3" : tipoMensagem.includes("video") ? "mp4" : "pdf";
      const mime = tipoMensagem.includes("image") ? "image/jpeg" : tipoMensagem.includes("audio") ? "audio/mpeg" : tipoMensagem.includes("video") ? "video/mp4" : "application/pdf";
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
      const nomeArquivo = `${sessao.nome.replace(/\s+/g, "_").toUpperCase()}_${ts}.${ext}`;
      const [, textoExtraido] = await Promise.all([
        salvarNoDrive(sessao.nome, nomeArquivo, resultado.base64, mime),
        (mime === "application/pdf" || mime === "image/jpeg") ? extrairTextoPDF(resultado.base64, mime) : Promise.resolve(null)
      ]);
      if (sessao.casoId) {
        await httpReq(`https://${FIREBASE_HOST}/casos/${sessao.casoId}/documentos.json`, "POST", {
          nome: nomeArquivo,
          tipo: ext,
          salvoEm: new Date().toISOString(),
          ...(textoExtraido ? { texto: textoExtraido } : {})
        });
      }
    }
    return res.status(200).send("Arquivo salvo no Drive");
  }

  if (isTexto) {
    const existente = await buscarCasoPorNome(texto);
    if (existente) {
      await setSessao({ nome: existente.nome, casoId: existente.id, timestamp: new Date().toISOString() });
      return res.status(200).send("Caso reaberto");
    }

    const urgencia = classificarUrgencia(texto);
    const caso = {
      nome: texto,
      tipo: classificarServico(texto),
      modalidade: detectarModalidade(texto),
      cacau: texto,
      status: urgencia.status,
      resp: "grazi",
      prazo: "Hoje",
      obs: `${texto}\n\n[Urgência: ${urgencia.motivo}]`,
      atualizado: new Date().toISOString().split("T")[0],
      concluido: false,
      dep: ""
    };

    const fbResp = await httpReq(`https://${FIREBASE_HOST}/casos.json`, "POST", caso);
    const casoId = fbResp?.name || null;
    await setSessao({ nome: caso.nome, casoId, timestamp: new Date().toISOString() });

    // Gerar minuta automaticamente e salvar no Drive (MINUTAS IA)
    if (casoId) {
      const { driveUrl, docUrl } = await gerarECriarMinuta(caso);
      const patch = {};
      if (driveUrl) patch.driveUrl = driveUrl;
      if (docUrl) patch.docUrl = docUrl;
      if (Object.keys(patch).length > 0) {
        await httpReq(`https://${FIREBASE_HOST}/casos/${casoId}.json`, "PATCH", patch);
      }
    }
  }

  return res.status(200).send("OK");
};
