
/* =========================================
   app.js — AUDIO ESTABLE + Pulso del logo ajustable
========================================== */

const audio = document.getElementById('audio');
const playPauseBtn = document.getElementById('playPauseBtn');
const spectrum = document.getElementById('spectrum');
const installBubble = document.getElementById('install-bubble');
const iosInstallPrompt = document.getElementById('ios-install-prompt');
const closeIosPromptBtn = document.getElementById('closeIosPromptBtn');
const peliBubble = document.getElementById('peli-bubble');

const LOGO_BEAT_SPEED = 1.00;
const LOGO_BEAT_INTENSITY = 1.00;

const logoEl = document.getElementById('logo');
let logoBeatRAF = null;

/* === Animación Logo === */
function startLogoBeat() {
  if (!logoEl || logoBeatRAF) return;
  const startedAt = performance.now();
  const base1 = 6.0 * LOGO_BEAT_SPEED;
  const base2 = 9.7 * LOGO_BEAT_SPEED;
  const maxScale = 0.06 * LOGO_BEAT_INTENSITY;

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

/* === Audio === */
let isPlaying = false;
let manualPaused = false;
let interrupted = false;
let lastUserPlayAt = 0;
let startInProgress = false;
let baseSrc = (audio && (audio.getAttribute('src') || audio.src)) || '';

if (audio) {
  audio.preload = 'auto';
  audio.setAttribute('playsinline','');
  audio.setAttribute('webkit-playsinline','');
}

/* Spectrum */
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

function ensureBaseSrc(){ if (!baseSrc) baseSrc = audio.getAttribute('src') || audio.src || ''; }
function cacheBusted(){ ensureBaseSrc(); const sep = baseSrc.includes('?') ? '&' : '?'; return `${baseSrc}${sep}ts=${Date.now()}`; }
function hardReload(){ ensureBaseSrc(); if (!baseSrc) return; audio.pause(); audio.src = cacheBusted(); audio.load(); }

async function startPlayback({ forceReload = false } = {}){
  if (!audio || startInProgress) return;
  startInProgress = true;
  manualPaused = false;
  lastUserPlayAt = Date.now();
  if (forceReload) hardReload();
  try {
    if (audio.readyState < 1) audio.load();
    await audio.play();
    isPlaying = true; interrupted = false;
    playPauseBtn && (playPauseBtn.textContent = '⏸');
    startSpectrum(); startLogoBeat();
  } catch (e) {
    try {
      const was = audio.muted; audio.muted = true;
      await audio.play(); await new Promise(r=>setTimeout(r,50));
      audio.muted = was; if (audio.paused) await audio.play();
      isPlaying = true; interrupted = false;
      playPauseBtn && (playPauseBtn.textContent = '⏸');
      startSpectrum(); startLogoBeat();
    } catch { console.warn("Se requiere interacción del usuario."); isPlaying = false; stopSpectrum(); stopLogoBeat(); }
  } finally { startInProgress = false; }
}
function pausePlayback(){ if (!audio) return; manualPaused = true; audio.pause(); isPlaying = false; playPauseBtn && (playPauseBtn.textContent = '▶'); stopLogoBeat(); stopSpectrum(); }

audio.addEventListener('playing', () => { isPlaying = true; playPauseBtn && (playPauseBtn.textContent = '⏸'); startSpectrum(); startLogoBeat(); });
audio.addEventListener('pause', () => { const justStarted = (Date.now() - lastUserPlayAt) < 1200; if (!manualPaused && !justStarted) interrupted = true; if (manualPaused || !isPlaying) { stopSpectrum(); stopLogoBeat(); } });
audio.addEventListener('error', () => { setTimeout(() => startPlayback({ forceReload: true }), 400); });
audio.addEventListener('stalled', () => { if (!manualPaused) setTimeout(() => { if (audio.paused) startPlayback().catch(()=>{}); }, 600); });
audio.addEventListener('ended', () => { if (!manualPaused) setTimeout(() => startPlayback({ forceReload: true }), 600); });

function tryAutoResume(){ if (interrupted && !manualPaused){ interrupted = false; if (audio.paused) startPlayback().catch(()=>{}); } }
window.addEventListener('focus', tryAutoResume);
window.addEventListener('pageshow', tryAutoResume);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tryAutoResume(); });

window.addEventListener('online', () => { if (audio.paused && !manualPaused) startPlayback({ forceReload: true }); });
if (navigator.connection?.addEventListener){ navigator.connection.addEventListener('change', () => { if (audio.paused && !manualPaused) startPlayback({ forceReload: true }); }); }

playPauseBtn && playPauseBtn.addEventListener('click', () => { if (!isPlaying) startPlayback(); else pausePlayback(); });

/* === Instalación PWA definitiva === */
let deferredPrompt = null;

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function checkIfInstalled(){
  if ('getInstalledRelatedApps' in navigator){
    const related = await navigator.getInstalledRelatedApps();
    if (related && related.length > 0) return true;
  }
  return false;
}

async function hideIfInstalled() {
  if (isStandalone() || localStorage.getItem('pwaInstalled') === 'true' || await checkIfInstalled()) {
    installBubble && (installBubble.style.display = 'none');
    return true;
  }
  return false;
}
hideIfInstalled();

// Guardar el evento para Chrome/Brave/Edge
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  hideIfInstalled().then(installed => {
    if (!installed) {
      installBubble && (installBubble.style.display = 'block');
    }
  });
});

// Escuchar cuando realmente se instala (Chrome lo dispara)
window.addEventListener('appinstalled', () => {
  localStorage.setItem('pwaInstalled', 'true');
  installBubble && (installBubble.style.display = 'none');
});

// Click en la burbuja
installBubble?.addEventListener('click', async () => {
  if (await hideIfInstalled()) return;

  if (deferredPrompt) {
    // 👉 Chrome/Brave/Edge usan prompt oficial
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('pwaInstalled', 'true');
      installBubble.style.display = 'none';
    }
    deferredPrompt = null;
  } else {
    // 👉 Samsung Internet, Firefox, Opera, Xiaomi: instrucciones
    const ua = navigator.userAgent.toLowerCase();
    let msg = null;
    if (ua.includes("firefox")) msg = "En Firefox Android: menú ⋮ → 'Instalar' o 'Añadir a pantalla principal'.";
    else if (ua.includes("samsungbrowser")) msg = "En Samsung Internet: menú ☰ → 'Agregar a pantalla principal'.\n⚠️ Si ves 'pantalla principal bloqueada', revisa Ajustes → Pantalla de inicio o usa Google Chrome.";
    else if (ua.includes("opr/") || ua.includes("opera")) msg = "En Opera: menú O → 'Instalar app' o 'Agregar a pantalla principal'.";
    else if (ua.includes("miui") || ua.includes("xiaomi")) msg = "En Xiaomi Browser: menú ⋮ → 'Agregar a pantalla de inicio'.";

    if (msg) alert(msg);
  }
});

/* === Instalación iOS === */
function isIos(){ return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isStandaloneIos(){ return ('standalone' in navigator) && navigator.standalone; }
document.addEventListener('DOMContentLoaded', () => {
  if (iosInstallPrompt && isIos() && !isStandaloneIos() && !localStorage.getItem('iosPromptShown')){
    iosInstallPrompt.style.display = 'block';
  }
});
closeIosPromptBtn?.addEventListener('click', () => {
  iosInstallPrompt.style.display = 'none';
  localStorage.setItem('iosPromptShown', 'true');
});

/* === Subvistas === */
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
  c.style.display = 'none'; f.src = 'about:blank';
  document.body.classList.remove('subview-open');
  if (history.state && history.state.subview) history.back();
};
window.addEventListener('popstate', () => { const c = document.getElementById('iframe-container'); if (c && c.style.display === 'block') window.cerrarSubview(); });
window.addEventListener('message', (e) => { if (e?.data?.type === 'close-subview') window.cerrarSubview?.(); });

/* === Peli === */
peliBubble?.addEventListener('click', () => {
  pausePlayback();
  const features = 'width=' + screen.width + ',height=' + screen.height + ',fullscreen=yes';
  window.open('peli.html', '_blank', features);
});

/* === Compartir === */
function compartirApp(){
  const url = "https://labuenota.vercel.app/";
  const text = "¡Descarga la app de La Buenota Radio Online, se puede ver películas Gratis y tiene buena música!";
  if (navigator.share) navigator.share({ title: "La Buenota Radio Online", text, url }).catch(console.error);
  else prompt("Copia el enlace para compartir:", url);
}
window.compartirApp = compartirApp;
