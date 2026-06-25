// Constantes de la aplicación

export const THEMES = {
  '':          { name: 'Dorado', color: '#f0c040', icon: '♠' },
  emerald:     { name: 'Esmeralda', color: '#30d980', icon: '♣' },
  crimson:     { name: 'Carmesí', color: '#e04060', icon: '♥' },
  sapphire:    { name: 'Zafiro', color: '#4090ff', icon: '◆' },
  violet:      { name: 'Violeta', color: '#a060ff', icon: '✦' },
  rose:        { name: 'Rosa', color: '#ff70b0', icon: '✿' },
  arctic:      { name: 'Ártico', color: '#80e0ff', icon: '❄' },
  neon:        { name: 'Neón', color: '#39ff14', icon: '⚡' },
  synthwave:   { name: 'Synthwave', color: '#ff2e97', icon: '🌆' },
  cyber:       { name: 'Cyberpunk', color: '#00fff0', icon: '🤖' },
  sunset:      { name: 'Atardecer', color: '#ff7e3d', icon: '🌅' },
  dracula:     { name: 'Drácula', color: '#bd93f9', icon: '🦇' },
  matrix:      { name: 'Matrix', color: '#00ff66', icon: '💚' },
  amber:       { name: 'Ámbar', color: '#ffb300', icon: '🔶' },
  ruby:        { name: 'Rubí', color: '#ff3b5c', icon: '💎' },
  ocean:       { name: 'Océano', color: '#2bd4d4', icon: '🌊' },
  lime:        { name: 'Lima', color: '#c6ff00', icon: '🍋' },
  magenta:     { name: 'Magenta', color: '#ff35d0', icon: '🎀' },
  indigo:      { name: 'Índigo', color: '#6c63ff', icon: '🔷' },
  tangerine:   { name: 'Mandarina', color: '#ff9f1c', icon: '🍊' },
  mint:        { name: 'Menta', color: '#4effb0', icon: '🌿' },
  blood:       { name: 'Sangre', color: '#e01030', icon: '🩸' },
  royal:       { name: 'Real', color: '#5b6cff', icon: '👑' },
  teal:        { name: 'Verdeazul', color: '#14b8a6', icon: '🦚' },
  coral:       { name: 'Coral', color: '#ff6b6b', icon: '🪸' },
  lavender:    { name: 'Lavanda', color: '#b794f6', icon: '💜' },
  flamingo:    { name: 'Flamenco', color: '#ff5fa2', icon: '🦩' },
  aqua:        { name: 'Aqua', color: '#22d3ee', icon: '💧' },
  fire:        { name: 'Fuego', color: '#ff5722', icon: '🔥' },
  galaxy:      { name: 'Galaxia', color: '#9d4edd', icon: '🌌' },
  corporate:   { name: 'Corporativo', color: '#5b84b1', icon: '💼' },
  steel:       { name: 'Acero', color: '#8895a7', icon: '⚙️' },
  obsidian:    { name: 'Obsidiana', color: '#7a7f9c', icon: '⬛' },
  bronze:      { name: 'Bronce', color: '#cd7f4d', icon: '🥉' },
  platinum:    { name: 'Platino', color: '#c4ccd6', icon: '⚪' },
  forest:      { name: 'Bosque', color: '#3a9e6e', icon: '🌲' },
  wine:        { name: 'Vino', color: '#a03050', icon: '🍷' },
  copper:      { name: 'Cobre', color: '#d97f5a', icon: '🟤' },
  ice:         { name: 'Hielo', color: '#7ec8e3', icon: '🧊' },
  gold2:       { name: 'Oro Viejo', color: '#c9a44c', icon: '🏆' },
  midnight:    { name: 'Medianoche', color: '#4a6fa5', icon: '🌃' },
  sage:        { name: 'Salvia', color: '#7ba88a', icon: '🌿' },
  slate:       { name: 'Pizarra', color: '#6b7d8c', icon: '🪨' },
};

// Plantillas visuales: cambian forma/tipografía/efectos (independiente del color)
export const TEMPLATES = {
  glass: { name: 'Cyber Glass', icon: '💎' },
  neon:  { name: 'Neon Arcade', icon: '⚡' },
  flat:  { name: 'Minimal Flat', icon: '▫️' },
  neu:   { name: 'Neumorfismo', icon: '🌑' },
  vegas: { name: 'Casino Clásico', icon: '🎰' },
  dense: { name: 'Compacto Denso', icon: '🗜️' },
  terminal: { name: 'Terminal', icon: '🖥️' },
  pastel:   { name: 'Pastel Suave', icon: '🍦' },
  brutal:   { name: 'Brutalist', icon: '⬛' },
  corppro:  { name: 'Corporativo Pro', icon: '🏢' },
};

export const ROLE_HIERARCHY = {
  superadmin: 0, gerente: 1, admin: 2, supervisor: 3, cajero: 4,
};

export const ROLE_LABELS = {
  superadmin: 'SUPER ADMIN', gerente: 'GERENTE', admin: 'ADMIN',
  supervisor: 'SUPERVISOR', cajero: 'CAJERO',
};

export const SHIFT_NAMES = {
  1: '🌙 Turno Noche', 2: '🌅 Turno Mañana', 3: '☀️ Turno Tarde',
};

export const ALL_PAGES = [
  { id: 'inicio',    label: 'Inicio / Stats'     },
  { id: 'cargas',    label: 'Cargas'             },
  { id: 'historial', label: 'Historial'          },
  { id: 'retiros',   label: 'Retiros'            },
  { id: 'jugadores', label: 'Jugadores'          },
  { id: 'bonos',     label: 'Bonos'              },
  { id: 'turnos',    label: 'Turnos'             },
  { id: 'cuentas',   label: 'Cuentas Bancarias'  },
  { id: 'metricas',  label: 'Métricas / Gráficos' },
];

export const DEFAULT_PERMS = {
  gerente:    { inicio: true, cargas: true, historial: true, retiros: true, jugadores: true, bonos: true, turnos: true, cuentas: true, metricas: true },
  admin:      { inicio: true, cargas: true, historial: true, retiros: true, jugadores: true, bonos: true, turnos: true, cuentas: true, metricas: true },
  supervisor: { inicio: true, cargas: true, historial: true, retiros: true, jugadores: true, bonos: false, turnos: true, cuentas: true, metricas: false },
  cajero:     { inicio: true, cargas: true, historial: true, retiros: true, jugadores: false, bonos: false, turnos: true, cuentas: false, metricas: false },
};

export const PAL = ['#f0c040', '#40c070', '#4090ff', '#a060ff', '#e04060', '#ff9040', '#80e0ff', '#ff70b0', '#30d980', '#e0a040'];