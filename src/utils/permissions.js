import { db } from '../services/supabase.js';
import { state } from './state.js';
import { DEFAULT_PERMS, ROLE_HIERARCHY } from './constants.js';

export async function loadPermConfig() {
  if (state.permConfig_) return state.permConfig_;
  try {
    const { data } = await db.from('settings').select('value').eq('key', 'permissions').single();
    if (data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      state.permConfig_ = {};
      ['gerente', 'admin', 'supervisor', 'cajero'].forEach(role => {
        state.permConfig_[role] = { ...DEFAULT_PERMS[role], ...(parsed[role] || {}) };
      });
    } else {
      state.permConfig_ = JSON.parse(JSON.stringify(DEFAULT_PERMS));
    }
  } catch (e) {
    try {
      const saved = localStorage.getItem('casino_perms');
      state.permConfig_ = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_PERMS));
    } catch (_) {
      state.permConfig_ = JSON.parse(JSON.stringify(DEFAULT_PERMS));
    }
  }
  return state.permConfig_;
}

export function canAccess(page) {
  const u = state.currentUser;
  if (!u) return false;
  if (u.role === 'superadmin') return true;
  const cfg = state.permConfig_ || DEFAULT_PERMS;
  const rolePerm = cfg[u.role];
  if (rolePerm && page in rolePerm) return rolePerm[page] === true;
  return DEFAULT_PERMS[u.role]?.[page] === true;
}

export function myRoleLevel() {
  return ROLE_HIERARCHY[state.currentUser?.role] ?? 99;
}

export function canManageRole(targetRole) {
  return ROLE_HIERARCHY[targetRole] > myRoleLevel();
}

export function roleCls(r) {
  return { superadmin: 'role-sa', gerente: 'role-g', admin: 'role-a', supervisor: 'role-s', cajero: 'role-c' }[r] || 'role-c';
}
