# 🎰 Casino Dashboard — Vite

Sistema de gestión interno migrado de un monolito HTML a una arquitectura modular con **Vite + Vanilla JS + Supabase**.

## 🚀 Inicio rápido

```bash
npm install          # Instalar dependencias
npm run dev          # Servidor de desarrollo (http://localhost:5173)
npm run build        # Build de producción → dist/
npm run preview      # Previsualizar el build
```

## 🔑 Variables de entorno

Copiá `.env.example` a `.env` y completá:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

> ⚠️ La `anon key` es pública por diseño (viaja al navegador). La seguridad real
> está en las **Row Level Security policies** de Supabase, no en ocultar la key.

## 📁 Estructura

```
src/
  app.js                 # Lógica central de la app (cohesionada)
  main.js                # Punto de entrada (importa estilos + app)
  services/
    supabase.js          # Cliente Supabase (lee de .env)
    auth.js              # Login / logout
    users.js             # Gestión de staff
    players.js           # Jugadores
    withdrawals.js       # Retiros
    metrics.js           # Métricas y reportes
  utils/
    state.js             # Store central de estado compartido
    constants.js         # THEMES, ROLES, PERMS, etc.
    formatters.js        # esc, fmtNum, cap, durStr
    dom.js               # toast, modal, loader, clipboard
    permissions.js       # canAccess, roles, jerarquía
    validators.js        # Validación de formularios
    storage.js           # Wrapper de localStorage
  styles/
    main.css             # Todos los estilos
index.html               # HTML principal
vite.config.js           # Config de Vite (code-splitting)
vercel.json              # Headers de seguridad + build config
```

## 🌐 Despliegue en Vercel

1. Subí el repo a GitHub.
2. Importá el proyecto en Vercel.
3. Configurá las variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. Vercel detecta Vite automáticamente:
   - Build: `npm run build`
   - Output: `dist`

## 🛡️ Seguridad

Headers configurados en `vercel.json`: CSP, X-Frame-Options, X-Content-Type-Options,
Referrer-Policy, Permissions-Policy.

Frontend: escape de HTML con `esc()`, validación de formularios con `validators.js`.

## 📦 Migración incremental (próximos pasos)

`app.js` mantiene la lógica cohesionada para garantizar que todo funcione.
Para seguir modularizando sin romper:

1. Mové una función a su servicio (`services/players.js`, etc.).
2. Importala en `app.js`.
3. Probá esa pantalla.
4. Repetí con la siguiente.

Los servicios ya tienen stubs (`fetchPlayers`, `fetchStaff`, etc.) listos para crecer.
