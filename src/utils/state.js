// Store central de estado compartido entre módulos.
// Reemplaza las variables globales del monolito original.
export const state = {
  currentUser: null,
  selBonus_: null,
  activeBonuses: [],
  starImagesMap: {},
  players_: [],
  currentBankAccount_: null,
  bankAccounts_: [],
  activeShift_: parseInt(localStorage.getItem('casino_active_shift') || '1'),
  permConfig_: null,
  notifPanelOpen_: false,
  hCurrentPage: 1,
  hTotalCount: 0,
  hAllData: [],
  topPeriodDays_: 30,
  pendingStars: {},
  turnoInterval_: null,
  activeTurno_: null,
  chartInstances_: {},
  repData_: {},
  toastTimer: null,
};
