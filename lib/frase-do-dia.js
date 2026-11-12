const ia = require('./ia');
const {hojeEmSP} = require('./radar-triagem');

const RESERVAS = [
  'Um passo de cada vez também constrói grandes conquistas.',
  'Seu cuidado faz diferença em cada detalhe.',
  'O que fazemos juntos torna o caminho mais leve.',
  'Cada pequeno avanço merece ser reconhecido.',
  'Confie no caminho que você constrói com dedicação.',
  'Hoje é uma nova chance de fazer bem feito.',
  'Com calma e constância, a gente chega mais longe.'
];
const TEMAS = ['coragem para começar','cuidado nos detalhes','cooperação','pequenas conquistas','confiança','renovação','calma e constância'];
function validarFrase(valor){
  if(typeof valor!=='string')return null;
  const frase=valor.trim().replace(/^["“”]|["“”]$/g,'');
  if(!frase||frase.length>100||frase.split(/\s+/).length>16||/[\r\n<>#*_`]|https?:\/\//i.test(frase))return null;
  return frase;
}
function reserva(data){return RESERVAS[Math.floor(Date.parse(data+'T12:00:00Z')/86400000)%RESERVAS.length];}
function segundosAteAmanha(agora,data){return Math.max(1,Math.floor((Date.parse(data+'T23:59:59.999-03:00')-agora.getTime())/1000));}
function criarServico({gerar=opcoes=>ia.texto(opcoes),agora=()=>new Date()}={}){
  let salvo=null,pendente=null;
  return async function fraseDoDia(){
    const momento=agora(),data=hojeEmSP(momento);
    if(salvo?.data===data)return salvo;
    if(pendente?.data===data)return pendente.promessa;
    const anterior=salvo?.frase;
    const promessa=(async()=>{
      let frase,origem='ia';
      try{
        frase=validarFrase(await gerar({max_tokens:160,
          system:'Escreva uma única frase motivacional original, curta e acolhedora, em português do Brasil, para uma equipe começar o dia. De 5 a 12 palavras e no máximo 100 caracteres. Sem listas, markdown, aspas, saudação, autor, emojis ou explicação. Não faça perguntas, promessas de sucesso, cobranças de produtividade nem referências religiosas ou políticas.',
          messages:[{role:'user',content:`Dia: ${data}. Inspiração: ${TEMAS[Math.floor(Date.parse(data+'T12:00:00Z')/86400000)%TEMAS.length]}.${anterior?' Crie algo diferente desta frase anterior: '+anterior:''}`}]}));
        if(!frase||frase===anterior)throw new Error('Frase fora do formato.');
      }catch(_){frase=reserva(data);origem='reserva';}
      const resultado={ok:true,data,frase,origem};
      if(hojeEmSP(agora())===data)salvo=resultado;
      return resultado;
    })();
    pendente={data,promessa};
    try{return await promessa;}finally{if(pendente?.promessa===promessa)pendente=null;}
  };
}
const obterFrase=criarServico();
async function atender(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false});
  // Nenhum dado enviado pelo visitante entra no prompt desta rota.
  const url=new URL(req.url||'/', 'https://painel.invalid');
  if([...url.searchParams.keys()].some(k=>k!=='acao'))return res.status(400).json({ok:false});
  const resultado=await obterFrase();
  const ttl=segundosAteAmanha(new Date(),resultado.data);
  res.setHeader('Cache-Control',`public, max-age=${ttl}, s-maxage=${ttl}, must-revalidate`);
  return res.status(200).json(resultado);
}
module.exports={atender,criarServico,validarFrase,reserva,segundosAteAmanha};
