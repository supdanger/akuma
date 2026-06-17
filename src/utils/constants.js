// Constantes de la aplicación

export const THEMES = {
  '':        { name: 'Dorado',    color: '#f0c040' },
  emerald:   { name: 'Esmeralda', color: '#30d980' },
  crimson:   { name: 'Carmesí',   color: '#e04060' },
  sapphire:  { name: 'Zafiro',    color: '#4090ff' },
  violet:    { name: 'Violeta',   color: '#a060ff' },
  rose:      { name: 'Rosa',      color: '#ff70b0' },
  arctic:    { name: 'Ártico',    color: '#80e0ff' },
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
