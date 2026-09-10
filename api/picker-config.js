// ══ CONFIGURAÇÃO DO GOOGLE PICKER ═══════════════════════════════════════
//
// O botão "Escolher do Drive" (index.html, junto dos botões de anexar) abre
// o seletor de arquivos do próprio Google — a mesma caixa que o Gmail usa
// para anexar do Drive. Isso pede duas credenciais do Google Cloud (Client
// ID OAuth e API key, com a Picker API e a Drive API ativadas no projeto):
// nenhuma das duas é segredo — o navegador de quem usa o painel enxerga as
// duas de qualquer jeito, é assim que o Picker sempre funcionou em qualquer
// site — mas moram nas variáveis de ambiente da Vercel, como a chave da IA,
// para trocar sem mexer no código.
//
// GOOGLE_PICKER_CLIENT_ID = Client ID OAuth 2.0 (tipo "Aplicativo da Web")
// GOOGLE_PICKER_API_KEY   = API key (restrita à Picker API + Drive API)
//
// Passo a passo de como criar as duas: ver FIREBASE.md, seção 10.

module.exports = async (req, res) => {
  const clientId = process.env.GOOGLE_PICKER_CLIENT_ID || "";
  const apiKey = process.env.GOOGLE_PICKER_API_KEY || "";
  if (!clientId || !apiKey) {
    return res.status(200).json({
      ok: false,
      erro: "O Google Drive ainda não foi configurado neste painel — falta GOOGLE_PICKER_CLIENT_ID e/ou GOOGLE_PICKER_API_KEY nas variáveis de ambiente da Vercel."
    });
  }
  return res.status(200).json({ ok: true, clientId, apiKey });
};
