import { supabase, requireAuth, logHistorial, formatMoney, formatDate, today, currentMonth } from './supabase-client.js';

// ── INIT ──────────────────────────────────────────────────────
let currentUser = null;

(async () => {
  currentUser = await requireAuth();
  if (!currentUser) return;
  document.getElementById('user-email').textContent = currentUser.email;

  setDefaultDates();
  await loadDashboard();
})();

function setDefaultDates() {
  const t = today();
  const h = new Date().toTimeString().slice(0, 5);
  ['ing-fecha', 'g-fecha'].forEach(id => { const el = document.getElementById(id); if (el) el.value = t; });
  ['ing-hora',  'g-hora' ].forEach(id => { const el = document.getElementById(id); if (el) el.value = h; });
}

// ── NAVEGACIÓN ───────────────────────────────────────────────
const pageLoaders = {
  dashboard:    loadDashboard,
  ingresos:     loadIngresos,
  gastos:       loadGastos,
  fijos:        loadFijos,
  deudas:       loadDeudas,
  equilibrio:   loadEquilibrio,
  ahorro:       loadAhorro,
  alertas:      loadAlertas,
  comparativas: loadComparativas,
  historial:    loadHistorial,
};

window.showPage = function(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(b => b.classList.remove('active'));

  const pages = ['dashboard','ingresos','gastos','fijos','deudas','equilibrio','ahorro','alertas','comparativas','historial'];
  const idx = pages.indexOf(id);
  if (idx >= 0) document.querySelectorAll('.nav-item')[idx]?.classList.add('active');

  const mobileMap = { dashboard: 0, gastos: 1, ingresos: 2, deudas: 3, alertas: 4 };
  if (mobileMap[id] !== undefined) {
    document.querySelectorAll('.mobile-nav-item')[mobileMap[id]]?.classList.add('active');
  }

  if (pageLoaders[id]) pageLoaders[id]();
};

window.logout = async function() {
  await supabase.auth.signOut();
  window.location.href = '/index.html';
};

// ── TOAST ────────────────────────────────────────────────────
function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.background = type === 'error' ? '#A32D2D' : '#1a1a18';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 2200);
}

// ── HELPERS ──────────────────────────────────────────────────
function uid() { return currentUser.id; }

function monthRange() {
  const { year, month } = currentMonth();
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
  return { from, to };
}

function daysIntoMonth() {
  return new Date().getDate();
}

function tipoPill(tipo) {
  return `<span class="pill pill-${tipo}">${tipo}</span>`;
}

function estadoBadge(estado) {
  const map = { pendiente: 'yellow', pagado: 'green', vencido: 'red' };
  return `<span class="badge badge-${map[estado] || 'blue'}">${estado}</span>`;
}

function diasHastaVenc(fechaStr) {
  if (!fechaStr) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const venc = new Date(fechaStr + 'T00:00:00');
  return Math.round((venc - hoy) / 86400000);
}

function badgeVenc(dias) {
  if (dias === null) return '';
  if (dias < 0)  return `<span class="badge badge-red">Vencida hace ${Math.abs(dias)}d</span>`;
  if (dias === 0) return `<span class="badge badge-red">Vence hoy</span>`;
  if (dias <= 3)  return `<span class="badge badge-red">Vence en ${dias}d</span>`;
  if (dias <= 7)  return `<span class="badge badge-yellow">Vence en ${dias}d</span>`;
  return `<span class="badge badge-green">Vence en ${dias}d</span>`;
}

// ── DASHBOARD ────────────────────────────────────────────────
async function loadDashboard() {
  const { from, to } = monthRange();

  const [{ data: ingresos }, { data: gastos }, { data: deudas }] = await Promise.all([
    supabase.from('ingresos').select('monto').eq('user_id', uid()).gte('fecha', from).lte('fecha', to),
    supabase.from('gastos').select('monto,tipo').eq('user_id', uid()).gte('fecha', from).lte('fecha', to),
    supabase.from('deudas').select('monto,estado').eq('user_id', uid()).neq('estado', 'pagado'),
  ]);

  const totalIng  = (ingresos  || []).reduce((s, r) => s + Number(r.monto), 0);
  const totalGas  = (gastos    || []).reduce((s, r) => s + Number(r.monto), 0);
  const totalDeuda = (deudas   || []).reduce((s, r) => s + Number(r.monto), 0);
  const disponible = totalIng - totalGas;
  const promedio   = daysIntoMonth() > 0 ? totalGas / daysIntoMonth() : 0;

  const el = (id) => document.getElementById(id);
  el('kpi-disponible').textContent = formatMoney(disponible);
  el('kpi-ingresos').textContent   = formatMoney(totalIng);
  el('kpi-gastos').textContent     = formatMoney(totalGas);
  el('kpi-resultado').textContent  = (disponible >= 0 ? '+' : '') + formatMoney(disponible);
  el('kpi-deudas').textContent     = formatMoney(totalDeuda);
  el('kpi-promedio').textContent   = formatMoney(promedio) + '/día';

  // Colores KPIs
  el('kpi-disponible').parentElement.className = 'kpi ' + (disponible >= 0 ? 'green' : 'red');
  el('kpi-resultado').parentElement.className  = 'kpi ' + (disponible >= 0 ? 'green' : 'red');

  // Distribución
  const fijos  = (gastos || []).filter(g => g.tipo === 'operativo').reduce((s, g) => s + Number(g.monto), 0);
  const impul  = (gastos || []).filter(g => g.tipo === 'impulsivo').reduce((s, g) => s + Number(g.monto), 0);
  const neces  = (gastos || []).filter(g => g.tipo === 'necesario').reduce((s, g) => s + Number(g.monto), 0);
  const crece  = (gastos || []).filter(g => g.tipo === 'crecimiento').reduce((s, g) => s + Number(g.monto), 0);
  const base   = totalIng || 1;

  const proyeccion = daysIntoMonth() > 0 ? (totalGas / daysIntoMonth()) * new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate() : 0;

  document.getElementById('distribucion-content').innerHTML = `
    <div class="dist-row"><span class="dist-label">Necesarios</span><span><span class="dist-val">${formatMoney(neces)}</span><span class="dist-pct">(${Math.round(neces/base*100)}%)</span></span></div>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(neces/base*100,100)}%;background:#639922"></div></div>
    <div class="dist-row" style="margin-top:8px"><span class="dist-label">Impulsivos</span><span><span class="dist-val">${formatMoney(impul)}</span><span class="dist-pct">(${Math.round(impul/base*100)}%)</span></span></div>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(impul/base*100,100)}%;background:#E24B4A"></div></div>
    <div class="dist-row" style="margin-top:8px"><span class="dist-label">Operativos</span><span><span class="dist-val">${formatMoney(fijos)}</span><span class="dist-pct">(${Math.round(fijos/base*100)}%)</span></span></div>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(fijos/base*100,100)}%;background:#378ADD"></div></div>
    <div class="dist-row" style="margin-top:8px"><span class="dist-label">Crecimiento</span><span><span class="dist-val">${formatMoney(crece)}</span><span class="dist-pct">(${Math.round(crece/base*100)}%)</span></span></div>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(crece/base*100,100)}%;background:#7F77DD"></div></div>
    <div style="margin-top:14px;display:flex;gap:16px;font-size:12px;color:var(--text3)">
      <span>Promedio diario: <strong style="color:var(--text)">${formatMoney(promedio)}</strong></span>
      <span>Proyección fin de mes: <strong style="color:${proyeccion > totalIng ? 'var(--red)' : 'var(--yellow)'}">${formatMoney(proyeccion)}</strong></span>
    </div>
  `;
}

// ── INGRESOS ─────────────────────────────────────────────────
async function loadIngresos() {
  const { from, to } = monthRange();

  const { data: all }   = await supabase.from('ingresos').select('monto').eq('user_id', uid());
  const { data: mes }   = await supabase.from('ingresos').select('*').eq('user_id', uid()).gte('fecha', from).lte('fecha', to).order('fecha', { ascending: false });

  const montos = (all || []).map(r => Number(r.monto));
  const total  = (mes || []).reduce((s, r) => s + Number(r.monto), 0);

  document.getElementById('ing-total').textContent = formatMoney(total);
  document.getElementById('ing-min').textContent   = montos.length ? formatMoney(Math.min(...montos)) : '—';
  document.getElementById('ing-max').textContent   = montos.length ? formatMoney(Math.max(...montos)) : '—';
  document.getElementById('ing-prom').textContent  = montos.length ? formatMoney(montos.reduce((a,b)=>a+b,0)/montos.length) : '—';

  const lista = document.getElementById('lista-ingresos');
  if (!mes || mes.length === 0) {
    lista.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div>No hay ingresos registrados este mes.</div>';
    return;
  }
  lista.innerHTML = mes.map(r => `
    <div class="list-item">
      <div class="li-main">
        <div class="li-name">${r.descripcion || r.categoria}</div>
        <div class="li-meta">${formatDate(r.fecha)} · ${r.metodo_cobro || ''} · ${r.categoria}</div>
      </div>
      <div class="li-monto monto-ingreso">+${formatMoney(r.monto)}</div>
      <button class="btn-danger" onclick="eliminarIngreso('${r.id}','${r.descripcion || r.categoria}',${r.monto})">✕</button>
    </div>
  `).join('');
}

window.guardarIngreso = async function() {
  const monto = parseFloat(document.getElementById('ing-monto').value);
  if (!monto || monto <= 0) { toast('Ingresá un monto válido', 'error'); return; }

  const { error } = await supabase.from('ingresos').insert({
    user_id:      uid(),
    fecha:        document.getElementById('ing-fecha').value || today(),
    hora:         document.getElementById('ing-hora').value  || null,
    categoria:    document.getElementById('ing-cat').value,
    descripcion:  document.getElementById('ing-desc').value || null,
    metodo_cobro: document.getElementById('ing-medio').value,
    monto,
    observaciones: document.getElementById('ing-obs').value || null,
  });

  if (error) { toast('Error al guardar: ' + error.message, 'error'); return; }
  await logHistorial('agregado', 'ingresos', `Ingreso: "${document.getElementById('ing-desc').value || document.getElementById('ing-cat').value}" por ${formatMoney(monto)}`);
  toast('✓ Ingreso registrado');
  ['ing-monto','ing-desc','ing-obs'].forEach(id => document.getElementById(id).value = '');
  loadIngresos();
  loadDashboard();
};

window.eliminarIngreso = async function(id, desc, monto) {
  if (!confirm(`¿Eliminar "${desc}"?`)) return;
  await supabase.from('ingresos').delete().eq('id', id).eq('user_id', uid());
  await logHistorial('eliminado', 'ingresos', `Ingreso eliminado: "${desc}"`, formatMoney(monto));
  toast('Ingreso eliminado');
  loadIngresos();
  loadDashboard();
};

// ── GASTOS ───────────────────────────────────────────────────
async function loadGastos() {
  const { from, to } = monthRange();
  const { data } = await supabase.from('gastos').select('*').eq('user_id', uid()).gte('fecha', from).lte('fecha', to).order('fecha', { ascending: false }).order('created_at', { ascending: false });

  const lista = document.getElementById('lista-gastos');
  if (!data || data.length === 0) {
    lista.innerHTML = '<div class="empty-state"><div class="empty-icon">🧾</div>No hay gastos registrados este mes.</div>';
    return;
  }
  lista.innerHTML = data.map(r => `
    <div class="list-item">
      <div class="li-main">
        <div class="li-name">${r.descripcion || r.categoria} ${tipoPill(r.tipo)}</div>
        <div class="li-meta">${formatDate(r.fecha)} · ${r.metodo_pago || ''} · ${r.categoria}</div>
      </div>
      <div class="li-monto monto-gasto">−${formatMoney(r.monto)}</div>
      <button class="btn-danger" onclick="eliminarGasto('${r.id}','${(r.descripcion||r.categoria).replace(/'/g,"\\'")}',${r.monto})">✕</button>
    </div>
  `).join('');
}

window.guardarGasto = async function() {
  const monto = parseFloat(document.getElementById('g-monto').value);
  if (!monto || monto <= 0) { toast('Ingresá un monto válido', 'error'); return; }

  const { error } = await supabase.from('gastos').insert({
    user_id:     uid(),
    fecha:       document.getElementById('g-fecha').value || today(),
    hora:        document.getElementById('g-hora').value  || null,
    categoria:   document.getElementById('g-cat').value,
    subcategoria:document.getElementById('g-subcat').value || null,
    descripcion: document.getElementById('g-desc').value  || null,
    metodo_pago: document.getElementById('g-medio').value,
    monto,
    tipo:        document.getElementById('g-tipo').value,
    observacion: document.getElementById('g-obs').value   || null,
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  const desc = document.getElementById('g-desc').value || document.getElementById('g-cat').value;
  await logHistorial('agregado', 'gastos', `Gasto: "${desc}" por ${formatMoney(monto)} (${document.getElementById('g-tipo').value})`);
  toast('✓ Gasto registrado');
  ['g-monto','g-desc','g-subcat','g-obs'].forEach(id => document.getElementById(id).value = '');
  loadGastos();
  loadDashboard();
};

window.eliminarGasto = async function(id, desc, monto) {
  if (!confirm(`¿Eliminar "${desc}"?`)) return;
  await supabase.from('gastos').delete().eq('id', id).eq('user_id', uid());
  await logHistorial('eliminado', 'gastos', `Gasto eliminado: "${desc}"`, formatMoney(monto));
  toast('Gasto eliminado');
  loadGastos();
  loadDashboard();
};

// CARGA RÁPIDA DESDE DASHBOARD
window.cargarGastoRapido = async function() {
  const monto = parseFloat(document.getElementById('q-monto').value);
  if (!monto || monto <= 0) { toast('Ingresá un monto válido', 'error'); return; }

  const { error } = await supabase.from('gastos').insert({
    user_id:    uid(),
    fecha:      today(),
    hora:       new Date().toTimeString().slice(0, 5),
    categoria:  document.getElementById('q-cat').value,
    descripcion:document.getElementById('q-desc').value || document.getElementById('q-cat').value,
    metodo_pago:document.getElementById('q-medio').value,
    monto,
    tipo:       document.getElementById('q-tipo').value,
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  const desc = document.getElementById('q-desc').value || document.getElementById('q-cat').value;
  await logHistorial('agregado', 'gastos', `Gasto rápido: "${desc}" por ${formatMoney(monto)}`);
  toast('✓ Gasto registrado');
  document.getElementById('q-monto').value = '';
  document.getElementById('q-desc').value  = '';
  loadDashboard();
};

// ── GASTOS FIJOS ─────────────────────────────────────────────
async function loadFijos() {
  const { data } = await supabase.from('gastos_fijos').select('*').eq('user_id', uid()).eq('activo', true).order('dia_vencimiento');
  const { from, to } = monthRange();
  const { data: ingresos } = await supabase.from('ingresos').select('monto').eq('user_id', uid()).gte('fecha', from).lte('fecha', to);
  const totalIng = (ingresos || []).reduce((s, r) => s + Number(r.monto), 0);

  const total = (data || []).reduce((s, r) => s + Number(r.monto), 0);
  const pct   = totalIng > 0 ? Math.round(total / totalIng * 100) : 0;

  const hoy = new Date().getDate();
  const prox = (data || []).filter(r => r.dia_vencimiento >= hoy).sort((a,b) => a.dia_vencimiento - b.dia_vencimiento)[0];

  document.getElementById('fijo-total').textContent = formatMoney(total);
  document.getElementById('fijo-pct').textContent   = pct + '%';
  document.getElementById('fijo-prox').textContent  = prox ? `Día ${prox.dia_vencimiento}` : '—';
  document.getElementById('fijo-pct').parentElement.className = 'kpi ' + (pct > 50 ? 'red' : pct > 30 ? 'yellow' : '');

  const lista = document.getElementById('lista-fijos');
  if (!data || data.length === 0) {
    lista.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div>No hay gastos fijos cargados.</div>';
    return;
  }
  lista.innerHTML = data.map(r => {
    const diasParaVenc = r.dia_vencimiento ? r.dia_vencimiento - hoy : null;
    const badge = diasParaVenc === null ? '' : diasParaVenc < 0 ? `<span class="badge badge-green">Pagado</span>` : diasParaVenc <= 3 ? `<span class="badge badge-yellow">Vence en ${diasParaVenc}d</span>` : `<span class="badge badge-green">Al día</span>`;
    return `
      <div class="list-item">
        <div class="li-main">
          <div class="li-name">${r.nombre}</div>
          <div class="li-meta">Vence día ${r.dia_vencimiento || '?'} · ${r.categoria || ''}</div>
        </div>
        <div class="li-monto">${formatMoney(r.monto)}</div>
        ${badge}
        <button class="btn-danger" onclick="eliminarFijo('${r.id}','${r.nombre}')">✕</button>
      </div>
    `;
  }).join('');
}

window.guardarFijo = async function() {
  const nombre = document.getElementById('fijo-nombre').value.trim();
  const monto  = parseFloat(document.getElementById('fijo-monto').value);
  if (!nombre || !monto) { toast('Completá nombre y monto', 'error'); return; }

  const { error } = await supabase.from('gastos_fijos').insert({
    user_id:        uid(),
    nombre,
    monto,
    dia_vencimiento: parseInt(document.getElementById('fijo-dia').value) || null,
    categoria:      document.getElementById('fijo-cat').value,
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  await logHistorial('agregado', 'gastos_fijos', `Gasto fijo: "${nombre}" por ${formatMoney(monto)}`);
  toast('✓ Gasto fijo agregado');
  document.getElementById('fijo-nombre').value = '';
  document.getElementById('fijo-monto').value  = '';
  document.getElementById('fijo-dia').value    = '';
  loadFijos();
};

window.eliminarFijo = async function(id, nombre) {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return;
  await supabase.from('gastos_fijos').delete().eq('id', id).eq('user_id', uid());
  await logHistorial('eliminado', 'gastos_fijos', `Gasto fijo eliminado: "${nombre}"`);
  toast('Fijo eliminado');
  loadFijos();
};

// ── DEUDAS ───────────────────────────────────────────────────
async function loadDeudas() {
  const { data } = await supabase.from('deudas').select('*').eq('user_id', uid()).neq('estado', 'pagado').order('fecha_vencimiento');

  const total     = (data || []).reduce((s, r) => s + Number(r.monto), 0);
  const semana    = (data || []).filter(r => { const d = diasHastaVenc(r.fecha_vencimiento); return d !== null && d >= 0 && d <= 7; }).length;
  const vencidas  = (data || []).filter(r => { const d = diasHastaVenc(r.fecha_vencimiento); return d !== null && d < 0; }).length;

  document.getElementById('deuda-total').textContent   = formatMoney(total);
  document.getElementById('deuda-semana').textContent  = semana;
  document.getElementById('deuda-vencidas').textContent = vencidas;

  const lista = document.getElementById('lista-deudas');
  if (!data || data.length === 0) {
    lista.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div>No hay deudas pendientes.</div>';
    return;
  }

  const iconos = { tarjeta: '💳', prestamo: '🏦', cuota: '📦', impuesto: '🏛️', servicio: '💡', otro: '📋' };
  lista.innerHTML = data.map(r => {
    const dias  = diasHastaVenc(r.fecha_vencimiento);
    const borde = dias !== null && dias < 0 ? 'var(--red)' : dias !== null && dias <= 7 ? 'var(--yellow)' : 'var(--border)';
    return `
      <div class="deuda-card" style="border-color:${borde}">
        <div class="deuda-icon">${iconos[r.tipo] || '📋'}</div>
        <div class="deuda-info">
          <div class="deuda-nombre">${r.descripcion}</div>
          <div class="deuda-meta">${r.fecha_vencimiento ? 'Vence ' + formatDate(r.fecha_vencimiento) : ''} · Prioridad ${r.prioridad} · ${r.tipo}</div>
        </div>
        <div class="deuda-right">
          <div class="deuda-monto" style="color:${borde === 'var(--red)' ? 'var(--red)' : 'var(--yellow)'}">${formatMoney(r.monto)}</div>
          ${badgeVenc(dias)}
          <div style="margin-top:4px;display:flex;gap:4px;justify-content:flex-end">
            <button class="btn-danger" onclick="marcarDeudaPagada('${r.id}','${r.descripcion}')">Pagada ✓</button>
            <button class="btn-danger" onclick="eliminarDeuda('${r.id}','${r.descripcion}')">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.guardarDeuda = async function() {
  const desc  = document.getElementById('d-desc').value.trim();
  const monto = parseFloat(document.getElementById('d-monto').value);
  if (!desc || !monto) { toast('Completá descripción y monto', 'error'); return; }

  const { error } = await supabase.from('deudas').insert({
    user_id:          uid(),
    descripcion:      desc,
    tipo:             document.getElementById('d-tipo').value,
    monto,
    fecha_vencimiento: document.getElementById('d-fecha').value || null,
    prioridad:        document.getElementById('d-prio').value,
    estado:           document.getElementById('d-estado').value,
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  await logHistorial('agregado', 'deudas', `Deuda: "${desc}" por ${formatMoney(monto)}`);
  toast('✓ Deuda registrada');
  document.getElementById('d-desc').value  = '';
  document.getElementById('d-monto').value = '';
  document.getElementById('d-fecha').value = '';
  loadDeudas();
};

window.marcarDeudaPagada = async function(id, desc) {
  await supabase.from('deudas').update({ estado: 'pagado' }).eq('id', id).eq('user_id', uid());
  await logHistorial('editado', 'deudas', `Deuda marcada como pagada: "${desc}"`);
  toast('✓ Marcada como pagada');
  loadDeudas();
};

window.eliminarDeuda = async function(id, desc) {
  if (!confirm(`¿Eliminar "${desc}"?`)) return;
  await supabase.from('deudas').delete().eq('id', id).eq('user_id', uid());
  await logHistorial('eliminado', 'deudas', `Deuda eliminada: "${desc}"`);
  toast('Deuda eliminada');
  loadDeudas();
};

// ── EQUILIBRIO ────────────────────────────────────────────────
async function loadEquilibrio() {
  const { from, to } = monthRange();
  const diasMes = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();

  const [{ data: ingresos }, { data: gastos }] = await Promise.all([
    supabase.from('ingresos').select('monto').eq('user_id', uid()).gte('fecha', from).lte('fecha', to),
    supabase.from('gastos').select('monto').eq('user_id', uid()).gte('fecha', from).lte('fecha', to),
  ]);

  const totalIng = (ingresos || []).reduce((s, r) => s + Number(r.monto), 0);
  const totalGas = (gastos   || []).reduce((s, r) => s + Number(r.monto), 0);
  const resultado = totalIng - totalGas;
  const diasHoy   = daysIntoMonth();
  const promDiario = diasHoy > 0 ? totalGas / diasHoy : 0;
  const proyeccion = promDiario * diasMes;
  const superavit  = resultado >= 0;

  document.getElementById('equilibrio-content').innerHTML = `
    <div class="equilibrio-result ${superavit ? 'superavit' : 'deficit'}">
      <div class="eq-num" style="color:${superavit ? 'var(--green)' : 'var(--red)'}">
        ${superavit ? '+' : ''}${formatMoney(resultado)}
      </div>
      <div class="eq-label" style="color:${superavit ? 'var(--green)' : 'var(--red)'}">
        ${superavit ? 'Superávit este mes' : 'Déficit este mes'}
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi"><div class="kpi-label">Mínimo por mes</div><div class="kpi-val">${formatMoney(totalGas)}</div></div>
      <div class="kpi"><div class="kpi-label">Mínimo por semana</div><div class="kpi-val">${formatMoney(totalGas/4)}</div></div>
      <div class="kpi"><div class="kpi-label">Mínimo por día</div><div class="kpi-val">${formatMoney(totalGas/diasMes)}</div></div>
    </div>

    <div class="card">
      <h3>📈 Proyección del mes</h3>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text2)">Gastado hasta hoy (${diasHoy} días)</span><strong>${formatMoney(totalGas)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text2)">Promedio diario</span><strong>${formatMoney(promDiario)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text2)">Proyección fin de mes</span><strong style="color:${proyeccion > totalIng ? 'var(--red)' : 'var(--yellow)'}">${formatMoney(proyeccion)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text2)">Ingresos del mes</span><strong style="color:var(--green)">${formatMoney(totalIng)}</strong></div>
      </div>
      <div class="progress-bar" style="height:12px;margin-top:12px">
        <div class="progress-fill" style="width:${Math.min(totalGas/(totalIng||1)*100,100)}%;background:${totalGas > totalIng ? '#E24B4A' : '#378ADD'}"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-top:4px">
        <span>Gastado: ${Math.round(totalGas/(totalIng||1)*100)}%</span>
        <span>Disponible: ${Math.round(Math.max(0,resultado)/(totalIng||1)*100)}%</span>
      </div>
      ${proyeccion > totalIng
        ? `<div class="alert alert-danger" style="margin-top:12px"><span class="alert-icon">⚠️</span><span>Al ritmo actual, terminarás el mes con <strong>${formatMoney(proyeccion - totalIng)} de déficit</strong>. Necesitás reducir gastos.</span></div>`
        : `<div class="alert alert-success" style="margin-top:12px"><span class="alert-icon">✅</span><span>Al ritmo actual, terminarás el mes con <strong>${formatMoney(totalIng - proyeccion)} de superávit</strong>.</span></div>`
      }
    </div>
  `;
}

// ── AHORRO ───────────────────────────────────────────────────
async function loadAhorro() {
  const { from, to } = monthRange();
  const [{ data: metas }, { data: ingresos }, { data: gastos }] = await Promise.all([
    supabase.from('metas_ahorro').select('*').eq('user_id', uid()).order('created_at'),
    supabase.from('ingresos').select('monto').eq('user_id', uid()).gte('fecha', from).lte('fecha', to),
    supabase.from('gastos').select('monto').eq('user_id', uid()).gte('fecha', from).lte('fecha', to),
  ]);

  const totalIng = (ingresos || []).reduce((s, r) => s + Number(r.monto), 0);
  const totalGas = (gastos   || []).reduce((s, r) => s + Number(r.monto), 0);
  const capAhorro = Math.max(0, totalIng - totalGas);
  const totalMetas = (metas || []).reduce((s, r) => s + Number(r.monto_actual), 0);

  document.getElementById('ahorro-cap').textContent   = formatMoney(capAhorro);
  document.getElementById('ahorro-metas').textContent = (metas || []).length;
  document.getElementById('ahorro-total').textContent = formatMoney(totalMetas);

  const lista = document.getElementById('lista-metas');
  if (!metas || metas.length === 0) {
    lista.innerHTML = '<div class="empty-state"><div class="empty-icon">🎯</div>No hay objetivos de ahorro.</div>';
    return;
  }

  lista.innerHTML = metas.map(r => {
    const pct  = r.monto_objetivo > 0 ? Math.min(Math.round(r.monto_actual / r.monto_objetivo * 100), 100) : 0;
    const falta = Math.max(0, r.monto_objetivo - r.monto_actual);
    return `
      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:500">${r.emoji || '🎯'} ${r.nombre}</span>
          <span style="font-size:12px;color:var(--text3)">${formatMoney(r.monto_actual)} / ${formatMoney(r.monto_objetivo)}</span>
        </div>
        <div class="progress-bar" style="height:10px">
          <div class="progress-fill" style="width:${pct}%;background:${pct >= 100 ? '#639922' : '#378ADD'}"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-top:4px">
          <span>${pct}% completado${pct < 100 ? ' · Faltan ' + formatMoney(falta) : ' · ¡Meta alcanzada!'}</span>
          <div style="display:flex;gap:6px">
            <button class="btn" style="font-size:11px;padding:2px 8px" onclick="abonarMeta('${r.id}','${r.nombre}',${r.monto_actual},${r.monto_objetivo})">+ Abonar</button>
            <button class="btn-danger" onclick="eliminarMeta('${r.id}','${r.nombre}')">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.guardarMeta = async function() {
  const nombre   = document.getElementById('meta-nombre').value.trim();
  const objetivo = parseFloat(document.getElementById('meta-objetivo').value);
  if (!nombre || !objetivo) { toast('Completá nombre y monto', 'error'); return; }

  const { error } = await supabase.from('metas_ahorro').insert({
    user_id:        uid(),
    nombre,
    monto_objetivo: objetivo,
    monto_actual:   parseFloat(document.getElementById('meta-inicial').value) || 0,
    emoji:          document.getElementById('meta-emoji').value || '🎯',
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  await logHistorial('agregado', 'metas_ahorro', `Meta de ahorro: "${nombre}" por ${formatMoney(objetivo)}`);
  toast('✓ Meta creada');
  document.getElementById('meta-nombre').value   = '';
  document.getElementById('meta-objetivo').value = '';
  document.getElementById('meta-inicial').value  = '0';
  loadAhorro();
};

window.abonarMeta = async function(id, nombre, actual, objetivo) {
  const monto = parseFloat(prompt(`¿Cuánto querés abonar a "${nombre}"?`));
  if (!monto || monto <= 0) return;
  const nuevo = actual + monto;
  await supabase.from('metas_ahorro').update({ monto_actual: nuevo }).eq('id', id).eq('user_id', uid());
  await logHistorial('editado', 'metas_ahorro', `Abono a "${nombre}": ${formatMoney(monto)}`, formatMoney(actual), formatMoney(nuevo));
  toast('✓ Abono registrado');
  loadAhorro();
};

window.eliminarMeta = async function(id, nombre) {
  if (!confirm(`¿Eliminar la meta "${nombre}"?`)) return;
  await supabase.from('metas_ahorro').delete().eq('id', id).eq('user_id', uid());
  await logHistorial('eliminado', 'metas_ahorro', `Meta eliminada: "${nombre}"`);
  toast('Meta eliminada');
  loadAhorro();
};

// ── ALERTAS ──────────────────────────────────────────────────
async function loadAlertas() {
  const { from, to } = monthRange();
  const diasMes = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();

  const mesAnteriorFin   = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
  const mesAnteriorIni   = new Date(mesAnteriorFin.getFullYear(), mesAnteriorFin.getMonth(), 1);
  const fromAnterior     = mesAnteriorIni.toISOString().split('T')[0];
  const toAnterior       = mesAnteriorFin.toISOString().split('T')[0];

  const [
    { data: gastosMes },
    { data: gastosAnt },
    { data: ingresosMes },
    { data: deudas },
  ] = await Promise.all([
    supabase.from('gastos').select('monto,tipo,categoria,fecha').eq('user_id', uid()).gte('fecha', from).lte('fecha', to),
    supabase.from('gastos').select('monto,categoria').eq('user_id', uid()).gte('fecha', fromAnterior).lte('fecha', toAnterior),
    supabase.from('ingresos').select('monto').eq('user_id', uid()).gte('fecha', from).lte('fecha', to),
    supabase.from('deudas').select('descripcion,fecha_vencimiento,monto').eq('user_id', uid()).neq('estado','pagado'),
  ]);

  const alertas = [];
  const totalIng = (ingresosMes || []).reduce((s, r) => s + Number(r.monto), 0);
  const totalGas = (gastosMes   || []).reduce((s, r) => s + Number(r.monto), 0);
  const diasHoy  = daysIntoMonth();
  const promDia  = diasHoy > 0 ? totalGas / diasHoy : 0;
  const proyeccion = promDia * diasMes;

  // Riesgo financiero
  if (proyeccion > totalIng && totalIng > 0) {
    alertas.push({ tipo: 'danger', icono: '🔥', msg: `Estás gastando a un ritmo que <strong>superaría tus ingresos</strong> al fin de mes. Proyección: ${formatMoney(proyeccion)} vs ingresos: ${formatMoney(totalIng)}.` });
  }

  // Deudas próximas
  (deudas || []).forEach(d => {
    const dias = diasHastaVenc(d.fecha_vencimiento);
    if (dias !== null && dias < 0)  alertas.push({ tipo: 'danger',  icono: '💳', msg: `<strong>${d.descripcion}</strong> está <strong>vencida</strong> (${formatMoney(d.monto)}). Regularizá cuanto antes.` });
    if (dias !== null && dias >= 0 && dias <= 3) alertas.push({ tipo: 'danger',  icono: '⚠️', msg: `<strong>${d.descripcion}</strong> vence en <strong>${dias === 0 ? 'hoy' : dias + ' días'}</strong> (${formatMoney(d.monto)}).` });
    if (dias !== null && dias > 3 && dias <= 7)  alertas.push({ tipo: 'warning', icono: '📅', msg: `<strong>${d.descripcion}</strong> vence en <strong>${dias} días</strong> (${formatMoney(d.monto)}).` });
  });

  // Comparación por categoría
  const catMes = {};
  const catAnt = {};
  (gastosMes || []).forEach(g => { catMes[g.categoria] = (catMes[g.categoria] || 0) + Number(g.monto); });
  (gastosAnt || []).forEach(g => { catAnt[g.categoria] = (catAnt[g.categoria] || 0) + Number(g.monto); });

  Object.keys(catMes).forEach(cat => {
    if (catAnt[cat]) {
      const cambio = Math.round((catMes[cat] - catAnt[cat]) / catAnt[cat] * 100);
      if (cambio > 30) alertas.push({ tipo: 'warning', icono: '📈', msg: `<strong>${cat}</strong> aumentó <strong>${cambio}%</strong> respecto al mes pasado (${formatMoney(catAnt[cat])} → ${formatMoney(catMes[cat])}).` });
      if (cambio < -15) alertas.push({ tipo: 'success', icono: '🏆', msg: `<strong>${cat}</strong> bajó un <strong>${Math.abs(cambio)}%</strong> respecto al mes pasado. ¡Buen trabajo!` });
    }
  });

  // Gastos impulsivos
  const impulsivos = (gastosMes || []).filter(g => g.tipo === 'impulsivo').reduce((s,g) => s + Number(g.monto), 0);
  const impAnt     = (gastosAnt || []).filter(g => g.tipo === 'impulsivo').reduce((s,g) => s + Number(g.monto), 0);
  if (impulsivos > 0 && totalIng > 0 && impulsivos / totalIng > 0.20) {
    alertas.push({ tipo: 'warning', icono: '🛍️', msg: `Los gastos impulsivos representan el <strong>${Math.round(impulsivos/totalIng*100)}%</strong> de tus ingresos este mes (${formatMoney(impulsivos)}).` });
  }
  if (impAnt > 0 && impulsivos < impAnt) {
    alertas.push({ tipo: 'success', icono: '✅', msg: `Reduciste gastos impulsivos un <strong>${Math.round((impAnt-impulsivos)/impAnt*100)}%</strong> respecto al mes anterior.` });
  }

  // Hábito fin de semana
  const finSemana = (gastosMes || []).filter(g => { const d = new Date(g.fecha+'T12:00:00').getDay(); return d === 0 || d === 6; }).reduce((s,g) => s + Number(g.monto), 0);
  if (totalGas > 0 && finSemana / totalGas > 0.45) {
    alertas.push({ tipo: 'info', icono: '📆', msg: `Tus mayores gastos ocurren los <strong>fines de semana</strong>. Representan el <strong>${Math.round(finSemana/totalGas*100)}%</strong> de tus gastos totales.` });
  }

  if (alertas.length === 0) {
    alertas.push({ tipo: 'success', icono: '🎉', msg: 'No hay alertas por el momento. ¡Tus finanzas están bien encaminadas!' });
  }

  document.getElementById('alertas-content').innerHTML = alertas.map(a => `
    <div class="alert alert-${a.tipo}">
      <span class="alert-icon">${a.icono}</span>
      <span>${a.msg}</span>
    </div>
  `).join('');
}

// ── COMPARATIVAS ─────────────────────────────────────────────
async function loadComparativas() {
  await loadCompMes();
}

async function loadCompMes() {
  const meses = [];
  const hoy = new Date();
  for (let i = 2; i >= 0; i--) {
    const d   = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const año = d.getFullYear();
    const mes = d.getMonth() + 1;
    const from = `${año}-${String(mes).padStart(2,'0')}-01`;
    const to   = `${año}-${String(mes).padStart(2,'0')}-${new Date(año, mes, 0).getDate()}`;
    const nombre = d.toLocaleString('es-AR', { month: 'short', year: '2-digit' });
    const [{ data: ing }, { data: gas }] = await Promise.all([
      supabase.from('ingresos').select('monto').eq('user_id', uid()).gte('fecha', from).lte('fecha', to),
      supabase.from('gastos').select('monto').eq('user_id', uid()).gte('fecha', from).lte('fecha', to),
    ]);
    meses.push({
      nombre,
      ingresos: (ing || []).reduce((s,r) => s + Number(r.monto), 0),
      gastos:   (gas || []).reduce((s,r) => s + Number(r.monto), 0),
    });
  }
  const maxVal = Math.max(...meses.map(m => Math.max(m.ingresos, m.gastos)), 1);

  document.getElementById('comp-mes-content').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:1rem">
      ${meses.map(m => `
        <div>
          <div style="font-size:12px;font-weight:500;margin-bottom:8px;color:var(--text2)">${m.nombre}</div>
          <div style="display:flex;gap:4px;align-items:flex-end;height:100px">
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
              <span style="font-size:10px;color:var(--green)">${formatMoney(m.ingresos)}</span>
              <div style="width:100%;border-radius:4px 4px 0 0;background:#639922;height:${Math.round(m.ingresos/maxVal*80)}px;min-height:4px"></div>
              <span style="font-size:10px;color:var(--text3)">ing</span>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
              <span style="font-size:10px;color:var(--red)">${formatMoney(m.gastos)}</span>
              <div style="width:100%;border-radius:4px 4px 0 0;background:#E24B4A;height:${Math.round(m.gastos/maxVal*80)}px;min-height:4px"></div>
              <span style="font-size:10px;color:var(--text3)">gas</span>
            </div>
          </div>
          <div style="text-align:center;font-size:11px;margin-top:6px;font-weight:500;color:${m.ingresos >= m.gastos ? 'var(--green)' : 'var(--red)'}">
            ${m.ingresos >= m.gastos ? '+' : ''}${formatMoney(m.ingresos - m.gastos)}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadCompCategorias() {
  const { from, to } = monthRange();
  const { data } = await supabase.from('gastos').select('categoria,monto').eq('user_id', uid()).gte('fecha', from).lte('fecha', to);
  const cats = {};
  (data || []).forEach(g => { cats[g.categoria] = (cats[g.categoria] || 0) + Number(g.monto); });
  const sorted = Object.entries(cats).sort((a,b) => b[1]-a[1]);
  const max = sorted[0]?.[1] || 1;

  document.getElementById('comp-cat-content').innerHTML = sorted.length === 0
    ? '<div class="empty-state"><div class="empty-icon">📊</div>Sin datos este mes.</div>'
    : sorted.map(([cat, monto]) => `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
            <span>${cat}</span><strong>${formatMoney(monto)}</strong>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(monto/max*100)}%;background:#378ADD"></div></div>
        </div>
      `).join('');
}

async function loadCompTipo() {
  const { from, to } = monthRange();
  const { data } = await supabase.from('gastos').select('tipo,monto').eq('user_id', uid()).gte('fecha', from).lte('fecha', to);
  const tipos = { necesario: 0, impulsivo: 0, operativo: 0, crecimiento: 0 };
  (data || []).forEach(g => { if (tipos[g.tipo] !== undefined) tipos[g.tipo] += Number(g.monto); });
  const total = Object.values(tipos).reduce((a,b) => a+b, 0) || 1;
  const colores = { necesario: '#639922', impulsivo: '#E24B4A', operativo: '#378ADD', crecimiento: '#7F77DD' };

  document.getElementById('comp-tipo-content').innerHTML = Object.entries(tipos).map(([tipo, monto]) => `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
        <span>${tipoPill(tipo)} ${tipo}</span>
        <span><strong>${formatMoney(monto)}</strong> <span style="font-size:11px;color:var(--text3)">(${Math.round(monto/total*100)}%)</span></span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(monto/total*100)}%;background:${colores[tipo]}"></div></div>
    </div>
  `).join('');
}

window.switchCompTab = async function(btn, tab) {
  btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('comp-mes').style.display         = tab === 'mes'         ? 'block' : 'none';
  document.getElementById('comp-categorias').style.display  = tab === 'categorias'  ? 'block' : 'none';
  document.getElementById('comp-tipo').style.display        = tab === 'tipo'        ? 'block' : 'none';
  if (tab === 'mes')        await loadCompMes();
  if (tab === 'categorias') await loadCompCategorias();
  if (tab === 'tipo')       await loadCompTipo();
};

// ── HISTORIAL ────────────────────────────────────────────────
async function loadHistorial() {
  const { data } = await supabase.from('historial').select('*').eq('user_id', uid()).order('created_at', { ascending: false }).limit(50);

  const lista = document.getElementById('lista-historial');
  if (!data || data.length === 0) {
    lista.innerHTML = '<div class="empty-state"><div class="empty-icon">🕓</div>No hay modificaciones registradas.</div>';
    return;
  }

  const iconos  = { agregado: '➕', eliminado: '🗑️', editado: '✏️' };
  const colores = { agregado: 'var(--blue-bg)', eliminado: 'var(--red-bg)', editado: 'var(--green-bg)' };

  lista.innerHTML = data.map(r => {
    const fecha = new Date(r.created_at);
    const fechaStr = fecha.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit' });
    const horaStr  = fecha.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
    return `
      <div class="hist-row">
        <div class="hist-icon" style="background:${colores[r.accion] || 'var(--bg)'}">
          ${iconos[r.accion] || '•'}
        </div>
        <div class="hist-main">
          <div class="hist-titulo">${r.descripcion}</div>
          <div class="hist-meta">${r.tabla}${r.valor_anterior ? ` · ${r.valor_anterior} → ${r.valor_nuevo}` : ''}</div>
        </div>
        <div class="hist-time">${fechaStr}<br>${horaStr}</div>
      </div>
    `;
  }).join('');
}
