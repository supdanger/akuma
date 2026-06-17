// ============================================================
//  withdrawals.js — Servicio de retiros
//  Migrar acá: createWithdrawal, loadRetiros, markPartDone.
// ============================================================
import { db } from './supabase.js';

export async function fetchWithdrawals(status = null) {
  let q = db.from('withdrawals').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  return { data: data || [], error };
}
