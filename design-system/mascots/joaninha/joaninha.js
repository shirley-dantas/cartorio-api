/**
 * Joaninha — mascote/componente do design system PRIME.
 *
 * Componente puro: não sabe nada sobre o produto que a hospeda (nenhuma
 * referência a Firebase, casos, painel). Só corpo, animação e uma API
 * pública pequena. A integração com um produto específico (ex.: o painel
 * do PRIME) fica inteiramente do lado de fora, chamando essa API.
 *
 * Uso:
 *   <link rel="stylesheet" href="design-system/mascots/joaninha/joaninha.css">
 *   <script src="design-system/mascots/joaninha/joaninha.js"></script>
 *   <script>
 *     const joaninha = JoaninhaMascote.montar(document.body);
 *     joaninha.onInteragir(() => abrirAlgumPainel());
 *     joaninha.play('happy');
 *     joaninha.notify('success');
 *   </script>
 *
 * Vocabulário de play(): idle, blink, breathe, sorrir/happy, comemorar/celebrate,
 * pensando-on/thinking, pensando-off, atenta-on, atenta-off, surprised, worried,
 * chamarAtencao/attention, wave, walk, fly, land, sleep, wake, lookLeft, lookRight,
 * lookUp, lookDown.
 *
 * O corpo é composto pelas 6 fotos oficiais do guia de marca (assets/*.png),
 * uma por pose — sem partes soltas animáveis (olho, antena, asa). Estados que
 * antes moviam só uma parte do SVG (piscar, olhar o cursor, antena/asa) não
 * têm mais efeito visual próprio; continuam existindo como no-op só para não
 * quebrar quem já chama essas funções.
 */
(function (global) {
  const MARKUP = `
    <div class="joaninha-bubble" id="joaninha-bubble" data-jn="bubble"></div>
    <button type="button" id="joaninha" class="joaninha" data-jn="botao" aria-label="Joaninha">
      <img class="joaninha-avatar" data-jn="avatar" alt="Joaninha">
      <span class="joaninha-heart" id="joaninha-heart" data-jn="coracao">❤️</span>
    </button>
  `;

  const POSES = {
    idle: 'design-system/mascots/joaninha/assets/idle.png',
    walk: 'design-system/mascots/joaninha/assets/walk.png',
    fly: 'design-system/mascots/joaninha/assets/fly.png',
    thinking: 'design-system/mascots/joaninha/assets/thinking.png',
    happy: 'design-system/mascots/joaninha/assets/happy.png',
    sleep: 'design-system/mascots/joaninha/assets/sleep.png',
  };

  const MSGS_COMEMORACAO = ['Anotado! 🐞', 'Salvo com carinho.', 'Prontinho!', 'Registrado, pode continuar.'];

  function montar(container, opcoes) {
    opcoes = opcoes || {};
    const host = document.createElement('div');
    host.id = opcoes.hostId || 'joaninha-host';
    host.innerHTML = MARKUP;
    container.appendChild(host);

    const joaninha = host.querySelector('[data-jn="botao"]');
    const bubble = host.querySelector('[data-jn="bubble"]');
    const heart = host.querySelector('[data-jn="coracao"]');
    const avatar = host.querySelector('[data-jn="avatar"]');

    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    const estado = { andando: false, voando: false, pausada: false, dormindo: false, pensando: false, atentaExterna: false, observando: false };
    let ultimaAtividade = Date.now();
    let bolhaTimer = null;
    let aoInteragirCallback = null;
    let poseAtual = null;
    let poseFadeTimer = null;

    function mostrarPose(nome) {
      if (!POSES[nome] || poseAtual === nome) return;
      poseAtual = nome;
      clearTimeout(poseFadeTimer);
      avatar.classList.add('jn-fading');
      poseFadeTimer = setTimeout(() => {
        avatar.src = POSES[nome];
        avatar.classList.remove('jn-fading');
      }, 160);
    }
    avatar.src = POSES.idle;
    poseAtual = 'idle';

    function acordar() {
      if (!estado.dormindo) return;
      estado.dormindo = false;
      joaninha.classList.remove('jn-dormindo');
      mostrarPose('idle');
    }
    function dormir() {
      if (estado.dormindo) return;
      estado.dormindo = true;
      pararDeVagarAgora();
      joaninha.classList.add('jn-dormindo');
      mostrarPose('sleep');
    }
    function registrarAtividade() {
      ultimaAtividade = Date.now();
      acordar();
    }
    ['mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach((evt) => {
      window.addEventListener(evt, registrarAtividade, { passive: true });
    });

    // sem partes soltas (pupila) pra apontar na direção do cursor — mantida
    // como no-op só para não quebrar quem já chama look()/lookLeft/etc.
    function apontarOffset() {}
    function look() {}

    // jn-atenta pode ser ligada por dois motivos independentes: um evento
    // externo do produto (ex.: arrastar arquivo) ou o cursor se aproximando/
    // pousando em cima dela. Os dois convergem aqui pra nenhum apagar o outro
    // por engano, e o estado "pensando" sempre suprime os dois.
    function atualizarAtenta() {
      const ativa = (estado.atentaExterna || estado.observando) && !estado.pensando;
      joaninha.classList.toggle('jn-atenta', ativa);
      joaninha.classList.toggle('jn-observando', estado.observando && !estado.pensando);
    }

    const RAIO_OBSERVAR = 120;
    function pertoDoCursor(x, y) {
      const r = host.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      return Math.hypot(x - cx, y - cy) < RAIO_OBSERVAR;
    }
    window.addEventListener('mousemove', (e) => {
      registrarAtividade();
      const perto = pertoDoCursor(e.clientX, e.clientY);
      if (perto !== estado.observando) {
        estado.observando = perto;
        atualizarAtenta();
      }
    }, { passive: true });
    joaninha.addEventListener('mouseenter', () => {
      estado.observando = true;
      atualizarAtenta();
    });
    joaninha.addEventListener('mouseleave', () => {
      estado.observando = false;
      atualizarAtenta();
    });

    function posicaoAleatoria() {
      const vw = window.innerWidth, vh = window.innerHeight;
      const right = 16 + Math.random() * Math.max(0, Math.min(vw - 110, vw * 0.7));
      const bottomMax = Math.min(vh * 0.34, 260);
      const bottom = 16 + Math.random() * Math.max(0, bottomMax - 16);
      return { right, bottom };
    }
    function pararDeVagarAgora() {
      joaninha.classList.remove('jn-andando', 'jn-voando', 'jn-pousando');
      estado.andando = false; estado.voando = false;
      host.style.right = ''; host.style.bottom = '';
      if (!estado.dormindo) mostrarPose('idle');
    }
    async function vagar() {
      if (estado.pausada || document.querySelector('.modal-overlay.open')) return;
      estado.andando = true;
      joaninha.classList.add('jn-andando');
      mostrarPose('walk');
      const alvo1 = posicaoAleatoria();
      host.style.right = alvo1.right + 'px';
      host.style.bottom = alvo1.bottom + 'px';
      await esperar(1900);
      joaninha.classList.remove('jn-andando');
      estado.andando = false;
      if (estado.pausada || Date.now() - ultimaAtividade < 1500) { mostrarPose('idle'); return; }
      estado.voando = true;
      joaninha.classList.add('jn-voando');
      mostrarPose('fly');
      const alvo2 = posicaoAleatoria();
      host.style.right = alvo2.right + 'px';
      host.style.bottom = alvo2.bottom + 'px';
      await esperar(1600);
      joaninha.classList.remove('jn-voando');
      joaninha.classList.add('jn-pousando');
      mostrarPose('idle');
      estado.voando = false;
      await esperar(550);
      joaninha.classList.remove('jn-pousando');
    }
    let proximaVariacaoPostura = Date.now() + 12000 + Math.random() * 4000;
    function talvezVariarPostura() {
      if (estado.pensando || joaninha.classList.contains('jn-variando')) return;
      if (Date.now() < proximaVariacaoPostura) return;
      joaninha.classList.add('jn-variando');
      setTimeout(() => joaninha.classList.remove('jn-variando'), 3600);
      proximaVariacaoPostura = Date.now() + 12000 + Math.random() * 4000;
    }
    setInterval(() => {
      if (estado.pausada || estado.andando || estado.voando || estado.dormindo) return;
      if (document.querySelector('.modal-overlay.open')) return;
      talvezVariarPostura();
      const idleMs = Date.now() - ultimaAtividade;
      if (idleMs > 300000) { dormir(); return; }
      if (idleMs > 60000) vagar();
    }, 5000);

    function falar(msg, duracaoMs) {
      bubble.textContent = msg;
      bubble.classList.add('show');
      clearTimeout(bolhaTimer);
      bolhaTimer = setTimeout(() => bubble.classList.remove('show'), duracaoMs || 3600);
    }

    function setHumor(mood) {
      host.classList.remove('jn-mood-preocupada', 'jn-mood-feliz');
      if (mood) host.classList.add('jn-mood-' + mood);
    }

    function pausarVagar() {
      estado.pausada = true;
      pararDeVagarAgora();
    }
    function retomarVagar() {
      estado.pausada = false;
    }

    function play(nome) {
      switch (nome) {
        case 'sorrir': case 'happy':
          mostrarPose('happy');
          joaninha.classList.add('jn-sorrindo');
          setTimeout(() => { joaninha.classList.remove('jn-sorrindo'); mostrarPose('idle'); }, 650);
          break;
        case 'comemorar': case 'celebrate':
          mostrarPose('happy');
          joaninha.classList.add('jn-comemorando');
          heart.classList.remove('jn-pop');
          void heart.offsetWidth;
          heart.classList.add('jn-pop');
          falar(MSGS_COMEMORACAO[Math.floor(Math.random() * MSGS_COMEMORACAO.length)], 2200);
          setTimeout(() => { joaninha.classList.remove('jn-comemorando'); mostrarPose('idle'); }, 1100);
          break;
        case 'pensando-on': case 'thinking':
          estado.pensando = true;
          joaninha.classList.add('jn-pensando');
          atualizarAtenta();
          mostrarPose('thinking');
          break;
        case 'pensando-off':
          estado.pensando = false;
          joaninha.classList.remove('jn-pensando');
          atualizarAtenta();
          mostrarPose('idle');
          break;
        case 'atenta-on':
          estado.atentaExterna = true;
          atualizarAtenta();
          break;
        case 'atenta-off':
          estado.atentaExterna = false;
          atualizarAtenta();
          break;
        case 'surprised':
          joaninha.classList.add('jn-surpresa');
          setTimeout(() => joaninha.classList.remove('jn-surpresa'), 500);
          break;
        case 'worried':
          joaninha.classList.add('jn-preocupada-gesto');
          setTimeout(() => joaninha.classList.remove('jn-preocupada-gesto'), 2400);
          break;
        case 'chamarAtencao': case 'attention':
          joaninha.classList.add('jn-chamar-atencao');
          setTimeout(() => joaninha.classList.remove('jn-chamar-atencao'), 1800);
          break;
        case 'wave':
          mostrarPose('happy');
          joaninha.classList.add('jn-sorrindo');
          setTimeout(() => { joaninha.classList.remove('jn-sorrindo'); mostrarPose('idle'); }, 1300);
          break;
        case 'blink':
          break; // sem pálpebra separada, sem efeito
        case 'walk':
          pararDeVagarAgora();
          mostrarPose('walk');
          joaninha.classList.add('jn-andando');
          break;
        case 'fly':
          joaninha.classList.remove('jn-andando');
          mostrarPose('fly');
          joaninha.classList.add('jn-voando');
          break;
        case 'land':
          joaninha.classList.remove('jn-voando');
          mostrarPose('idle');
          joaninha.classList.add('jn-pousando');
          setTimeout(() => joaninha.classList.remove('jn-pousando'), 550);
          break;
        case 'sleep':
          dormir();
          break;
        case 'wake':
          acordar();
          break;
        case 'idle':
          pararDeVagarAgora();
          acordar();
          mostrarPose('idle');
          break;
        case 'lookLeft': case 'lookRight': case 'lookUp': case 'lookDown':
          break; // sem pupila separada, sem efeito
        case 'breathe':
          break; // sempre ativo via CSS, não precisa de ação
        default:
          break;
      }
    }

    function notify(tipo) {
      if (tipo === 'success') play('celebrate');
      else if (tipo === 'warning') { setHumor('preocupada'); play('worried'); }
    }

    function onInteragir(callback) {
      aoInteragirCallback = callback;
    }
    joaninha.addEventListener('click', () => {
      registrarAtividade();
      if (aoInteragirCallback) aoInteragirCallback();
    });

    return {
      elementoHost: host,
      elementoBotao: joaninha,
      play,
      look,
      notify,
      onInteragir,
      falar,
      setHumor,
      reagir: play,
      pausarVagar,
      retomarVagar,
      registrarAtividade,
    };
  }

  global.JoaninhaMascote = { montar };
})(window);
