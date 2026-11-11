// ══ AS FERRAMENTAS DA JOANINHA ═══════════════════════════════════════════
//
// O catálogo do que a conversa ampla pode fazer — e, por isso, a única lista
// que decide o que ela NÃO pode. Shirley e Grazi enxergam exatamente esta
// lista: ela não depende de quem entrou (o `dono` do cofre pessoal e da Rede
// não tem papel aqui), só de a conta estar em /acesso.
//
// Cada ferramenta diz onde roda:
//   "servidor" — a função da Vercel resolve sozinha (a base jurídica mora no
//                banco aberto e o código que a lê já existe aqui);
//   "cliente"  — o navegador resolve, com as funções que o painel JÁ TEM (nota,
//                lembrete, busca, resumo…). O modelo pede, o painel executa com
//                a sessão da própria pessoa, e devolve o resultado. Nada é
//                reescrito do lado do servidor.
//
// E se escreve ou não. Quem escreve (`escreve: true`) nunca roda sozinha: o
// painel mostra o que vai acontecer e espera o clique em Confirmar. Isso mora
// no navegador (joaninha-chat.js) e é conferido por teste — regra que só
// existisse no prompt dependeria de o modelo ter lembrado dela naquele dia.
//
// Fora do catálogo, de propósito: Financeiro, Meu financeiro, Rede e qualquer
// escrita em orçamento. Orçamento só se LÊ, para conferir a conta.

const FERRAMENTAS = [
  {
    nome: "consultar_base_juridica",
    onde: "servidor",
    escreve: false,
    descricao: "Consulta a Base de Regras do cartório (ITCMD no inventário, dispensa de certidões, baixa de hipoteca, individualização de matrícula, IPTU nos atos, HIS/HMP) e o Radar Jurídico dos últimos dias. Use SEMPRE antes de responder qualquer pergunta jurídica ou de redigir mensagem de cliente sobre norma.",
    parametros: {
      type: "object",
      properties: { assunto: { type: "string", description: "O assunto em poucas palavras, só para registro." } },
      additionalProperties: false
    }
  },
  {
    nome: "listar_casos",
    onde: "cliente",
    escreve: false,
    descricao: "Lista os casos (cards) do painel com id, nome, tipo, status, etapa, responsável, prazo e dias parado. Sem filtro, traz os casos ativos. Use para achar o id de um caso antes de chamar outra ferramenta.",
    parametros: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Trecho do nome, tipo ou observação." },
        status: { type: "string", enum: ["critico", "prioridade", "atencao", "emdia"] },
        etapa: { type: "string", description: "Texto da etapa/dependência, ex.: 'Falta documentos'." },
        responsavel: { type: "string", enum: ["shirley", "grazi", "gabriel"] },
        incluir_concluidos: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  {
    nome: "obter_caso",
    onde: "cliente",
    escreve: false,
    descricao: "Traz tudo o que o painel sabe de UM caso: campos, observações, as últimas anotações do histórico, a lista de documentos (nome, tipo, origem e tamanho do texto lido) e se há orçamento ou minuta.",
    parametros: {
      type: "object",
      properties: { caso_id: { type: "string" } },
      required: ["caso_id"],
      additionalProperties: false
    }
  },
  {
    nome: "ler_documento_caso",
    onde: "cliente",
    escreve: false,
    descricao: "Lê o texto de um documento do caso (matrícula, RG, certidão, minuta anexada…). 'documento' é um pedaço do nome ou o tipo, como aparece em obter_caso. O texto vem cortado em max_caracteres.",
    parametros: {
      type: "object",
      properties: {
        caso_id: { type: "string" },
        documento: { type: "string" },
        max_caracteres: { type: "integer", description: "Padrão 12000, máximo 30000." }
      },
      required: ["caso_id", "documento"],
      additionalProperties: false
    }
  },
  {
    nome: "buscar",
    onde: "cliente",
    escreve: false,
    descricao: "Busca um termo em casos (nome, tipo, ação, observações) e nos lembretes manuais do Foco do dia.",
    parametros: {
      type: "object",
      properties: { texto: { type: "string" } },
      required: ["texto"],
      additionalProperties: false
    }
  },
  {
    nome: "resumo_do_dia",
    onde: "cliente",
    escreve: false,
    descricao: "O resumo do painel agora: quantos casos em andamento, críticos, aguardando cliente ou documentos, média de dias parado, os sinais de atenção do dia e o Foco do dia pendente.",
    parametros: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    nome: "listar_lembretes",
    onde: "cliente",
    escreve: false,
    descricao: "Lista os lembretes com data e hora que ainda não foram concluídos.",
    parametros: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    nome: "consultar_orcamento",
    onde: "cliente",
    escreve: false,
    descricao: "Lê o último orçamento do caso (só leitura): ato, valor do negócio, linhas de escritura, registro, despesas e tributos, total, alertas e o que ainda não foi confirmado. Serve para CONFERIR se a conta está certa; você nunca altera orçamento. Valores em centavos.",
    parametros: {
      type: "object",
      properties: { caso_id: { type: "string" } },
      required: ["caso_id"],
      additionalProperties: false
    }
  },
  {
    nome: "adicionar_nota",
    onde: "cliente",
    escreve: true,
    descricao: "Anota um texto no histórico e nas observações de um caso (com caso_id) ou, sem caso_id, no Foco do dia. A pessoa confirma antes de gravar.",
    parametros: {
      type: "object",
      properties: {
        texto: { type: "string" },
        caso_id: { type: "string", description: "Omita para anotar no Foco do dia." }
      },
      required: ["texto"],
      additionalProperties: false
    }
  },
  {
    nome: "criar_lembrete",
    onde: "cliente",
    escreve: true,
    descricao: "Cria um lembrete com data e hora. 'quando' em ISO 8601 no horário de Brasília, ex.: 2026-11-12T14:30:00-03:00. A pessoa confirma antes de gravar.",
    parametros: {
      type: "object",
      properties: {
        texto: { type: "string" },
        quando: { type: "string" },
        caso_id: { type: "string" }
      },
      required: ["texto", "quando"],
      additionalProperties: false
    }
  },
  {
    nome: "concluir_lembrete",
    onde: "cliente",
    escreve: true,
    descricao: "Conclui (remove) um lembrete. O id vem de listar_lembretes. A pessoa confirma.",
    parametros: {
      type: "object",
      properties: { lembrete_id: { type: "string" } },
      required: ["lembrete_id"],
      additionalProperties: false
    }
  },
  {
    nome: "adicionar_foco",
    onde: "cliente",
    escreve: true,
    descricao: "Acrescenta uma prioridade na lista do Foco do dia. A pessoa confirma.",
    parametros: {
      type: "object",
      properties: { texto: { type: "string" } },
      required: ["texto"],
      additionalProperties: false
    }
  },
  {
    nome: "preparar_reedicao_minuta",
    onde: "cliente",
    escreve: true,
    descricao: "Prepara a instrução para o motor que elabora as escrituras (o Claude) e abre a tela de reedição da minuta com o texto já escrito. Você NÃO gera nem altera a minuta: a pessoa lê, ajusta e aperta o botão de gerar. Escreva a instrução como pedido objetivo, apontando cada correção e o motivo.",
    parametros: {
      type: "object",
      properties: {
        caso_id: { type: "string" },
        instrucao: { type: "string" }
      },
      required: ["caso_id", "instrucao"],
      additionalProperties: false
    }
  }
];

const POR_NOME = Object.fromEntries(FERRAMENTAS.map(f => [f.nome, f]));

// O formato que a API de chat da OpenAI espera.
function definicoesParaModelo() {
  return FERRAMENTAS.map(f => ({
    type: "function",
    function: { name: f.nome, description: f.descricao, parameters: f.parametros }
  }));
}

module.exports = { FERRAMENTAS, POR_NOME, definicoesParaModelo };
