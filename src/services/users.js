// ============================================================
//  users.js — Servicio de gestión de staff/usuarios
//  Migrar acá: addStaff, delStaff, loadStaff, uploadStaffPhoto.
// ============================================================
import { db } from './supabase.js';

export async function fetchStaff() {
  const { data, error } = await db.from('staff').select('*').order('created_at', { ascending: false });
  return { data: data || [], error };
}
