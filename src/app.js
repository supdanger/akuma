// ============================================================
//  app.js — Lógica central de la aplicación
//  Migrado del monolito HTML original a módulos ES.
//  Estado compartido vive en utils/state.js
// ============================================================
import { db } from './services/supabase.js';
import { state } from './utils/state.js';
import {
  THEMES, ROLE_HIERARCHY, ROLE_LABELS, SHIFT_NAMES,
  ALL_PAGES, DEFAULT_PERMS, PAL,
} from './utils/constants.js';
import { fmtNum, esc, cap, durStr } from './utils/formatters.js';
import {
  showToast, showLoad, showModal, showConfirm, closeModal,
  copyToClipboard, copyTextFallback, copyText,
} from './utils/dom.js';
import {
  loadPermConfig, canAccess, myRoleLevel, canManageRole, roleCls,
} from './utils/permissions.js';
import Chart from 'chart.js/auto';

/* ── WELCOME OVERLAY ──────────────────────────────────────── */
function showWelcome(user) {
  const overlay = document.getElementById('welcome-overlay');
  if (!overlay) return;

  // Avatar
  const av = document.getElementById('w-avatar');
  if (av) {
    if (user.photo_url) {
      av.innerHTML = `<img src="${user.photo_url}" alt="${esc(user.name)}">`;
    } else {
      const colors = { superadmin:'#f0c040', admin:'#4090ff', supervisor:'#a060ff', cajero:'#40c070' };
      const col = colors[user.role] || '#f0c040';
      av.style.borderColor = col + '88';
      av.style.boxShadow   = `0 0 40px ${col}33`;
      av.style.background  = col + '18';
      av.innerHTML = `<span style="font-size:2.4rem;font-weight:700;font-family:Rajdhani,sans-serif;color:${col}">${cap(user.name).charAt(0)}</span>`;
    }
  }

  const nameEl = document.getElementById('w-name');
  if (nameEl) nameEl.textContent = cap(user.name);

  const roleEl = document.getElementById('w-role');
  const roleLabels = { superadmin:'SUPER ADMIN', gerente:'GERENTE', admin:'ADMINISTRADOR', supervisor:'SUPERVISOR', cajero:'CAJERO' };
  if (roleEl) roleEl.textContent = roleLabels[user.role] || user.role.toUpperCase();

  const timeEl = document.getElementById('w-time');
  if (timeEl) {
    const h = new Date().getHours();
    const greeting = h < 12 ? '🌅 Buenos días' : h < 19 ? '☀️ Buenas tardes' : '🌙 Buenas noches';
    const timeStr = new Date().toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'});
    timeEl.textContent = `${greeting} · ${timeStr}`;
  }

  overlay.classList.add('show');
}

function hideWelcome() {
  const overlay = document.getElementById('welcome-overlay');
  if (!overlay) return;
  overlay.style.transition = 'opacity .4s';
  overlay.style.opacity = '0';
  setTimeout(() => {
    overlay.classList.remove('show');
    overlay.style.opacity = '';
    overlay.style.transition = '';
  }, 400);
}


/* Aplica el fondo: imagen (en #bg-layer) o video (en #bg-video) */
function applyBg(ap) {
  const bgLayer = document.getElementById('bg-layer');
  const bgVideo = document.getElementById('bg-video');
  const url = (ap && ap.bg) || '';

  // Determinar el tipo: explícito, o inferido por la URL
  let type = ap && ap.bgType;
  if (!type) {
    if (!url) type = 'none';
    else if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url) || url.startsWith('data:video')) type = 'video';
    else type = 'image';
  }

  if (type === 'video' && url) {
    if (bgLayer) bgLayer.style.backgroundImage = '';
    if (bgVideo) {
      if (bgVideo.getAttribute('src') !== url) bgVideo.src = url;
      bgVideo.style.display = '';
      try { bgVideo.play && bgVideo.play().catch(() => {}); } catch (_) {}
    }
    localStorage.setItem('casino_bg', url);
    localStorage.setItem('casino_bg_type', 'video');
  } else if (type === 'image' && url) {
    if (bgVideo) { try { bgVideo.pause && bgVideo.pause(); } catch (_) {} bgVideo.style.display = 'none'; bgVideo.removeAttribute('src'); }
    if (bgLayer) bgLayer.style.backgroundImage = 'url(' + url + ')';
    localStorage.setItem('casino_bg', url);
    localStorage.setItem('casino_bg_type', 'image');
  } else {
    if (bgVideo) { try { bgVideo.pause && bgVideo.pause(); } catch (_) {} bgVideo.style.display = 'none'; bgVideo.removeAttribute('src'); }
    if (bgLayer) bgLayer.style.backgroundImage = '';
    localStorage.removeItem('casino_bg');
    localStorage.removeItem('casino_bg_type');
  }
}

/* Muestra/oculta los campos de fondo según el tipo elegido */
function toggleBgFields() {
  const type = document.getElementById('ap-bg-type')?.value || 'none';
  const fields = document.getElementById('ap-bg-fields');
  const urlInp = document.getElementById('ap-bg-url');
  const uploadLabel = document.getElementById('ap-bg-upload');
  if (fields) fields.style.display = type === 'none' ? 'none' : 'block';
  if (urlInp) urlInp.placeholder = type === 'video'
    ? 'URL de video de Cloudinary (.mp4 / .webm)'
    : 'URL de imagen (Cloudinary, etc.)';
  // El botón de subir archivo solo aplica a imagen; el video va por URL
  if (uploadLabel) uploadLabel.style.display = type === 'image' ? 'inline-flex' : 'none';
}

function applyAppearance(ap) {
  if (!ap) return;
  // Tema
  if (ap.theme !== undefined) {
    const t = THEMES[ap.theme] || THEMES[''];
    applyTheme(ap.theme, t.name, t.color, null);
  }
  // Fondo (imagen o video)
  applyBg(ap);
  // Overlay
  if (ap.overlay !== undefined) {
    const bgOver = document.getElementById('bg-over');
    if (bgOver) bgOver.style.background = 'rgba(4,6,12,' + ap.overlay + ')';
  }
  // Banner (carrusel)
  renderBanners(ap);
}

async function loadAppearance() {
  try {
    const { data } = await db.from('settings').select('value').eq('key','appearance').single();
    if (!data?.value) return;
    const ap = data.value;

    // Tema de color
    if (ap.theme !== undefined) {
      const t = THEMES[ap.theme] || THEMES[''];
      applyTheme(ap.theme, t.name, t.color, null);
    }

    // Imagen o video de fondo
    applyBg(ap);

    // Opacidad del overlay
    const ov = ap.overlay !== undefined ? ap.overlay : 0.78;
    document.getElementById('bg-over').style.background = 'rgba(4,6,12,' + ov + ')';

    // Banner (carrusel)
    renderBanners(ap);

  } catch(e) { console.warn('loadAppearance:', e); }
}

/* ── BANNER (carrusel multi-banner con botones configurables) ── */

// Devuelve la lista de banners a mostrar (soporta el formato viejo de 1 banner)
function getBannerList(ap) {
  if (ap && Array.isArray(ap.banners) && ap.banners.length) return ap.banners;
  if (ap && ap.banner && ap.banner.type && ap.banner.type !== 'none') return [ap.banner];
  return [];
}

// Renderiza un banner individual (slide) dentro de un contenedor
function buildBannerSlide(b) {
  const slide = document.createElement('div');
  slide.className = 'bnr-slide';
  slide.style.cssText = 'position:absolute;inset:0;opacity:0;transition:opacity .6s ease;pointer-events:none';

  // Media de fondo
  if (b.type === 'video' && b.url) {
    const v = document.createElement('video');
    v.src = b.url; v.autoplay = true; v.muted = true; v.loop = true;
    v.playsInline = true; v.preload = 'auto';
    v.style.cssText = 'width:100%;height:100%;object-fit:cover';
    slide.appendChild(v);
  } else if (b.type === 'image' && b.url) {
    const im = document.createElement('img');
    im.src = b.url; im.alt = '';
    im.style.cssText = 'width:100%;height:100%;object-fit:cover';
    slide.appendChild(im);
  } else {
    // Mensaje / sin media: fondo degradado
    slide.style.background = 'linear-gradient(135deg,rgba(240,192,64,.18),rgba(224,120,32,.12))';
  }

  // Capa de contenido (texto + botones)
  const content = document.createElement('div');
  content.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#fff;padding:16px;text-align:center';

  if (b.text) {
    const t = document.createElement('div');
    t.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:1.5rem;font-weight:700;letter-spacing:1px;text-shadow:0 2px 8px rgba(0,0,0,.7)';
    t.textContent = b.text;
    content.appendChild(t);
  }

  // Botones configurables
  if (Array.isArray(b.buttons) && b.buttons.length) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;pointer-events:auto';
    b.buttons.forEach(btn => {
      const el = document.createElement('button');
      el.style.cssText = 'display:inline-flex;align-items:center;gap:8px;border:none;border-radius:10px;padding:10px 16px;font-weight:700;font-size:.95rem;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);transition:transform .15s ease;'
        + 'background:' + (btn.bg || '#f0c040') + ';color:' + (btn.color || '#0a0c14') + ';';
      el.onmouseenter = () => el.style.transform = 'translateY(-2px)';
      el.onmouseleave = () => el.style.transform = '';
      if (btn.img) {
        const bi = document.createElement('img');
        bi.src = btn.img; bi.alt = '';
        bi.style.cssText = 'width:22px;height:22px;object-fit:contain;border-radius:4px';
        el.appendChild(bi);
      }
      if (btn.label) {
        const span = document.createElement('span');
        span.textContent = btn.label;
        el.appendChild(span);
      }
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (btn.action === 'copy') {
          copyToClipboard(btn.message || '').then(ok =>
            showToast(ok ? '✔ Mensaje copiado.' : '⚠ No se pudo copiar.', ok ? 't-ok' : 't-err'));
        } else if (btn.link) {
          window.open(btn.link, '_blank');
        }
      });
      row.appendChild(el);
    });
    content.appendChild(row);
  }

  // Click en el banner (fuera de botones) → link del slide
  if (b.link) {
    slide.style.cursor = 'pointer';
    slide.style.pointerEvents = 'auto';
    slide.addEventListener('click', () => window.open(b.link, '_blank'));
  }

  slide.appendChild(content);
  return slide;
}

let _bannerHash = null;
function renderBanners(ap) {
  const banner = document.getElementById('site-banner');
  if (!banner) return;
  const list = getBannerList(ap);
  const rotateMs = Math.max(2000, parseInt(ap?.bannerRotate, 10) || 5000);

  // Evitar reconstruir si no cambió (previene parpadeo)
  const hash = JSON.stringify({ list, rotateMs });
  if (hash === _bannerHash) return;
  _bannerHash = hash;

  // Limpiar rotación previa
  if (state.bannerTimer_) { clearInterval(state.bannerTimer_); state.bannerTimer_ = null; }

  if (!list.length) { banner.style.display = 'none'; banner.innerHTML = ''; return; }

  banner.style.display = '';
  banner.style.cursor = 'default';
  banner.style.position = 'relative';
  banner.style.minHeight = '160px';
  banner.style.maxHeight = '220px';
  banner.style.overflow = 'hidden';
  banner.onclick = null;
  banner.innerHTML = '';

  const slides = list.map(buildBannerSlide);
  slides.forEach(s => banner.appendChild(s));

  // Indicadores (dots) si hay más de uno
  let dots = [];
  if (slides.length > 1) {
    const dotWrap = document.createElement('div');
    dotWrap.style.cssText = 'position:absolute;bottom:8px;left:0;right:0;display:flex;gap:6px;justify-content:center;z-index:5;pointer-events:auto';
    slides.forEach((_, i) => {
      const d = document.createElement('button');
      d.style.cssText = 'width:9px;height:9px;border-radius:50%;border:none;cursor:pointer;background:rgba(255,255,255,.45);padding:0';
      d.addEventListener('click', (ev) => { ev.stopPropagation(); show(i); });
      dotWrap.appendChild(d); dots.push(d);
    });
    banner.appendChild(dotWrap);
  }

  let idx = 0, gen = 0;
  function clearBannerTimer() {
    if (state.bannerTimer_) { clearTimeout(state.bannerTimer_); state.bannerTimer_ = null; }
  }
  function show(i) {
    gen++; const myGen = gen;
    idx = (i + slides.length) % slides.length;
    slides.forEach((s, k) => {
      const active = k === idx;
      s.style.opacity = active ? '1' : '0';
      s.style.pointerEvents = active ? 'auto' : 'none';
      const vv = s.querySelector('video');
      if (vv && !active) { vv.pause && vv.pause(); }
    });
    dots.forEach((d, k) => d.style.background = k === idx ? 'var(--accent,#f0c040)' : 'rgba(255,255,255,.45)');

    clearBannerTimer();
    const cur = slides[idx];
    const v = cur.querySelector('video');

    if (slides.length <= 1) {
      // Un solo banner: el video queda en loop, sin rotación
      if (v) { v.loop = true; try { v.play && v.play().catch(()=>{}); } catch(_){} }
      return;
    }

    if (v) {
      // Banner de video: avanza cuando el video TERMINA (dura lo que dura el video)
      v.loop = false;
      try { v.currentTime = 0; } catch(_) {}
      v.play && v.play().catch(()=>{});
      v.onended = () => { if (myGen === gen) show(idx + 1); };
      // Respaldo por si 'ended' no dispara (video que no carga): usa la duración o un margen amplio
      const durMs = (v.duration && isFinite(v.duration) && v.duration > 0) ? v.duration * 1000 + 600 : rotateMs * 5;
      state.bannerTimer_ = setTimeout(() => { if (myGen === gen) show(idx + 1); }, durMs);
    } else {
      // Imagen o mensaje: usa el tiempo fijo configurado
      state.bannerTimer_ = setTimeout(() => { if (myGen === gen) show(idx + 1); }, rotateMs);
    }
  }
  show(0);
}

// Compatibilidad: renderBanner(b) sigue funcionando para 1 banner
function renderBanner(b) { _bannerHash = null; renderBanners({ banner: b }); }

function bannerClick() { /* manejado por cada slide ahora */ }

function toggleBannerFields() { /* obsoleto: reemplazado por el constructor de banners */ }

/* ── CONSTRUCTOR DE BANNERS (admin) ───────────────────────── */
let bannerBuilderState = [];

function blankBannerSlide() {
  return { type: 'image', url: '', text: '', link: '', buttons: [] };
}
function blankBannerButton() {
  return { label: '', img: '', action: 'link', link: '', message: '', bg: '#f0c040', color: '#0a0c14' };
}

function addBannerSlide() {
  bannerBuilderState.push(blankBannerSlide());
  renderBannerBuilder();
}
function removeBannerSlide(i) {
  bannerBuilderState.splice(i, 1);
  renderBannerBuilder();
}
function addBannerButton(i) {
  (bannerBuilderState[i].buttons = bannerBuilderState[i].buttons || []).push(blankBannerButton());
  renderBannerBuilder();
}
function removeBannerButton(i, j) {
  bannerBuilderState[i].buttons.splice(j, 1);
  renderBannerBuilder();
}
// Actualiza un campo del slide o botón sin re-renderizar (mantiene el foco)
function setBannerField(i, field, val) { bannerBuilderState[i][field] = val; }
function setBannerBtnField(i, j, field, val) { bannerBuilderState[i].buttons[j][field] = val; }

// Subida de archivo (imagen/video) → data URL al campo correspondiente
function bannerFileUpload(input, i, kind, j) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    const url = e.target.result;
    if (kind === 'slide') {
      bannerBuilderState[i].url = url;
      const inp = document.getElementById('bnr-url-' + i); if (inp) inp.value = url;
    } else {
      bannerBuilderState[i].buttons[j].img = url;
      const inp = document.getElementById('bnr-btnimg-' + i + '-' + j); if (inp) inp.value = url;
    }
  };
  r.readAsDataURL(file);
}

function renderBannerBuilder() {
  const cont = document.getElementById('ap-banners-list');
  if (!cont) return;
  if (!bannerBuilderState.length) {
    cont.innerHTML = '<div style="color:var(--muted);font-size:.78rem;padding:8px 0">Sin banners. Tocá "Agregar banner" para crear el primero.</div>';
    return;
  }
  cont.innerHTML = bannerBuilderState.map((b, i) => {
    const buttonsHtml = (b.buttons || []).map((btn, j) => `
      <div style="border:1px solid var(--glass-b);border-radius:8px;padding:8px;margin-top:6px;background:rgba(255,255,255,.02)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:.66rem;color:var(--muted);letter-spacing:1px">BOTÓN ${j + 1}</span>
          <button class="btn-tiny" type="button" onclick="removeBannerButton(${i},${j})" style="background:rgba(224,64,96,.15);color:var(--red)">✕</button>
        </div>
        <input class="inp" placeholder="Texto del botón" value="${esc(btn.label || '')}" oninput="setBannerBtnField(${i},${j},'label',this.value)" style="margin-bottom:6px">
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <input class="inp" id="bnr-btnimg-${i}-${j}" placeholder="URL imagen del botón (opcional)" value="${esc(btn.img || '')}" oninput="setBannerBtnField(${i},${j},'img',this.value)" style="flex:1">
          <label class="btn-tiny" style="cursor:pointer;white-space:nowrap">📁<input type="file" accept="image/*" style="display:none" onchange="bannerFileUpload(this,${i},'btn',${j})"></label>
        </div>
        <select class="inp-sel" onchange="setBannerBtnField(${i},${j},'action',this.value);renderBannerBuilder()" style="width:100%;margin-bottom:6px">
          <option value="link" ${btn.action === 'link' ? 'selected' : ''}>🔗 Ir a otra página</option>
          <option value="copy" ${btn.action === 'copy' ? 'selected' : ''}>📋 Copiar un mensaje</option>
        </select>
        ${btn.action === 'copy'
          ? `<input class="inp" placeholder="Mensaje a copiar" value="${esc(btn.message || '')}" oninput="setBannerBtnField(${i},${j},'message',this.value)" style="margin-bottom:6px">`
          : `<input class="inp" placeholder="Link de destino (https://...)" value="${esc(btn.link || '')}" oninput="setBannerBtnField(${i},${j},'link',this.value)" style="margin-bottom:6px">`}
        <div style="display:flex;gap:8px;align-items:center">
          <label style="font-size:.66rem;color:var(--muted)">Color: <input type="color" value="${esc(btn.bg || '#f0c040')}" oninput="setBannerBtnField(${i},${j},'bg',this.value)"></label>
          <label style="font-size:.66rem;color:var(--muted)">Texto: <input type="color" value="${esc(btn.color || '#0a0c14')}" oninput="setBannerBtnField(${i},${j},'color',this.value)"></label>
        </div>
      </div>`).join('');

    return `
    <div style="border:1px solid var(--glass-b);border-radius:10px;padding:10px;margin-bottom:10px;background:rgba(0,0,0,.25)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:.72rem;font-weight:700;color:var(--accent)">BANNER ${i + 1}</span>
        <button class="btn-tiny" type="button" onclick="removeBannerSlide(${i})" style="background:rgba(224,64,96,.15);color:var(--red)">🗑 Quitar</button>
      </div>
      <select class="inp-sel" onchange="setBannerField(${i},'type',this.value)" style="width:100%;margin-bottom:6px">
        <option value="image" ${b.type === 'image' ? 'selected' : ''}>🖼 Imagen</option>
        <option value="video" ${b.type === 'video' ? 'selected' : ''}>🎬 Video</option>
        <option value="message" ${b.type === 'message' ? 'selected' : ''}>💬 Solo mensaje</option>
      </select>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <input class="inp" id="bnr-url-${i}" placeholder="URL de imagen o video" value="${esc(b.url || '')}" oninput="setBannerField(${i},'url',this.value)" style="flex:1">
        <label class="btn-tiny" style="cursor:pointer;white-space:nowrap">📁<input type="file" accept="image/*,video/*" style="display:none" onchange="bannerFileUpload(this,${i},'slide')"></label>
      </div>
      <input class="inp" placeholder="Texto sobre el banner (opcional)" value="${esc(b.text || '')}" oninput="setBannerField(${i},'text',this.value)" style="margin-bottom:6px">
      <input class="inp" placeholder="Link al tocar el banner (opcional)" value="${esc(b.link || '')}" oninput="setBannerField(${i},'link',this.value)" style="margin-bottom:6px">
      <div style="font-size:.66rem;color:var(--muted);letter-spacing:1px;margin:4px 0">BOTONES</div>
      ${buttonsHtml}
      <button class="btn-tiny" type="button" onclick="addBannerButton(${i})" style="margin-top:6px">➕ Agregar botón</button>
    </div>`;
  }).join('');
}

function apBgUpload(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    const dataUrl = e.target.result;
    const urlInp = document.getElementById('ap-bg-url');
    if (urlInp) urlInp.value = dataUrl;
    // Preview inmediato
    document.getElementById('bg-layer').style.backgroundImage = 'url(' + dataUrl + ')';
  };
  r.readAsDataURL(file);
}

async function saveAppearance() {
  const theme   = document.getElementById('ap-theme')?.value ?? '';
  const bg      = document.getElementById('ap-bg-url')?.value.trim() ?? '';
  const bgType  = document.getElementById('ap-bg-type')?.value || (bg ? 'image' : 'none');
  const overlayEl = document.getElementById('ap-overlay');
  const overlay = overlayEl ? parseFloat(overlayEl.value) : 0.78;
  const rotateSec = parseInt(document.getElementById('ap-banner-rotate')?.value, 10) || 5;

  // Banners: limpiar slides vacíos y botones vacíos
  const banners = (bannerBuilderState || [])
    .map(b => ({
      type: b.type || 'image',
      url: (b.url || '').trim(),
      text: (b.text || '').trim(),
      link: (b.link || '').trim(),
      buttons: (b.buttons || [])
        .filter(btn => (btn.label || '').trim() || (btn.img || '').trim())
        .map(btn => ({
          label: (btn.label || '').trim(),
          img: (btn.img || '').trim(),
          action: btn.action === 'copy' ? 'copy' : 'link',
          link: (btn.link || '').trim(),
          message: (btn.message || '').trim(),
          bg: btn.bg || '#f0c040',
          color: btn.color || '#0a0c14',
        })),
    }))
    .filter(b => b.url || b.text || (b.buttons && b.buttons.length));

  const ap = { theme, bg, bgType, overlay, banners, bannerRotate: rotateSec * 1000 };

  showLoad(true);
  try {
    const { error } = await db.from('settings').upsert({ key:'appearance', value: ap, updated_by: state.currentUser.name, updated_at: new Date().toISOString() });
    if (error) throw error;

    // Aplicar inmediatamente para el usuario que guardó
    _bannerHash = null; // forzar re-render del banner
    applyAppearance(ap);
    lastAppearanceHash_ = new Date().toISOString();

    showToast('✔ Apariencia guardada correctamente.', 't-ok');
  } catch(e) {
    showToast('Error al guardar apariencia: ' + (e?.message || e), 't-err');
    console.error('saveAppearance:', e);
  }
  finally { showLoad(false); }
}

// Populate admin appearance form on load
async function populateAppearanceForm() {
  try {
    const { data } = await db.from('settings').select('value').eq('key','appearance').single();
    const ap = data?.value || {};

    populateThemeSelect();
    const th = document.getElementById('ap-theme');
    if (th) th.value = ap.theme ?? '';

    const bg = document.getElementById('ap-bg-url');
    if (bg) bg.value = ap.bg || '';

    // Tipo de fondo (imagen / video / ninguno) + mostrar campos
    const bgTypeEl = document.getElementById('ap-bg-type');
    if (bgTypeEl) {
      let type = ap.bgType;
      if (!type) {
        if (!ap.bg) type = 'none';
        else if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(ap.bg) || String(ap.bg).startsWith('data:video')) type = 'video';
        else type = 'image';
      }
      bgTypeEl.value = type;
    }
    toggleBgFields();

    const ov = document.getElementById('ap-overlay');
    const ovVal = document.getElementById('ap-overlay-val');
    if (ov) {
      ov.value = ap.overlay !== undefined ? ap.overlay : 0.78;
      if (ovVal) ovVal.textContent = ov.value;
    }

    // Banners (constructor)
    const rotEl = document.getElementById('ap-banner-rotate');
    if (rotEl) rotEl.value = Math.round((ap.bannerRotate || 5000) / 1000);

    // Migrar formato viejo (1 banner) si hace falta
    if (Array.isArray(ap.banners) && ap.banners.length) {
      bannerBuilderState = JSON.parse(JSON.stringify(ap.banners));
    } else if (ap.banner && ap.banner.type && ap.banner.type !== 'none') {
      bannerBuilderState = [{
        type: ap.banner.type, url: ap.banner.url || '', text: ap.banner.text || '',
        link: ap.banner.link || '', buttons: [],
      }];
    } else {
      bannerBuilderState = [];
    }
    bannerBuilderState.forEach(b => { if (!Array.isArray(b.buttons)) b.buttons = []; });
    renderBannerBuilder();
  } catch(e) { console.warn('populateAppearanceForm:', e); }
}


/* ══════════════════════════════════════════════════════════
   SISTEMA DE ROTACIÓN DE CUENTAS BANCARIAS
   ══════════════════════════════════════════════════════════ */


function setActiveShift(n) {
  state.activeShift_ = parseInt(n) || 1;
  localStorage.setItem('casino_active_shift', String(state.activeShift_));
  // Sincronizar ambos selectores sin disparar onchange
  const s1 = document.getElementById('cargas-shift-sel');
  const s2 = document.getElementById('cuentas-shift');
  if (s1) s1.value = String(state.activeShift_);
  if (s2) s2.value = String(state.activeShift_);
  // Recargar datos según página activa
  loadCurrentBankAccount();
  if (document.getElementById('page-cuentas')?.classList.contains('active')) {
    loadCuentas();
  }
}

async function loadCurrentBankAccount() {
  try {
    const shiftNum = state.activeShift_;
    const shiftName = SHIFT_NAMES[shiftNum] || 'Turno ' + shiftNum;
    const el = document.getElementById('bank-shift-label');
    if (el) el.textContent = shiftName;

    const { data, error } = await db.from('bank_accounts')
      .select('*')
      .eq('shift_number', shiftNum)
      .eq('active', true)
      .order('use_count', { ascending: true })
      .order('last_used_at', { ascending: true, nullsFirst: true });

    if (error) { console.error('bank_accounts:', error.message); return; }
    state.bankAccounts_ = data || [];

    const bankCard = document.getElementById('bank-card');
    if (!state.bankAccounts_.length) {
      const prev = document.getElementById('bank-preview');
      if (prev) prev.innerHTML = '<div class="bank-preview-bank" style="color:var(--muted)">Sin cuentas activas para ' + shiftName + '</div>';
      if (bankCard) bankCard.style.display = 'none';
      return;
    }

    if (bankCard) bankCard.style.display = '';
    state.currentBankAccount_ = state.bankAccounts_[0];
    renderBankPreview(state.currentBankAccount_);

    const nextLabel = state.bankAccounts_.length > 1 ? cap(state.bankAccounts_[1].holder_name) : 'misma cuenta';
    const nextEl = document.getElementById('bank-next-label');
    if (nextEl) nextEl.textContent = 'próx: ' + nextLabel;

    const total = state.bankAccounts_.reduce((a,b) => a + (b.use_count||0), 0);
    const te = document.getElementById('bank-turno-count');
    const ae = document.getElementById('bank-account-count');
    if (te) te.textContent = total;
    if (ae) ae.textContent = state.currentBankAccount_.use_count || 0;
  } catch(e) {
    console.error('loadCurrentBankAccount:', e);
  }
}

function renderBankPreview(acc) {
  if (!acc) return;
  const prev = document.getElementById('bank-preview');
  if (!prev) return;
  prev.innerHTML =
    (acc.pretexto ? '<div class="bank-preview-pretexto">⚠️ ' + esc(acc.pretexto) + '</div>' : '') +
    '<div class="bank-preview-name">' + esc(acc.holder_name) + '</div>' +
    '<div class="bank-preview-bank">🏦 ' + esc(acc.bank_name) + '</div>' +
    '<div class="bank-preview-cbu">CBU: ' + esc(acc.cbu) + '</div>' +
    (acc.alias ? '<div class="bank-preview-alias">📝 Alias: ' + esc(acc.alias) + '</div>' : '') +
    (acc.mensaje ? '<div class="bank-preview-mensaje">💬 ' + esc(acc.mensaje) + '</div>' : '');
}

// Fallback de copia para contextos sin clipboard API (HTTP, algunos browsers)


async function copyBankAccount() {
  if (!state.currentBankAccount_) { showToast('Sin cuenta disponible.', 't-err'); return; }
  const acc = state.currentBankAccount_;

  // Feedback visual inmediato en el botón
  const btn = document.getElementById('bank-copy-main');
  if (btn) {
    btn.style.background = 'rgba(64,192,112,.25)';
    btn.style.borderColor = 'rgba(64,192,112,.6)';
    setTimeout(() => {
      btn.style.background = '';
      btn.style.borderColor = '';
    }, 600);
  }

  // Construir texto
  let text = '';
  if (acc.pretexto) text += acc.pretexto + '\n\n';
  text += 'Titular: ' + acc.holder_name + '\n';
  text += 'Banco: '   + acc.bank_name   + '\n';
  text += 'CBU: '     + acc.cbu         + '\n';
  if (acc.alias)   text += 'Alias: '   + acc.alias   + '\n';
  if (acc.mensaje) text += '\n' + acc.mensaje + '\n';

  // Copiar PRIMERO — sin esperar Supabase
  const copied = await copyToClipboard(text);

  if (copied) {
    showToast('✔ ' + cap(acc.holder_name) + ' copiado.', 't-ok');
  } else {
    showToast('⚠ No se pudo copiar automáticamente.', 't-err');
    return;
  }

  // Actualizar use_count en SEGUNDO PLANO — sin bloquear UI
  const newCount = (acc.use_count || 0) + 1;
  acc.use_count = newCount; // actualizar objeto local inmediatamente

  // Rotar a siguiente cuenta EN LOCAL sin esperar DB
  state.bankAccounts_ = state.bankAccounts_.map(a => a.id === acc.id ? { ...a, use_count: newCount, last_used_at: new Date().toISOString() } : a);
  // Re-ordenar por use_count para encontrar la siguiente
  const sorted = [...state.bankAccounts_].sort((a,b) => (a.use_count||0) - (b.use_count||0));
  state.currentBankAccount_ = sorted[0];
  renderBankPreview(state.currentBankAccount_);
  const nextEl = document.getElementById('bank-next-label');
  if (nextEl) nextEl.textContent = sorted.length > 1 ? 'próx: ' + cap(sorted[1].holder_name) : 'misma cuenta';
  const turnoEl = document.getElementById('bank-turno-count');
  const accEl   = document.getElementById('bank-account-count');
  if (turnoEl) turnoEl.textContent = state.bankAccounts_.reduce((s,a) => s + (a.use_count||0), 0);
  if (accEl)   accEl.textContent   = state.currentBankAccount_.use_count || 0;

  // Sync con Supabase en background — sin await
  db.from('bank_accounts')
    .update({ use_count: newCount, last_used_at: new Date().toISOString() })
    .eq('id', acc.id)
    .then(() => {})
    .catch(e => console.warn('bank update:', e));
}

/* ── CUENTAS PAGE ──────────────────────────────────────── */
async function loadCuentas() {
  // Sincronizar selector (sin disparar onchange)
  const sel = document.getElementById('cuentas-shift');
  if (sel && sel.value !== String(state.activeShift_)) sel.value = String(state.activeShift_);
  const shift = state.activeShift_;
  showLoad(true);
  try {
    const { data, error } = await db.from('bank_accounts')
      .select('*').eq('shift_number', shift)
      .order('active', { ascending: false })
      .order('use_count', { ascending: false });

    const list = document.getElementById('bank-list');
    if (!list) { showLoad(false); return; }

    if (error) {
      list.innerHTML = '<div style="color:var(--red);padding:20px;text-align:center">Error al cargar cuentas.<br><small>' + esc(error.message) + '</small><br><small style="color:var(--muted)">Verificá que ejecutaste el SQL de bank_accounts en Supabase.</small></div>';
      showLoad(false); return;
    }

    if (!data?.length) {
      list.innerHTML = '<div class="empty-state"><div class="es-icon">🏦</div><div class="es-title">Sin cuentas en este turno</div><div class="es-sub">Agregá la primera cuenta bancaria para empezar.</div></div>';
      showLoad(false); return;
    }

    state.bankAccounts_ = data;

    list.innerHTML = data.map(a => {
      const activeStyle = a.active ? 'active-bank' : '';
      return '<div class="bank-row ' + activeStyle + '">' +
        '<div class="bank-row-info">' +
          '<div class="bank-row-name">' + esc(a.holder_name) +
            '<span class="bank-uses">⚡ ' + (a.use_count||0) + ' usos</span>' +
          '</div>' +
          '<div class="bank-row-cbu">CBU: ' + esc(a.cbu) + (a.alias ? ' · Alias: ' + esc(a.alias) : '') + '</div>' +
          '<div class="bank-row-meta">🏦 ' + esc(a.bank_name) + '</div>' +
          (a.pretexto ? '<div style="font-size:.68rem;color:var(--accent);margin-top:3px">⚠️ ' + esc(a.pretexto) + '</div>' : '') +
          (a.mensaje  ? '<div style="font-size:.68rem;color:var(--blue);margin-top:2px">💬 ' + esc(a.mensaje) + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
          '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.75rem;color:var(--text)">' +
            '<input type="checkbox" ' + (a.active ? 'checked' : '') + ' style="accent-color:var(--green)" onchange="toggleBankActive(&quot;' + a.id + '&quot;,this.checked)"> Activa' +
          '</label>' +
          '<button class="btn-ghost" style="padding:4px 9px" onclick="showBankEdit(&quot;' + a.id + '&quot;)">✏️</button>' +
          '<button class="btn-red" onclick="deleteBankAccount(&quot;' + a.id + '&quot;)">🗑</button>' +
        '</div>' +
      '</div>';
    }).join('');
  } finally { showLoad(false); }
}

async function addBankAccount() {
  const holder    = document.getElementById('ba-holder')?.value.trim();
  const cbu       = document.getElementById('ba-cbu')?.value.trim().replace(/\s/g, '');
  const bank      = document.getElementById('ba-bank')?.value.trim();
  const alias     = document.getElementById('ba-alias')?.value.trim() || '';
  const pretexto  = document.getElementById('ba-pretexto')?.value.trim() || '';
  const mensaje   = document.getElementById('ba-mensaje')?.value.trim() || '';
  const shift     = state.activeShift_;

  if (!holder) { showToast('Ingresá el nombre del titular.', 't-err'); return; }
  if (!cbu)    { showToast('Ingresá el CBU.', 't-err'); return; }
  if (!bank)   { showToast('Ingresá el nombre del banco.', 't-err'); return; }
  if (cbu.length > 0 && !/^\d+$/.test(cbu)) {
    showToast('El CBU solo debe contener números.', 't-err'); return;
  }

  showLoad(true);
  try {
    const { error } = await db.from('bank_accounts').insert({
      holder_name: holder, cbu, bank_name: bank, alias,
      pretexto, mensaje,
      shift_number: shift, active: true, use_count: 0,
      created_by: state.currentUser.name
    });
    if (error) throw error;
    document.getElementById('ba-holder').value   = '';
    document.getElementById('ba-cbu').value      = '';
    document.getElementById('ba-bank').value     = '';
    document.getElementById('ba-alias').value    = '';
    document.getElementById('ba-pretexto').value = '';
    document.getElementById('ba-mensaje').value  = '';
    await loadCuentas();
    showToast('✔ Cuenta de ' + holder + ' agregada.', 't-ok');
  } catch(e) {
    console.error('addBankAccount error:', e);
    showToast('Error al guardar: ' + (e?.message || 'verificá la tabla bank_accounts en Supabase.'), 't-err');
  } finally {
    showLoad(false);
  }
}

async function toggleBankActive(id, active) {
  const { error } = await db.from('bank_accounts').update({ active }).eq('id', id);
  if (error) { showToast('No se pudo actualizar la cuenta: ' + (error.message || error), 't-err'); console.error(error); return; }
  await loadCuentas();
  await loadCurrentBankAccount();
}

async function deleteBankAccount(id) {
  showConfirm('¿Eliminar esta cuenta bancaria?', async () => {
    showLoad(true);
    const { error } = await db.from('bank_accounts').delete().eq('id', id);
    if (error) { showToast('No se pudo eliminar: ' + (error.message || error), 't-err'); console.error(error); showLoad(false); return; }
    await loadCuentas();
    await loadCurrentBankAccount();
    showLoad(false);
  });
}

function showBankEdit(id) {
  const a = (state.bankAccounts_ || []).find(x => String(x.id) === String(id));
  if (!a) { showToast('No se encontró la cuenta.', 't-err'); return; }
  const v = s => (s == null ? '' : String(s));
  showModal({
    title: '✏️ Editar cuenta bancaria',
    wide: true,
    body:
      '<div style="display:flex;flex-direction:column;gap:10px">' +
        '<div class="form-col"><label>TITULAR</label>' +
          '<input id="be-holder" class="inp" value="' + esc(v(a.holder_name)) + '"></div>' +
        '<div class="form-col"><label>CBU</label>' +
          '<input id="be-cbu" class="inp" inputmode="numeric" value="' + esc(v(a.cbu)) + '"></div>' +
        '<div class="form-col"><label>BANCO</label>' +
          '<input id="be-bank" class="inp" value="' + esc(v(a.bank_name)) + '"></div>' +
        '<div class="form-col"><label>ALIAS (opcional)</label>' +
          '<input id="be-alias" class="inp" value="' + esc(v(a.alias)) + '"></div>' +
        '<div class="form-col"><label>PRE-TEXTO (opcional)</label>' +
          '<input id="be-pretexto" class="inp" value="' + esc(v(a.pretexto)) + '"></div>' +
        '<div class="form-col"><label>MENSAJE FINAL (opcional)</label>' +
          '<input id="be-mensaje" class="inp" value="' + esc(v(a.mensaje)) + '"></div>' +
      '</div>',
    actions:
      '<button class="btn-modal" data-modal-cancel>Cancelar</button>' +
      '<button class="btn-primary" onclick="saveBankEdit(&quot;' + a.id + '&quot;)">Guardar cambios</button>',
  });
}

async function saveBankEdit(id) {
  const holder   = document.getElementById('be-holder')?.value.trim();
  const cbu      = document.getElementById('be-cbu')?.value.trim().replace(/\s/g, '');
  const bank     = document.getElementById('be-bank')?.value.trim();
  const alias    = document.getElementById('be-alias')?.value.trim() || '';
  const pretexto = document.getElementById('be-pretexto')?.value.trim() || '';
  const mensaje  = document.getElementById('be-mensaje')?.value.trim() || '';

  if (!holder) { showToast('Ingresá el nombre del titular.', 't-err'); return; }
  if (!cbu)    { showToast('Ingresá el CBU.', 't-err'); return; }
  if (!bank)   { showToast('Ingresá el nombre del banco.', 't-err'); return; }
  if (!/^\d+$/.test(cbu)) { showToast('El CBU solo debe contener números.', 't-err'); return; }

  showLoad(true);
  const { error } = await db.from('bank_accounts').update({
    holder_name: holder, cbu, bank_name: bank, alias, pretexto, mensaje,
  }).eq('id', id);
  if (error) {
    showToast('No se pudo guardar: ' + (error.message || error), 't-err');
    console.error(error); showLoad(false); return;
  }
  closeModal();
  await loadCuentas();
  await loadCurrentBankAccount();
  showLoad(false);
  showToast('✔ Cuenta actualizada.', 't-ok');
}

async function resetBankCounters() {
  const shift = state.activeShift_;
  showConfirm('¿Reiniciar contadores de uso de todas las cuentas del turno ' + shift + '?', async () => {
    showLoad(true);
    try {
      const { error } = await db.from('bank_accounts').update({ use_count: 0, last_used_at: null }).eq('shift_number', shift);
      if (error) throw error;
      await loadCuentas();
      await loadCurrentBankAccount();
      showToast('Contadores de cuentas reiniciados.', 't-ok');
    } catch (e) {
      showToast('No se pudo reiniciar: ' + (e?.message || e), 't-err');
      console.error(e);
    } finally {
      showLoad(false);
    }
  });
}

/* ── STATE ─────────────────────────────────────────────── */


/* ── INIT ──────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', async () => {
  // El cliente Supabase ya viene inicializado desde services/supabase.js
  const savedBG = localStorage.getItem('casino_bg');
  const savedType = localStorage.getItem('casino_bg_type');
  if (savedBG) applyBg({ bg: savedBG, bgType: savedType });
  // Tema guardado
  const savedTheme = localStorage.getItem('casino_theme') || '';
  const t = THEMES[savedTheme] || THEMES[''];
  applyTheme(savedTheme, t.name, t.color, null);
  renderThemeOptions();
  try {
    await loadStarImages();
    await loadAppearance();
  } catch (e) { console.warn('init:', e); }
});

/* ── AUTH ──────────────────────────────────────────────── */

/* ============================================================
   AUTO-REFRESH / POLLING
   Refresca la página activa cada 10 segundos sin real-time.
   Solo corre cuando la pestaña está visible (evita requests
   innecesarios cuando el usuario cambió de pestaña).
   ============================================================ */
let autoRefreshInterval_ = null;
let currentActivePage_   = null;
let isRefreshing_        = false;
const POLL_INTERVAL      = 10_000; // 10 segundos

// Páginas que NO tienen sentido refrescar automáticamente
const NO_AUTO_REFRESH = new Set(['admin', 'bonos']);

async function autoRefreshPage() {
  if (!currentActivePage_) return;
  if (NO_AUTO_REFRESH.has(currentActivePage_)) return;
  if (isRefreshing_) return; // evitar solapamiento si la query tarda
  if (document.hidden) return; // pestaña no visible, no gastar requests

  isRefreshing_ = true;
  try {
    await refreshPage(currentActivePage_);
  } catch (e) {
    console.warn('autoRefresh error:', e);
  } finally {
    isRefreshing_ = false;
  }
}

// Refresca sin mostrar el loader (silencioso)
async function refreshPage(p) {
  if (p === 'inicio')    { await populateInicioTurnos(); applyInicioFilters(); loadReporte(); }
  if (p === 'cargas')    { await loadCounters(); await loadCurrentBankAccount(); }
  if (p === 'historial') { await loadHistorial(false); }
  if (p === 'retiros')   { await loadRetiros(); }
  if (p === 'jugadores') {
    await Promise.allSettled([loadJugadorStats(), loadTopPlayers(), loadJugadores()]);
  }
  if (p === 'cuentas')   { await loadCuentas(); }
  if (p === 'metricas')  { await loadMetricas(); }
  if (p === 'turnos')    { await loadTurnos(); }
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshInterval_ = setInterval(autoRefreshPage, POLL_INTERVAL);
}

function stopAutoRefresh() {
  if (autoRefreshInterval_) {
    clearInterval(autoRefreshInterval_);
    autoRefreshInterval_ = null;
  }
}

// Pausa cuando el usuario cambia de pestaña, reanuda cuando vuelve
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    // Al volver, refrescar inmediatamente + arrancar polling
    autoRefreshPage();
    startAutoRefresh();
  }
});


/* ============================================================
   APPEARANCE POLLING
   Verifica cada 15s si cambió el tema/fondo/banner en Supabase
   y lo aplica en tiempo real para todos los usuarios conectados.
   ============================================================ */
let appearanceInterval_  = null;
let lastAppearanceHash_  = null;

async function checkAppearanceUpdate() {
  if (document.hidden) return;
  try {
    const { data } = await db.from('settings')
      .select('value, updated_at')
      .eq('key', 'appearance')
      .single();

    if (!data) return;

    // Comparar con el último valor conocido usando updated_at como hash
    const hash = data.updated_at || JSON.stringify(data.value);
    if (hash === lastAppearanceHash_) return; // no cambió nada
    lastAppearanceHash_ = hash;

    // Hay cambios — aplicar apariencia silenciosamente
    applyAppearance(data.value);
  } catch (e) {
    // Silencioso — si falla no interrumpe nada
  }
}

function startAppearancePolling() {
  if (appearanceInterval_) clearInterval(appearanceInterval_);
  // Chequear cada 15 segundos
  appearanceInterval_ = setInterval(checkAppearanceUpdate, 15000);
}

function stopAppearancePolling() {
  if (appearanceInterval_) {
    clearInterval(appearanceInterval_);
    appearanceInterval_ = null;
  }
}

/* ============================================================
   PRESENCIA / SESIÓN (heartbeat)
   Cada usuario marca presencia cada 20s, revisa si fue
   expulsado y aplica cambios de permisos en vivo.
   ============================================================ */
let heartbeatTimer_ = null;
let sessionStartAt_ = null;

function startHeartbeat() {
  sessionStartAt_ = Date.now();
  sendHeartbeat();
  if (heartbeatTimer_) clearInterval(heartbeatTimer_);
  heartbeatTimer_ = setInterval(sendHeartbeat, 20000);
}

function stopHeartbeat() {
  if (heartbeatTimer_) { clearInterval(heartbeatTimer_); heartbeatTimer_ = null; }
}

async function sendHeartbeat() {
  const u = state.currentUser;
  if (!u) return;
  try {
    // 1) Marcar presencia
    await db.from('staff').update({ last_seen: new Date().toISOString() }).eq('id', u.id);

    // 2) Revisar expulsión / desactivación / cambios de permisos
    const { data } = await db.from('staff')
      .select('force_logout_at, perm_overrides, active, role')
      .eq('id', u.id).maybeSingle();
    if (!data) return;

    // ¿Desactivado?
    if (data.active === false) { forcedLogout('Tu usuario fue desactivado.'); return; }

    // ¿Expulsado? (marca más nueva que el inicio de esta sesión)
    if (data.force_logout_at && new Date(data.force_logout_at).getTime() > sessionStartAt_) {
      forcedLogout('Tu sesión fue cerrada por el administrador.');
      return;
    }

    // ¿Cambiaron permisos/override en vivo?
    const ovChanged = JSON.stringify(u.perm_overrides || {}) !== JSON.stringify(data.perm_overrides || {});
    const roleChanged = u.role !== data.role;
    if (ovChanged || roleChanged) {
      u.perm_overrides = data.perm_overrides || {};
      u.role = data.role;
      state.permConfig_ = null;
      await loadPermConfig();
      refreshTabVisibility();
      ensureCurrentPageAllowed();
    }
  } catch (_) { /* silencioso */ }
}

function forcedLogout(msg) {
  stopHeartbeat();
  stopOnlinePolling();
  showToast(msg || 'Tu sesión fue cerrada.', 't-err');
  setTimeout(() => doLogout(), 1300);
}

// Si la página actual quedó bloqueada, mandar a una permitida
function ensureCurrentPageAllowed() {
  const p = currentActivePage_;
  if (!p || p === 'admin') return;
  if (!canAccess(p)) {
    const first = ['inicio','cargas','historial','retiros','jugadores','bonos','turnos','metricas','cuentas']
      .find(x => canAccess(x)) || 'cargas';
    showPage(first);
    showToast('El administrador actualizó tus permisos.', 't-info');
  }
}

/* ============================================================
   USUARIOS EN LÍNEA (solo Super Admin, en Admin)
   ============================================================ */
let onlineTimer_ = null;
const ONLINE_WINDOW_MS = 60000; // activo en el último minuto

function startOnlinePolling() {
  if (state.currentUser?.role !== 'superadmin') return;
  loadOnlineUsers();
  if (onlineTimer_) clearInterval(onlineTimer_);
  onlineTimer_ = setInterval(loadOnlineUsers, 15000);
}

function stopOnlinePolling() {
  if (onlineTimer_) { clearInterval(onlineTimer_); onlineTimer_ = null; }
}

async function loadOnlineUsers() {
  const box = document.getElementById('online-users');
  if (!box) return;
  if (state.currentUser?.role !== 'superadmin') return;
  try {
    const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
    const { data } = await db.from('staff')
      .select('id,name,role,last_seen,photo_url')
      .gte('last_seen', since)
      .order('last_seen', { ascending: false });

    const list = data || [];
    const countEl = document.getElementById('online-count');
    if (countEl) countEl.textContent = list.length;

    if (!list.length) {
      box.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:8px 0">Nadie conectado en este momento.</div>';
      return;
    }

    box.innerHTML = list.map(s => {
      const secs = Math.max(0, Math.floor((Date.now() - new Date(s.last_seen).getTime()) / 1000));
      const ago = secs < 30 ? 'ahora' : secs < 60 ? 'hace ' + secs + 's' : 'hace ' + Math.floor(secs / 60) + 'm';
      const isSelf = s.id === state.currentUser.id;
      const isSuper = s.role === 'superadmin';
      const avatar = s.photo_url
        ? '<img src="' + esc(s.photo_url) + '" style="width:30px;height:30px;border-radius:50%;object-fit:cover">'
        : '<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.08);font-weight:700;font-size:.8rem">' + cap(s.name).charAt(0) + '</span>';
      const kickBtn = (!isSelf && !isSuper)
        ? '<button class="btn-red" style="padding:5px 10px;font-size:.72rem" onclick="kickUser(&quot;' + s.id + '&quot;,&quot;' + esc(s.name) + '&quot;)">Desconectar</button>'
        : (isSelf ? '<span style="font-size:.66rem;color:var(--muted)">vos</span>' : '');
      return '<div class="online-row">' +
          '<span class="online-pulse"></span>' +
          avatar +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:600;font-size:.85rem">' + esc(cap(s.name)) + ' <span class="staff-role-badge ' + roleCls(s.role) + '" style="font-size:.55rem;padding:1px 6px">' + s.role.toUpperCase() + '</span></div>' +
            '<div style="font-size:.68rem;color:var(--muted)">' + ago + '</div>' +
          '</div>' +
          kickBtn +
        '</div>';
    }).join('');
  } catch (e) { console.warn('loadOnlineUsers:', e); }
}

async function kickUser(staffId, name) {
  if (state.currentUser?.role !== 'superadmin') { showToast('Sin permisos.', 't-err'); return; }
  if (staffId === state.currentUser.id) { showToast('No podés desconectarte a vos mismo.', 't-err'); return; }
  showConfirm('¿Cerrar la sesión de "' + name + '"? Se va a desconectar en los próximos segundos.', async () => {
    const { error } = await db.from('staff').update({ force_logout_at: new Date().toISOString() }).eq('id', staffId);
    if (error) { showToast('No se pudo desconectar: ' + (error.message || error), 't-err'); return; }
    showToast('Se cerró la sesión de ' + cap(name) + '.', 't-ok');
    loadOnlineUsers();
  });
}

/* ── Override de secciones por usuario (Super Admin) ──────── */
function showUserPerms(staffId) {
  if (state.currentUser?.role !== 'superadmin') { showToast('Sin permisos.', 't-err'); return; }
  const s = (state.staffList_ || []).find(x => String(x.id) === String(staffId));
  if (!s) { showToast('No se encontró el usuario.', 't-err'); return; }
  if (s.role === 'superadmin') { showToast('El Super Admin tiene acceso total.', 't-info'); return; }

  const ov = (s.perm_overrides && typeof s.perm_overrides === 'object') ? s.perm_overrides : {};
  const rolePerm = (state.permConfig_ || {})[s.role] || {};

  const rows = ALL_PAGES.map(p => {
    // Estado efectivo actual: override si existe, si no el del rol
    let on = (p.id in ov) ? ov[p.id] === true : rolePerm[p.id] === true;
    const forced = (s.role === 'cajero' && p.id === 'cargas'); // siempre activo
    if (forced) on = true;
    return '<label class="uperm-row">' +
        '<span>' + esc(p.label) + (forced ? ' <span style="font-size:.6rem;color:var(--muted)">(fijo)</span>' : '') + '</span>' +
        '<input type="checkbox" class="uperm-check" data-page="' + p.id + '" ' +
          (on ? 'checked' : '') + ' ' + (forced ? 'disabled' : '') + ' style="accent-color:var(--accent);width:18px;height:18px">' +
      '</label>';
  }).join('');

  showModal({
    title: '🔒 Secciones de ' + cap(s.name),
    wide: true,
    body:
      '<div style="font-size:.78rem;color:var(--muted);margin-bottom:10px">Destildá una sección para bloqueársela a <strong>' + esc(cap(s.name)) + '</strong> sin afectar al resto de su rol (' + esc(s.role) + '). Se aplica en vivo (~20s).</div>' +
      '<div class="uperm-list">' + rows + '</div>',
    actions:
      '<button class="btn-modal" data-modal-cancel>Cancelar</button>' +
      '<button class="btn-tiny" style="background:rgba(255,255,255,.06)" onclick="resetUserPerms(&quot;' + s.id + '&quot;)">Volver al rol</button>' +
      '<button class="btn-primary" onclick="saveUserPerms(&quot;' + s.id + '&quot;)">Guardar</button>',
  });
}

async function saveUserPerms(staffId) {
  const s = (state.staffList_ || []).find(x => String(x.id) === String(staffId));
  if (!s) return;
  const rolePerm = (state.permConfig_ || {})[s.role] || {};
  const overrides = {};
  document.querySelectorAll('.uperm-check').forEach(cb => {
    const page = cb.dataset.page;
    const checked = cb.checked;
    const forced = (s.role === 'cajero' && page === 'cargas');
    if (forced) return; // no se guarda, siempre activo
    // Solo guardar como override lo que DIFIERE del rol
    if (checked !== (rolePerm[page] === true)) overrides[page] = checked;
  });
  showLoad(true);
  const { error } = await db.from('staff').update({ perm_overrides: overrides }).eq('id', staffId);
  showLoad(false);
  if (error) { showToast('No se pudo guardar: ' + (error.message || error), 't-err'); console.error(error); return; }
  closeModal();
  const n = Object.keys(overrides).length;
  showToast(n ? ('✔ ' + n + ' sección(es) personalizada(s) para ' + cap(s.name) + '.') : ('✔ ' + cap(s.name) + ' vuelve a los permisos de su rol.'), 't-ok');
  await loadStaff();
}

async function resetUserPerms(staffId) {
  showLoad(true);
  const { error } = await db.from('staff').update({ perm_overrides: {} }).eq('id', staffId);
  showLoad(false);
  if (error) { showToast('No se pudo restablecer: ' + (error.message || error), 't-err'); return; }
  closeModal();
  showToast('Permisos restablecidos al rol.', 't-ok');
  await loadStaff();
}

async function doLogin() {
  const name = document.getElementById('lu').value.trim().toLowerCase();
  const pass = document.getElementById('lp').value;
  if (!name || !pass) return;
  showLoad(true);
  try {
    const { data, error } = await db.from('staff').select('*').ilike('name', name).eq('password', pass).eq('active', true).single();
    if (error || !data) { document.getElementById('lerr').textContent = 'Usuario o contraseña incorrectos.'; return; }
    state.currentUser = data;
    try { await db.from('staff').update({ last_login: new Date().toISOString() }).eq('id', data.id); } catch(_) {}
    startHeartbeat();
    document.getElementById('login-screen').style.display = 'none';

    // Show welcome overlay while app loads in background
    showWelcome(data);
    await setupTabs();
    await Promise.all([loadActiveBonuses(), loadStarImages()]);

    const firstPage = ['inicio','cargas','historial','retiros','jugadores','bonos','turnos','metricas']
      .find(p => canAccess(p)) || 'cargas';

    // Show app after 2.4s and fade out welcome
    setTimeout(() => {
      document.getElementById('app').style.display = 'block';
      document.getElementById('topbar-name').textContent = cap(data.name);
      const rlEl = document.getElementById('topbar-role-label');
      if (rlEl) rlEl.textContent = ROLE_LABELS[data.role]||data.role;
      const nw = document.getElementById('notif-wrap');
      if (nw) nw.style.display = data.role === 'superadmin' ? '' : 'none';
      if (data.role === 'superadmin') { loadNotifications(); setInterval(loadNotifications, 5000); }
      updateTopbarAvatar();
      showPage(firstPage);
      hideWelcome();
    }, 2400);
  } catch(e) { document.getElementById('lerr').textContent = 'Error de conexión.'; console.error(e); }
  finally { showLoad(false); }
}

function doLogout() {
  stopHeartbeat();
  stopOnlinePolling();
  state.currentUser = null; state.selBonus_ = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('lu').value = '';
  document.getElementById('lp').value = '';
  document.getElementById('lerr').textContent = '';
}

document.getElementById('lp').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
document.getElementById('lu').onkeydown = e => { if (e.key === 'Enter') document.getElementById('lp').focus(); };

/* ── TABS ──────────────────────────────────────────────── */
function setupTabs() {
  loadPermConfig();
  const isAdmin = ['superadmin','gerente','admin'].includes(state.currentUser.role);
  document.querySelectorAll('.role-admin').forEach(el => el.style.display = isAdmin ? '' : 'none');
  // SA tab: ONLY superadmin, or users with explicit sa_access=true, or explicit perm
  const saAllowed = canAccess('sa-cargas');
  document.querySelectorAll('.role-sa').forEach(el => el.style.display = saAllowed ? '' : 'none');
  const supAllowed = ['superadmin','supervisor'].includes(state.currentUser.role);
  document.querySelectorAll('.role-supervisor').forEach(el => el.style.display = supAllowed ? '' : 'none');

  // Show/hide tabs based on permissions
  document.querySelectorAll('#tab-nav .tab-btn').forEach(btn => {
    const page = btn.dataset.page;
    if (page === 'admin') {
      btn.style.display = isAdmin ? '' : 'none';
    } else {
      btn.style.display = canAccess(page) ? '' : 'none';
    }
    btn.onclick = () => showPage(btn.dataset.page);
  });
}

function showPage(p) {
  const pageEl = document.getElementById('page-'+p);
  if (!pageEl) { console.warn('showPage: página no encontrada:', p); return; }
  stopOnlinePolling(); // se reactiva en initPage si entra a Admin
  document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  pageEl.classList.add('active');
  document.querySelector('[data-page="'+p+'"]')?.classList.add('active');
  currentActivePage_ = p;
  initPage(p);
}

async function initPage(p) {
  if (p === 'inicio')    { startHeroClock(); await populateInicioTurnos(); applyInicioFilters(); loadReporte(); }
  if (p === 'cargas') {
    renderBonusButtons(); await loadCounters(); updateTotal();
    const csSel = document.getElementById('cargas-shift-sel');
    if (csSel) { csSel.value = String(state.activeShift_); const isSuper = ['superadmin','gerente','admin','supervisor'].includes(state.currentUser?.role); csSel.style.display = isSuper ? '' : 'none'; }
    await loadCurrentBankAccount();
  }
  if (p === 'historial') { populateBonusFilter(); await loadHistorial(); }
  if (p === 'retiros')   await loadRetiros();
  if (p === 'jugadores') {
    try { await loadJugadorStats(); } catch(e) { console.error('loadJugadorStats', e); }
    try { await loadTopPlayers();  } catch(e) { console.error('loadTopPlayers', e);  }
    try { await loadJugadores();   } catch(e) { console.error('loadJugadores', e);   }
  }
  if (p === 'bonos')     await loadBonos();
  if (p === 'cuentas')   await loadCuentas();
  if (p === 'metricas')  await loadMetricas();
  if (p === 'turnos')    await loadTurnos();
  if (p === 'admin')     { await loadAdmin(); await populateAppearanceForm(); startOnlinePolling(); }
  
}

/* ── STAR IMAGES ───────────────────────────────────────── */
async function loadStarImages() {
  if (!db) return;
  const { data } = await db.from('star_images').select('*');
  (data || []).forEach(r => { state.starImagesMap[r.stars] = r; });
}

function getStarDisplay(stars, size) {
  const s   = state.starImagesMap[stars];
  const cls = size === 'sm' ? 'star-badge-sm' : 'star-badge';
  const bg  = `star-bg-${stars}`;
  if (s && s.image_url) {
    return `<div class="${cls} ${bg}"><img src="${s.image_url}" alt="${getStarLabel(stars)}"></div>`;
  }
  const labels = { 5:'EX', 4:'BU', 3:'PR', 2:'PC', 1:'EP', 0:'🚫' };
  const lbl    = labels[stars] ?? '?';
  const lc     = `star-label-${stars}`;
  return `<div class="${cls} ${bg}"><span class="star-label-text ${lc}">${lbl}</span></div>`;
}

// Returns img or span sized exactly to px — no wrapper div — for use inside fixed-size containers
function getStarDisplayInline(stars, px) {
  const s = state.starImagesMap[stars];
  const sz = px || 26;
  if (s && s.image_url) {
    return `<img src="${s.image_url}" style="width:${sz}px;height:${sz}px;min-width:${sz}px;object-fit:cover;border-radius:50%;display:block" alt="">`;
  }
  const colors = { 5:'#40c070', 4:'#4090e0', 3:'#f0c040', 2:'#ff9040', 1:'#e04040', 0:'#666' };
  const labels = { 5:'EX', 4:'BU', 3:'PR', 2:'PC', 1:'EP', 0:'🚫' };
  const col = colors[stars] ?? '#888';
  const lbl = labels[stars] ?? '?';
  const fs  = Math.max(8, Math.floor(sz * 0.38));
  return `<span style="display:flex;align-items:center;justify-content:center;width:${sz}px;height:${sz}px;font-size:${fs}px;font-weight:700;color:${col};border-radius:50%">${lbl}</span>`;
}

function getStarStars(n) {
  const s = state.starImagesMap[n];
  const label = getStarLabel(n);
  if (s && s.image_url) {
    return '<div class="star-badge-sm star-bg-' + n + '"><img src="' + s.image_url + '" alt="' + label + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>';
  }
  const colors = { 5:'#40c070', 4:'#4090e0', 3:'#f0c040', 2:'#ff9040', 1:'#e04040', 0:'#666' };
  const labels = { 5:'EX', 4:'BU', 3:'PR', 2:'PC', 1:'EP', 0:'🚫' };
  const col = colors[n] || '#888';
  const lbl = labels[n] || '?';
  return '<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:' + col + '22;border:1px solid ' + col + '66;font-size:.58rem;font-weight:700;color:' + col + '">' + lbl + '</span>';
}

function getStarLabel(n) {
  const m = { 5:'Excelente', 4:'Bueno', 3:'Promedio', 2:'Precaución', 1:'Extrema precaución', 0:'Baneado' };
  return m[n] || '';
}

/* ── BG ────────────────────────────────────────────────── */
/* ── THEME ──────────────────────────────────────────────── */

function applyTheme(theme, name, color, e) {
  if (e) e.stopPropagation();
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('casino_theme', theme);
  const dot = document.getElementById('theme-dot');
  const lbl = document.getElementById('theme-label');
  if (dot) { dot.style.background = color; dot.style.boxShadow = `0 0 6px ${color}`; }
  if (lbl) lbl.textContent = name.toUpperCase();
  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === theme);
  });
  document.getElementById('theme-dropdown')?.classList.remove('open');
}

/* Cambio de tema desde el selector del panel de apariencia */
function apThemeChange(key) {
  const t = THEMES[key] || THEMES[''];
  applyTheme(key, t.name, t.color, null);
}

/* Genera las opciones del menú de temas desde THEMES (escalable) */
function renderThemeOptions() {
  const dd = document.getElementById('theme-dropdown');
  if (!dd) return;
  const cur = document.documentElement.dataset.theme || '';
  dd.innerHTML = Object.entries(THEMES).map(([key, t]) => {
    const active = key === cur ? ' active' : '';
    const nameJs = t.name.replace(/'/g, "\\'");
    return '<div class="theme-option' + active + '" data-theme="' + key + '" ' +
      'onclick="applyTheme(\'' + key + '\',\'' + nameJs + '\',\'' + t.color + '\',event)">' +
      '<div class="theme-swatch" style="background:' + t.color + ';box-shadow:0 0 6px ' + t.color + '"></div>' +
      '<span class="theme-name">' + (t.icon || '●') + ' ' + esc(t.name) + '</span></div>';
  }).join('');
}

/* Llena el <select> de tema del panel de apariencia */
function populateThemeSelect() {
  const sel = document.getElementById('ap-theme');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = Object.entries(THEMES).map(([key, t]) =>
    '<option value="' + key + '">' + (t.icon || '●') + ' ' + esc(t.name) + (key === '' ? ' (default)' : '') + '</option>'
  ).join('');
  sel.value = cur;
}

function toggleThemeDropdown(e) {
  e.stopPropagation();
  renderThemeOptions();
  const dd = document.getElementById('theme-dropdown');
  const btn = document.getElementById('theme-switcher');
  if (!dd.classList.contains('open')) {
    const rect = btn.getBoundingClientRect();
    const ddWidth = 190;
    dd.style.top  = (rect.bottom + 8) + 'px';
    let left = rect.left;
    if (left + ddWidth > window.innerWidth - 8) left = window.innerWidth - ddWidth - 8;
    if (left < 8) left = 8;
    dd.style.left  = left + 'px';
    dd.style.right = 'auto';
  }
  dd.classList.toggle('open');
}

document.addEventListener('click', () => {
  document.getElementById('theme-dropdown')?.classList.remove('open');
});

(function initTheme() {
  const saved = localStorage.getItem('casino_theme') || '';
  const t = THEMES[saved] || THEMES[''];
  applyTheme(saved, t.name, t.color, null);
})();

function setBG(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => { applyBg({ bg: e.target.result, bgType: 'image' }); };
  r.readAsDataURL(file);
}

/* ══════════════════════════════════════════════════════════
   NUEVAS FUNCIONES PARA EL INICIO CON FILTROS
   ══════════════════════════════════════════════════════════ */
async function populateInicioTurnos() {
  const sel = document.getElementById('inicio-turno');
  if (!sel) return;
  try {
    const { data: staff } = await db.from('staff').select('name').eq('active', true).order('name');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Todos los turnos</option>' +
      (staff||[]).map(s => `<option value="${esc(s.name)}" ${cur===s.name?'selected':''}>${cap(esc(s.name))}</option>`).join('');
  } catch(e) { /* ignore */ }
}

async function applyInicioFilters() {
  // Leer los filtros actuales
  const desdeFecha = document.getElementById('inicio-fecha-desde')?.value;
  const hastaFecha = document.getElementById('inicio-fecha-hasta')?.value;
  const horaDesde  = document.getElementById('inicio-hora-desde')?.value || '00:00';
  const horaHasta  = document.getElementById('inicio-hora-hasta')?.value || '23:59';
  const cajero     = document.getElementById('inicio-turno')?.value || '';

  const filters = {};

  if (desdeFecha) {
    filters.from = new Date(desdeFecha + 'T' + horaDesde + ':00').toISOString();
  } else {
    // Si no se pone fecha, usamos hoy desde las 00:00 hasta ahora
    const today = new Date();
    today.setHours(0,0,0,0);
    filters.from = today.toISOString();
  }

  if (hastaFecha) {
    filters.to = new Date(hastaFecha + 'T' + horaHasta + ':59').toISOString();
  } else {
    // Si no se pone fecha final, usamos "ahora"
    filters.to = new Date().toISOString();
  }

  if (cajero) filters.cajero = cajero;

  await loadInicio(filters);
}

/* Atajos rápidos de rango de fecha para el inicio */
function setInicioRange(preset) {
  const desde = document.getElementById('inicio-fecha-desde');
  const hasta = document.getElementById('inicio-fecha-hasta');
  const hd    = document.getElementById('inicio-hora-desde');
  const hh    = document.getElementById('inicio-hora-hasta');
  if (!desde || !hasta) return;

  const pad = n => String(n).padStart(2, '0');
  const fmt = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const now = new Date();
  let from = new Date(now), to = new Date(now);

  if (preset === 'ayer') {
    from.setDate(now.getDate() - 1); to.setDate(now.getDate() - 1);
  } else if (preset === '7') {
    from.setDate(now.getDate() - 6);
  } else if (preset === 'mes') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } // 'hoy' deja from = to = hoy

  desde.value = fmt(from);
  hasta.value = fmt(to);
  if (hd) hd.value = '00:00';
  if (hh) hh.value = '23:59';

  document.querySelectorAll('.inicio-preset').forEach(b =>
    b.classList.toggle('active', b.dataset.preset === preset));

  applyInicioFilters();
  loadReporte();
}

/* ── HERO / BIENVENIDA DEL INICIO ──────────────────────── */
let heroClockTimer_ = null;
let inicioLiveTimer_ = null;
let lastInicioUpdate_ = null;

function updateHeroGreeting() {
  const g = document.getElementById('hero-greeting');
  const d = document.getElementById('hero-date');
  if (!g) return;
  const now = new Date();
  const h = now.getHours();
  const greet = h < 6 ? '🌙 Buenas noches' : h < 12 ? '🌅 Buenos días' : h < 19 ? '☀️ Buenas tardes' : '🌙 Buenas noches';
  const name = cap(state.currentUser?.name || '');
  g.textContent = name ? `${greet}, ${name}` : greet;
  if (d) {
    const fecha = now.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long' });
    d.textContent = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  }
}

function updateHeroClock() {
  const c = document.getElementById('hero-clock');
  if (c) c.textContent = new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function startHeroClock() {
  updateHeroGreeting();
  updateHeroClock();
  if (heroClockTimer_) clearInterval(heroClockTimer_);
  heroClockTimer_ = setInterval(() => { updateHeroClock(); }, 1000);
}

/* Indicador "actualizado hace Xs" */
function markInicioUpdated() {
  lastInicioUpdate_ = Date.now();
  renderInicioLive();
  if (inicioLiveTimer_) clearInterval(inicioLiveTimer_);
  inicioLiveTimer_ = setInterval(renderInicioLive, 1000);
}

function renderInicioLive() {
  const el = document.getElementById('hero-live-text');
  if (!el || !lastInicioUpdate_) return;
  const secs = Math.floor((Date.now() - lastInicioUpdate_) / 1000);
  if (secs < 3) el.textContent = 'en vivo';
  else if (secs < 60) el.textContent = `hace ${secs}s`;
  else el.textContent = `hace ${Math.floor(secs / 60)}m`;
}

/* Animación count-up para las tarjetas de estadística */
const inicioStatCache_ = {};
function animateValue(id, end, opts = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  const { prefix = '', dur = 700 } = opts;
  const start = inicioStatCache_[id] ?? 0;
  inicioStatCache_[id] = end;
  // Si no cambió (típico en auto-refresh), no animar
  if (start === end) { el.textContent = prefix + fmtNum(end); return; }
  const startT = performance.now();
  function frame(now) {
    const p = Math.min(1, (now - startT) / dur);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    const val = Math.round(start + (end - start) * eased);
    el.textContent = prefix + fmtNum(val);
    if (p < 1) requestAnimationFrame(frame);
    else el.textContent = prefix + fmtNum(end);
  }
  requestAnimationFrame(frame);
}

/* ── INICIO MEJORADO ───────────────────────────────────── */
async function loadInicio(filters) {
  showLoad(true);
  try {
    // Construir query base para cargas según filtros
    let qb = db.from('charges').select('amount,bonus_amount,cajero,status,created_at,player_name');
    if (filters && filters.from) qb = qb.gte('created_at', filters.from);
    if (filters && filters.to)   qb = qb.lte('created_at', filters.to);
    if (filters && filters.cajero) qb = qb.eq('cajero', filters.cajero);

    // Ejecutar en paralelo con otras queries
    const [chargesRes, playersRes, wdRes] = await Promise.allSettled([
      qb,   // para cargas
      db.from('players').select('*', { count:'exact', head:true }),
      db.from('withdrawals').select('*', { count:'exact', head:true }).eq('status','pending')
    ]);

    const charges = chargesRes.status === 'fulfilled' ? (chargesRes.value.data || []) : [];
    const playersCount = playersRes.status === 'fulfilled' ? (playersRes.value.count ?? 0) : 0;
    const pendingCount = wdRes.status === 'fulfilled' ? (wdRes.value.count ?? 0) : 0;

    // Separar OK y Error
    const okCharges = charges.filter(c => c.status === 'ok');
    const totalMonto = okCharges.reduce((a,c) => a + Number(c.amount), 0);
    const totalBonos = okCharges.reduce((a,c) => a + Number(c.bonus_amount||0), 0);
    const cargasCount = okCharges.length;

    // Cajero top
    const cajeroMap = {};
    okCharges.forEach(c => { cajeroMap[c.cajero] = (cajeroMap[c.cajero]||0)+1; });
    const topCajero = Object.entries(cajeroMap).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';

    // Actualizar tarjetas con animación count-up
    animateValue('st-total-hoy',    totalMonto, { prefix: '$' });
    animateValue('st-bonos-hoy',    totalBonos, { prefix: '$' });
    animateValue('st-retiros-pend', pendingCount);
    animateValue('st-jugadores',    playersCount);
    animateValue('st-cargas-hoy',   cargasCount);
    animateValue('st-cargas-foot',  cargasCount);
    const cajeroTopEl = document.getElementById('st-cajero-top');
    if (cajeroTopEl) cajeroTopEl.textContent = cap(topCajero);

    // Marcar última actualización (indicador "en vivo")
    markInicioUpdated();

    // Actividad reciente (usamos los últimos 12 cargas)
    const recentAll = charges.slice(0,12); // ya vienen ordenadas por defecto? No, pero basta con tomar los primeros 12 de la lista devuelta (que no está ordenada por fecha si no se pidió orden). Vamos a pedir ordenadas:
    // Para no hacer otra query, ordenamos manualmente (no es óptimo pero pequeño)
    const sortedCharges = [...charges].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    const recent = sortedCharges.slice(0,12);
    const feed = document.getElementById('recent-activity');
    if (feed) {
      feed.innerHTML = recent.length ? recent.map(r => {
        const hora  = new Date(r.created_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
        const isErr = r.status === 'error';
        return `<div class="activity-item">
          <div class="activity-dot ${isErr?'red':'green'}"></div>
          <div class="activity-text">
            <strong>${esc(r.cajero)}</strong> → <strong>${esc(r.player_name)}</strong>
            $${fmtNum(r.amount)}${r.bonus_amount?` +bono $${fmtNum(r.bonus_amount)}`:''}
            ${isErr?'<span class="badge badge-err" style="font-size:.6rem;vertical-align:middle">ERR</span>':''}
          </div>
          <div class="activity-time">${hora}</div>
        </div>`;
      }).join('') : '<div class="empty-state"><div class="es-icon">🌙</div><div class="es-title">Sin actividad reciente</div><div class="es-sub">Las cargas del período elegido aparecerán acá.</div></div>';
    }

    // El reporte se sigue cargando con loadReporte, pero respetando filtros? loadReporte usa su propio periodo. De momento no fusionamos, así que sigue igual.
    // Pero podemos actualizar loadReporte con el periodo del filtro si se quiere. Lo dejo intacto.

  } catch(e) {
    console.error('loadInicio error:', e);
    showToast('Error al cargar datos del inicio.', 't-err');
  } finally { showLoad(false); }
}

/* ══════════════════════════════════════════════════════════
   CARGAS
   ══════════════════════════════════════════════════════════ */
async function loadActiveBonuses() {
  const { data } = await db.from('bonus_types').select('*').eq('status','active').order('amount');
  state.activeBonuses = data || [];
}

function renderBonusButtons() {
  const grid = document.getElementById('bonus-grid');
  if (!grid) return;
  grid.innerHTML = '<button class="b-btn-none ' + (!state.selBonus_ ? 'sel' : '') + '" id="btn-nobonus" onclick="selBonus(null)">SIN BONO</button>';
  const amount = parseFloat(document.getElementById('c-amount')?.value) || 0;
  state.activeBonuses.forEach(function(b) {
    const btn = document.createElement('button');
    btn.className = 'b-btn' + (state.selBonus_?.id === b.id ? ' sel' : '');
    const isPct  = b.bonus_type === 'percentage';
    const pct    = b.percentage || b.amount; // amount stores pct value for pct bonuses
    const calcAmt = isPct ? Math.round(amount * pct / 100) : b.amount;

    if (b.image_only && b.image_url) {
      // Solo imagen: ocupa todo el botón, sin texto
      btn.style.cssText += 'padding:0;overflow:hidden;position:relative;min-height:96px;';
      btn.innerHTML = '<img src="' + esc(b.image_url) + '" alt="' + esc(b.name) + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">';
    } else {
      const imgHtml = b.image_url
        ? '<img src="' + esc(b.image_url) + '" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px;display:block;margin:0 auto 4px">'
        : '';
      if (isPct) {
        btn.innerHTML = imgHtml + '<span style="font-size:1.1rem;font-weight:700">' + pct + '%</span><br><span style="font-size:.72rem">' + esc(b.name) + '</span>' +
          (amount > 0 ? '<br><span style="font-size:.7rem;opacity:.7">= $' + fmtNum(calcAmt) + '</span>' : '');
      } else {
        btn.innerHTML = imgHtml + '<span style="font-size:1.1rem;font-weight:700">$' + fmtNum(b.amount) + '</span><br><span style="font-size:.72rem">' + esc(b.name) + '</span>';
      }
    }
    btn.onclick = function() { selBonus(b); };
    grid.appendChild(btn);
  });
}

function selBonus(b) {
  state.selBonus_ = b;
  renderBonusButtons();
  updateTotal();
}

function calcBonusAmount(b, chargeAmount) {
  if (!b) return 0;
  if (b.bonus_type === 'percentage') {
    const pct = b.percentage || b.amount;
    return Math.round(chargeAmount * pct / 100);
  }
  return b.amount || 0;
}

function updateTotal() {
  const player = document.getElementById('c-player')?.value.trim() || '';
  const amount = parseFloat(document.getElementById('c-amount')?.value) || 0;
  const bonus  = calcBonusAmount(state.selBonus_, amount);
  const total  = amount + bonus;
  const el1 = document.getElementById('display-player');
  const el2 = document.getElementById('display-total');
  if (el1) el1.textContent = player || '—';
  if (el2) el2.textContent = '$' + fmtNum(total);
  // Refresh bonus buttons to update pct previews
  if (state.selBonus_?.bonus_type !== 'percentage') renderBonusButtons();
}

/* Autocomplete */
async function acSearch(q) {
  updateTotal();
  const list = document.getElementById('ac-list');
  if (q.length < 1) { list.classList.remove('show'); return; }
  const { data } = await db.from('players').select('id,name,stars,phone').or(`name.ilike.%${q}%,phone.ilike.%${q}%`).limit(8);
  state.players_ = data || [];
  if (!state.players_.length) { list.classList.remove('show'); return; }
  list.innerHTML = state.players_.map(p => `<div class="ac-item" onclick="pickPlayer('${esc(p.name)}')">
    <span>${esc(p.name)}</span><span class="ac-stars">${getStarStars(p.stars)}${p.phone ? ' · 📱 '+esc(p.phone) : ''}</span>
  </div>`).join('');
  list.classList.add('show');
}

function pickPlayer(name) {
  document.getElementById('c-player').value = name;
  document.getElementById('ac-list').classList.remove('show');
  updateTotal();
}

document.addEventListener('click', e => {
  if (!e.target.closest('.ac-wrap')) { document.querySelectorAll('.ac-list').forEach(l => l.classList.remove('show')); }
});

/* Copy user */
function copyUser() {
  const player = document.getElementById('c-player').value.trim();
  if (!player) { showToast('Ingresá el nombre del jugador.', 't-err'); return; }
  copyToClipboard(player).then(ok => showToast(ok ? '✔ Usuario copiado.' : '⚠ No se pudo copiar.', ok ? 't-ok' : 't-err'));
}

/* Copy total and register */
async function copyTotalAndRegister() {
  const player = document.getElementById('c-player').value.trim();
  const amount = parseFloat(document.getElementById('c-amount').value);
  if (!player) { showToast('Ingresá el nombre del jugador.', 't-err'); return; }
  if (!amount || amount <= 0) { showToast('Ingresá un monto válido.', 't-err'); return; }
  const bonus  = calcBonusAmount(state.selBonus_, amount);
  const total  = amount + bonus;
  await copyToClipboard(String(total));
  showToast('✔ Total copiado. Guardando registro...', 't-info');
  await saveCharge(player, amount);
}

async function saveCharge(playerName, amount) {
  showLoad(true);
  try {
    // Get or create player
    let pid = null;
    const { data: existing } = await db.from('players').select('id').ilike('name', playerName).limit(1);
    if (existing && existing.length) {
      pid = existing[0].id;
    } else {
      const { data: newP } = await db.from('players').insert({ name: playerName, stars: 5, created_by: state.currentUser.name }).select('id').single();
      pid = newP?.id || null;
    }
    const bonus = calcBonusAmount(state.selBonus_, amount);
    const { error: chErr } = await db.from('charges').insert({
      player_id: pid, player_name: playerName,
      amount, bonus_amount: bonus,
      bonus_type_id: state.selBonus_?.id || null,
      bonus_name: state.selBonus_?.name || '',
      total: amount + bonus,
      cajero: state.currentUser.name,
      status: 'ok'
    });
    if (chErr) throw chErr;
    showToast(`✔ Carga registrada — ${playerName} $${fmtNum(amount+bonus)}`, 't-ok');
    document.getElementById('c-player').value = '';
    document.getElementById('c-amount').value = '';
    selBonus(null);
    await loadCounters();
  } catch(e) { showToast('Error al guardar: ' + (e?.message || e), 't-err'); console.error(e); }
  finally { showLoad(false); }
}

/* ── COUNTERS ─────────────────────────────────────────── */
async function loadCounters() {
  const { data: cr } = await db.from('bonus_counters').select('reset_at').eq('id',1).maybeSingle();
  const resetAt = cr?.reset_at || '1970-01-01';
  const { data: charges } = await db.from('charges').select('bonus_amount,bonus_name,bonus_type_id,cajero').eq('status','ok').gte('created_at', resetAt);

  // ── Totales por tipo de bono ──────────────────────────
  const bonusMap = {}; let noBonus = 0, totalCargas = 0;

  // ── Totales por cajero ────────────────────────────────
  const cajeroMap = {};
  const allBonusNames = new Set();

  for (const c of charges || []) {
    totalCargas++;
    if (!c.bonus_amount) { noBonus++; }
    else {
      const key = c.bonus_type_id || c.bonus_amount;
      if (!bonusMap[key]) bonusMap[key] = { name: c.bonus_name || `$${fmtNum(c.bonus_amount)}`, count: 0, total: 0 };
      bonusMap[key].count++;
      bonusMap[key].total += c.bonus_amount;
    }
    if (c.cajero) {
      if (!cajeroMap[c.cajero]) cajeroMap[c.cajero] = { totalCount: 0, totalAmount: 0, byBonus: {} };
      if (c.bonus_amount) {
        const bname = c.bonus_name || `$${fmtNum(c.bonus_amount)}`;
        allBonusNames.add(bname);
        cajeroMap[c.cajero].totalCount++;
        cajeroMap[c.cajero].totalAmount += c.bonus_amount;
        if (!cajeroMap[c.cajero].byBonus[bname]) cajeroMap[c.cajero].byBonus[bname] = { count: 0, amount: 0 };
        cajeroMap[c.cajero].byBonus[bname].count++;
        cajeroMap[c.cajero].byBonus[bname].amount += c.bonus_amount;
      }
    }
  }

  // ── Render global counters ────────────────────────────
  const grid = document.getElementById('counters-grid');
  let html = '';
  for (const [, v] of Object.entries(bonusMap)) {
    html += `<div class="cnt-box"><div class="cnt-label">${esc(v.name)}</div><div class="cnt-num">${v.count}</div><div class="cnt-val">$${fmtNum(v.total)} total</div></div>`;
  }
  html += `<div class="cnt-box neutral"><div class="cnt-label">TOTAL CARGAS</div><div class="cnt-num">${totalCargas}</div><div class="cnt-sub">sin bono: ${noBonus}</div></div>`;
  grid.innerHTML = html || '<div style="color:var(--muted);font-size:.85rem">Sin cargas en el período actual.</div>';

  // ── Render cajero table ───────────────────────────────
  const bonusColsArr = [...allBonusNames].sort();
  const thead = document.getElementById('cajero-thead-tr');
  const tbody = document.getElementById('cajero-tbody');
  if (!thead || !tbody) return;

  thead.innerHTML = `<th>CAJERO</th>` +
    bonusColsArr.map(b => `<th>${esc(b)}</th>`).join('') +
    `<th>TOTAL BONOS</th><th>MONTO TOTAL</th>`;

  const cajeros = Object.entries(cajeroMap).sort((a,b) => b[1].totalAmount - a[1].totalAmount);

  if (!cajeros.length) {
    tbody.innerHTML = `<tr><td colspan="${bonusColsArr.length+3}" style="text-align:center;padding:20px;color:var(--muted)">Sin datos</td></tr>`;
    return;
  }

  let gtCount = 0, gtAmount = 0;
  const gtByBonus = {};

  tbody.innerHTML = cajeros.map(([cajero, d]) => {
    gtCount  += d.totalCount;
    gtAmount += d.totalAmount;
    const bonusCells = bonusColsArr.map(b => {
      const bd = d.byBonus[b];
      if (!gtByBonus[b]) gtByBonus[b] = { count: 0, amount: 0 };
      if (bd) { gtByBonus[b].count += bd.count; gtByBonus[b].amount += bd.amount; }
      return bd
        ? `<td><span style="color:var(--text)">${bd.count}</span> <span style="color:var(--muted);font-size:.7rem">($${fmtNum(bd.amount)})</span></td>`
        : `<td style="color:var(--muted)">—</td>`;
    }).join('');
    return `<tr>
      <td class="cajero-name-cell">${esc(cajero)}</td>
      ${bonusCells}
      <td style="font-weight:600">${d.totalCount}</td>
      <td style="color:var(--green);font-weight:600">$${fmtNum(d.totalAmount)}</td>
    </tr>`;
  }).join('') +
  `<tr class="cajero-total-row">
    <td>TOTAL GENERAL</td>
    ${bonusColsArr.map(b => `<td>${gtByBonus[b]?.count||0} <span style="font-size:.7rem">($${fmtNum(gtByBonus[b]?.amount||0)})</span></td>`).join('')}
    <td>${gtCount}</td>
    <td>$${fmtNum(gtAmount)}</td>
  </tr>`;
}

async function resetCounters() {
  const canReset = ['superadmin','supervisor'].includes(state.currentUser?.role);
  if (!canReset) { showToast('Sin permisos para reiniciar contadores.', 't-err'); return; }
  showConfirm('¿Reiniciar todos los contadores de bonos?', async () => {
    showLoad(true);
    try {
      // Leer el reinicio anterior para registrarlo en el historial
      const { data: prev } = await db.from('bonus_counters')
        .select('reset_at').eq('id', 1).maybeSingle();
      const previousResetAt = prev?.reset_at || null;
      const newResetAt = new Date().toISOString();

      const { error } = await db.from('bonus_counters')
        .upsert({ id: 1, reset_at: newResetAt }, { onConflict: 'id' });
      if (error) throw error;

      // Registrar en el historial (no bloquear el reinicio si esto falla)
      try {
        await db.from('counter_reset_history').insert({
          previous_reset_at: previousResetAt,
          new_reset_at:      newResetAt,
          reset_by:          state.currentUser?.name || '—',
        });
        // Conservar solo los últimos 10
        const { data: old } = await db.from('counter_reset_history')
          .select('id').order('created_at', { ascending: false }).range(10, 1000);
        if (old && old.length) {
          await db.from('counter_reset_history').delete().in('id', old.map(r => r.id));
        }
      } catch (hErr) { console.warn('No se pudo registrar historial de reinicio:', hErr); }

      await loadCounters();
      if (document.getElementById('reset-history-panel')?.style.display === 'block') {
        await loadResetHistory();
      }
      showToast('Contadores reiniciados.', 't-ok');
    } catch (e) {
      showToast('No se pudo reiniciar: ' + (e?.message || e), 't-err');
      console.error(e);
    } finally {
      showLoad(false);
    }
  });
}

/* ── HISTORIAL DE REINICIOS ───────────────────────────── */
async function toggleResetHistory() {
  const panel = document.getElementById('reset-history-panel');
  if (!panel) return;
  const open = panel.style.display === 'block';
  if (open) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  await loadResetHistory();
}

async function loadResetHistory() {
  const list = document.getElementById('reset-history-list');
  if (!list) return;
  list.textContent = 'Cargando...';
  try {
    const { data, error } = await db.from('counter_reset_history')
      .select('*').order('created_at', { ascending: false }).limit(10);
    if (error) throw error;
    if (!data || !data.length) {
      list.innerHTML = '<div style="color:var(--muted);padding:6px 0">Sin reinicios registrados todavía.</div>';
      return;
    }
    list.innerHTML = data.map(r => {
      const when = new Date(r.created_at).toLocaleString('es-PY');
      const prev = r.previous_reset_at
        ? new Date(r.previous_reset_at).toLocaleString('es-PY')
        : 'inicio';
      return `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)">
        <span>🕐 <strong>${esc(when)}</strong></span>
        <span style="color:var(--muted)">por ${esc(r.reset_by || '—')}</span>
      </div>
      <div style="font-size:.72rem;color:var(--muted);padding-bottom:6px">período anterior desde: ${esc(prev)}</div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = '<div style="color:var(--red,#e05)">No se pudo cargar el historial: ' + esc(e?.message || String(e)) + '</div>';
    console.error(e);
  }
}

/* ══════════════════════════════════════════════════════════
   HISTORIAL
   ══════════════════════════════════════════════════════════ */
function populateBonusFilter() {
  const sel = document.getElementById('h-bonus');
  const existing = new Set([...sel.options].map(o => o.value));
  state.activeBonuses.forEach(b => {
    if (!existing.has(String(b.id))) {
      const o = document.createElement('option');
      o.value = b.id; o.textContent = b.name;
      sel.appendChild(o);
    }
  });
}

const H_PAGE_SIZE = 50;


async function loadHistorial(resetPage) {
  if (resetPage !== false) state.hCurrentPage = 1;
  const q      = document.getElementById('h-search').value.trim();
  const df     = document.getElementById('h-date-from').value;
  const dt_    = document.getElementById('h-date-to').value;
  const status = document.getElementById('h-status').value;
  const bonus  = document.getElementById('h-bonus').value;
  const isSA   = state.currentUser?.role === 'superadmin';

  showLoad(true);
  try {
    // Base query — server-side filter, only sa_private=false for non-SA
    let qb = db.from('charges')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (!isSA) qb = qb.or('sa_private.is.null,sa_private.eq.false');
    if (status) qb = qb.eq('status', status);
    if (bonus === '0') qb = qb.eq('bonus_amount', 0);
    else if (bonus)    qb = qb.eq('bonus_type_id', bonus);
    if (df)  qb = qb.gte('created_at', df + 'T00:00:00');
    if (dt_) qb = qb.lte('created_at', dt_ + 'T23:59:59');

    // Text search: use ilike server-side when possible
    if (q && !isNaN(Number(q))) {
      // numeric search — filter by amount/total server-side
      qb = qb.or('player_name.ilike.%' + q + '%,cajero.ilike.%' + q + '%');
    } else if (q) {
      qb = qb.or('player_name.ilike.%' + q + '%,cajero.ilike.%' + q + '%');
    }

    // Fetch only current page
    const pageFrom = (state.hCurrentPage - 1) * H_PAGE_SIZE;
    const pageTo   = pageFrom + H_PAGE_SIZE - 1;
    const { data, count, error } = await qb.range(pageFrom, pageTo);

    if (error) throw error;

    state.hAllData    = data || [];
    state.hTotalCount = count || 0;

    // Hide SA edits from non-SA: show original values
    if (!isSA) {
      state.hAllData = state.hAllData.map(r => {
        if (r.sa_bonus_override) {
          return Object.assign({}, r, {
            bonus_amount: r.original_bonus_amount ?? r.bonus_amount,
            total:        r.original_total        ?? r.total,
          });
        }
        return r;
      });
    }

    renderHistorialPage();
  } finally { showLoad(false); }
}

function renderHistorialPage() {
  const isSA  = state.currentUser?.role === 'superadmin';
  const thDel = document.getElementById('th-delete');
  if (thDel) thDel.style.display = isSA ? '' : 'none';

  const total  = state.hTotalCount;
  const pages  = Math.max(1, Math.ceil(total / H_PAGE_SIZE));
  const start  = (state.hCurrentPage - 1) * H_PAGE_SIZE;
  const pageRows = state.hAllData;  // already the current page from server

  const tbody = document.getElementById('h-tbody');
  if (!state.hAllData.length && !total) {
    tbody.innerHTML = `<tr><td colspan="${isSA?11:10}" class="empty-td">Sin registros</td></tr>`;
    document.getElementById('pag-info').textContent = 'Sin resultados';
    document.getElementById('pag-btns').innerHTML = '';
    return;
  }

  tbody.innerHTML = pageRows.map((r, i) => {
    const dt2   = new Date(r.created_at);
    const fecha = dt2.toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit',year:'numeric'});
    const hora  = dt2.toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const globalIdx = start + i + 1;

    let bonusCell;
    if (r.bonus_amount) {
      const editBtn = (isSA && r.status !== 'error')
        ? `<button class="btn-sa-edit" onclick="showBonusEdit('${r.id}', ${r.bonus_amount})" title="Cambiar bono">✎</button>`
        : '';
      bonusCell = `<span class="badge badge-bonus">$${fmtNum(r.bonus_amount)}</span>${editBtn}`;
    } else {
      const addBtn = (isSA && r.status !== 'error')
        ? `<button class="btn-sa-edit" onclick="showBonusEdit('${r.id}', 0)" title="Agregar bono">+</button>`
        : '';
      bonusCell = `<span class="badge badge-none">—</span>${addBtn}`;
    }

    return `<tr class="${r.status==='error'?'err-row':''}" id="hrow-${r.id}">
      <td style="color:var(--muted);font-size:.7rem">${globalIdx}</td>
      <td style="font-weight:600">${esc(r.player_name)}</td>
      <td style="color:var(--green)">$${fmtNum(r.amount)}</td>
      <td id="bcell-${r.id}">${bonusCell}</td>
      <td style="color:var(--accent);font-weight:600" id="tcell-${r.id}">$${fmtNum(r.total)}</td>
      <td style="color:var(--accent);font-size:.78rem">${esc(r.cajero)}</td>
      <td style="color:var(--muted);font-size:.78rem">${fecha}</td>
      <td style="color:var(--muted);font-size:.78rem">${hora}</td>
      <td>${r.status==='error'?`<span class="badge badge-err">ERROR</span>`:`<span class="badge badge-ok">OK</span>`}</td>
      <td><button class="btn-red" ${r.status==='error'?'disabled':''} onclick="markError('${r.id}')">Marcar error</button></td>
      ${isSA ? `<td><button class="btn-del-row" onclick="deleteCharge('${r.id}',this)" title="Eliminar registro permanentemente">🗑</button></td>` : ''}
    </tr>`;
  }).join('');

  document.getElementById('pag-info').innerHTML =
    `Mostrando <strong>${start+1}–${Math.min(start+H_PAGE_SIZE, total)}</strong> de <strong>${total}</strong> registros`;

  renderPagButtons(pages);
}

function renderPagButtons(pages) {
  const btns = document.getElementById('pag-btns');
  if (pages <= 1) { btns.innerHTML = ''; return; }

  let html = `<button class="pag-btn" ${state.hCurrentPage===1?'disabled':''} onclick="goPage(${state.hCurrentPage-1})">‹</button>`;

  const delta = 2;
  let lo = Math.max(1, state.hCurrentPage - delta);
  let hi = Math.min(pages, state.hCurrentPage + delta);
  if (lo > 1) {
    html += `<button class="pag-btn" onclick="goPage(1)">1</button>`;
    if (lo > 2) html += `<span class="pag-ellipsis">…</span>`;
  }
  for (let p = lo; p <= hi; p++) {
    html += `<button class="pag-btn ${p===state.hCurrentPage?'active':''}" onclick="goPage(${p})">${p}</button>`;
  }
  if (hi < pages) {
    if (hi < pages - 1) html += `<span class="pag-ellipsis">…</span>`;
    html += `<button class="pag-btn" onclick="goPage(${pages})">${pages}</button>`;
  }
  html += `<button class="pag-btn" ${state.hCurrentPage===pages?'disabled':''} onclick="goPage(${state.hCurrentPage+1})">›</button>`;

  btns.innerHTML = html;
}

function goPage(p) {
  state.hCurrentPage = p;
  loadHistorial(false);
  document.getElementById('h-tbody')?.closest('.card')?.scrollIntoView({ behavior:'smooth', block:'start' });
}

function showBonusEdit(id, currentBonus) {
  const cell = document.getElementById('bcell-' + id);
  if (!cell) return;
  const row = state.hAllData.find(r => r.id === id);
  if (!row) return;

  // Use data attributes on buttons to avoid quoting nightmares
  const fromLabel = currentBonus > 0 ? '$' + fmtNum(currentBonus) : 'Sin bono';
  const wrap = document.createElement('div');
  wrap.className = 'bonus-sel-wrap';

  const title = document.createElement('div');
  title.className = 'bonus-sel-title';
  title.textContent = 'CAMBIAR BONO';
  wrap.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'bonus-sel-grid';

  // No bonus button
  const noneBtn = document.createElement('button');
  noneBtn.className = 'bonus-sel-btn nobonus' + (currentBonus === 0 ? ' current' : '');
  noneBtn.textContent = 'SIN BONO';
  noneBtn.onclick = function() { saveBonusEdit(id, 0, '', null); };
  grid.appendChild(noneBtn);

  // Bonus buttons from state.activeBonuses
  state.activeBonuses.forEach(function(b) {
    var btn = document.createElement('button');
    var isPct  = b.bonus_type === 'percentage';
    var calcAmt = calcBonusAmount(b, row.amount);
    btn.className = 'bonus-sel-btn' + (Math.abs(calcAmt - currentBonus) < 0.01 ? ' current' : '');
    btn.textContent = isPct
      ? (b.percentage || b.amount) + '% = $' + fmtNum(calcAmt)
      : '$' + fmtNum(b.amount);
    btn.title = b.name;
    btn.onclick = function() { saveBonusEdit(id, calcAmt, b.name, b.id); };
    grid.appendChild(btn);
  });
  wrap.appendChild(grid);

  const info = document.createElement('div');
  info.className = 'bonus-change-info';
  info.innerHTML = 'Actual: <span>' + fromLabel + '</span> &nbsp;·&nbsp; Carga: <span>$' + fmtNum(row.amount) + '</span>';
  wrap.appendChild(info);

  // Date/time editor (SA only)
  const dateDiv = document.createElement('div');
  dateDiv.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08)';
  const dateLabel = document.createElement('div');
  dateLabel.className = 'bonus-sel-title';
  dateLabel.textContent = 'FECHA Y HORA';
  dateDiv.appendChild(dateLabel);

  const dateRow = document.createElement('div');
  dateRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px';

  const dtObj = new Date(row.created_at);
  const toLocal = d => {
    const pad = n => String(n).padStart(2,'0');
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  };
  const toLocalTime = d => {
    const pad = n => String(n).padStart(2,'0');
    return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
  };

  const dateInp = document.createElement('input');
  dateInp.type = 'date'; dateInp.className = 'inp'; dateInp.id = 'sa-date-' + id;
  dateInp.value = toLocal(dtObj); dateInp.style.flex = '1';

  const timeInp = document.createElement('input');
  timeInp.type = 'time'; timeInp.className = 'inp'; timeInp.id = 'sa-time-' + id;
  timeInp.value = toLocalTime(dtObj); timeInp.step = '1'; timeInp.style.flex = '1';

  dateRow.appendChild(dateInp);
  dateRow.appendChild(timeInp);
  dateDiv.appendChild(dateRow);
  wrap.appendChild(dateDiv);

  const cancel = document.createElement('button');
  cancel.className = 'bonus-sel-cancel';
  cancel.textContent = '✕ Cancelar';
  cancel.style.marginTop = '8px';
  cancel.onclick = function() { loadHistorial(false); };
  wrap.appendChild(cancel);

  cell.innerHTML = '';
  cell.appendChild(wrap);
}

async function saveBonusEdit(id, newBonus, bonusName, bonusTypeId) {
  const row = state.hAllData.find(r => r.id === id);
  if (!row) return;

  // Don't save if same value
  if (Math.abs(row.bonus_amount - newBonus) < 0.01) {
    renderHistorialPage();
    return;
  }

  const oldBonus = row.bonus_amount || 0;
  const fromLabel = oldBonus > 0 ? '$' + fmtNum(oldBonus) : 'Sin bono';
  const toLabel   = newBonus > 0 ? '$' + fmtNum(newBonus)  : 'Sin bono';

  showConfirm(
    'Cambiar bono de <strong>' + esc(row.player_name) + '</strong><br>' +
    fromLabel + ' → ' + toLabel + '<br>' +
    'El contador se actualizará automáticamente.',
    async function() {
      showLoad(true);
      const updateData = {
        bonus_amount:    newBonus,
        bonus_name:      bonusName || '',
        bonus_type_id:   bonusTypeId || null,
        total:           row.amount + newBonus,
        sa_bonus_override: true,
        sa_edited_by:    state.currentUser.name,
        sa_edited_at:    new Date().toISOString(),
      };
      // Save originals only on first edit
      if (!row.sa_bonus_override) {
        updateData.original_bonus_amount = oldBonus;
        updateData.original_total        = row.total;
      }
      // Save date/time if changed
      const dateVal = document.getElementById('sa-date-' + id)?.value;
      const timeVal = document.getElementById('sa-time-' + id)?.value || '00:00:00';
      if (dateVal) {
        const newDt = new Date(dateVal + 'T' + timeVal);
        if (!isNaN(newDt.getTime())) {
          updateData.created_at = newDt.toISOString();
        }
      }
      const { error: upErr } = await db.from('charges').update(updateData).eq('id', id);
      if (upErr) {
        showToast('No se pudo guardar: ' + (upErr.message || upErr), 't-err');
        console.error(upErr);
        showLoad(false);
        return;
      }
      await loadCounters();
      await loadHistorial(false);
      showToast('✔ Bono cambiado: ' + fromLabel + ' → ' + toLabel, 't-ok');
      showLoad(false);
    }
  );
}

async function markError(id) {
  showConfirm('¿Marcar esta carga como ERROR? El bono se descontará del contador. El registro permanece en el historial.', async () => {
    showLoad(true);
    const { error } = await db.from('charges').update({ status: 'error' }).eq('id', id);
    if (error) { showToast('No se pudo actualizar: ' + (error.message || error), 't-err'); console.error(error); showLoad(false); return; }
    await Promise.all([loadHistorial(false), loadCounters()]);
    showToast('Registro marcado como error.', 't-err');
    showLoad(false);
  });
}

async function deleteCharge(id, btn) {
  if (state.currentUser?.role !== 'superadmin') { showToast('Sin permisos.', 't-err'); return; }
  showConfirm('⚠ ¿ELIMINAR este registro permanentemente? Esta acción no se puede deshacer. Si tenía bono, el contador se ajustará.', async () => {
    showLoad(true);
    const { error } = await db.from('charges').delete().eq('id', id);
    if (error) { showToast('No se pudo eliminar: ' + (error.message || error), 't-err'); console.error(error); showLoad(false); return; }
    state.hAllData = state.hAllData.filter(r => r.id !== id);
    renderHistorialPage();
    await loadCounters();
    showToast('Registro eliminado permanentemente.', 't-err');
    showLoad(false);
  });
}

/* ══════════════════════════════════════════════════════════
   RETIROS
   ══════════════════════════════════════════════════════════ */
function updateRetiroPreview() {
  const player    = document.getElementById('r-player').value.trim();
  const amount    = document.getElementById('r-amount').value.trim();
  const cbu       = document.getElementById('r-cbu').value.trim();
  const principal = document.getElementById('r-principal').value.trim();
  const preview   = document.getElementById('retiro-preview');
  if (!player && !amount && !cbu && !principal) { preview.style.display = 'none'; return; }
  preview.style.display = '';
  document.getElementById('pv-player').textContent    = player    || '—';
  document.getElementById('pv-amount').textContent    = amount    ? '$' + Number(amount).toLocaleString('es-AR') : '—';
  document.getElementById('pv-cbu').textContent       = cbu       || '—';
  document.getElementById('pv-principal').textContent = principal || '—';
  const btn = document.getElementById('btn-copy-all');
  btn.className = 'btn-copy-all';
  btn.innerHTML = '📋 COPIAR TODOS LOS DATOS';
}

function copyAllRetiroData() {
  const player    = document.getElementById('r-player').value.trim()    || '—';
  const amount    = document.getElementById('r-amount').value.trim();
  const cbu       = document.getElementById('r-cbu').value.trim()       || '—';
  const principal = document.getElementById('r-principal').value.trim() || '—';
  const amtFmt    = amount ? '$' + Number(amount).toLocaleString('es-AR') : '—';
  const text = `Usuario: ${player}\nMonto: ${amtFmt}\nCBU/Alias: ${cbu}\nPrincipal: ${principal}`;
  copyToClipboard(text).then(ok => {
    const btn = document.getElementById('btn-copy-all');
    btn.className = 'btn-copy-all copied';
    btn.innerHTML = '✔ ¡DATOS COPIADOS!';
    setTimeout(() => { btn.className = 'btn-copy-all'; btn.innerHTML = '📋 COPIAR TODOS LOS DATOS'; }, 2500);
  });
}

async function acSearchR(q) {
  const list = document.getElementById('ac-list-r');
  if (q.length < 1) { list.classList.remove('show'); checkWithdrawalTimer(); return; }
  const { data } = await db.from('players').select('id,name,stars,phone').or(`name.ilike.%${q}%,phone.ilike.%${q}%`).limit(8);
  if (!data?.length) { list.classList.remove('show'); return; }
  list.innerHTML = data.map(p => `<div class="ac-item" onclick="pickPlayerR('${esc(p.name)}')"><span>${esc(p.name)}</span><span class="ac-stars">${getStarStars(p.stars)}${p.phone ? ' · 📱 '+esc(p.phone) : ''}</span></div>`).join('');
  list.classList.add('show');
}

function pickPlayerR(name) {
  document.getElementById('r-player').value = name;
  document.getElementById('ac-list-r').classList.remove('show');
  checkWithdrawalTimer();
}

async function checkWithdrawalTimer() {
  const name = document.getElementById('r-player').value.trim();
  const info = document.getElementById('r-timer-info');
  if (!name) { info.innerHTML = ''; return; }
  const { data } = await db.from('withdrawals').select('created_at').ilike('player_name', name).not('status','eq','deleted').order('created_at', { ascending: false }).limit(1);
  if (!data?.length) { info.innerHTML = `<span class="badge badge-ok" style="font-size:.8rem">✔ Sin retiros previos — Habilitado</span>`; return; }
  const last = new Date(data[0].created_at);
  const diffMs = Date.now() - last.getTime();
  const diffHrs = diffMs / 3600000;
  if (diffHrs >= 24) {
    info.innerHTML = `<span class="badge badge-ok" style="font-size:.8rem">✔ Último retiro hace ${Math.floor(diffHrs)}h — Habilitado</span>`;
  } else {
    const rem = 24 - diffHrs;
    const hrs = Math.floor(rem); const mins = Math.floor((rem-hrs)*60);
    info.innerHTML = `<div class="timer-badge">⏱ Próximo retiro disponible en: <strong>${hrs}h ${mins}m</strong></div>`;
  }
}

document.getElementById('r-player').oninput    = function() { acSearchR(this.value); updateRetiroPreview(); };
document.getElementById('r-amount').oninput    = updateRetiroPreview;
document.getElementById('r-cbu').oninput       = updateRetiroPreview;
document.getElementById('r-principal').oninput = updateRetiroPreview;

async function createWithdrawal() {
  const player    = document.getElementById('r-player').value.trim();
  const amount    = parseFloat(document.getElementById('r-amount').value);
  const cbu       = document.getElementById('r-cbu').value.trim();
  const principal = document.getElementById('r-principal').value.trim();
  if (!player || !amount || amount <= 0 || !cbu) { showToast('Completá jugador, monto y CBU/alias.', 't-err'); return; }

  const { data: last } = await db.from('withdrawals').select('created_at').ilike('player_name', player).not('status','eq','deleted').order('created_at', { ascending: false }).limit(1);
  if (last?.length) {
    const diffMs = Date.now() - new Date(last[0].created_at).getTime();
    if (diffMs < 86400000) {
      const rem = (86400000 - diffMs) / 3600000;
      showToast(`Retiro no habilitado. Tiempo restante: ${Math.floor(rem)}h ${Math.floor((rem%1)*60)}m`, 't-err'); return;
    }
  }

  showLoad(true);
  try {
    let pid = null;
    const { data: ep } = await db.from('players').select('id').ilike('name', player).limit(1);
    if (ep?.length) pid = ep[0].id;
    else { const { data: np } = await db.from('players').insert({ name: player, stars: 5, created_by: state.currentUser.name }).select('id').single(); pid = np?.id; }

    const { data: wd } = await db.from('withdrawals').insert({ player_id: pid, player_name: player, cbu_alias: cbu, principal: principal || '', total_amount: amount, cajero: state.currentUser.name, status: 'pending' }).select('id').single();

    if (amount > 100000) {
      const parts = [];
      let rem = amount;
      let n = 1;
      while (rem > 0) {
        parts.push({ withdrawal_id: wd.id, amount: Math.min(100000, rem), part_number: n++, status: 'pending' });
        rem -= 100000;
      }
      await db.from('withdrawal_parts').insert(parts);
    } else {
      await db.from('withdrawal_parts').insert({ withdrawal_id: wd.id, amount, part_number: 1, status: 'pending' });
    }

    showToast(`✔ Retiro de $${fmtNum(amount)} registrado para ${player}`, 't-ok');
    document.getElementById('r-player').value = '';
    document.getElementById('r-amount').value = '';
    document.getElementById('r-cbu').value = '';
    document.getElementById('r-principal').value = '';
    document.getElementById('retiro-preview').style.display = 'none';
    document.getElementById('r-timer-info').innerHTML = '';
    await loadRetiros();
  } catch(e) { showToast('Error al registrar retiro.', 't-err'); console.error(e); }
  finally { showLoad(false); }
}

async function loadRetiros() {
  const flt = document.getElementById('r-filter').value;
  showLoad(true);
  try {
    let q = db.from('withdrawals').select('*').not('status','eq','deleted').order('created_at', { ascending: false }).limit(100);
    if (flt) q = q.eq('status', flt);
    const { data: wds } = await q;
    if (!wds?.length) { document.getElementById('retiros-list').innerHTML = '<div class="empty-state"><div class="es-icon">💸</div><div class="es-title">Sin retiros</div><div class="es-sub">No hay retiros pendientes ni recientes.</div></div>'; return; }

    const ids = wds.map(w => w.id);
    const { data: parts } = await db.from('withdrawal_parts').select('*').in('withdrawal_id', ids).order('part_number');

    const partsMap = {};
    (parts||[]).forEach(p => { if (!partsMap[p.withdrawal_id]) partsMap[p.withdrawal_id] = []; partsMap[p.withdrawal_id].push(p); });

    document.getElementById('retiros-list').innerHTML = wds.map(w => {
      const wParts = partsMap[w.id] || [];
      const done   = wParts.filter(p => p.status === 'done').length;
      const total  = wParts.length;
      const dt     = new Date(w.created_at);
      const fecha  = dt.toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit',year:'numeric'});
      const hora   = dt.toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'});
      const canDel = ['superadmin','admin','supervisor','cajero'].includes(state.currentUser.role);

      return `<div class="wd-card">
        <div class="wd-header">
          <div>
            <div class="wd-player">${esc(w.player_name)} <button class="btn-copy" onclick="copyText('${esc(w.player_name)}')">📋</button></div>
            <div class="cbu-row">CBU/Alias: <span class="cbu-val">${esc(w.cbu_alias)}</span> <button class="btn-copy" onclick="copyText('${esc(w.cbu_alias)}')">📋</button></div>
            ${w.principal ? `<div class="cbu-row">Principal: <span class="cbu-val" style="color:var(--accent)">${esc(w.principal)}</span> <button class="btn-copy" onclick="copyText('${esc(w.principal)}')">📋</button></div>` : ''}
            <div class="wd-meta">Cajero: ${esc(w.cajero)} · ${fecha} ${hora}</div>
          </div>
          <div style="text-align:right">
            <div class="wd-amount">$${fmtNum(w.total_amount)} <button class="btn-copy" onclick="copyText('${w.total_amount}')">📋</button></div>
            ${statusBadgeWD(w.status)}
            <div style="font-size:.72rem;color:var(--muted);margin-top:4px">${done}/${total} partes</div>
          </div>
        </div>
        <div class="parts-list">
          ${wParts.map(p => `
            <div class="part-row ${p.status==='done'?'done':''}" id="part-${p.id}">
              <span class="part-num">${p.part_number}</span>
              <span class="part-amt">$${fmtNum(p.amount)}</span>
              ${p.status==='done'
                ? `<span class="badge badge-ok" style="font-size:.68rem">✔ Listo</span>`
                : `<button class="btn-done" onclick="markPartDone('${p.id}','${w.id}')">✔ Listo</button>`}
            </div>`).join('')}
        </div>
        ${canDel ? `<div style="margin-top:10px;display:flex;gap:8px"><button class="btn-red" onclick="deleteWithdrawal('${w.id}')">Eliminar retiro</button></div>` : ''}
      </div>`;
    }).join('');
  } finally { showLoad(false); }
}

function statusBadgeWD(s) {
  const m = { pending:'<span class="badge badge-pend">PENDIENTE</span>', in_progress:'<span class="badge badge-prog">EN PROCESO</span>', completed:'<span class="badge badge-comp">CULMINADO</span>' };
  return m[s] || '';
}

async function markPartDone(partId, wdId) {
  showLoad(true);
  const { error: pErr } = await db.from('withdrawal_parts').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', partId);
  if (pErr) { showToast('No se pudo actualizar el retiro: ' + (pErr.message || pErr), 't-err'); console.error(pErr); showLoad(false); return; }
  const { data: parts } = await db.from('withdrawal_parts').select('status').eq('withdrawal_id', wdId);
  const allDone = parts?.every(p => p.status === 'done');
  const someD   = parts?.some(p => p.status === 'done');
  const newStatus = allDone ? 'completed' : someD ? 'in_progress' : 'pending';
  const { error: wErr } = await db.from('withdrawals').update({ status: newStatus }).eq('id', wdId);
  if (wErr) { showToast('No se pudo actualizar el estado: ' + (wErr.message || wErr), 't-err'); console.error(wErr); showLoad(false); return; }
  await loadRetiros();
  showLoad(false);
}

async function deleteWithdrawal(id) {
  showConfirm('¿Eliminar este retiro? El contador de 24hs se recalculará automáticamente.', async () => {
    showLoad(true);
    const { error } = await db.from('withdrawals').update({ status: 'deleted' }).eq('id', id);
    if (error) { showToast('No se pudo eliminar: ' + (error.message || error), 't-err'); console.error(error); showLoad(false); return; }
    await loadRetiros();
    showToast('Retiro eliminado.', 't-ok');
    showLoad(false);
  });
}

/* ══════════════════════════════════════════════════════════
   JUGADORES
   ══════════════════════════════════════════════════════════ */
async function createPlayer() {
  const name      = document.getElementById('nj-name').value.trim();
  const phone     = document.getElementById('nj-phone').value.trim();
  const principal = document.getElementById('nj-principal').value.trim();
  if (!name) { showToast('El nombre del jugador es obligatorio.', 't-err'); return; }
  const { data: dup } = await db.from('players').select('id').ilike('name', name).limit(1);
  if (dup?.length) { showToast('Ya existe un jugador con ese nombre.', 't-err'); return; }
  showLoad(true);
  await db.from('players').insert({ name, phone: phone || '', principal: principal || '', stars: 5, created_by: state.currentUser.name });
  document.getElementById('nj-name').value = '';
  document.getElementById('nj-phone').value = '';
  document.getElementById('nj-principal').value = '';
  showToast(`Jugador "${name}" creado.`, 't-ok');
  await loadJugadores();
  showLoad(false);
}


async function loadJugadorStats() {
  try {
    const mesStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [{ count: total }, { count: mesCount }, excelentes, baneados] = await Promise.all([
      db.from('players').select('*', { count:'exact', head:true }),
      db.from('players').select('*', { count:'exact', head:true }).gte('created_at', mesStart),
      db.from('players').select('*', { count:'exact', head:true }).eq('stars', 5),
      db.from('players').select('*', { count:'exact', head:true }).eq('stars', 0),
    ]);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? 0; };
    set('pj-total', total ?? 0);
    set('pj-mes', mesCount ?? 0);
    set('pj-excelentes', excelentes.count ?? 0);
    set('pj-baneados', baneados.count ?? 0);
  } catch(e) { console.error('loadJugadorStats:', e); }
}

function setTopPeriod(days, btn) {
  state.topPeriodDays_ = days;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadTopPlayers(days);
}

async function loadTopPlayers(days) {
  const list = document.getElementById('top-players-list');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--muted);text-align:center;padding:16px;font-size:.82rem">Cargando...</div>';

  try {
    const from = new Date(Date.now() - days * 86400000).toISOString();
    // Get all charges in period (OK only, exclude SA private)
    const { data: charges } = await db.from('charges')
      .select('player_name,player_id,amount,bonus_amount')
      .eq('status','ok')
      .or('sa_private.is.null,sa_private.eq.false')
      .gte('created_at', from);

    if (!charges?.length) {
      list.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px;font-size:.82rem">Sin cargas en el período.</div>';
      return;
    }

    // Aggregate by player
    const map = {};
    charges.forEach(c => {
      const key = c.player_id || c.player_name;
      if (!map[key]) map[key] = { name: c.player_name, pid: c.player_id, total: 0, bonos: 0, count: 0 };
      map[key].total  += Number(c.amount || 0);
      map[key].bonos  += Number(c.bonus_amount || 0);
      map[key].count++;
    });

    // Sort by total amount desc, take top 10
    const sorted = Object.values(map).sort((a,b) => b.total - a.total).slice(0, 10);
    const maxVal = sorted[0]?.total || 1;

    const medals = ['🥇','🥈','🥉'];
    const rankCls = ['r1','r2','r3'];

    list.innerHTML = sorted.map((p, i) => {
      const pct    = Math.round((p.total / maxVal) * 100);
      const medal  = medals[i] || '';
      const rCls   = rankCls[i] || 'rn';
      const rankNum = i + 1;
      return `<div class="top-player-row" onclick="openPlayerProfileByName('${esc(p.name)}')">
        <div class="top-rank ${rCls}">${rankNum}</div>
        <div class="top-medal">${medal}</div>
        <div style="flex:1;min-width:0">
          <div class="top-player-name">${esc(p.name)}</div>
          <div class="top-player-meta">${p.count} carga${p.count!==1?'s':''} · bono $${fmtNum(p.bonos)}</div>
          <div class="top-bar-wrap" style="margin-top:5px">
            <div class="top-bar-bg"><div class="top-bar-fill" style="width:${pct}%"></div></div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="top-amount">$${fmtNum(p.total)}</div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    console.error('loadTopPlayers:', e);
    list.innerHTML = '<div style="color:var(--red);text-align:center;padding:16px;font-size:.82rem">Error al cargar el ranking.</div>';
  }
}

async function openPlayerProfileByName(name) {
  const { data } = await db.from('players').select('id').ilike('name', name).limit(1);
  if (data?.length) openPlayerProfile(data[0].id);
}

async function loadJugadores() {
  const q = document.getElementById('j-search').value.trim();
  const s = document.getElementById('j-stars').value;
  showLoad(true);
  try {
    let qb = db.from('players').select('*').order('name').limit(200);
    if (q) qb = qb.or(`name.ilike.%${q}%,phone.ilike.%${q}%,principal.ilike.%${q}%`);
    if (s !== '') qb = qb.eq('stars', parseInt(s));
    const { data } = await qb;
    const grid = document.getElementById('players-grid');
    if (!data?.length) { grid.innerHTML = '<div class="empty-state"><div class="es-icon">👤</div><div class="es-title">Sin jugadores registrados</div><div class="es-sub">Aparecerán acá a medida que registres cargas.</div></div>'; return; }
    grid.innerHTML = data.map(function(p) {
      var ph  = p.phone     ? '<span style="font-size:.65rem;color:var(--blue)">📱 ' + esc(p.phone) + '</span>' : '';
      var pr  = p.principal ? '<span style="font-size:.65rem;color:var(--purple)">🏦 ' + esc(p.principal) + '</span>' : '';
      var av  = getStarDisplayInline(p.stars, 24);
      var st  = getStarStars(p.stars);
      var lbl = getStarLabel(p.stars);
      return [
        '<div class="player-card" onclick="openPlayerProfile(this.dataset.pid)" data-pid="' + p.id + '">',
          '<div class="player-avatar" style="width:24px;height:24px;min-width:24px;overflow:hidden;border-radius:50%;flex-shrink:0">' + av + '</div>',
          '<div class="player-card-main">',
            '<div class="player-name-card">' + esc(p.name) + '</div>',
            '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">' + st + ' <span style="font-size:.65rem;color:var(--muted)">' + lbl + '</span>' + ph + pr + '</div>',
          '</div>',
        '</div>'
      ].join('');
    }).join('');
  } finally { showLoad(false); }
}

async function openPlayerProfile(pidOrEl) {
  const pid = (typeof pidOrEl === "string") ? pidOrEl : pidOrEl?.dataset?.pid;
  showLoad(true);
  try {
    const { data: p } = await db.from('players').select('*').eq('id', pid).single();
    const { data: charges } = await db.from('charges').select('*').eq('player_id', pid).order('created_at', { ascending: false }).limit(20);
    const since = new Date(p.created_at).toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit',year:'numeric'});

    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      starsHtml += `<button class="star-btn ${i <= p.stars ? 'lit' : ''}" onclick="setPlayerStars('${pid}', ${i})" data-v="${i}">⭐</button>`;
    }
    starsHtml += `<button class="star-btn ${p.stars === 0 ? 'lit' : ''}" onclick="setPlayerStars('${pid}', 0)" style="font-size:1.2rem">🚫</button>`;

    const chargesHtml = charges?.length ? `
      <table style="width:100%;font-size:.78rem"><thead><tr>
        <th style="padding:6px;color:var(--muted)">FECHA</th><th style="padding:6px;color:var(--muted)">CARGA</th>
        <th style="padding:6px;color:var(--muted)">BONO</th><th style="padding:6px;color:var(--muted)">CAJERO</th>
        <th style="padding:6px;color:var(--muted)">EST.</th>
      </tr></thead><tbody>${charges.map(c => {
        const d = new Date(c.created_at).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'});
        return `<tr style="border-bottom:1px solid rgba(255,255,255,.04)">
          <td style="padding:6px;color:var(--muted)">${d}</td>
          <td style="padding:6px;color:var(--green)">$${fmtNum(c.amount)}</td>
          <td style="padding:6px">${c.bonus_amount ? `<span class="badge badge-bonus" style="font-size:.65rem">$${fmtNum(c.bonus_amount)}</span>` : '—'}</td>
          <td style="padding:6px;color:var(--accent);font-size:.75rem">${esc(c.cajero)}</td>
          <td style="padding:6px">${c.status==='error'?`<span class="badge badge-err" style="font-size:.65rem">ERR</span>`:`<span class="badge badge-ok" style="font-size:.65rem">OK</span>`}</td>
        </tr>`;
      }).join('')}</tbody></table>` : '<div style="color:var(--muted);font-size:.82rem;padding:10px">Sin cargas registradas.</div>';

    showModal({
      title: `👤 ${esc(p.name)}`,
      wide: true,
      body: `
        <div class="profile-header">
          <div class="profile-avatar">${getStarDisplay(p.stars)}</div>
          <div class="profile-info">
            <div class="profile-name">${esc(p.name)}</div>
            <div style="font-size:.72rem;color:var(--muted);margin-top:2px">ID: ${p.id}</div>
            ${p.phone ? `<div style="font-size:.82rem;color:var(--blue);margin-top:4px;display:flex;align-items:center;gap:6px">📱 ${esc(p.phone)} <button class="btn-copy" onclick="copyText('${esc(p.phone)}')">📋</button></div>` : ''}
            ${p.principal ? `<div style="font-size:.82rem;color:var(--purple);margin-top:3px">🏦 Principal: <strong>${esc(p.principal)}</strong></div>` : ''}
            <div class="profile-since">Desde: ${since}</div>
          </div>
        </div>
        <div class="profile-note-label">CALIFICACIÓN</div>
        <div class="stars-selector" id="stars-sel-${pid}">${starsHtml}</div>
        <div style="font-size:.82rem;color:var(--muted);margin-bottom:12px" id="star-label-${pid}">${getStarLabel(p.stars)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div><div class="profile-note-label" style="margin-top:14px;margin-bottom:6px">TELÉFONO</div>
          <input class="inp" id="player-phone-${pid}" placeholder="Número de teléfono..." value="${esc(p.phone||'')}"></div>
          <div><div class="profile-note-label" style="margin-top:14px;margin-bottom:6px">PRINCIPAL</div>
          <input class="inp" id="player-principal-${pid}" placeholder="Nombre o número..." value="${esc(p.principal||'')}"></div>
        </div>
        <div class="profile-note-label">NOTA / COMENTARIO</div>
        <textarea class="inp" id="star-note-${pid}" rows="2" style="resize:vertical;margin-bottom:10px">${esc(p.star_note||'')}</textarea>
        <button class="btn-primary" style="width:100%;margin-bottom:18px" onclick="savePlayerStars('${pid}')">GUARDAR CALIFICACIÓN</button>
        <div class="profile-history">
          <h4>HISTORIAL (últimas 20 cargas)</h4>
          <div class="table-wrap">${chargesHtml}</div>
        </div>`,
      actions: [{ label: 'CERRAR', cls: 'btn-modal-can', fn: closeModal }]
    });
  } finally { showLoad(false); }
}


function setPlayerStars(pid, n) {
  state.pendingStars[pid] = n;
  const sel = document.getElementById('stars-sel-'+pid);
  if (!sel) return;
  sel.querySelectorAll('.star-btn').forEach(btn => {
    const v = parseInt(btn.dataset.v || 0);
    btn.classList.toggle('lit', btn.dataset.v ? v <= n && n > 0 : n === 0);
  });
  const lbl = document.getElementById('star-label-'+pid);
  if (lbl) lbl.textContent = getStarLabel(n);
}

async function savePlayerStars(pid) {
  const stars = state.pendingStars[pid] !== undefined ? state.pendingStars[pid] : null;
  const note  = document.getElementById('star-note-'+pid)?.value || '';
  const phone     = document.getElementById('player-phone-'+pid)?.value.trim() || '';
  const principal = document.getElementById('player-principal-'+pid)?.value.trim() || '';
  const upd   = { star_note: note, phone, principal };
  if (stars !== null) upd.stars = stars;
  showLoad(true);
  const { error } = await db.from('players').update(upd).eq('id', pid);
  showLoad(false);
  if (error) { showToast('No se pudo guardar el perfil: ' + (error.message || error), 't-err'); console.error(error); return; }
  closeModal();
  showToast('Perfil guardado.', 't-ok');
  await loadJugadores();
}

/* ══════════════════════════════════════════════════════════
   BONOS
   ══════════════════════════════════════════════════════════ */
async function loadBonos() {
  const isSA = state.currentUser.role === 'superadmin';
  document.getElementById('create-bonus-card').style.display = isSA ? '' : 'none';

  const { data } = await db.from('bonus_types').select('*').order('created_at', { ascending: false });
  const list = document.getElementById('bonuses-list');
  if (!data?.length) { list.innerHTML = '<div class="empty-state"><div class="es-icon">🎁</div><div class="es-title">Sin bonos registrados</div><div class="es-sub">Creá tu primer bono con el formulario de arriba.</div></div>'; return; }
  state.bonusTypes_ = data;

  list.innerHTML = data.map(b => {
    const dt = new Date(b.created_at).toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit',year:'numeric'});
    const statusBadge = { active:`<span class="badge badge-act">ACTIVO</span>`, expired:`<span class="badge badge-exp">EXPIRADO</span>`, cancelled:`<span class="badge badge-can">CANCELADO</span>` }[b.status] || '';
    const actions = isSA ? `
      <div class="bonus-actions">
        <button class="btn-status" style="color:var(--accent);border-color:rgba(240,192,64,.3)" onclick="showBonusTypeEdit('${b.id}')">✏️ Editar</button>
        ${b.status !== 'active'   ? `<button class="btn-status" style="color:var(--green);border-color:rgba(64,192,112,.3)" onclick="setBonusStatus('${b.id}','active')">Activar</button>` : ''}
        ${b.status !== 'expired'  ? `<button class="btn-status" style="color:var(--muted);border-color:var(--glass-b)" onclick="setBonusStatus('${b.id}','expired')">Expirar</button>` : ''}
        ${b.status !== 'cancelled'? `<button class="btn-status" style="color:var(--red);border-color:rgba(224,64,64,.25)" onclick="setBonusStatus('${b.id}','cancelled')">Cancelar</button>` : ''}
      </div>` : '';
    return `<div class="bonus-row">
      <div style="display:flex;align-items:center;gap:10px">
        ${b.image_url ? `<img src="${esc(b.image_url)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px;flex-shrink:0">` : ''}
        <div>
          <div class="bonus-name">${esc(b.name)}</div>
          <div class="bonus-cond">${esc(b.conditions||'')}</div>
          <div style="font-size:.7rem;color:var(--muted);margin-top:4px">Creado por ${esc(b.created_by)} · ${dt}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <div class="bonus-amount">${b.bonus_type === 'percentage' ? b.percentage + '%' : '$' + fmtNum(b.amount)}</div>
        ${statusBadge}
        ${actions}
      </div>
    </div>`;
  }).join('');
}

function toggleBonusType() {
  const t = document.getElementById('bn-type').value;
  document.getElementById('bn-fixed-col').style.display = t === 'fixed' ? '' : 'none';
  document.getElementById('bn-pct-col').style.display   = t === 'percentage' ? '' : 'none';
}

function bonusImgUpload(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => { const inp = document.getElementById('bn-img'); if (inp) inp.value = e.target.result; };
  r.readAsDataURL(file);
}

async function createBonus() {
  const name    = document.getElementById('bn-name').value.trim();
  const btype   = document.getElementById('bn-type').value;
  const cond    = document.getElementById('bn-cond').value.trim();
  if (!name) { showToast('El nombre es obligatorio.', 't-err'); return; }

  let amount = 0, percentage = 0;
  if (btype === 'fixed') {
    amount = parseFloat(document.getElementById('bn-amount').value);
    if (!amount || amount <= 0) { showToast('Ingresá un monto válido.', 't-err'); return; }
  } else {
    percentage = parseFloat(document.getElementById('bn-pct-num').value) || 0;
    if (percentage < 0 || percentage > 100) { showToast('El porcentaje debe ser entre 0 y 100.', 't-err'); return; }
    amount = percentage; // store percentage value in amount field for pct bonuses
  }

  const imgUrl = document.getElementById('bn-img')?.value.trim() || '';
  const imgOnly = !!document.getElementById('bn-img-only')?.checked;

  showLoad(true);
  const { error: bnErr } = await db.from('bonus_types').insert({
    name, amount, conditions: cond,
    bonus_type:  btype,
    percentage:  btype === 'percentage' ? percentage : 0,
    image_url:   imgUrl,
    image_only:  imgOnly,
    created_by:  state.currentUser.name
  });
  if (bnErr) { showToast('No se pudo crear el bono: ' + (bnErr.message || bnErr), 't-err'); console.error(bnErr); showLoad(false); return; }
  // Reset form
  document.getElementById('bn-name').value = '';
  document.getElementById('bn-amount').value = '';
  document.getElementById('bn-cond').value = '';
  const bnImg = document.getElementById('bn-img'); if(bnImg) bnImg.value = '';
  const bnImgOnly = document.getElementById('bn-img-only'); if(bnImgOnly) bnImgOnly.checked = false;
  document.getElementById('bn-pct-num').value = '50';
  document.getElementById('bn-pct').value = '50';
  document.getElementById('bn-pct-label').textContent = '50%';

  await Promise.all([loadBonos(), loadActiveBonuses()]);
  renderBonusButtons();
  showToast('Bono "' + name + '" creado.', 't-ok');
  showLoad(false);
}

async function setBonusStatus(id, status) {
  showLoad(true);
  const { error } = await db.from('bonus_types').update({ status }).eq('id', id);
  if (error) { showToast('No se pudo cambiar el estado del bono: ' + (error.message || error), 't-err'); console.error(error); showLoad(false); return; }
  await Promise.all([loadBonos(), loadActiveBonuses()]);
  renderBonusButtons();
  showLoad(false);
}

function showBonusTypeEdit(id) {
  if (state.currentUser?.role !== 'superadmin') { showToast('Sin permisos.', 't-err'); return; }
  const b = (state.bonusTypes_ || []).find(x => String(x.id) === String(id));
  if (!b) { showToast('No se encontró el bono.', 't-err'); return; }
  const v = s => (s == null ? '' : String(s));
  const isPct = b.bonus_type === 'percentage';
  showModal({
    title: '✏️ Editar bono',
    wide: true,
    body:
      '<div style="display:flex;flex-direction:column;gap:10px">' +
        '<div class="form-col"><label>NOMBRE</label>' +
          '<input id="be-bn-name" class="inp" value="' + esc(v(b.name)) + '"></div>' +
        '<div class="form-col"><label>TIPO DE BONO</label>' +
          '<select id="be-bn-type" class="inp-sel" style="width:100%" onchange="bonusEditToggleType()">' +
            '<option value="fixed"' + (!isPct ? ' selected' : '') + '>💰 Monto fijo ($)</option>' +
            '<option value="percentage"' + (isPct ? ' selected' : '') + '>📊 Porcentaje (%)</option>' +
          '</select></div>' +
        '<div class="form-col" id="be-bn-fixed-col"' + (isPct ? ' style="display:none"' : '') + '><label>MONTO ($)</label>' +
          '<input id="be-bn-amount" class="inp" type="number" min="0" value="' + esc(v(isPct ? '' : b.amount)) + '"></div>' +
        '<div class="form-col" id="be-bn-pct-col"' + (!isPct ? ' style="display:none"' : '') + '><label>PORCENTAJE (%)</label>' +
          '<input id="be-bn-pct" class="inp" type="number" min="0" max="100" value="' + esc(v(isPct ? (b.percentage || b.amount) : '')) + '"></div>' +
        '<div class="form-col"><label>CONDICIONES / DESCRIPCIÓN</label>' +
          '<input id="be-bn-cond" class="inp" value="' + esc(v(b.conditions)) + '"></div>' +
        '<div class="form-col"><label>IMAGEN (opcional)</label>' +
          '<div style="display:flex;gap:6px;align-items:center">' +
            '<input id="be-bn-img" class="inp" value="' + esc(v(b.image_url)) + '" placeholder="URL o subí un archivo..." style="flex:1">' +
            '<label class="btn-tiny" style="cursor:pointer;white-space:nowrap">📁<input type="file" accept="image/*" style="display:none" onchange="bonusEditImgUpload(this)"></label>' +
          '</div>' +
          '<label style="display:flex;align-items:center;gap:7px;margin-top:8px;font-size:.78rem;color:var(--muted);cursor:pointer">' +
            '<input type="checkbox" id="be-bn-img-only"' + (b.image_only ? ' checked' : '') + ' style="accent-color:var(--accent)">' +
            'Mostrar solo la imagen (sin texto), ocupa todo el botón' +
          '</label></div>' +
      '</div>',
    actions:
      '<button class="btn-modal" data-modal-cancel>Cancelar</button>' +
      '<button class="btn-primary" onclick="saveBonusTypeEdit(&quot;' + b.id + '&quot;)">Guardar cambios</button>',
  });
}

function bonusEditToggleType() {
  const t = document.getElementById('be-bn-type')?.value;
  const fc = document.getElementById('be-bn-fixed-col');
  const pc = document.getElementById('be-bn-pct-col');
  if (fc) fc.style.display = t === 'fixed' ? '' : 'none';
  if (pc) pc.style.display = t === 'percentage' ? '' : 'none';
}
function bonusEditImgUpload(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => { const inp = document.getElementById('be-bn-img'); if (inp) inp.value = e.target.result; };
  r.readAsDataURL(file);
}

async function saveBonusTypeEdit(id) {
  const name  = document.getElementById('be-bn-name')?.value.trim();
  const btype = document.getElementById('be-bn-type')?.value || 'fixed';
  const cond  = document.getElementById('be-bn-cond')?.value.trim() || '';
  const img   = document.getElementById('be-bn-img')?.value.trim() || '';
  const imgOnly = !!document.getElementById('be-bn-img-only')?.checked;
  if (!name) { showToast('El nombre es obligatorio.', 't-err'); return; }

  let amount = 0, percentage = 0;
  if (btype === 'fixed') {
    amount = parseFloat(document.getElementById('be-bn-amount')?.value);
    if (!amount || amount <= 0) { showToast('Ingresá un monto válido.', 't-err'); return; }
  } else {
    percentage = parseFloat(document.getElementById('be-bn-pct')?.value) || 0;
    if (percentage < 0 || percentage > 100) { showToast('El porcentaje debe ser entre 0 y 100.', 't-err'); return; }
    amount = percentage; // se guarda el % en amount para bonos porcentuales
  }

  showLoad(true);
  const { error } = await db.from('bonus_types').update({
    name, amount, conditions: cond, bonus_type: btype,
    percentage: btype === 'percentage' ? percentage : 0,
    image_url: img, image_only: imgOnly,
  }).eq('id', id);
  if (error) {
    showToast('No se pudo guardar: ' + (error.message || error), 't-err');
    console.error(error); showLoad(false); return;
  }
  closeModal();
  await Promise.all([loadBonos(), loadActiveBonuses()]);
  renderBonusButtons();
  showLoad(false);
  showToast('✔ Bono actualizado.', 't-ok');
}
/* ══════════════════════════════════════════════════════════
   ADMIN
   ══════════════════════════════════════════════════════════ */
async function loadAdmin() {
  await Promise.all([loadStaff(), renderStarConfig()]);
  renderPermissions();
}

async function loadStaff() {
  const { data } = await db.from('staff').select('*').eq('active', true).order('name');
  const myLevel = myRoleLevel();
  state.staffList_ = data || [];

  const list = document.getElementById('staff-list');
  const isSA = state.currentUser.role === 'superadmin';
  list.innerHTML = (data||[]).map(s => {
    const canDel = s.role !== 'superadmin' && canManageRole(s.role);
    const avatarContent = s.photo_url ? `<img src="${s.photo_url}" alt="${esc(s.name)}">` : `<span>${cap(s.name).charAt(0)}</span>`;
    const avatarEdit = isSA
      ? `<label class="staff-avatar can-edit" title="Cambiar foto" style="cursor:pointer">${avatarContent}<input type="file" accept="image/*" style="display:none" onchange="uploadStaffPhoto('${s.id}', this)"></label>`
      : `<div class="staff-avatar">${avatarContent}</div>`;
    // SA access toggle — only for non-superadmin staff, only SA can set it
    const saToggle = isSA && s.role !== 'superadmin'
      ? `<label title="Acceso al panel ★ SA" style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:.7rem;color:var(--accent);white-space:nowrap">
          <input type="checkbox" ${s.sa_access?'checked':''} style="accent-color:var(--accent)"
            onchange="toggleSaAccess('${s.id}','${esc(s.name)}',this.checked)"> ★SA
        </label>`
      : '';
    // Botón de override de secciones (solo SA, no para otros superadmin)
    const ovCount = (s.perm_overrides && typeof s.perm_overrides === 'object') ? Object.keys(s.perm_overrides).length : 0;
    const permsBtn = isSA && s.role !== 'superadmin'
      ? `<button class="btn-status" style="color:var(--accent);border-color:rgba(240,192,64,.3)" onclick="showUserPerms('${s.id}')">🔒 Secciones${ovCount?` <span style="background:var(--accent);color:#1a1200;border-radius:8px;padding:0 5px;font-size:.6rem;font-weight:700">${ovCount}</span>`:''}</button>`
      : '';
    return `<div class="staff-row">
      <div style="display:flex;align-items:center;gap:12px">
        ${avatarEdit}
        <div><div class="staff-name">${esc(s.name)}</div><div style="font-size:.7rem;color:var(--muted)">desde ${new Date(s.created_at).toLocaleDateString('es-AR')}</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${saToggle}
        ${permsBtn}
        <span class="staff-role-badge ${roleCls(s.role)}">${s.role.toUpperCase()}</span>
        <button class="btn-red" ${!canDel?'disabled title="Sin permiso"':''} onclick="delStaff('${s.id}','${esc(s.name)}')">Eliminar</button>
      </div>
    </div>`;
  }).join('');

  ['cajero','supervisor','admin','gerente','superadmin'].forEach(r => {
    const opt = document.querySelector('#a-role option[value="'+r+'"]');
    if (opt) opt.style.display = canManageRole(r) ? '' : 'none';
  });
}

async function uploadStaffPhoto(staffId, input) {
  if (state.currentUser.role !== 'superadmin') { showToast('Sin permisos.', 't-err'); return; }
  const file = input.files[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('La imagen no puede superar 2MB.', 't-err'); return; }
  showLoad(true);
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    const { error } = await db.from('staff').update({ photo_url: dataUrl }).eq('id', staffId);
    if (error) { showToast('No se pudo subir la foto: ' + (error.message || error), 't-err'); console.error(error); showLoad(false); return; }
    if (staffId === state.currentUser.id) {
      state.currentUser.photo_url = dataUrl;
      updateTopbarAvatar();
    }
    await loadStaff();
    showToast('Foto de perfil actualizada.', 't-ok');
    showLoad(false);
  };
  reader.readAsDataURL(file);
}

function updateTopbarAvatar() {
  const av = document.getElementById('topbar-avatar');
  if (!av) return;
  if (state.currentUser.photo_url) {
    av.innerHTML = `<img src="${state.currentUser.photo_url}" alt="${esc(state.currentUser.name)}">`;
  } else {
    av.innerHTML = cap(state.currentUser.name).charAt(0);
  }
}

async function toggleSaAccess(staffId, staffName, enabled) {
  if (state.currentUser.role !== 'superadmin') { showToast('Sin permisos.', 't-err'); return; }
  showLoad(true);
  const { error } = await db.from('staff').update({ sa_access: enabled }).eq('id', staffId);
  if (error) { showToast('No se pudo cambiar el acceso SA: ' + (error.message || error), 't-err'); console.error(error); showLoad(false); return; }
  showToast(
    enabled
      ? `★ Acceso SA habilitado para ${cap(staffName)}.`
      : `Acceso SA removido para ${cap(staffName)}.`,
    enabled ? 't-ok' : 't-err'
  );
  showLoad(false);
}


async function addStaff() {
  const name = document.getElementById('a-name').value.trim().toLowerCase();
  const pass = document.getElementById('a-pass').value;
  const role = document.getElementById('a-role').value;
  if (!name || !pass) { showToast('Completá nombre y contraseña.', 't-err'); return; }
  if (!canManageRole(role)) { showToast('No tenés permisos para crear ese rol.', 't-err'); return; }
  showLoad(true);
  const { error } = await db.from('staff').insert({ name, password: pass, role, created_by: state.currentUser.id });
  if (error?.code === '23505') { showToast('Ya existe un usuario con ese nombre.', 't-err'); showLoad(false); return; }
  document.getElementById('a-name').value = '';
  document.getElementById('a-pass').value = '';
  await loadStaff();
  showToast(`Usuario "${name}" creado.`, 't-ok');
  showLoad(false);
}

async function delStaff(id, name) {
  if (!['superadmin','gerente','admin'].includes(state.currentUser?.role)) { showToast('Sin permisos.', 't-err'); return; }
  showConfirm(`¿Desactivar al usuario "${name}"?`, async () => {
    showLoad(true);
    const { error } = await db.from('staff').update({ active: false }).eq('id', id);
    if (error) { showToast('No se pudo desactivar: ' + (error.message || error), 't-err'); console.error(error); showLoad(false); return; }
    await loadStaff();
    showToast(`Usuario "${name}" desactivado.`, 't-ok');
    showLoad(false);
  });
}

/* ── STAR IMAGES CONFIG ─────────────────────────────────── */
async function renderStarConfig() {
  const grid = document.getElementById('star-config-grid');
  const rows = [
    { n:5, label:'Excelente',          color:'#40c070' },
    { n:4, label:'Bueno',              color:'#4090e0' },
    { n:3, label:'Promedio',           color:'#f0c040' },
    { n:2, label:'Precaución',         color:'#ff9040' },
    { n:1, label:'Extrema Precaución', color:'#e04040' },
    { n:0, label:'Baneado',            color:'#888'    },
  ];
  grid.innerHTML = rows.map(({n, label, color}) => {
    const si = state.starImagesMap[n] || {};
    const previewContent = si.image_url
      ? `<img src="${esc(si.image_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : `<span style="font-size:.65rem;font-weight:700;color:${color}">${label.slice(0,2).toUpperCase()}</span>`;
    return `<div class="star-config-row-v2">
      <div style="width:40px;height:40px;border-radius:50%;background:${color}22;border:2px solid ${color}55;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0" id="si-prev-${n}">${previewContent}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.8rem;font-weight:600;color:var(--text);margin-bottom:4px">${label}</div>
        <input class="inp" id="si-url-${n}" placeholder="URL de imagen o subí un archivo..." value="${esc(si.image_url||'')}" style="font-size:.75rem;padding:7px 10px">
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <label class="btn-tiny" style="cursor:pointer;font-size:.72rem">📁<input type="file" accept="image/*" style="display:none" onchange="uploadStarImg(${n},this)"></label>
        <button class="btn-tiny" style="font-size:.72rem" onclick="saveStarImg(${n})">✔ Guardar</button>
        ${si.image_url ? `<button class="btn-red" style="font-size:.72rem;padding:5px 8px" onclick="clearStarImg(${n})">✕</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function clearStarImg(n) {
  showLoad(true);
  await db.from('star_images').upsert({ stars: n, image_url: '' });
  state.starImagesMap[n] = { ...state.starImagesMap[n], image_url: '' };
  await renderStarConfig();
  showToast('Imagen eliminada.', 't-ok');
  showLoad(false);
}

async function uploadStarImg(n, input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => { document.getElementById('si-url-'+n).value = e.target.result; };
  r.readAsDataURL(file);
}

async function saveStarImg(n) {
  const url = document.getElementById('si-url-'+n).value.trim();
  showLoad(true);
  await db.from('star_images').upsert({ stars: n, image_url: url });
  await loadStarImages();
  const prev = document.getElementById('si-prev-'+n);
  prev.innerHTML = url ? `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : '?';
  showToast('Imagen guardada.', 't-ok');
  showLoad(false);
}

/* ══════════════════════════════════════════════════════════
   UTILS
   ══════════════════════════════════════════════════════════ */


/* ── MODAL ──────────────────────────────────────────────── */


document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// Delegación de eventos para botones del modal (showConfirm)
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target.hasAttribute('data-modal-ok')) {
    closeModal();
    if (typeof window.__modalOkCallback === 'function') {
      window.__modalOkCallback();
      window.__modalOkCallback = null;
    }
  }
  if (e.target.hasAttribute('data-modal-cancel')) {
    closeModal();
    window.__modalOkCallback = null;
  }
});

/* ══════════════════════════════════════════════════════════
   TURNOS
   ══════════════════════════════════════════════════════════ */


async function loadTurnos() {
  const tbody = document.getElementById('turnos-tbody');

  try {
    const { data: staff } = await db.from('staff').select('name').eq('active',true).order('name');
    const sel = document.getElementById('turno-filter-staff');
    if (sel && staff) {
      const cur = sel.value;
      sel.innerHTML = '<option value="">Todos los cajeros</option>' +
        staff.map(s => `<option value="${esc(s.name)}" ${cur===s.name?'selected':''}>${cap(esc(s.name))}</option>`).join('');
    }

    const { data: open, error: openErr } = await db.from('turnos')
      .select('*').eq('cajero', state.currentUser.name).is('closed_at', null).limit(1);

    if (openErr) throw openErr;

    state.activeTurno_ = open?.[0] || null;
    renderTurnoStatus();

    let qb = db.from('turnos').select('*').order('opened_at', { ascending: false }).limit(50);
    const fv = document.getElementById('turno-filter-staff')?.value;
    if (fv) qb = qb.eq('cajero', fv);
    const { data: hist, error: histErr } = await qb;

    if (histErr) throw histErr;

    if (!hist?.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-td">Sin turnos registrados aún</td></tr>`;
      return;
    }

    tbody.innerHTML = hist.map(t => {
      const open_  = new Date(t.opened_at);
      const close_ = t.closed_at ? new Date(t.closed_at) : null;
      const dur    = close_ ? durStr((close_-open_)/1000) : '<span style="color:var(--green)">EN CURSO</span>';
      const fmtDt  = d => d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'}) + ' ' + d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
      return `<tr>
        <td style="font-weight:600;color:var(--accent)">${cap(esc(t.cajero))}</td>
        <td style="color:var(--muted);font-size:.78rem">${fmtDt(open_)}</td>
        <td style="color:var(--muted);font-size:.78rem">${close_?fmtDt(close_):'—'}</td>
        <td>${dur}</td>
        <td>${t.cargas_count||0}</td>
        <td style="color:var(--muted);font-size:.78rem;max-width:180px;white-space:normal">${esc(t.nota||'—')}</td>
      </tr>`;
    }).join('');

  } catch(e) {
    console.error('loadTurnos error:', e);
    const msg = e?.message?.includes('relation "turnos" does not exist')
      ? '⚠ La tabla <strong>turnos</strong> no existe en Supabase. Ejecutá el schema SQL y recargá.'
      : `⚠ Error al cargar turnos: ${e?.message || 'Error desconocido'}`;
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--red)">${msg}</td></tr>`;
  }
}

function renderTurnoStatus() {
  const info    = document.getElementById('turno-info');
  const openBtn = document.getElementById('btn-open-turno');
  const closeBtn= document.getElementById('btn-close-turno');
  const badge   = document.getElementById('turno-status-badge');

  if (state.activeTurno_) {
    const since = new Date(state.activeTurno_.opened_at);
    badge.innerHTML = `<span class="badge badge-ok">EN TURNO</span>`;
    info.innerHTML  = `<div class="turno-active-box"><div class="turno-time-big" id="turno-clock">—</div><div class="turno-meta">Inicio: ${since.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</div></div>`;
    openBtn.disabled  = true; openBtn.style.opacity = '.4';
    closeBtn.disabled = false;
    clearInterval(state.turnoInterval_);
    state.turnoInterval_ = setInterval(() => {
      const el = document.getElementById('turno-clock');
      if (el) el.textContent = durStr((Date.now()-since.getTime())/1000);
    }, 1000);
  } else {
    badge.innerHTML = `<span class="badge badge-none">SIN TURNO</span>`;
    info.innerHTML  = '';
    openBtn.disabled  = false; openBtn.style.opacity = '1';
    closeBtn.disabled = true;
    clearInterval(state.turnoInterval_);
  }
}


async function openTurno() {
  showLoad(true);
  try {
    const { data, error } = await db.from('turnos')
      .insert({ cajero: state.currentUser.name, opened_at: new Date().toISOString() })
      .select().single();
    if (error) throw error;
    state.activeTurno_ = data;
    renderTurnoStatus();
    showToast('Turno iniciado.', 't-ok');
  } catch(e) {
    console.error('openTurno error:', e);
    const msg = e?.message?.includes('does not exist')
      ? 'La tabla turnos no existe. Ejecutá el schema SQL primero.'
      : 'Error al iniciar turno: ' + (e?.message || '');
    showToast(msg, 't-err');
  } finally {
    showLoad(false);
  }
}

async function closeTurno() {
  if (!state.activeTurno_) return;
  const nota = document.getElementById('turno-nota')?.value?.trim() || '';
  const { data: ch } = await db.from('charges').select('id').eq('cajero', state.currentUser.name).gte('created_at', state.activeTurno_.opened_at);
  showLoad(true);
  const { error } = await db.from('turnos').update({ closed_at: new Date().toISOString(), nota, cargas_count: ch?.length||0 }).eq('id', state.activeTurno_.id);
  if (error) { showToast('No se pudo cerrar el turno: ' + (error.message || error), 't-err'); console.error(error); showLoad(false); return; }
  state.activeTurno_ = null;
  clearInterval(state.turnoInterval_);
  if (document.getElementById('turno-nota')) document.getElementById('turno-nota').value = '';
  await loadTurnos();
  showToast('Turno cerrado.', 't-ok');
  showLoad(false);
}

/* ══════════════════════════════════════════════════════════
   GLOBAL SEARCH
   ══════════════════════════════════════════════════════════ */
async function globalSearch(q) {
  const results = document.getElementById('gs-results');
  if (!results) return;
  if (q.length < 2) { results.innerHTML = ''; return; }

  const lq = q.toLowerCase();
  const [{ data: players }, { data: charges }, { data: wds }] = await Promise.all([
    db.from('players').select('id,name,stars,phone').or(`name.ilike.%${q}%,phone.ilike.%${q}%`).limit(5),
    db.from('charges').select('player_name,amount,cajero,created_at').ilike('player_name','%'+q+'%').order('created_at',{ascending:false}).limit(4),
    db.from('withdrawals').select('player_name,total_amount,status').ilike('player_name','%'+q+'%').limit(3),
  ]);

  let html = '';

  if (players?.length) {
    html += `<div class="gs-section">JUGADORES</div>`;
    html += players.map(p => `
      <div class="gs-item" onclick="showPage('jugadores');setTimeout(()=>{document.getElementById('j-search').value='${esc(p.name)}';loadJugadores();},300);document.getElementById('gs-inp').value=''">
        <span class="gs-item-icon">${getStarStars(p.stars)}</span>
        <div class="gs-item-main"><div class="gs-item-name">${esc(p.name)}</div>${p.phone?`<div class="gs-item-sub">📱 ${esc(p.phone)}</div>`:''}</div>
      </div>`).join('');
  }
  if (charges?.length) {
    html += `<div class="gs-section">CARGAS RECIENTES</div>`;
    html += charges.map(c => {
      const d = new Date(c.created_at).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'});
      return `<div class="gs-item" onclick="showPage('historial');setTimeout(()=>{document.getElementById('h-search').value='${esc(c.player_name)}';loadHistorial();},300);document.getElementById('gs-inp').value=''">
        <span class="gs-item-icon">💰</span>
        <div class="gs-item-main"><div class="gs-item-name">${esc(c.player_name)}</div><div class="gs-item-sub">$${fmtNum(c.amount)} · ${d} · ${esc(c.cajero)}</div></div>
      </div>`;
    }).join('');
  }
  if (wds?.length) {
    html += `<div class="gs-section">RETIROS</div>`;
    html += wds.map(w => `<div class="gs-item" onclick="showPage('retiros');document.getElementById('gs-inp').value=''">
      <span class="gs-item-icon">📤</span>
      <div class="gs-item-main"><div class="gs-item-name">${esc(w.player_name)}</div><div class="gs-item-sub">$${fmtNum(w.total_amount)} · ${w.status}</div></div>
    </div>`).join('');
  }

  results.innerHTML = html || `<div class="gs-empty">Sin resultados para "${esc(q)}"</div>`;

  const inp = document.getElementById('gs-inp');
  if (inp) {
    const rect = inp.getBoundingClientRect();
    results.style.top   = (rect.bottom + 6) + 'px';
    results.style.left  = rect.left + 'px';
    results.style.width = Math.max(280, rect.width) + 'px';
  }
}

/* ══════════════════════════════════════════════════════════
   MÉTRICAS / CHARTS
   ══════════════════════════════════════════════════════════ */


function destroyChart(id) {
  if (state.chartInstances_[id]) { state.chartInstances_[id].destroy(); delete state.chartInstances_[id]; }
}

function mkChart(id, type, data, options = {}) {
  destroyChart(id);
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const isBar  = type === 'bar' || type === 'line';
  const isDonut= type === 'doughnut' || type === 'pie';
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: {
        display: isDonut,
        position: 'bottom',
        labels: { color: '#9090b0', font: { family: 'Exo 2', size: 9 }, boxWidth: 8, padding: 8 }
      },
      tooltip: {
        backgroundColor: 'rgba(10,12,20,.95)',
        titleColor: '#f0c040', bodyColor: '#c0c0d8',
        borderColor: 'rgba(255,255,255,.1)', borderWidth: 1,
        padding: 8, titleFont: { size: 11 }, bodyFont: { size: 10 }
      }
    },
    scales: isBar ? {
      x: { ticks: { color:'#6a6a8a', font:{size:9}, maxRotation:45 }, grid: { color:'rgba(255,255,255,.04)' } },
      y: { ticks: { color:'#6a6a8a', font:{size:9} }, grid: { color:'rgba(255,255,255,.05)' }, beginAtZero:true }
    } : {}
  };
  state.chartInstances_[id] = new Chart(ctx, { type, data, options: { ...base, ...options } });
}


function accentPal(n) {
  return Array.from({length:n}, (_,i) => PAL[i % PAL.length]);
}

function onMetPeriodChange() {
  const val = document.getElementById('met-period')?.value;
  const custom = document.getElementById('met-custom-dates');
  if (custom) custom.style.display = val === 'custom' ? 'flex' : 'none';
  if (val !== 'custom') loadMetricas();
}

function getMetDateRange() {
  const period = document.getElementById('met-period')?.value || '30';
  if (period === 'custom') {
    const from = document.getElementById('met-from')?.value;
    const to   = document.getElementById('met-to')?.value;
    const now  = new Date();
    return {
      from: from ? new Date(from + 'T00:00:00').toISOString() : new Date(now - 30*86400000).toISOString(),
      to:   to   ? new Date(to   + 'T23:59:59').toISOString() : now.toISOString(),
      days: from && to ? Math.ceil((new Date(to)-new Date(from))/86400000)+1 : 30,
      label: (from||'?') + ' → ' + (to||'?')
    };
  }
  const days = parseInt(period);
  return {
    from: new Date(Date.now() - days*86400000).toISOString(),
    to:   new Date().toISOString(),
    days, label: `Últimos ${days} días`
  };
}

async function populateMetCajeroFilter() {
  const { data: staff } = await db.from('staff').select('name').eq('active',true).order('name');
  const sel = document.getElementById('met-cajero');
  if (!sel || !staff) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos los cajeros</option>' +
    staff.map(s=>`<option value="${esc(s.name)}" ${cur===s.name?'selected':''}>${cap(esc(s.name))}</option>`).join('');
}

async function loadMetricas() {
  const { from, to, days, label } = getMetDateRange();
  const cajeroFilter = document.getElementById('met-cajero')?.value || '';

  showLoad(true);
  try {
    await populateMetCajeroFilter();

    let chargesQ = db.from('charges')
      .select('amount,bonus_amount,bonus_name,bonus_type_id,cajero,status,created_at')
      .gte('created_at', from).lte('created_at', to);
    if (cajeroFilter) chargesQ = chargesQ.eq('cajero', cajeroFilter);

    let wdQ = db.from('withdrawals')
      .select('total_amount,status,created_at')
      .gte('created_at', from).lte('created_at', to)
      .not('status','eq','deleted');

    const [{ data: charges }, { data: wds }, { data: players }] = await Promise.all([
      chargesQ, wdQ,
      db.from('players').select('stars'),
    ]);

    const ok     = (charges||[]).filter(c => c.status === 'ok');
    const errors = (charges||[]).filter(c => c.status === 'error');

    const totalMonto   = ok.reduce((a,c) => a + Number(c.amount), 0);
    const totalBonos   = ok.reduce((a,c) => a + Number(c.bonus_amount||0), 0);
    const totalRetiros = (wds||[]).filter(w=>w.status==='completed').reduce((a,w)=>a+Number(w.total_amount),0);
    const promDiario   = totalMonto / Math.max(1, days);

    document.getElementById('met-kpis').innerHTML = [
      ['💰 MONTO TOTAL',       '$'+fmtNum(totalMonto)],
      ['🎁 BONOS TOTALES',     '$'+fmtNum(totalBonos)],
      ['📤 RETIROS COMPLET.',  '$'+fmtNum(totalRetiros)],
      ['📋 CARGAS OK',         ok.length],
      ['⚠ ERRORES',            errors.length],
      ['📈 PROMEDIO DIARIO',   '$'+fmtNum(Math.round(promDiario))],
      ['👥 JUGADORES',         (players||[]).length],
      ['🎯 TASA DE ERROR',     ok.length+errors.length ? ((errors.length/(ok.length+errors.length))*100).toFixed(1)+'%' : '0%'],
    ].map(([l,v]) => `<div class="met-kpi"><div class="met-kpi-val">${v}</div><div class="met-kpi-lbl">${l}</div></div>`).join('');

    const upd = document.getElementById('met-updated');
    if (upd) upd.textContent = label + ' · ' + new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});

    // ... graficos (igual que antes, se mantienen)
    const dailyMap = {}, dailyMontoMap = {};
    const rangeMs = new Date(to) - new Date(from);
    const rangeDays = Math.min(Math.ceil(rangeMs/86400000)+1, 365);
    const fromDate = new Date(from);
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(fromDate.getTime() + i*86400000);
      const k = d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'});
      dailyMap[k] = 0; dailyMontoMap[k] = 0;
    }
    ok.forEach(c => {
      const k = new Date(c.created_at).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'});
      if (k in dailyMap) { dailyMap[k]++; dailyMontoMap[k] += Number(c.amount); }
    });
    const dayLabels = Object.keys(dailyMap);
    const maxTicks  = rangeDays > 30 ? 15 : rangeDays > 14 ? 10 : rangeDays;
    mkChart('ch-daily', 'line', {
      labels: dayLabels,
      datasets: [
        { label:'Cargas',    data: Object.values(dailyMap),      borderColor:'#f0c040', backgroundColor:'rgba(240,192,64,.1)', tension:.4, fill:true, pointRadius: rangeDays>14?1:3 },
        { label:'Monto ($)', data: Object.values(dailyMontoMap), borderColor:'#40c070', backgroundColor:'rgba(64,192,112,.07)', tension:.4, fill:true, yAxisID:'y2', pointRadius: rangeDays>14?1:3 }
      ]
    },{
      scales:{
        x:  { ticks:{color:'#6a6a8a',font:{size:9},maxTicksLimit:maxTicks}, grid:{color:'rgba(255,255,255,.04)'} },
        y:  { ticks:{color:'#6a6a8a',font:{size:9}}, grid:{color:'rgba(255,255,255,.05)'}, beginAtZero:true },
        y2: { position:'right', ticks:{color:'#6a6a8a',font:{size:9},callback:v=>'$'+fmtNum(v)}, grid:{drawOnChartArea:false}, beginAtZero:true }
      }
    });

    const bonusMap = {};
    ok.forEach(c => { if(!c.bonus_amount) return; const k=c.bonus_name||`$${fmtNum(c.bonus_amount)}`; bonusMap[k]=(bonusMap[k]||0)+Number(c.bonus_amount); });
    if (Object.keys(bonusMap).length) {
      mkChart('ch-bonus-type','doughnut',{ labels:Object.keys(bonusMap), datasets:[{ data:Object.values(bonusMap), backgroundColor:accentPal(Object.keys(bonusMap).length), borderColor:'rgba(0,0,0,.3)', borderWidth:2 }] });
    } else {
      destroyChart('ch-bonus-type');
      const c=document.getElementById('ch-bonus-type'); if(c) c.style.display='none';
      const p=c?.parentElement; if(p&&!p.querySelector('.chart-empty')) p.insertAdjacentHTML('beforeend','<div class="chart-empty">Sin bonos</div>');
    }

    const cajeroCount = {};
    ok.forEach(c=>{ cajeroCount[c.cajero]=(cajeroCount[c.cajero]||0)+1; });
    const cajSort = Object.entries(cajeroCount).sort((a,b)=>b[1]-a[1]);
    mkChart('ch-cajero','bar',{ labels:cajSort.map(([k])=>cap(k)), datasets:[{ data:cajSort.map(([,v])=>v), backgroundColor:accentPal(cajSort.length), borderRadius:5 }] },{ plugins:{legend:{display:false}} });

    const cajMonto = {};
    ok.forEach(c=>{ cajMonto[c.cajero]=(cajMonto[c.cajero]||0)+Number(c.amount); });
    const cajMonSort = Object.entries(cajMonto).sort((a,b)=>b[1]-a[1]);
    mkChart('ch-cajero-monto','bar',{ labels:cajMonSort.map(([k])=>cap(k)), datasets:[{ data:cajMonSort.map(([,v])=>v), backgroundColor:accentPal(cajMonSort.length), borderRadius:5 }] },{
      indexAxis:'y', plugins:{legend:{display:false}},
      scales:{ x:{ticks:{color:'#6a6a8a',font:{size:9},callback:v=>'$'+fmtNum(v)},grid:{color:'rgba(255,255,255,.04)'},beginAtZero:true}, y:{ticks:{color:'#6a6a8a',font:{size:9}},grid:{color:'rgba(255,255,255,.04)'}} }
    });

    const wdSt={pending:0,in_progress:0,completed:0};
    (wds||[]).forEach(w=>{ if(wdSt[w.status]!==undefined) wdSt[w.status]++; });
    mkChart('ch-retiros','pie',{ labels:['Pendientes','En proceso','Completados'], datasets:[{ data:Object.values(wdSt), backgroundColor:['#4090ff','#a060ff','#40c070'], borderColor:'rgba(0,0,0,.3)', borderWidth:2 }] });

    const stCnt={5:0,4:0,3:0,2:0,1:0,0:0};
    (players||[]).forEach(p=>{ if(stCnt[p.stars]!==undefined) stCnt[p.stars]++; });
    mkChart('ch-stars','bar',{ labels:['EX','BU','PR','PC','EP','BAN'], datasets:[{ data:[5,4,3,2,1,0].map(s=>stCnt[s]), backgroundColor:['#40c070','#4090e0','#f0c040','#ff9040','#e04040','#555'], borderRadius:5 }] },{ plugins:{legend:{display:false}} });

    mkChart('ch-status','doughnut',{ labels:['OK','Error'], datasets:[{ data:[ok.length,errors.length], backgroundColor:['#40c070','#e04060'], borderColor:'rgba(0,0,0,.3)', borderWidth:2 }] });

    const horaCount=Array(24).fill(0);
    ok.forEach(c=>{ horaCount[new Date(c.created_at).getHours()]++; });
    const maxH=Math.max(...horaCount,1);
    mkChart('ch-hora','bar',{ labels:Array.from({length:24},(_,i)=>i+'h'), datasets:[{ data:horaCount, backgroundColor:horaCount.map(v=>`rgba(240,192,64,${.1+.8*(v/maxH)})`), borderRadius:3 }] },{ plugins:{legend:{display:false}} });

    renderCajeroDetail(ok, errors, cajSort);

  } finally { showLoad(false); }
}

function renderCajeroDetail(ok, errors, cajSort) {
  const grid = document.getElementById('cajero-detail-grid');
  if (!grid) return;

  const allCajeros = [...new Set([...ok, ...errors].map(c=>c.cajero))];
  if (!allCajeros.length) { grid.innerHTML='<div style="color:var(--muted);padding:10px">Sin datos en el período.</div>'; return; }

  grid.innerHTML = allCajeros.map((cajero, ci) => {
    const cOk  = ok.filter(c=>c.cajero===cajero);
    const cErr = errors.filter(c=>c.cajero===cajero);
    const monto= cOk.reduce((a,c)=>a+Number(c.amount),0);
    const bonos= cOk.reduce((a,c)=>a+Number(c.bonus_amount||0),0);
    const errRate = cOk.length+cErr.length ? ((cErr.length/(cOk.length+cErr.length))*100).toFixed(1) : '0.0';
    const color = PAL[ci % PAL.length];

    const bMap={};
    cOk.forEach(c=>{ if(!c.bonus_amount) return; const k=c.bonus_name||`$${fmtNum(c.bonus_amount)}`; bMap[k]=(bMap[k]||0)+1; });
    const bRows = Object.entries(bMap).map(([k,v])=>`<div style="display:flex;justify-content:space-between;font-size:.68rem;padding:2px 0"><span style="color:var(--muted)">${esc(k)}</span><span style="color:var(--accent)">${v}</span></div>`).join('');

    return `<div style="background:rgba(12,14,24,.75);border:1px solid ${color}33;border-top:2px solid ${color};border-radius:12px;padding:14px">
      <div style="font-family:'Rajdhani',sans-serif;font-size:1.05rem;font-weight:700;color:${color};letter-spacing:1px;margin-bottom:10px">${cap(esc(cajero))}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        <div style="background:rgba(255,255,255,.04);border-radius:8px;padding:8px;text-align:center">
          <div style="font-family:'Rajdhani',sans-serif;font-size:1.4rem;font-weight:700;color:var(--text)">${cOk.length}</div>
          <div style="font-size:.6rem;color:var(--muted);letter-spacing:1px">CARGAS OK</div>
        </div>
        <div style="background:rgba(255,255,255,.04);border-radius:8px;padding:8px;text-align:center">
          <div style="font-family:'Rajdhani',sans-serif;font-size:1.4rem;font-weight:700;color:var(--green)">$${fmtNum(monto)}</div>
          <div style="font-size:.6rem;color:var(--muted);letter-spacing:1px">MONTO TOTAL</div>
        </div>
        <div style="background:rgba(255,255,255,.04);border-radius:8px;padding:8px;text-align:center">
          <div style="font-family:'Rajdhani',sans-serif;font-size:1.4rem;font-weight:700;color:var(--accent)">$${fmtNum(bonos)}</div>
          <div style="font-size:.6rem;color:var(--muted);letter-spacing:1px">BONOS OTORG.</div>
        </div>
        <div style="background:rgba(255,255,255,.04);border-radius:8px;padding:8px;text-align:center">
          <div style="font-family:'Rajdhani',sans-serif;font-size:1.4rem;font-weight:700;color:${cErr.length?'var(--red)':'var(--green)'}">${errRate}%</div>
          <div style="font-size:.6rem;color:var(--muted);letter-spacing:1px">TASA ERROR</div>
        </div>
      </div>
      ${bRows ? `<div style="border-top:1px solid rgba(255,255,255,.06);padding-top:8px"><div style="font-size:.65rem;color:var(--muted);letter-spacing:1px;margin-bottom:4px">BONOS</div>${bRows}</div>` : ''}
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   REPORTE (exportación, etc.)
   ══════════════════════════════════════════════════════════ */

async function loadReporte() {
  const period = document.getElementById('rep-period')?.value || 'hoy';
  const now  = new Date();
  let from;
  if (period === 'hoy') {
    from = new Date(now); from.setHours(0,0,0,0);
  } else if (period === 'semana') {
    from = new Date(now); from.setDate(now.getDate() - now.getDay()); from.setHours(0,0,0,0);
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const fromISO = from.toISOString();

  const [{ data: charges }, { data: wds }] = await Promise.all([
    db.from('charges').select('amount,bonus_amount,total,status,cajero').gte('created_at', fromISO),
    db.from('withdrawals').select('total_amount,status').gte('created_at', fromISO),
  ]);

  const ok    = (charges||[]).filter(c => c.status === 'ok');
  const totalC= ok.reduce((a,c) => a+Number(c.amount),0);
  const totalB= ok.reduce((a,c) => a+Number(c.bonus_amount||0),0);
  const totalR= (wds||[]).filter(w=>w.status==='completed').reduce((a,w)=>a+Number(w.total_amount),0);
  const errors= (charges||[]).filter(c=>c.status==='error').length;

  state.repData_ = { period, totalC, totalB, totalR, errors, cargas: ok.length };

  const el = document.getElementById('rep-content');
  if (!el) return;
  el.innerHTML = `
    <div class="rep-row"><span class="rep-key">Cargas realizadas</span><span class="rep-val">${ok.length}</span></div>
    <div class="rep-row"><span class="rep-key">Total cargado</span><span class="rep-val green">$${fmtNum(totalC)}</span></div>
    <div class="rep-row"><span class="rep-key">Bonos otorgados</span><span class="rep-val accent">$${fmtNum(totalB)}</span></div>
    <div class="rep-row"><span class="rep-key">Total con bonos</span><span class="rep-val">$${fmtNum(totalC+totalB)}</span></div>
    <div class="rep-row"><span class="rep-key">Retiros completados</span><span class="rep-val">$${fmtNum(totalR)}</span></div>
    <div class="rep-row"><span class="rep-key">Registros con error</span><span class="rep-val ${errors?'rep-val red':''}">${errors}</span></div>
  `;
}

function exportReporte() {
  const d = state.repData_;
  const labels = { hoy:'Hoy', semana:'Esta semana', mes:'Este mes' };
  const text = [
    `== REPORTE CASINO — ${labels[d.period]||''} ==`,
    `Fecha: ${new Date().toLocaleString('es-AR')}`,
    ``,
    `Cargas realizadas : ${d.cargas}`,
    `Total cargado     : $${fmtNum(d.totalC)}`,
    `Bonos otorgados   : $${fmtNum(d.totalB)}`,
    `Total con bonos   : $${fmtNum(d.totalC+d.totalB)}`,
    `Retiros completados: $${fmtNum(d.totalR)}`,
    `Registros con error: ${d.errors}`,
  ].join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `reporte-casino-${d.period}-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
}

/* ══════════════════════════════════════════════════════════
   PERMISSIONS SYSTEM
   ══════════════════════════════════════════════════════════ */



async function savePermissions() {
  if (state.currentUser?.role !== 'superadmin') { showToast('Solo el Super Admin puede cambiar permisos.', 't-err'); return; }
  const roles = ['gerente','admin','supervisor','cajero'];
  const newPerms = {};
  roles.forEach(role => {
    newPerms[role] = {};
    ALL_PAGES.forEach(p => {
      const cb = document.getElementById(`perm-${role}-${p.id}`);
      // Force cargas=true for cajero always
      if (role === 'cajero' && p.id === 'cargas') {
        newPerms[role][p.id] = true;
      } else {
        newPerms[role][p.id] = cb ? cb.checked : false;
      }
    });
  });
  showLoad(true);
  try {
    // Persistir en la base para que aplique a TODOS los usuarios/dispositivos
    const { error } = await db.from('settings').upsert({
      key: 'permissions',
      value: newPerms,
      updated_by: state.currentUser.name,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
    if (error) throw error;
    state.permConfig_ = newPerms;
    localStorage.setItem('casino_perms', JSON.stringify(newPerms)); // respaldo offline
    refreshTabVisibility();
    showToast('✔ Permisos guardados y aplicados para todos.', 't-ok');
  } catch (e) {
    showToast('No se pudieron guardar los permisos: ' + (e?.message || e), 't-err');
    console.error(e);
  } finally {
    showLoad(false);
  }
}

function refreshTabVisibility() {
  const isAdmin  = ['superadmin','gerente','admin'].includes(state.currentUser?.role);
  const saAllowed = canAccess('sa-cargas');
  const isSA = state.currentUser?.role === 'superadmin';
  // SA-only topbar elements
  document.querySelectorAll('.role-sa-inline').forEach(el => el.style.display = isSA ? '' : 'none');
  document.querySelectorAll('#tab-nav .tab-btn').forEach(btn => {
    const page = btn.dataset.page;
    if (!page) return;
    if (page === 'admin') {
      btn.style.display = isAdmin ? '' : 'none';
    } else if (page === 'sa-cargas') {
      btn.style.display = saAllowed ? '' : 'none';
    } else {
      btn.style.display = canAccess(page) ? '' : 'none';
    }
  });
  document.querySelectorAll('.role-admin').forEach(el => el.style.display = isAdmin ? '' : 'none');
  document.querySelectorAll('.role-sa').forEach(el => el.style.display = saAllowed ? '' : 'none');
}


function renderPermissions() {
  if (!state.permConfig_) loadPermConfig();
  const tbody = document.getElementById('perm-tbody');
  if (!tbody) return;
  const roles = ['gerente','admin','supervisor','cajero'];
  const roleLabels = { gerente:'Gerente', admin:'Admin', supervisor:'Supervisor', cajero:'Cajero' };

  tbody.innerHTML = ALL_PAGES.map(p => {
    const isSaRow = p.id === 'sa-cargas';
    const rowStyle = isSaRow ? 'style="background:rgba(240,192,64,.04);border-top:1px solid rgba(240,192,64,.15)"' : '';
    const cells = roles.map(role => {
      const checked = state.permConfig_[role]?.[p.id] === true;  // SA defaults to false
      const forced  = (role === 'cajero' && p.id === 'cargas');
      return `<td><input type="checkbox" class="perm-check" id="perm-${role}-${p.id}"
        ${checked ? 'checked' : ''} ${forced ? 'disabled title="Siempre activo"' : ''}
        style="${isSaRow ? 'accent-color:var(--accent)' : ''}"></td>`;
    }).join('');
    const labelHtml = isSaRow
      ? `<span style="color:var(--accent);font-weight:600">${p.label}</span> <span style="font-size:.65rem;color:var(--muted)">(requiere ★SA en el perfil)</span>`
      : p.label;
    return `<tr ${rowStyle}><td>${labelHtml}</td>${cells}</tr>`;
  }).join('');
}


/* == NOTIFICACIONES == */

function notifSeenKey() {
  return 'casino_notif_seen_' + (state.currentUser?.id || state.currentUser?.name || 'sa');
}
function getNotifLastSeen() {
  try { return localStorage.getItem(notifSeenKey()) || '1970-01-01T00:00:00Z'; }
  catch (_) { return '1970-01-01T00:00:00Z'; }
}
function setNotifLastSeen(ts) {
  try { localStorage.setItem(notifSeenKey(), ts); } catch (_) {}
}


/* Sonido de notificación (Web Audio) */
let audioCtx_ = null;
function notifSoundEnabled() {
  try { return localStorage.getItem('casino_notif_sound') !== 'off'; } catch (_) { return true; }
}
function playNotifSound(urgent) {
  if (!notifSoundEnabled()) return;
  try {
    audioCtx_ = audioCtx_ || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx_;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const beep = (freq, start, dur) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0, now + start);
      g.gain.linearRampToValueAtTime(0.16, now + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      o.start(now + start); o.stop(now + start + dur);
    };
    if (urgent) { beep(880, 0, 0.15); beep(660, 0.17, 0.22); }
    else { beep(740, 0, 0.16); }
  } catch (_) {}
}

/* Notificación del navegador (cuando la pestaña está en segundo plano) */
function ensureNotifPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  } catch (_) {}
}
function showBrowserNotif(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!document.hidden) return; // solo si no está mirando la pestaña
    const n = new Notification(title, { body, tag: 'akuma-notif', icon: '/favicon.ico' });
    n.onclick = () => { window.focus(); try { toggleNotifPanel(); } catch (_) {} n.close(); };
  } catch (_) {}
}

/* Navegar al registro de una notificación */
function notifGo(kind, id, encName) {
  const name = encName ? decodeURIComponent(encName) : '';
  // cerrar panel
  const panel = document.getElementById('notif-panel');
  if (panel) { panel.classList.remove('show'); state.notifPanelOpen_ = false; }
  if (kind === 'retiro') {
    showPage('retiros');
  } else if (kind === 'jugador') {
    if (id) openPlayerProfile(id);
    else { showPage('jugadores'); }
  } else { // carga / error → historial filtrado por jugador
    showPage('historial');
    setTimeout(() => {
      const inp = document.getElementById('h-search');
      if (inp) { inp.value = name; loadHistorial(); }
    }, 300);
  }
}

let notifSeenIds_ = null; // null = todavía no se inicializó (primer poll no alerta)

async function loadNotifications() {
  if (state.currentUser?.role !== 'superadmin') return;
  try {
    const since = new Date(Date.now() - 24*3600000).toISOString();
    const [chargesRes, retirosRes, errorsRes, playersRes] = await Promise.allSettled([
      db.from('charges').select('id,player_name,amount,cajero,created_at').eq('status','ok').gte('created_at',since).order('created_at',{ascending:false}).limit(8),
      db.from('withdrawals').select('id,player_name,total_amount,cajero,created_at').eq('status','pending').order('created_at',{ascending:false}).limit(8),
      db.from('charges').select('id,player_name,amount,cajero,created_at').eq('status','error').gte('created_at',since).order('created_at',{ascending:false}).limit(8),
      db.from('players').select('id,name,created_by,created_at').gte('created_at',since).order('created_at',{ascending:false}).limit(8),
    ]);
    const charges    = chargesRes.status==='fulfilled'  ? chargesRes.value.data||[]  : [];
    const retiros    = retirosRes.status==='fulfilled'  ? retirosRes.value.data||[]  : [];
    const errors     = errorsRes.status==='fulfilled'   ? errorsRes.value.data||[]   : [];
    const newPlayers = playersRes.status==='fulfilled'  ? playersRes.value.data||[]  : [];

    // ── Detección de novedades (para sonido / parpadeo / toast / navegador) ──
    const tagId = (k, r) => k + ':' + r.id;
    const currentIds = new Set([
      ...retiros.map(r => tagId('retiro', r)),
      ...errors.map(r => tagId('error', r)),
      ...charges.map(r => tagId('carga', r)),
      ...newPlayers.map(r => tagId('jugador', r)),
    ]);

    if (notifSeenIds_ === null) {
      // Primer poll: registrar lo existente sin alertar
      notifSeenIds_ = currentIds;
    } else {
      const fresh = { retiro: [], error: [], carga: [], jugador: [] };
      let anyNew = false, anyCritical = false;
      const pushFresh = (k, arr) => arr.forEach(r => {
        if (!notifSeenIds_.has(tagId(k, r))) { fresh[k].push(r); anyNew = true; if (k === 'retiro' || k === 'error') anyCritical = true; }
      });
      pushFresh('retiro', retiros); pushFresh('error', errors);
      pushFresh('carga', charges);  pushFresh('jugador', newPlayers);

      if (anyNew) {
        playNotifSound(anyCritical);
        pulseNotifBell();
        // Toast proactivo solo para lo crítico y con el panel cerrado
        const panelOpen = document.getElementById('notif-panel')?.classList.contains('show');
        if (!panelOpen) {
          if (fresh.retiro[0]) showToast('💸 Nuevo retiro pendiente: ' + cap(fresh.retiro[0].player_name) + ' $' + fmtNum(fresh.retiro[0].total_amount), 't-err');
          else if (fresh.error[0]) showToast('🔴 Carga marcada con error: ' + cap(fresh.error[0].player_name), 't-err');
        }
        // Notificación del navegador (si la pestaña está en segundo plano)
        const total = fresh.retiro.length + fresh.error.length + fresh.carga.length + fresh.jugador.length;
        if (total) {
          const parts = [];
          if (fresh.retiro.length) parts.push(fresh.retiro.length + ' retiro(s)');
          if (fresh.error.length)  parts.push(fresh.error.length + ' error(es)');
          if (fresh.carga.length)  parts.push(fresh.carga.length + ' carga(s)');
          if (fresh.jugador.length) parts.push(fresh.jugador.length + ' jugador(es)');
          showBrowserNotif('akuma — ' + total + ' novedad(es)', parts.join(' · '));
        }
      }
      notifSeenIds_ = currentIds;
    }

    // ── Badge (no vistos según last-seen) ──
    const lastSeenMs = new Date(getNotifLastSeen()).getTime();
    const isUnseen = r => new Date(r.created_at).getTime() > lastSeenMs;
    const alertCount = retiros.filter(isUnseen).length
                     + errors.filter(isUnseen).length
                     + charges.filter(isUnseen).length
                     + newPlayers.filter(isUnseen).length;
    const badge = document.getElementById('notif-badge');
    if (badge) { badge.textContent = alertCount||''; badge.style.display = alertCount ? '' : 'none'; }

    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    // Solo reconstruir el panel si está abierto (evita parpadeo cada 5s)
    if (!panel.classList.contains('show')) return;

    const item = (cls, icon, kind, id, name, line, meta) =>
      '<div class="notif-item ' + cls + '" onclick="notifGo(\'' + kind + '\',\'' + (id||'') + '\',\'' + encodeURIComponent(name||'') + '\')">' +
        '<span class="notif-icon">' + icon + '</span>' +
        '<div class="notif-body"><strong>' + esc(name) + '</strong>' + (line||'') +
          '<div class="notif-meta">' + meta + '</div></div>' +
        '<span class="notif-go">›</span>' +
      '</div>';

    let html = '<div class="notif-header"><span>🔔 NOTIFICACIONES</span><div style="display:flex;gap:6px;align-items:center">' +
      '<button class="notif-act" title="Activar/silenciar sonido" onclick="toggleNotifSound(event)">' + (notifSoundEnabled() ? '🔊' : '🔇') + '</button>' +
      '<button class="notif-act" title="Marcar todo como leído" onclick="markAllNotifRead(event)">✓</button>' +
      '<button class="notif-act" title="Cerrar" onclick="toggleNotifPanel()">✕</button>' +
      '</div></div>';

    if (retiros.length) {
      html += '<div class="notif-section"><div class="notif-section-title urgent">⚠ RETIROS PENDIENTES</div>';
      retiros.forEach(r => { const h = new Date(r.created_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
        html += item('notif-warn', '💸', 'retiro', r.id, r.player_name, ' $' + fmtNum(r.total_amount), esc(r.cajero) + ' · ' + h); });
      html += '</div>';
    }
    if (errors.length) {
      html += '<div class="notif-section"><div class="notif-section-title urgent">🔴 ERRORES HOY</div>';
      errors.forEach(r => { const h = new Date(r.created_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
        html += item('notif-err', '⚡', 'error', r.id, r.player_name, ' $' + fmtNum(r.amount), esc(r.cajero) + ' · ' + h); });
      html += '</div>';
    }
    if (charges.length) {
      html += '<div class="notif-section"><div class="notif-section-title">✅ ÚLTIMAS CARGAS</div>';
      charges.forEach(r => { const h = new Date(r.created_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
        html += item('notif-ok', '💰', 'carga', r.id, r.player_name, ' $' + fmtNum(r.amount), esc(r.cajero) + ' · ' + h); });
      html += '</div>';
    }
    if (newPlayers.length) {
      html += '<div class="notif-section"><div class="notif-section-title">👤 JUGADORES NUEVOS HOY</div>';
      newPlayers.forEach(r => { const h = new Date(r.created_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
        html += item('notif-info', '🆕', 'jugador', r.id, r.name, '', 'por ' + esc(r.created_by||'—') + ' · ' + h); });
      html += '</div>';
    }
    if (!retiros.length && !errors.length && !charges.length && !newPlayers.length) {
      html += '<div class="empty-state"><div class="es-icon">🔔</div><div class="es-title">Sin actividad reciente</div><div class="es-sub">Las novedades de las últimas 24h aparecerán acá.</div></div>';
    }
    panel.innerHTML = html;
  } catch(e) { console.error('loadNotifications:', e); }
}

/* Parpadeo del 🔔 al llegar algo nuevo */
function pulseNotifBell() {
  const bell = document.getElementById('notif-bell');
  if (!bell) return;
  bell.classList.remove('bell-pulse');
  void bell.offsetWidth; // reiniciar animación
  bell.classList.add('bell-pulse');
  setTimeout(() => bell.classList.remove('bell-pulse'), 2000);
}

function toggleNotifSound(e) {
  if (e) e.stopPropagation();
  const on = notifSoundEnabled();
  try { localStorage.setItem('casino_notif_sound', on ? 'off' : 'on'); } catch (_) {}
  if (on === false) playNotifSound(false); // al activar, suena de muestra
  loadNotifications();
}

function markAllNotifRead(e) {
  if (e) e.stopPropagation();
  setNotifLastSeen(new Date().toISOString());
  const badge = document.getElementById('notif-badge');
  if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
  showToast('Notificaciones marcadas como leídas.', 't-ok');
}

function toggleNotifPanel() {
  state.notifPanelOpen_ = !state.notifPanelOpen_;
  const panel = document.getElementById('notif-panel');
  if (panel) panel.classList.toggle('show', state.notifPanelOpen_);
  if (state.notifPanelOpen_) {
    if (audioCtx_ && audioCtx_.state === 'suspended') audioCtx_.resume();
    ensureNotifPermission();
    setNotifLastSeen(new Date().toISOString()); // marcar todo como visto
    loadNotifications();                          // recalcula el badge → 0
  }
}

document.addEventListener('click', e => {
  if (!e.target.closest('#notif-wrap') && !e.target.closest('#notif-panel')) {
    const panel = document.getElementById('notif-panel');
    if (panel?.classList.contains('show')) { panel.classList.remove('show'); state.notifPanelOpen_ = false; }
  }
});



/* ============================================================
   EXPOSICIÓN A window
   Funciones invocadas desde atributos onclick/oninput del HTML
   (estático y generado dinámicamente). Con Vite los módulos son
   aislados, por eso se exponen explícitamente al scope global.
   ============================================================ */
Object.assign(window, {
  acSearch, acSearchR, addBankAccount, addStaff,
  showBankEdit, saveBankEdit,
  apBgUpload, applyInicioFilters, applyTheme, bannerClick, toggleBgFields,
  setInicioRange,
  addBannerSlide, removeBannerSlide, addBannerButton, removeBannerButton,
  setBannerField, setBannerBtnField, bannerFileUpload, renderBannerBuilder,
  clearStarImg, closeTurno, copyAllRetiroData, copyBankAccount,
  copyTotalAndRegister, copyUser, createBonus, createPlayer,
  createWithdrawal, delStaff, deleteBankAccount, deleteCharge,
  deleteWithdrawal, doLogin, doLogout, exportReporte,
  globalSearch, goPage, loadHistorial, loadJugadores,
  loadMetricas, loadReporte, loadRetiros, loadTurnos,
  markError, markPartDone, onMetPeriodChange, openPlayerProfile,
  openPlayerProfileByName, openTurno, pickPlayer, pickPlayerR,
  renderBonusButtons, resetBankCounters, resetCounters, saveAppearance, bonusImgUpload,
  showBonusTypeEdit, saveBonusTypeEdit, bonusEditToggleType, bonusEditImgUpload,
  savePermissions, savePlayerStars, saveStarImg, selBonus,
  setActiveShift, setBG, setBonusStatus, setPlayerStars,
  setTopPeriod, showBonusEdit, showPage, toggleBankActive,
  toggleBannerFields, toggleBonusType, toggleNotifPanel, toggleSaAccess,
  toggleThemeDropdown, updateTotal, uploadStaffPhoto, uploadStarImg,
  toggleResetHistory, loadResetHistory,
  showUserPerms, saveUserPerms, resetUserPerms, kickUser,
  notifGo, toggleNotifSound, markAllNotifRead, apThemeChange,
  copyText, closeModal,
});