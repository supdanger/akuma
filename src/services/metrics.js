// ============================================================
//  metrics.js — Servicio de métricas y reportes
//  Migrar acá: loadMetricas, loadReporte queries.
// ============================================================
import { db } from './supabase.js';

export async function fetchCharges(since, status = 'ok') {
  const { data, error } = await db
    .from('charges')
    .select('*')
    .eq('status', status)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}
