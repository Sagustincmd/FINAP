import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = window.ENV_SUPABASE_URL;
const SUPABASE_KEY  = window.ENV_SUPABASE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    window.location.href = '/index.html';
    return null;
  }
  return user;
}

export async function logHistorial(accion, tabla, descripcion, valorAnterior = null, valorNuevo = null) {
  const user = await getUser();
  if (!user) return;
  await supabase.from('historial').insert({
    user_id: user.id,
    accion,
    tabla,
    descripcion,
    valor_anterior: valorAnterior ? String(valorAnterior) : null,
    valor_nuevo:    valorNuevo    ? String(valorNuevo)    : null,
  });
}

export function formatMoney(n) {
  if (n == null || isNaN(n)) return '$0';
  return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function currentMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
