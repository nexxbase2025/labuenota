
// ==================== PWA INSTALL PROMPT ==================== //
let deferredPrompt;
const installBtn = document.getElementById("installBtn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.style.display = "block"; // mostrar solo en desktop
});

if (installBtn) {
  installBtn.addEventListener("click", () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        deferredPrompt = null;
        installBtn.style.display = "none";
      });
    }
  });
}

// Detectar iPhone/iPad y mostrar burbuja especial
window.addEventListener("load", () => {
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isInStandaloneMode = ("standalone" in window.navigator) && window.navigator.standalone;
  if (isIos && !isInStandaloneMode) {
    const iosPrompt = document.createElement("div");
    iosPrompt.innerHTML = `
      <div style="position:fixed; bottom:10px; left:10px; right:10px; 
                  background:#000; color:#fff; padding:15px; border-radius:12px;
                  font-size:14px; z-index:10000; text-align:center;">
        📲 Para instalar esta app en tu iPhone: toca 
        <strong>Compartir</strong> ➜ <strong>Añadir a pantalla de inicio</strong>.
        <br><button id="closeIosPrompt" style="margin-top:10px; padding:5px 12px; border:none; border-radius:8px; background:#fff; color:#000; cursor:pointer;">Cerrar</button>
      </div>
    `;
    document.body.appendChild(iosPrompt);
    document.getElementById("closeIosPrompt").addEventListener("click", () => {
      iosPrompt.remove();
    });
  }
});

// ==================== PADS LOGIC ==================== //
const padContainer = document.getElementById("padContainer");
const menuButtons = document.querySelectorAll(".menu-btn");

// Definir categorías de efectos
const efectos = {
  "efectos1": ["efecto1.mp3", "efecto2.mp3", "efecto3.mp3"],
  "efectos2": ["efecto4.mp3", "efecto5.mp3", "efecto6.mp3"],
  "efectos3": ["efecto7.mp3", "efecto8.mp3", "efecto9.mp3"],
  "efectos4": ["efecto10.mp3", "efecto11.mp3", "efecto12.mp3"],
  "efectos5": ["efecto13.mp3", "efecto14.mp3", "efecto15.mp3"]
};

// Colores alternativos para distinguir cada set
const colores = ["#ffcc00", "#00ccff", "#cc00ff", "#ff6600", "#66ff66"];

// Función para cargar los pads según categoría
function cargarPads(categoria, index) {
  padContainer.innerHTML = "";
  const lista = efectos[categoria] || [];

  lista.forEach((audio, i) => {
    const pad = document.createElement("div");
    pad.className = "pad";
    pad.style.background = colores[index % colores.length];
    pad.innerText = `PAD ${i + 1}`;
    pad.addEventListener("click", () => {
      const sonido = new Audio(`audios/${audio}`);
      sonido.play();
    });
    padContainer.appendChild(pad);
  });
}

// Event listeners para botones del menú
menuButtons.forEach((btn, index) => {
  btn.addEventListener("click", () => {
    const categoria = btn.dataset.cat;
    cargarPads(categoria, index);
  });
});
