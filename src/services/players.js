// ============================================================
//  players.js — Servicio de jugadores
//  Migrar acá: createPlayer, loadJugadores, loadTopPlayers.
// ============================================================
import { db } from './supabase.js';

export async function fetchPlayers(search = '') {
  let q = db.from('players').select('*').order('created_at', { ascending: false });
  if (search) q = q.ilike('name', `%${search}%`);
  const { data, error } = await q;
  return { data: data || [], error };
}
