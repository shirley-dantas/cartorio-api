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
 * wave, walk, fly, land, sleep, wake, lookLeft, lookRight, lookUp, lookDown.
 */
(function (global) {
  const MARKUP = `
    <div class="joaninha-bubble" id="joaninha-bubble" data-jn="bubble"></div>
    <button type="button" id="joaninha" class="joaninha" data-jn="botao" aria-label="Joaninha">
      <svg class="joaninha-svg" viewBox="0 0 140 140">
        <defs>
          <radialGradient id="jn-grad-body" cx="40%" cy="26%" r="78%">
            <stop offset="0%" stop-color="#FF7A6E"/>
            <stop offset="52%" stop-color="#FF3B30"/>
            <stop offset="100%" stop-color="#B32B23"/>
          </radialGradient>
          <radialGradient id="jn-grad-head" cx="38%" cy="26%" r="78%">
            <stop offset="0%" stop-color="#2C2C2E"/>
            <stop offset="100%" stop-color="#1C1C1E"/>
          </radialGradient>
          <linearGradient id="jn-grad-wing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#FFE0E6" stop-opacity=".85"/>
            <stop offset="100%" stop-color="#FFB6C1" stop-opacity=".55"/>
          </linearGradient>
          <clipPath id="jn-body-clip"><ellipse cx="70" cy="85" rx="46" ry="43"/></clipPath>
        </defs>

        <ellipse class="jn-shadow" cx="70" cy="131" rx="32" ry="6" fill="#000" opacity=".14"/>

        <!-- asas (atrás do corpo) -->
        <ellipse class="jn-wing jn-wing-l" cx="40" cy="70" rx="18" ry="30" fill="url(#jn-grad-wing)"/>
        <ellipse class="jn-wing jn-wing-r" cx="100" cy="70" rx="18" ry="30" fill="url(#jn-grad-wing)"/>

        <!-- patinhas -->
        <g class="jn-patas" stroke="#1C1C1E" stroke-width="3" stroke-linecap="round">
          <path d="M34,90 Q26,96 22,100"/>
          <path d="M32,104 Q24,108 19,110"/>
          <path d="M37,117 Q29,122 24,126"/>
          <path d="M106,90 Q114,96 118,100"/>
          <path d="M108,104 Q116,108 121,110"/>
          <path d="M103,117 Q111,122 116,126"/>
        </g>

        <!-- corpo: casco vermelho brilhante em cima, base preta fosca embaixo -->
        <ellipse class="jn-body" cx="70" cy="85" rx="46" ry="43" fill="url(#jn-grad-body)" stroke="#7A211B" stroke-width="1.5"/>
        <ellipse cx="70" cy="118" rx="46" ry="22" fill="#1C1C1E" opacity=".9" clip-path="url(#jn-body-clip)"/>
        <line x1="70" y1="50" x2="70" y2="122" stroke="#7A211B" stroke-width="2" clip-path="url(#jn-body-clip)"/>
        <ellipse cx="54" cy="64" rx="11" ry="7.5" fill="#fff" opacity=".2" clip-path="url(#jn-body-clip)"/>
        <g fill="#1C1C1E" clip-path="url(#jn-body-clip)">
          <circle cx="52" cy="68" r="5.5"/>
          <circle cx="46" cy="90" r="6"/>
          <circle cx="88" cy="68" r="5.5"/>
          <circle cx="94" cy="90" r="6"/>
        </g>

        <!-- cabeça: contínua com o corpo, sem divisão -->
        <circle cx="70" cy="38" r="28" fill="url(#jn-grad-head)"/>
        <path class="jn-antenna jn-antenna-l" d="M58,18 Q50,6 46,2" stroke="#1C1C1E" stroke-width="3" stroke-linecap="round" fill="none"/>
        <circle cx="46" cy="2" r="4" fill="#1C1C1E"/>
        <path class="jn-antenna jn-antenna-r" d="M82,18 Q90,6 94,2" stroke="#1C1C1E" stroke-width="3" stroke-linecap="round" fill="none"/>
        <circle cx="94" cy="2" r="4" fill="#1C1C1E"/>

        <circle class="jn-cheek" cx="49" cy="48" r="6" fill="#FFB6C1" opacity=".55"/>
        <circle class="jn-cheek" cx="91" cy="48" r="6" fill="#FFB6C1" opacity=".55"/>

        <g class="jn-eye">
          <ellipse cx="57" cy="35" rx="12" ry="14" fill="#fff"/>
          <circle class="jn-pupil" cx="58.5" cy="36" r="7" fill="#1C1C1E"/>
          <circle cx="61.5" cy="31.5" r="2.2" fill="#fff"/>
          <circle cx="56" cy="41" r="1.1" fill="#fff" opacity=".8"/>
          <path class="jn-eyelid" d="M45,22 a12,14 0 0 1 24,0 Z" fill="#1C1C1E"/>
        </g>
        <g class="jn-eye">
          <ellipse cx="83" cy="35" rx="12" ry="14" fill="#fff"/>
          <circle class="jn-pupil" cx="84.5" cy="36" r="7" fill="#1C1C1E"/>
          <circle cx="87.5" cy="31.5" r="2.2" fill="#fff"/>
          <circle cx="82" cy="41" r="1.1" fill="#fff" opacity=".8"/>
          <path class="jn-eyelid" d="M71,22 a12,14 0 0 1 24,0 Z" fill="#1C1C1E"/>
        </g>

        <path class="jn-mouth" d="M64,53 Q70,57 76,53" stroke="#1C1C1E" stroke-width="2" stroke-linecap="round" fill="none"/>
      </svg>
      <span class="joaninha-heart" id="joaninha-heart" data-jn="coracao">❤️</span>
    </button>
  `;

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

    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    const estado = { andando: false, voando: false, pausada: false, dormindo: false };
    let ultimaAtividade = Date.now();
    let bolhaTimer = null;
    let aoInteragirCallback = null;

    function acordar() {
      if (!estado.dormindo) return;
      estado.dormindo = false;
      joaninha.classList.remove('jn-dormindo');
    }
    function dormir() {
      if (estado.dormindo) return;
      estado.dormindo = true;
      pararDeVagarAgora();
      joaninha.classList.add('jn-dormindo');
    }
    function registrarAtividade() {
      ultimaAtividade = Date.now();
      acordar();
    }
    ['mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach((evt) => {
      window.addEventListener(evt, registrarAtividade, { passive: true });
    });

    function apontarOffset(dx, dy) {
      const dist = Math.hypot(dx, dy);
      if (dist < 0.0001) {
        host.style.setProperty('--jn-pupil-x', '0px');
        host.style.setProperty('--jn-pupil-y', '0px');
        return;
      }
      const ang = Math.atan2(dy, dx), r = 2.4;
      host.style.setProperty('--jn-pupil-x', (Math.cos(ang) * r).toFixed(2) + 'px');
      host.style.setProperty('--jn-pupil-y', (Math.sin(ang) * r).toFixed(2) + 'px');
    }
    function look(x, y) {
      if (estado.andando || estado.voando) return;
      const rect = host.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5, cy = rect.top + rect.height * 0.28;
      const dx = x - cx, dy = y - cy;
      if (Math.hypot(dx, dy) > 460) { apontarOffset(0, 0); return; }
      apontarOffset(dx, dy);
    }
    window.addEventListener('mousemove', (e) => {
      registrarAtividade();
      look(e.clientX, e.clientY);
    }, { passive: true });

    // piscar de vez em quando
    (function agendarPiscada() {
      setTimeout(() => {
        if (!estado.voando && !estado.andando && !estado.dormindo) {
          joaninha.classList.add('jn-piscando');
          setTimeout(() => joaninha.classList.remove('jn-piscando'), 200);
        }
        agendarPiscada();
      }, 2600 + Math.random() * 3400);
    })();

    // de vez em quando abre e fecha as asinhas, mesmo parada
    (function agendarAsinha() {
      setTimeout(() => {
        if (!estado.voando && !estado.andando && !estado.pausada && !estado.dormindo) {
          joaninha.classList.add('jn-asa-twitch');
          setTimeout(() => joaninha.classList.remove('jn-asa-twitch'), 900);
        }
        agendarAsinha();
      }, 16000 + Math.random() * 14000);
    })();

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
    }
    async function vagar() {
      if (estado.pausada || document.querySelector('.modal-overlay.open')) return;
      estado.andando = true;
      joaninha.classList.add('jn-andando');
      const alvo1 = posicaoAleatoria();
      host.style.right = alvo1.right + 'px';
      host.style.bottom = alvo1.bottom + 'px';
      await esperar(1900);
      joaninha.classList.remove('jn-andando');
      estado.andando = false;
      if (estado.pausada || Date.now() - ultimaAtividade < 1500) return;
      estado.voando = true;
      joaninha.classList.add('jn-voando');
      const alvo2 = posicaoAleatoria();
      host.style.right = alvo2.right + 'px';
      host.style.bottom = alvo2.bottom + 'px';
      await esperar(1600);
      joaninha.classList.remove('jn-voando');
      joaninha.classList.add('jn-pousando');
      estado.voando = false;
      await esperar(550);
      joaninha.classList.remove('jn-pousando');
    }
    setInterval(() => {
      if (estado.pausada || estado.andando || estado.voando || estado.dormindo) return;
      if (document.querySelector('.modal-overlay.open')) return;
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
          joaninha.classList.add('jn-sorrindo');
          setTimeout(() => joaninha.classList.remove('jn-sorrindo'), 650);
          break;
        case 'comemorar': case 'celebrate':
          joaninha.classList.add('jn-comemorando');
          heart.classList.remove('jn-pop');
          void heart.offsetWidth;
          heart.classList.add('jn-pop');
          falar(MSGS_COMEMORACAO[Math.floor(Math.random() * MSGS_COMEMORACAO.length)], 2200);
          setTimeout(() => joaninha.classList.remove('jn-comemorando'), 1100);
          break;
        case 'pensando-on': case 'thinking':
          joaninha.classList.add('jn-pensando');
          break;
        case 'pensando-off':
          joaninha.classList.remove('jn-pensando');
          break;
        case 'atenta-on':
          joaninha.classList.add('jn-atenta');
          break;
        case 'atenta-off':
          joaninha.classList.remove('jn-atenta');
          break;
        case 'surprised':
          joaninha.classList.add('jn-surpresa');
          setTimeout(() => joaninha.classList.remove('jn-surpresa'), 500);
          break;
        case 'worried':
          joaninha.classList.add('jn-preocupada-gesto');
          setTimeout(() => joaninha.classList.remove('jn-preocupada-gesto'), 2400);
          break;
        case 'wave':
          joaninha.classList.add('jn-acenando');
          setTimeout(() => joaninha.classList.remove('jn-acenando'), 1300);
          break;
        case 'blink':
          joaninha.classList.add('jn-piscando');
          setTimeout(() => joaninha.classList.remove('jn-piscando'), 200);
          break;
        case 'walk':
          pararDeVagarAgora();
          joaninha.classList.add('jn-andando');
          break;
        case 'fly':
          joaninha.classList.remove('jn-andando');
          joaninha.classList.add('jn-voando');
          break;
        case 'land':
          joaninha.classList.remove('jn-voando');
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
          break;
        case 'lookLeft': apontarOffset(-1, 0); break;
        case 'lookRight': apontarOffset(1, 0); break;
        case 'lookUp': apontarOffset(0, -1); break;
        case 'lookDown': apontarOffset(0, 1); break;
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
