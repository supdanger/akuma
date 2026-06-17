// ============================================================
//  auth.js — Servicio de autenticación
//  Wrapper sobre Supabase para login/logout.
//  Nota: la lógica de UI (welcome overlay, etc.) vive en app.js.
//  Migrar acá incrementalmente las queries de auth.
// ============================================================
import { db } from './supabase.js';

export async function login(name, password) {
  const { data, error } = await db
    .from('staff')
    .select('*')
    .ilike('name', name)
    .eq('password', password)
    .eq('active', true)
    .single();
  if (error || !data) return { user: null, error: 'Usuario o contraseña incorrectos.' };
  // Registrar último login (no bloqueante)
  db.from('staff').update({ last_login: new Date().toISOString() }).eq('id', data.id).then(() => {}).catch(() => {});
  return { user: data, error: null };
}
