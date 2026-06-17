// Helpers de UI: toast, loader, modal, clipboard

let toastTimer;

export function showToast(msg, type = '', duration = 2800) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  clearTimeout(toastTimer);

  const t = document.createElement('div');
  t.id = 'toast';
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

export function showLoad(v) {
  const el = document.getElementById('g-load');
  if (el) el.style.display = v ? 'flex' : 'none';
}

export function showModal({ title, body, actions, wide }) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  if (!overlay || !box) return;
  box.className = 'modal-box' + (wide ? ' wide' : '');
  box.innerHTML = `
    <div class="modal-header">${title || ''}</div>
    <div class="modal-body">${body || ''}</div>
    <div class="modal-actions">${actions || ''}</div>`;
  overlay.classList.add('show');
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('show');
}

export function showConfirm(msg, onOk) {
  showModal({
    title: 'Confirmar',
    body: `<p style="font-size:.9rem;line-height:1.5">${msg}</p>`,
    actions: `
      <button class="btn-ghost" data-modal-cancel>Cancelar</button>
      <button class="btn-danger" data-modal-ok>Confirmar</button>`,
  });
  // Los listeners se conectan por delegación en app.js
  window.__modalOkCallback = onOk;
}

// Clipboard con fallback para contextos no seguros (HTTP)
export function copyTextFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) {}
  document.body.removeChild(ta);
  return ok;
}

export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {}
  }
  return copyTextFallback(text);
}

export function copyText(t) {
  copyToClipboard(String(t)).then(ok =>
    showToast(ok ? '✔ Copiado.' : '⚠ No se pudo copiar.', ok ? 't-ok' : 't-err')
  );
}
