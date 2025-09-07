
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

// Estado
let isPlaying = false;
let manualPaused = false;       // true solo cuando el usuario pulsa "pausa"
let autoInterrupted = false;    // true si el SO u otra app nos interrumpió
let lastPlayClick = 0;          // para evitar “play→pause” inmediato falso
let animationId = null;
let deferredPrompt = null;
let keepAliveTimer = null;

// =======================
// ESPECTRO (sin tocar estilos / DOM)
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
  animationId = requestAnimationFrame(animateSpectrum);
}
function startSpectrum() {
  if (!animationId) animateSpectrum();
}
function stopSpectrum() {
  if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
}

// =======================
// MEDIA SESSION
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
  navigator.mediaSession.setActionHandler('play', () => playRadio().catch(()=>{}));
  navigator.mediaSession.setActionHandler('pause', () => pauseRadio());
}

// =======================
// UTILIDADES AUDIO
// =======================
function ensureBaseSrc() {
  if (!audio.dataset.src) audio.dataset.src = audio.src;
}
function cacheBustedSrc() {
  const base = audio.dataset.src || audio.src;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}ts=${Date.now()}`;
}

// Reproducción robusta sin burbujas extras
async function playRadio(reload = false) {
  ensureBaseSrc();
  manualPaused = false;
  lastPlayClick = Date.now();

  if (reload) {
    audio.src = cacheBustedSrc();
    audio.load();
  }

  try {
    await audio.play(); // esperamos a que realmente inicie
    isPlaying = true;
    autoInterrupted = false;
    playPauseBtn && (playPauseBtn.textContent = '⏸');
    startSpectrum();
    startKeepAlive();
  } catch (err) {
    // Si el navegador no deja (p. ej. sin gesto), no mostramos nada: el usuario puede tocar Play.
    console.warn('Bloqueado hasta interacción del usuario (silencioso):', err);
    isPlaying = false;
    stopSpectrum();
    stopKeepAlive();
    throw err;
  }
}

function pauseRadio() {
  manualPaused = true;
  audio.pause();
  isPlaying = false;
  playPauseBtn && (playPauseBtn.textContent = '▶');
  stopSpectrum();
  stopKeepAlive();
}

// =======================
// EVENTOS <audio> — estados reales
// =======================
audio.addEventListener('playing', () => {
  isPlaying = true;
  playPauseBtn && (playPauseBtn.textContent = '⏸');
  startSpectrum();
  startKeepAlive();
});
audio.addEventListener('pause', () => {
  // Ignorar “pausa fantasma” dentro de 1200ms tras pulsar play (evita el bug de doble toque)
  const justStarted = (Date.now() - lastPlayClick) < 1200;
  if (!manualPaused && !justStarted) {
    // interpretamos interrupción del sistema u otra app
    autoInterrupted = true;
  }
  if (manualPaused || !isPlaying) {
    stopSpectrum();
    stopKeepAlive();
  }
});

// Reconectar rápido si el stream se congela
['stalled','error','ended','abort','waiting'].forEach(evt => {
  audio.addEventListener(evt, () => hardRestart());
});

// =======================
// AUTO-RESUME tras llamada/TikTok/volver a la app
// =======================
function tryAutoResume() {
  if (autoInterrupted && !manualPaused) {
    playRadio(false).catch(()=>{ /* sin burbujas */ });
  }
}
window.addEventListener('focus', tryAutoResume);
window.addEventListener('pageshow', tryAutoResume);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tryAutoResume();
});

// Importante: NO pausar por pantalla apagada / background.
// (No añadimos listeners de pause por visibility/blur/pagehide)

// =======================
// REINTENTOS Y CAMBIO DE RED
// =======================
function hardRestart(delay = 250) {
  if (!manualPaused) {
    setTimeout(() => playRadio(true).catch(()=>{}), delay);
  }
}
window.addEventListener('online', () => hardRestart(120));
if ('connection' in navigator && navigator.connection?.addEventListener) {
  navigator.connection.addEventListener('change', () => hardRestart(120));
}

// Keep-alive suave: si en primer plano el audio queda pausado por red, intenta reproducir
function startKeepAlive() {
  stopKeepAlive();
  keepAliveTimer = setInterval(() => {
    if (!manualPaused && document.visibilityState === 'visible') {
      if (audio.paused) playRadio(false).catch(()=>{});
    }
  }, 5000);
}
function stopKeepAlive() {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
}

// =======================
// BOTÓN PLAY/PAUSE
// =======================
playPauseBtn && playPauseBtn.addEventListener('click', () => {
  if (!isPlaying) playRadio().catch(()=>{});
  else pauseRadio();
});

// =======================
// INSTALACIÓN ANDROID (igual)
// =======================
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
// INSTALACIÓN IOS (igual)
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
// SUBVISTAS internas (mantienen audio)
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
  if (e?.data?.type === 'close-subview') {
    if (typeof window.cerrarSubview === 'function') window.cerrarSubview();
  }
});

// =======================
// Peli → pausar la radio (sin cambios)
// =======================
peliBubble && peliBubble.addEventListener('click', () => {
  pauseRadio();
  const features = 'width=' + screen.width + ',height=' + screen.height + ',fullscreen=yes';
  window.open('peli.html', '_blank', features);
});

// =======================
// Compartir (igual)
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

