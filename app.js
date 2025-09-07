
/* =========================================
   app.js — AUDIO ESTABLE + Pulso del logo ajustable
   - Audio estable (sin microcortes, sin pausar por pantalla)
   - Auto-resume tras llamadas/TikTok
   - Reconecta solo cuando es necesario
   - Pulso visual del #logo mientras suena (NO usa WebAudio)
========================================== */

// ====== Referencias (tu DOM existente) ======
const audio = document.getElementById('audio');
const playPauseBtn = document.getElementById('playPauseBtn');
const spectrum = document.getElementById('spectrum');
const installBubble = document.getElementById('install-bubble');
const iosInstallPrompt = document.getElementById('ios-install-prompt');
const closeIosPromptBtn = document.getElementById('closeIosPromptBtn');
const peliBubble = document.getElementById('peli-bubble');

// ====== Perillas del pulso del logo (AJUSTA AQUÍ si quieres) ======
const LOGO_BEAT_SPEED = 1.00;     // 0.6 = más lento | 1.0 = normal | 1.5 = más rápido
const LOGO_BEAT_INTENSITY = 1.00; // 0.6 = suave    | 1.0 = normal | 1.3 = más fuerte

// === Pulso del logo (solo visual; no toca audio) ===
const logoEl = document.getElementById('logo');
let logoBeatRAF = null;

function startLogoBeat() {
  if (!logoEl || logoBeatRAF) return;
  const startedAt = performance.now();
  // Frecuencias base escaladas por tu “perilla” de velocidad
  const base1 = 6.0 * LOGO_BEAT_SPEED;
  const base2 = 9.7 * LOGO_BEAT_SPEED;
  const maxScale = 0.06 * LOGO_BEAT_INTENSITY; // 0.06 ≈ +6% de tamaño

  const loop = (t) => {
    const sec = (t - startedAt) / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(sec * base1) + 0.15 * Math.sin(sec * base2);
    const clamped = Math.min(Math.max(pulse, 0), 1);
    const scale = 1 + clamped * maxScale;
    logoEl.style.transform = `translateX(-50%) scale(${scale.toFixed(3)})`;
    logoBeatRAF = requestAnimationFrame(loop);
  };
  logoBeatRAF = requestAnimationFrame(loop);
}

function stopLogoBeat() {
  if (logoBeatRAF) { cancelAnimationFrame(logoBeatRAF); logoBeatRAF = null; }
  if (logoEl) logoEl.style.transform = 'translateX(-50%) scale(1)';
}

// ====== Estado (audio) ======
let isPlaying = false;        // intención: debería sonar
let manualPaused = false;     // pausa pedida por el usuario
let interrupted = false;      // SO/otra app nos interrumpió
let lastUserPlayAt = 0;       // para ignorar "pausa fantasma"
let startInProgress = false;  // evita dobles arranques
let baseSrc = (audio && (audio.getAttribute('src') || audio.src)) || '';

if (audio) {
  audio.preload = 'auto';
  audio.setAttribute('playsinline','');
  audio.setAttribute('webkit-playsinline','');
}

// ====== ESPECTRO (sin tocar tu CSS/HTML) ======
const bars = [];
if (spectrum) {
  for (let i = 0; i < 16; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    spectrum.appendChild(bar);
    bars.push(bar);
  }
}
let animId = null;
function animateSpectrum() {
  for (const b of bars) b.style.height = (Math.random() * 100) + '%';
  animId = requestAnimationFrame(animateSpectrum);
}
function startSpectrum(){ if (!animId && bars.length) animateSpectrum(); }
function stopSpectrum(){ if (animId){ cancelAnimationFrame(animId); animId = null; } }

// ====== Utilidades ======
function ensureBaseSrc(){
  if (!baseSrc) baseSrc = audio.getAttribute('src') || audio.src || '';
}
function cacheBusted(){
  ensureBaseSrc();
  const sep = baseSrc.includes('?') ? '&' : '?';
  return `${baseSrc}${sep}ts=${Date.now()}`;
}
function hardReload(){
  // Recarga DURA solo cuando realmente hay error/fin de datos
  ensureBaseSrc();
  if (!baseSrc) return;
  audio.pause();
  audio.src = cacheBusted();
  audio.load();
}

// ====== Play / Pause (sin trucos agresivos) ======
async function startPlayback({ forceReload = false } = {}){
  if (!audio || startInProgress) return;
  startInProgress = true;
  manualPaused = false;
  lastUserPlayAt = Date.now();

  if (forceReload) hardReload();

  try {
    if (audio.readyState < 1) audio.load();
    await audio.play();
    isPlaying = true;
    interrupted = false;
    playPauseBtn && (playPauseBtn.textContent = '⏸');
    startSpectrum();
    startLogoBeat(); // 🔹 activa pulso al iniciar
  } catch (e) {
    try {
      const was = audio.muted; audio.muted = true;
      await audio.play();
      await new Promise(r=>setTimeout(r,50));
      audio.muted = was;
      if (audio.paused) await audio.play();
      isPlaying = true;
      interrupted = false;
      playPauseBtn && (playPauseBtn.textContent = '⏸');
      startSpectrum();
      startLogoBeat(); // 🔹 también en el fallback
    } catch (e2) {
      console.warn('Se requiere interacción del usuario para reproducir.', e2);
      isPlaying = false;
      stopSpectrum();
      stopLogoBeat();
    }
  } finally {
    startInProgress = false;
  }
}

function pausePlayback(){
  if (!audio) return;
  manualPaused = true;
  audio.pause();
  isPlaying = false;
  playPauseBtn && (playPauseBtn.textContent = '▶');
  stopLogoBeat();  // 🔹 detener pulso al pausar
  stopSpectrum();
}

// ====== Eventos del <audio> ======
audio.addEventListener('playing', () => {
  isPlaying = true;
  playPauseBtn && (playPauseBtn.textContent = '⏸');
  startSpectrum();
  startLogoBeat(); // 🔹 asegurar pulso si el evento llega primero
});

audio.addEventListener('pause', () => {
  const justStarted = (Date.now() - lastUserPlayAt) < 1200;
  if (!manualPaused && !justStarted) interrupted = true;
  if (manualPaused || !isPlaying) {
    stopSpectrum();
    stopLogoBeat(); // 🔹 detener pulso si se pausa
  }
});

// IMPORTANTÍSIMO: NO recargar el stream por 'waiting'/'suspend' (causa microcortes).
audio.addEventListener('error', () => {
  setTimeout(() => startPlayback({ forceReload: true }), 400);
});
audio.addEventListener('stalled', () => {
  if (!manualPaused) {
    setTimeout(() => { if (audio.paused) startPlayback().catch(()=>{}); }, 600);
  }
});
audio.addEventListener('ended', () => {
  if (!manualPaused) setTimeout(() => startPlayback({ forceReload: true }), 600);
});

// ====== Auto-resume al volver a la app ======
function tryAutoResume(){
  if (interrupted && !manualPaused){
    interrupted = false;
    if (audio.paused) startPlayback().catch(()=>{});
  }
}
window.addEventListener('focus', tryAutoResume);
window.addEventListener('pageshow', tryAutoResume);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tryAutoResume(); });

// ====== Cambio de red / volver online (conservador) ======
window.addEventListener('online', () => {
  if (audio.paused && !manualPaused) startPlayback({ forceReload: true });
});
if (navigator.connection?.addEventListener){
  navigator.connection.addEventListener('change', () => {
    if (audio.paused && !manualPaused) startPlayback({ forceReload: true });
  });
}

// ====== Botón Play / Pause (tu UI) ======
playPauseBtn && playPauseBtn.addEventListener('click', () => {
  if (!isPlaying) startPlayback();
  else pausePlayback();
});

// ====== Instalación Android (igual) ======
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBubble && (installBubble.style.display = 'block');
});
installBubble?.addEventListener('click', async () => {
  installBubble.style.display = 'none';
  if (deferredPrompt){
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }
});

// ====== Instalación iOS (igual) ======
function isIos(){ return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isStandalone(){ return ('standalone' in navigator) && navigator.standalone; }
document.addEventListener('DOMContentLoaded', () => {
  if (iosInstallPrompt && isIos() && !isStandalone() && !localStorage.getItem('iosPromptShown')){
    iosInstallPrompt.style.display = 'block';
  }
});
closeIosPromptBtn?.addEventListener('click', () => {
  iosInstallPrompt.style.display = 'none';
  localStorage.setItem('iosPromptShown', 'true');
});

// ====== Subvistas (mantienen audio, como antes) ======
function abrirPagina(pagina){
  const c = document.getElementById('iframe-container');
  const f = document.getElementById('subpage-frame');
  if (!c || !f) return;
  f.src = pagina;
  c.style.display = 'block';
  document.body.classList.add('subview-open');
  if (!history.state || !history.state.subview) history.pushState({ subview:true }, '');
}
window.abrirPagina = abrirPagina;

window.cerrarSubview = function(){
  const c = document.getElementById('iframe-container');
  const f = document.getElementById('subpage-frame');
  if (!c || !f) return;
  c.style.display = 'none';
  f.src = 'about:blank';
  document.body.classList.remove('subview-open');
  if (history.state && history.state.subview) history.back();
};
window.addEventListener('popstate', () => {
  const c = document.getElementById('iframe-container');
  if (c && c.style.display === 'block') window.cerrarSubview();
});
window.addEventListener('message', (e) => {
  if (e?.data?.type === 'close-subview') window.cerrarSubview?.();
});

// ====== Peli (pausa radio, como lo tienes) ======
peliBubble?.addEventListener('click', () => {
  pausePlayback();
  const features = 'width=' + screen.width + ',height=' + screen.height + ',fullscreen=yes';
  window.open('peli.html', '_blank', features);
});

// ====== Compartir (igual) ======
function compartirApp(){
  const url = "https://labuenota.vercel.app/";
  const text = "¡Descarga la app de La Buenota Radio Online, se puede ver películas Gratis y tiene buena música!";
  if (navigator.share) navigator.share({ title: "La Buenota Radio Online", text, url }).catch(console.error);
  else prompt("Copia el enlace para compartir:", url);
}
window.compartirApp = compartirApp;

