
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

// --- NUEVO: control de pausas automáticas y reconexión
let autoPausedByFocus = false; // pausa por llamada / cambio de app
let forceReload = false;       // reconexión dura tras error de red
let unlocked = false;          // audio/AudioContext desbloqueado por gesto

// --- NUEVO: botón “activar sonido” (usa estilos ya definidos en style.css)
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
// SPECTRUM DE BARRAS (sin cambios visuales)
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

// =======================
// DESBLOQUEO AUDIO AL PRIMER GESTO (iOS/Android)
// =======================
function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try {
    if (!window.audioCtx) {
      window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const track = window.audioCtx.createMediaElementSource(audio);
      track.connect(window.audioCtx.destination);
    } else if (window.audioCtx.state === 'suspended') {
      window.audioCtx.resume();
    }
    // micro reproducción silenciada para satisfacer el gesto en iOS
    const wasMuted = audio.muted;
    audio.muted = true;
    audio.play().then(() => audio.pause()).finally(() => { audio.muted = wasMuted; });
  } catch (e) {}
}
// Gesto válido en la mayoría de dispositivos
['pointerdown','touchstart','mousedown','keydown'].forEach(evt => {
  document.addEventListener(evt, unlockAudio, { once: true, passive: true });
});

// =======================
// REPRODUCCIÓN RADIO (robusta)
// =======================
function ensureAudioGraph() {
  if (!window.audioCtx) {
    window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const track = window.audioCtx.createMediaElementSource(audio);
    track.connect(window.audioCtx.destination);
  }
  if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
  if (!audio.dataset.src) audio.dataset.src = audio.src; // guarda src base
}

function playRadio(reload = false) {
  audio.manualPaused = false;
  ensureAudioGraph();

  // Recarga dura solo cuando venimos de error/fin/interrupción de red
  if (reload || forceReload) {
    const base = audio.dataset.src;
    const sep = base.includes('?') ? '&' : '?';
    audio.src = `${base}${sep}ts=${Date.now()}`; // rompe caché/proxy del stream
    forceReload = false;
    audio.load();
  }

  return audio.play().then(() => {
    playPauseBtn.textContent = '⏸';
    isPlaying = true;
    if (!animationId) animateSpectrum();
  }).catch(err => {
    // Si el navegador bloquea reproducción (autoplay), pedimos toque del usuario
    activateBtn.style.display = 'block';
    console.warn('Reproducción bloqueada. Esperando interacción del usuario.', err);
    throw err;
  });
}

function pauseRadio() {
  audio.manualPaused = true;
  audio.pause();
  playPauseBtn.textContent = '▶';
  isPlaying = false;
  if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
}

// =======================
// BOTÓN PLAY / PAUSE
// =======================
playPauseBtn.addEventListener('click', () => {
  if (!isPlaying) playRadio().catch(() => {});
  else pauseRadio();
});

// =======================
// PAUSAR/REANUDAR POR CAMBIO DE APP / LLAMADA
// =======================
function handleHide() {
  if (!audio.paused && isPlaying) {
    autoPausedByFocus = true;
    // Pausa sin marcar manual (para poder reanudar sola)
    audio.pause();
    playPauseBtn.textContent = '▶';
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
  }
}
function handleShow() {
  if (autoPausedByFocus && !audio.manualPaused) {
    autoPausedByFocus = false;
    playRadio().catch(() => { activateBtn.style.display = 'block'; });
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) handleHide(); else handleShow();
});
window.addEventListener('pagehide', handleHide);
window.addEventListener('pageshow', handleShow);
window.addEventListener('blur', handleHide);
window.addEventListener('focus', handleShow);

// =======================
// REINTENTOS INTELIGENTES SI SE DETIENE POR RED
// =======================
function hardRestart() {
  if (!audio.manualPaused && isPlaying) {
    forceReload = true;
    setTimeout(() => playRadio(true).catch(() => { activateBtn.style.display = 'block'; }), 400);
  }
}

// Pausas no manuales en primer plano → reintento suave
audio.addEventListener('pause', () => {
  if (isPlaying && !audio.manualPaused) {
    if (document.hidden || !document.hasFocus()) {
      autoPausedByFocus = true; // reanudará al volver
    } else {
      setTimeout(() => playRadio(false).catch(() => { activateBtn.style.display = 'block'; }), 500);
    }
  }
});

['stalled','error','ended','abort'].forEach(evt => audio.addEventListener(evt, hardRestart));
window.addEventListener('online', hardRestart);

// =======================
// INSTALACIÓN ANDROID
// =======================
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBubble.style.display = 'block';
});
installBubble.addEventListener('click', async () => {
  installBubble.style.display = 'none';
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }
});

// =======================
// INSTALACIÓN IOS
// =======================
function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isInStandaloneMode() { return ('standalone' in window.navigator) && window.navigator.standalone; }
document.addEventListener('DOMContentLoaded', () => {
  if (isIos() && !isInStandaloneMode() && !localStorage.getItem('iosPromptShown')) {
    iosInstallPrompt.style.display = 'block';
  }
});
closeIosPromptBtn.addEventListener('click', () => {
  iosInstallPrompt.style.display = 'none';
  localStorage.setItem('iosPromptShown', 'true');
});

// =======================
// SUBVISTAS: ARTISTAS / CLIENTES (sin tocar audio)
// =======================
function abrirPagina(pagina){
  const iframeContainer = document.getElementById('iframe-container');
  const iframe = document.getElementById('subpage-frame');
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
// PELI → debe pausar la radio (se mantiene)
// =======================
peliBubble.addEventListener('click', () => {
  pauseRadio(); // obligatorio
  const features = 'width=' + screen.width + ',height=' + screen.height + ',fullscreen=yes';
  window.open('peli.html', '_blank', features);
});

// =======================
// FUNCIÓN COMPARTIR APP (se mantiene)
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

