# Plan de Migración — Monolito → Vite

## ✅ Fase 1 — Estructura base (COMPLETADA)
- [x] Proyecto Vite con `package.json`, `vite.config.js`
- [x] Credenciales movidas a `.env`
- [x] `.gitignore` (node_modules, .env, dist)
- [x] `vercel.json` con headers de seguridad
- [x] CSS extraído a `src/styles/main.css`
- [x] HTML extraído a `index.html`
- [x] JS monolítico → `src/app.js` (con imports de módulos)

## ✅ Fase 2 — Extracción de utilidades (COMPLETADA)
- [x] `services/supabase.js` — cliente
- [x] `utils/state.js` — estado central (reemplaza globales)
- [x] `utils/constants.js` — THEMES, ROLES, PERMS
- [x] `utils/formatters.js` — esc, fmtNum, cap
- [x] `utils/dom.js` — toast, modal, loader, clipboard
- [x] `utils/permissions.js` — canAccess, jerarquía de roles
- [x] `utils/validators.js` — validación de formularios
- [x] `utils/storage.js` — localStorage seguro

## 🔄 Fase 3 — Servicios (EN PROGRESO, stubs listos)
Los servicios tienen funciones base. Migrar incrementalmente:
- [ ] `services/auth.js` ← doLogin, doLogout
- [ ] `services/users.js` ← addStaff, delStaff, loadStaff
- [ ] `services/players.js` ← createPlayer, loadJugadores
- [ ] `services/withdrawals.js` ← createWithdrawal, loadRetiros
- [ ] `services/metrics.js` ← loadMetricas, loadReporte

## 📋 Cómo migrar una función sin romper
1. Copiá la función a su servicio.
2. Quitá las referencias a estado global (usá parámetros o el store).
3. Exportala e importala en `app.js`.
4. Eliminá la versión vieja de `app.js`.
5. Probá esa pantalla en `npm run dev`.
6. `npm run build` para confirmar que compila.

## ⚠️ Decisión clave: funciones en window
Los `onclick="..."` del HTML llaman funciones globales. Con Vite los módulos
son aislados, por eso `app.js` expone las funciones necesarias a `window`
(ver el bloque "EXPOSICIÓN A window" al final de app.js).

Si migrás un `onclick` a `addEventListener`, podés quitar esa función del
bloque de exposición.
