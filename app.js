
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
let peliWindow = null;

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
// REPRODUCCIÓN RADIO AJUSTADA
// =======================
function playRadio() {
  audio.manualPaused = false;
  audio.load(); // Forzar carga del stream

  // AudioContext para Android/iOS
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
  }).catch(err => console.error('Error al reproducir:', err));
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

// =======================
// RECONEXIÓN AUTOMÁTICA
// =======================
function restartStream() {
  if (isPlaying && !audio.manualPaused) {
    console.log("♻️ Intentando reconectar el stream...");
    setTimeout(playRadio, 1000);
  }
}

audio.addEventListener('stalled', restartStream);
audio.addEventListener('error', restartStream);
audio.addEventListener('ended', restartStream);
window.addEventListener('online', () => { if (isPlaying) restartStream(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isPlaying && audio.paused) restartStream();
});

// =======================
// VISIBILITY CHANGE (SPECTRUM)
// =======================
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isPlaying) animateSpectrum();
});

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
// PELI
// =======================
peliBubble.addEventListener('click', () => {
  if (isPlaying) pauseRadio();
  peliWindow = window.open('peli.html', '_blank', 'width=' + screen.width + ',height=' + screen.height + ',fullscreen=yes');
  window.addEventListener('message', (e) => {
    if (e.data === 'resumeRadio') playRadio();
  });
});