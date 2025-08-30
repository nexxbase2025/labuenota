
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

  navigator.mediaSession.setActionHandler('play', () => { playRadio(); });
  navigator.mediaSession.setActionHandler('pause', () => { pauseRadio(); });
}

// =======================
// SPECTRUM DE BARRAS
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
// REPRODUCCIÓN RADIO
// =======================
function playRadio() {
  audio.manualPaused = false;
  audio.load();
  if (!window.audioCtx) {
    window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const track = window.audioCtx.createMediaElementSource(audio);
    track.connect(window.audioCtx.destination);
  }
  if (window.audioCtx.state === 'suspended') window.audioCtx.resume();

  audio.play().then(() => {
    playPauseBtn.textContent = '⏸';
    isPlaying = true;
    animateSpectrum();
  }).catch(err => {
    console.warn('Error al reproducir, reintentando...', err);
    setTimeout(playRadio, 1000);
  });
}

function pauseRadio() {
  audio.manualPaused = true;
  audio.pause();
  playPauseBtn.textContent = '▶';
  isPlaying = false;
  cancelAnimationFrame(animationId);
}

// =======================
// BOTÓN PLAY / PAUSE
// =======================
playPauseBtn.addEventListener('click', () => {
  if (!isPlaying) playRadio();
  else pauseRadio();
});

// =======================
// DESBLOQUEO AUDIO AL TOQUE
// =======================
document.addEventListener('touchstart', () => {
  if (audio.paused && !isPlaying) audio.play().then(() => audio.pause()).catch(() => {});
}, { once: true });

// =======================
// REINTENTAR SI SE DETIENE
// =======================
audio.addEventListener('pause', () => {
  if (isPlaying && !audio.manualPaused) setTimeout(playRadio, 500);
});
function restartStream() {
  if (isPlaying && !audio.manualPaused) setTimeout(playRadio, 1000);
}
audio.addEventListener('stalled', restartStream);
audio.addEventListener('error', restartStream);
audio.addEventListener('ended', restartStream);
window.addEventListener('online', () => { if (isPlaying) restartStream(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isPlaying && audio.paused) restartStream();
});
window.addEventListener('pagehide', () => { if (isPlaying) restartStream(); });
window.addEventListener('pageshow', () => { if (isPlaying) restartStream(); });

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
// SUBVISTAS: ARTISTAS / CLIENTES
// =======================

// Abre subpágina en overlay sin pausar el audio
function abrirPagina(pagina){
  const iframeContainer = document.getElementById('iframe-container');
  const iframe = document.getElementById('subpage-frame');

  iframe.src = pagina;               // carga artistas.html o clientes.html
  iframeContainer.style.display = 'block'; // muestra overlay
  document.body.classList.add('subview-open'); // oculta la UI del index (pero NO el audio)

  // Hacer que el botón "Atrás" cierre la subvista
  if (!history.state || !history.state.subview) {
    history.pushState({ subview: true }, '');
  }
}

// Disponible para que el hijo pueda “volver al inicio”
window.cerrarSubview = function (){
  const iframeContainer = document.getElementById('iframe-container');
  const iframe = document.getElementById('subpage-frame');

  iframeContainer.style.display = 'none';
  iframe.src = 'about:blank';
  document.body.classList.remove('subview-open');

  // Si estamos en un estado de subvista, regresar uno en el historial para no acumular
  if (history.state && history.state.subview) {
    history.back();
  }
};

// Cerrar subvista al presionar Atrás del navegador
window.addEventListener('popstate', () => {
  const iframeContainer = document.getElementById('iframe-container');
  if (iframeContainer && iframeContainer.style.display === 'block') {
    window.cerrarSubview();
  }
});

// Aceptar mensajes desde iframes (fallback universal)
window.addEventListener('message', (e) => {
  if (e && e.data && e.data.type === 'close-subview') {
    if (typeof window.cerrarSubview === 'function') window.cerrarSubview();
  }
});

// =======================
// PELI → debe pausar la radio
// =======================
peliBubble.addEventListener('click', () => {
  pauseRadio(); // obligatorio
  const features = 'width=' + screen.width + ',height=' + screen.height + ',fullscreen=yes';
  window.open('peli.html', '_blank', features);
});

