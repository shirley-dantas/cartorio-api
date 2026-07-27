/**
 * Joaninha - assistente virtual do PRIME
 * -----------------------------------------------------------
 * Como usar no HTML do painel:
 *
 *   <link rel="stylesheet" href="joaninha/joaninha.css">
 *   <script src="joaninha/joaninha.js"></script>
 *
 * Depois de carregado, o objeto global `joaninha` fica disponível
 * em qualquer lugar do painel:
 *
 *   joaninha.play("idle");      // parada, respirando (estado padrão)
 *   joaninha.play("walk");      // andando
 *   joaninha.play("fly");       // voando
 *   joaninha.play("thinking");  // pensativa (ex: processando algo)
 *   joaninha.play("happy");     // comemorando (ex: tarefa concluída)
 *   joaninha.play("sleep");     // descansando (ex: 1 min sem atividade)
 *
 *   joaninha.followCursor(true);  // ela "olha" na direção do cursor
 *   joaninha.followCursor(false); // desliga
 *
 * Cada chamada joaninha.play() troca a imagem com um fade suave.
 * Não é preciso esperar nada - pode chamar quantas vezes quiser.
 */

(function () {
  // -----------------------------------------------------------
  // 1. Onde estão as imagens de cada estado.
  //    Ajuste os caminhos aqui se você mover a pasta assets/.
  // -----------------------------------------------------------
  const BASE_PATH = "joaninha/assets/";

  const POSES = {
    idle: BASE_PATH + "idle.png",
    walk: BASE_PATH + "walk.png",
    fly: BASE_PATH + "fly.png",
    thinking: BASE_PATH + "thinking.png",
    happy: BASE_PATH + "happy.png",
    sleep: BASE_PATH + "sleep.png",
  };

  const DEFAULT_STATE = "idle";

  // Depois de quantos ms sem nenhuma chamada joaninha.play()
  // ela volta sozinha para o idle (parada). Ajuste ou remova se
  // preferir controlar isso manualmente pelo painel.
  const AUTO_RETURN_TO_IDLE_MS = 6000;

  // -----------------------------------------------------------
  // 2. Monta o elemento na tela (uma vez só, quando o script carrega)
  // -----------------------------------------------------------
  let imgEl, wrapperEl;
  let currentState = DEFAULT_STATE;
  let autoReturnTimer = null;
  let cursorEnabled = false;

  function createElement() {
    wrapperEl = document.createElement("div");
    wrapperEl.id = "joaninha-wrapper";

    imgEl = document.createElement("img");
    imgEl.id = "joaninha-avatar";
    imgEl.src = POSES[DEFAULT_STATE];
    imgEl.alt = "Joaninha, assistente do PRIME";

    wrapperEl.appendChild(imgEl);
    document.body.appendChild(wrapperEl);
  }

  // -----------------------------------------------------------
  // 3. Troca de estado com fade
  // -----------------------------------------------------------
  function play(state) {
    if (!POSES[state]) {
      console.warn(`[joaninha] estado "${state}" não existe. Use um de: ${Object.keys(POSES).join(", ")}`);
      return;
    }
    if (state === currentState && !imgEl.classList.contains("joaninha-fade-out")) {
      return; // já está nesse estado, não faz nada
    }

    currentState = state;

    // fade out -> troca imagem -> fade in
    imgEl.classList.add("joaninha-fade-out");
    window.setTimeout(() => {
      imgEl.src = POSES[state];
      imgEl.classList.remove("joaninha-fade-out");
    }, 200);

    // reagenda o retorno automático ao idle (exceto se o próprio
    // estado chamado já for idle ou sleep)
    if (autoReturnTimer) window.clearTimeout(autoReturnTimer);
    if (state !== "idle" && state !== "sleep" && AUTO_RETURN_TO_IDLE_MS > 0) {
      autoReturnTimer = window.setTimeout(() => play("idle"), AUTO_RETURN_TO_IDLE_MS);
    }
  }

  // -----------------------------------------------------------
  // 4. Seguir o cursor (leve inclinação/deslocamento na direção do mouse)
  // -----------------------------------------------------------
  function handleMouseMove(e) {
    if (!cursorEnabled || !wrapperEl) return;
    const rect = wrapperEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // direção do cursor em relação ao centro da joaninha, limitada
    const deltaX = Math.max(-1, Math.min(1, (e.clientX - centerX) / 200));
    const deltaY = Math.max(-1, Math.min(1, (e.clientY - centerY) / 200));

    const tiltX = deltaY * 6; // graus
    const tiltY = deltaX * -6;

    imgEl.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  }

  function followCursor(enabled) {
    cursorEnabled = !!enabled;
    if (cursorEnabled) {
      document.addEventListener("mousemove", handleMouseMove);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      if (imgEl) imgEl.style.transform = "";
    }
  }

  // -----------------------------------------------------------
  // 5. Inicialização
  // -----------------------------------------------------------
  function init() {
    createElement();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // -----------------------------------------------------------
  // 6. Expõe a API global, como previsto no guia de marca
  // -----------------------------------------------------------
  window.joaninha = {
    play,
    followCursor,
    get state() {
      return currentState;
    },
  };
})();
