// ══ BASE DE REGRAS — a carga inicial ═════════════════════════════════════
//
// O que o cartório sabe que não muda toda semana: o chão em que a mesa pisa.
// Diferente do Radar, que é o jornal do dia, isto aqui é a memória.
//
// Seis temas entram prontos. Do sétimo em diante quem escreve é o próprio
// Radar: item que ele marcar como conhecimento estável vira uma linha em
// `atualizacoes` do tema, com a data. **O `resumo` e o `naMesa` da carga
// inicial nunca são sobrescritos pela varredura** — mesma regra do lápis da
// Rede: o que foi conferido à mão vence a leitura da máquina.
//
// `atencao` não é decoração. Cada linha ali é um ponto que a pesquisa deixou
// em aberto, e a Joaninha é obrigada a repetir isso antes de dizer "já pode
// aplicar". Ponto em aberto escondido é o que faz exigência formal sair
// errada.

const BASE_REGRAS_INICIAL = {

  'itcmd-inventario': {
    titulo: 'ITCMD no inventário e partilha extrajudicial',
    resumo: 'Desde 18/08/2026 não é mais obrigatório comprovar o recolhimento do ITCMD para lavrar a escritura de inventário e partilha. O Plenário do CNJ, por unanimidade, revogou o trecho do art. 15 da Resolução CNJ nº 35/2007 que fazia essa exigência. A obrigação tributária continua existindo — o que caiu foi a exigência na lavratura, não o imposto.',
    naMesa: [
      'A escritura de inventário e partilha pode ser lavrada sem a guia do ITCMD paga.',
      'Havendo imóvel na partilha, avisar a parte na hora: o Registro de Imóveis continua exigindo a comprovação do ITCMD para efetivar a transferência.',
      'Não dizer ao cliente que "o imposto acabou". Ele continua devido, com os mesmos prazos e a mesma alíquota da SEFAZ/SP.'
    ],
    etapas: [
      { etapa: 'Escritura (Tabelionato)', situacao: 'dispensado', base: 'CNJ, PP nº 0008622-24.2025.2.00.0000, 18/08/2026' },
      { etapa: 'Registro (Registro de Imóveis)', situacao: 'continua exigido', base: 'art. 289 da Lei 6.015/73 + lei tributária estadual' }
    ],
    fundamentos: [
      { ref: 'CNJ · Pedido de Providências nº 0008622-24.2025.2.00.0000', texto: 'Plenário, 18/08/2026, unânime. Revogou o trecho do art. 15 da Resolução CNJ nº 35/2007 que exigia o ITCMD antes da lavratura.' },
      { ref: 'Lei 6.015/73, art. 289', texto: 'Obriga o oficial de registro a fiscalizar o pagamento dos impostos devidos por força dos atos que praticar. É competência que o CNJ não alcança.' },
      { ref: 'NSCGJ/SP, Cap. XX, item 117.1', texto: 'Mantém a exceção do ITCMD e do ITBI mesmo dispensando as demais certidões negativas. Ver a ressalva de numeração em Atenção.' }
    ],
    atencao: [
      'Competência: o CNJ regula procedimento notarial e registral. Ele não pode alterar lei tributária estadual nem o art. 289 da Lei de Registros Públicos — por isso a dispensa parou na porta do Registro de Imóveis.',
      'Confirmado com caso real no 5º Registro de Imóveis de São Paulo: a exigência do ITCMD para registrar continuou depois da decisão.'
    ],
    mensagemCliente: 'Oi, [nome]! Boa pergunta 😊\n\nÉ verdade — no dia 18/08/2026 o CNJ decidiu que não é mais obrigatório pagar o ITCMD antes de lavrar a escritura de inventário e partilha (decisão do Plenário do CNJ, Pedido de Providências nº 0008622-24.2025.2.00.0000, que revogou parte do art. 15 da Resolução CNJ nº 35/2007). Então sim, já podemos seguir com a escritura mesmo sem o imposto pago.\n\nUm detalhe importante, porém: essa dispensa vale só para a escritura. Se houver imóvel no inventário, o Registro de Imóveis continua exigindo a comprovação do ITCMD para efetivar a transferência (isso está no art. 289 da Lei de Registros Públicos e no item 117.1 das Normas de Serviço da Corregedoria de SP). Ou seja: a escritura sai, mas a transferência do imóvel só se completa depois do imposto pago.\n\nNa prática: dá pra avançar com a escritura agora. Se tiver imóvel na partilha, já vale ir organizando o pagamento do ITCMD, porque ele será necessário pra concluir o registro depois.\n\nQualquer dúvida, é só chamar!'
  },

  'certidoes-dispensa': {
    titulo: 'Apresentação e dispensa de certidões na compra e venda',
    resumo: 'O CNJ vedou a exigência de certidões negativas de débitos para lavrar, registrar ou averbar compra e venda de imóvel. Ficaram de fora da dispensa o ITBI e o laudêmio, que continuam exigidos. A dispensa não apaga o direito da parte de pedir as certidões: quem compra pode continuar querendo ver, e o cartório deve informar essa possibilidade.',
    naMesa: [
      'Não exigir CND federal, estadual, municipal ou trabalhista como condição para lavrar a compra e venda.',
      'Continuar exigindo o ITBI e, quando for o caso, o laudêmio.',
      'Informar o comprador de que ele pode pedir as certidões do vendedor por conta própria — a dispensa é do cartório exigir, não do comprador se resguardar.'
    ],
    fundamentos: [
      { ref: 'CNJ · PCA nº 0001611-12.2023.2.00.0000', texto: 'Decisão de 15/08/2025. Veda exigir certidões negativas de débitos para lavrar, registrar ou averbar compra e venda de imóvel, ressalvados ITBI e laudêmio.' },
      { ref: 'NSCGJ/SP, Cap. XX, item 117.1', texto: 'Item paulista que trata da dispensa das certidões e mantém a ressalva do ITCMD e do ITBI.' }
    ],
    atencao: [
      'Divergência de numeração: parte das fontes cita o item como 117.1 e parte como 119.1 das Normas de Serviço da Corregedoria de SP. Antes de usar o número numa exigência formal ou numa nota devolutiva, conferir a redação vigente direto no site do TJSP.',
      'Não confirmado: fala-se num Provimento CGJ 17/2026 que alinharia as normas paulistas à decisão do CNJ sobre CNDs. A pesquisa não localizou esse ato. Não citar até confirmar.'
    ]
  },

  'baixa-hipoteca': {
    titulo: 'Baixa de hipoteca',
    resumo: 'A baixa da hipoteca se faz por averbação, a partir de termo de quitação do credor com firma reconhecida. Não é preciso escritura pública. Quando o documento vier em meio eletrônico, ele precisa ser nato-digital — cópia digitalizada de papel não serve.',
    naMesa: [
      'Pedir ao credor o termo de quitação com firma reconhecida; não montar escritura de cancelamento sem necessidade.',
      'A baixa é averbação na matrícula, feita no Registro de Imóveis — o tabelionato entra reconhecendo a firma ou lavrando o ato quando a parte quiser a forma pública.',
      'Documento eletrônico: exigir que seja nato-digital, com assinatura eletrônica válida. PDF escaneado de termo assinado em papel não é nato-digital.'
    ],
    fundamentos: [
      { ref: 'Lei 6.015/73, arts. 250 e 251', texto: 'Tratam do cancelamento do registro e da averbação, inclusive por documento particular de quitação.' }
    ],
    atencao: [
      'Credor bancário costuma emitir o termo em plataforma própria: confirmar se o arquivo entregue é o nato-digital ou uma impressão dele.'
    ]
  },

  'individualizacao-matricula': {
    titulo: 'Individualização de matrícula',
    resumo: 'Há dois caminhos diferentes e não intercambiáveis. Em incorporação, a individualização segue o regime de fichas complementares abertas a partir da matrícula-mãe, depois de registrada a incorporação. Fora da incorporação, o que existe é desdobro ou desmembramento, com as regras de parcelamento do solo e a aprovação municipal correspondente.',
    naMesa: [
      'Identificar primeiro qual dos dois casos é: incorporação registrada, ou parcelamento do solo. A confusão entre os dois é a origem da maioria das devolutivas.',
      'Em incorporação: a unidade só ganha matrícula própria depois do registro da incorporação na matrícula-mãe.',
      'Em desdobro/desmembramento: sem aprovação municipal não há registro.'
    ],
    fundamentos: [
      { ref: 'Lei 6.766/79', texto: 'Parcelamento do solo urbano — desmembramento e loteamento.' },
      { ref: 'NSCGJ/SP, item 122.2', texto: 'Regra paulista sobre a abertura de matrículas na individualização.' },
      { ref: '1ª VRP/SP · Provimento 03/1988', texto: 'Disciplina o regime de fichas complementares.' }
    ],
    atencao: [
      'Conferir a redação vigente do item 122.2 no site do TJSP: as Normas de Serviço foram renumeradas mais de uma vez.'
    ]
  },

  'iptu-atos': {
    titulo: 'IPTU nos atos notariais e registrais',
    resumo: 'Não é exigível a quitação do IPTU para lavrar ou registrar. O que o carnê serve é para identificar o imóvel no cadastro municipal e para compor a base do ITBI. Confundir uma coisa com a outra cria exigência que não existe.',
    naMesa: [
      'Não condicionar a lavratura nem o registro à quitação do IPTU.',
      'Pedir o número do contribuinte/cadastro para identificar o imóvel e para a guia do ITBI.',
      'Avisar o comprador de que o débito de IPTU acompanha o imóvel — é informação útil, não exigência do cartório.'
    ],
    fundamentos: [
      { ref: 'STJ · Tema 1.113', texto: 'Fixou que a base de cálculo do ITBI é o valor da transação declarado pelo contribuinte, presumido verdadeiro, e que o município não pode arbitrar previamente valor de referência.' },
      { ref: 'LC Municipal 227/2026', texto: 'Trata da base de cálculo do ITBI em São Paulo. Ver a ressalva em Atenção.' }
    ],
    atencao: [
      'Em aberto: a aplicação da LC 227/2026 sobre a base de cálculo do ITBI colide com o STJ Tema 1.113 e ainda não está pacificada. Não tratar como regra fechada nem orientar cliente como se estivesse resolvido — informar que o ponto está em disputa.'
    ]
  },

  'his-hmp': {
    titulo: 'HIS e HMP — Habitação de Interesse Social e de Mercado Popular',
    resumo: 'Imóvel enquadrado como HIS ou HMP tem averbação obrigatória do enquadramento e redução de emolumentos. A redução é lei estadual; o enquadramento é ato municipal. Sem o documento de enquadramento não se aplica a redução — e aplicar redução indevida é falta do tabelião, não do cliente.',
    naMesa: [
      'Exigir o documento municipal de enquadramento antes de aplicar qualquer redução.',
      'Averbar o enquadramento — é obrigatório, não opcional.',
      'Conferir a faixa (HIS 1, HIS 2, HMP): a redução não é a mesma em todas.'
    ],
    fundamentos: [
      { ref: 'Lei Estadual 11.331/2002', texto: 'Emolumentos dos serviços notariais e de registro em São Paulo.' },
      { ref: 'Lei Estadual 13.290/2008', texto: 'Reduções aplicáveis aos atos de habitação de interesse social.' },
      { ref: 'Decreto Municipal 64.244/2025 e Decreto Municipal 64.895/2026', texto: 'Regras municipais de enquadramento em São Paulo.' }
    ],
    atencao: [
      'Os decretos municipais são recentes e o segundo altera o primeiro: conferir qual está vigente na data do ato antes de aplicar a faixa.'
    ]
  }

};

module.exports = { BASE_REGRAS_INICIAL };
