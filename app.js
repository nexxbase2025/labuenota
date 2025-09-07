
// =======================
// ELEMENTOS PRINCIPALES
// =======================
const audio = document.getElementById('audio');
const playPauseBtn = document.getElementById('playPauseBtn');
const spectrum = document.getElementById('spectrum');
const installBubble = document.getElementById('install-bubble');
const iosInstallPrompt = document.getElementById('ios-install-prompt');
const closeIosPromptBtn = document.getElementById('closeIosPromptBtn');
const peliBubble = document.getElementById('peli-bubble');

let isPlaying = false;
let animationId;
let deferredPrompt;

// Flags de control
let autoPausedByFocus = false; // pausa por llamada / otra app con audio
let forceReload = false;       // reconexión dura tras error de red
let unlocked = false;          // audio desbloqueado por gesto
let keepAliveTimer = null;

// --- Botón CTA para desbloquear audio si el navegador lo exige
let activateBtn = document.getElementById('activateSound');
if (!activateBtn) {
  activateBtn = document.createElement('button');
  activateBtn.id = 'activateSound';
  activateBtn.textContent = 'Tocar para reanudar';
  activateBtn.style.display = 'none';
  document.body.appendChild(activateBtn);
}
activateBtn.addEventListener('click', () => {
  activateBtn.style.display = 'none';
  unlockAudio();
  playRadio(true).catch(() => {});
});

// =======================
// MEDIA SESSION (pantalla de bloqueo)
// =======================
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'LA BUENOTA RADIO ONLINE',
    artist: 'Ivibra',
    album: 'Radio Online',
    artwork: [
      { src: 'ivibra.webp', sizes: '96x96', type: 'image/webp' },
      { src: 'ivibra.webp', sizes: '128x128', type: 'image/webp' },
      { src: 'ivibra.webp', sizes: '192x192', type: 'image/webp' },
      { src: 'ivibra.webp', sizes: '256x256', type: 'image/webp' },
      { src: 'ivibra.webp', sizes: '384x384', type: 'image/webp' },
      { src: 'ivibra.webp', sizes: '512x512', type: 'image/webp' }
    ]
  });

  navigator.mediaSession.setActionHandler('play', () => { playRadio().catch(()=>{}); });
  navigator.mediaSession.setActionHandler('pause', () => { pauseRadio(); });
}

// =======================
// ESPECTRO (sin cambios visuales; animación aleatoria)
// =======================
const bars = [];
for (let i = 0; i < 16; i++) {
  const bar = document.createElement('div');
  bar.className = 'bar';
  spectrum.appendChild(bar);
  bars.push(bar);
}
function animateSpectrum() {
  bars.forEach(bar => bar.style.height = `${Math.random() * 100}%`);
  const logo = document.getElementById('logo');
  if (logo) logo.style.transform = `translateX(-50%) scale(${1 + Math.random() * 0.1})`;
  animationId = requestAnimationFrame(animateSpectrum);
}
function startSpectrum() {
  if (!animationId) animateSpectrum();
}
function stopSpectrum() {
  if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
}

// =======================
// DESBLOQUEO AUDIO AL PRIMER GESTO (iOS/Android)
// =======================
// Nota: no usamos AudioContext para que el audio nativo pueda seguir en background.
function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try {
    const wasMuted = audio.muted;
    audio.muted = true;
    audio.play().then(() => audio.pause()).finally(() => { audio.muted = wasMuted; });
  } catch (e) {}
}
['pointerdown','touchstart','mousedown','keydown'].forEach(evt => {
  document.addEventListener(evt, unlockAudio, { once: true, passive: true });
});

// =======================
// REPRODUCCIÓN ROBUSTA
// =======================
function ensureBaseSrc() {
  if (!audio.dataset.src) audio.dataset.src = audio.src;
}

function playRadio(reload = false) {
  ensureBaseSrc();
  audio.manualPaused = false;

  // Recarga dura solo en caso necesario
  if (reload || forceReload) {
    const base = audio.dataset.src;
    const sep = base.includes('?') ? '&' : '?';
    audio.src = `${base}${sep}ts=${Date.now()}`; // cache-buster
    forceReload = false;
    audio.load();
  }

  return audio.play().then(() => {
    isPlaying = true;
    playPauseBtn && (playPauseBtn.textContent = '⏸');
    startSpectrum();
    showActivate(false);
    startKeepAlive();
  }).catch(err => {
    showActivate(true);
    console.warn('Reproducción bloqueada o fallida hasta interacción del usuario.', err);
    throw err;
  });
}

function pauseRadio() {
  audio.manualPaused = true;
  audio.pause();
  isPlaying = false;
  playPauseBtn && (playPauseBtn.textContent = '▶');
  stopSpectrum();
  stopKeepAlive();
}

function showActivate(show) {
  if (!activateBtn) return;
  activateBtn.style.display = show ? 'block' : 'none';
}

// =======================
// BOTÓN PLAY / PAUSE
// =======================
playPauseBtn && playPauseBtn.addEventListener('click', () => {
  if (!isPlaying) playRadio().catch(() => {});
  else pauseRadio();
});

// =======================
// POLÍTICA DE PAUSA/REANUDACIÓN
// =======================
// IMPORTANTE: NO pausar por pantalla apagada o background.
// Dejamos que el SO gestione el foco de audio.
// Si el SO nos interrumpe (llamada / otra app), el <audio> emite 'pause'.
// Marcamos autoPausedByFocus y reanudamos al volver al frente.

audio.addEventListener('pause', () => {
  // Si no fue el usuario quien pausó, interpretamos que el SO u otra app nos interrumpió.
  if (isPlaying && !audio.manualPaused) {
    autoPausedByFocus = true;
    stopSpectrum(); // detener animación para ahorrar
  }
});

audio.addEventListener('play', () => {
  isPlaying = true;
  playPauseBtn && (playPauseBtn.textContent = '⏸');
  startSpectrum();
  startKeepAlive();
});

// Al volver al frente, si fue pausa por foco, reanudamos.
function tryAutoResume() {
  if (autoPausedByFocus && !audio.manualPaused) {
    autoPausedByFocus = false;
    playRadio(false).catch(() => { showActivate(true); });
  }
}
window.addEventListener('focus', tryAutoResume);
window.addEventListener('pageshow', tryAutoResume);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tryAutoResume();
});

// =======================
// REINTENTOS Y RECONECTAR STREAM
// =======================
function hardRestart(delay = 300) {
  if (!audio.manualPaused) {
    forceReload = true;
    setTimeout(() => playRadio(true).catch(() => { showActivate(true); }), delay);
  }
}
['stalled','error','ended','abort','waiting'].forEach(evt => {
  audio.addEventListener(evt, () => hardRestart());
});
window.addEventListener('online', () => hardRestart(100));

// Reaccionar al cambio de red (Wi-Fi/datos)
if ('connection' in navigator && navigator.connection && navigator.connection.addEventListener) {
  navigator.connection.addEventListener('change', () => hardRestart(100));
}

// Keep-alive: si el reproductor se queda pausado por red en primer plano, reintenta suave
function startKeepAlive() {
  stopKeepAlive();
  keepAliveTimer = setInterval(() => {
    if (!audio.manualPaused && isPlaying) {
      // Si estamos visibles y el audio aparece pausado, intenta reproducir
      if (document.visibilityState === 'visible' && audio.paused) {
        playRadio(false).catch(()=>{});
      }
    }
  }, 5000);
}
function stopKeepAlive() {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
}

// =======================
// INSTALACIÓN ANDROID (sin cambios)
/// ======================
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBubble) installBubble.style.display = 'block';
});
installBubble && installBubble.addEventListener('click', async () => {
  installBubble.style.display = 'none';
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }
});

// =======================
// INSTALACIÓN IOS (sin cambios)
// =======================
function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isInStandaloneMode() { return ('standalone' in window.navigator) && window.navigator.standalone; }
document.addEventListener('DOMContentLoaded', () => {
  if (iosInstallPrompt && isIos() && !isInStandaloneMode() && !localStorage.getItem('iosPromptShown')) {
    iosInstallPrompt.style.display = 'block';
  }
});
closeIosPromptBtn && closeIosPromptBtn.addEventListener('click', () => {
  iosInstallPrompt.style.display = 'none';
  localStorage.setItem('iosPromptShown', 'true');
});

// =======================
// SUBVISTAS internas (galería/clientes) mantienen audio
// =======================
function abrirPagina(pagina){
  const iframeContainer = document.getElementById('iframe-container');
  const iframe = document.getElementById('subpage-frame');
  if (!iframeContainer || !iframe) return;
  iframe.src = pagina;
  iframeContainer.style.display = 'block';
  document.body.classList.add('subview-open');
  if (!history.state || !history.state.subview) {
    history.pushState({ subview: true }, '');
  }
}
window.abrirPagina = abrirPagina;

window.cerrarSubview = function (){
  const iframeContainer = document.getElementById('iframe-container');
  const iframe = document.getElementById('subpage-frame');
  if (!iframeContainer || !iframe) return;
  iframeContainer.style.display = 'none';
  iframe.src = 'about:blank';
  document.body.classList.remove('subview-open');
  if (history.state && history.state.subview) history.back();
};
window.addEventListener('popstate', () => {
  const iframeContainer = document.getElementById('iframe-container');
  if (iframeContainer && iframeContainer.style.display === 'block') {
    window.cerrarSubview();
  }
});
window.addEventListener('message', (e) => {
  if (e && e.data && e.data.type === 'close-subview') {
    if (typeof window.cerrarSubview === 'function') window.cerrarSubview();
  }
});

// =======================
// Peli → pausar la radio (como antes)
// =======================
peliBubble && peliBubble.addEventListener('click', () => {
  pauseRadio();
  const features = 'width=' + screen.width + ',height=' + screen.height + ',fullscreen=yes';
  window.open('peli.html', '_blank', features);
});

// =======================
// Compartir (como antes)
// =======================
function compartirApp() {
  const url = "https://labuenota.vercel.app/";
  const text = "¡Descarga la app de La Buenota Radio Online, se puede ver películas Gratis y tiene buena música!";
  if (navigator.share) {
    navigator.share({ title: "La Buenota Radio Online", text, url }).catch(console.error);
  } else {
    prompt("Copia el enlace para compartir:", url);
  }
}
window.compartirApp = compartirApp;

