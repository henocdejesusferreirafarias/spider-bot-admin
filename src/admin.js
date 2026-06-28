/* ── API routing ─────────────────────────────────────────────── */
(function () {
  const apiBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (!apiBase) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.startsWith('/v1/')) {
      const requestInit = { ...init };
      if (requestInit.credentials !== 'omit') requestInit.credentials = 'include';
      return originalFetch(apiBase + input, requestInit);
    }
    return originalFetch(input, init);
  };
})();

/* ── login ──────────────────────────────────────────────────── */
function showLogin(){
  document.getElementById('login-overlay').classList.add('show');
  document.getElementById('main-shell').style.display='none';
}

async function doLogin(){
  const pass = document.getElementById('login-pass').value;
  const code = document.getElementById('login-code').value.trim();
  const errEl = document.getElementById('login-err');
  const btn = document.querySelector('.login-box .btn-primary');
  errEl.style.display='none';
  btn?.classList.add('is-loading');
  try {
    const r = await fetch('/v1/admin/login', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'same-origin',
      body:JSON.stringify(code ? {password:pass, code} : {password:pass})
    });
    if (!r.ok) {
      let reason = '';
      try { reason = (await r.json())?.code || ''; } catch(_) {}
      errEl.textContent = r.status === 429
        ? 'Muitas tentativas. Aguarde alguns minutos.'
        : reason === 'totp_required'
          ? 'Código 2FA obrigatório ou inválido.'
          : 'Senha incorreta';
      errEl.style.display='block';
      if (reason === 'totp_required') document.getElementById('login-code').focus();
      return;
    }
    document.getElementById('login-overlay').classList.remove('show');
    document.getElementById('main-shell').style.display='grid';
    document.getElementById('login-pass').value='';
    document.getElementById('login-code').value='';
    loadAll();
  } catch(e) { errEl.textContent=e.message; errEl.style.display='block'; }
  finally { btn?.classList.remove('is-loading'); }
}

async function doLogout(){
  await fetch('/v1/admin/logout', {method:'POST',credentials:'same-origin'});
  showLogin();
}

document.getElementById('login-pass').addEventListener('keydown', function(e){
  if (e.key==='Enter') doLogin();
});
document.getElementById('login-code').addEventListener('keydown', function(e){
  if (e.key==='Enter') doLogin();
});

/* ── utils ─────────────────────────────────────────────────── */
function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function brl(v) { return 'R$ ' + (v||0).toLocaleString('pt-BR'); }
function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt) - Date.now()) / 86400000);
}

/* HTML-escape para conteudo de texto e valores de atributo (title, etc). */
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
/* Escape para valores embutidos em data-onclick="fn('...')": seguro tanto na
   string JS entre aspas simples quanto no atributo HTML entre aspas duplas. */
function escArg(v) {
  return String(v == null ? '' : v)
    .replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PLAN_MAP = { daily:'Diário', monthly:'Mensal', lifetime:'Vitalício' };
const PLAN_MAP_REV = { 'Diário':'daily', 'Mensal':'monthly', 'Vitalício':'lifetime' };

function toast(msg, type='ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = 'toast', 2800);
}

function openModal(id) {
  document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function openCreateUser() {
  document.getElementById('cu-email').value = '';
  document.getElementById('cu-name').value = '';
  document.getElementById('cu-err').style.display = 'none';
  document.getElementById('cu-result').style.display = 'none';
  openModal('user-create-overlay');
}

function openCreateCoupon() {
  document.getElementById('f-err').style.display = 'none';
  openModal('coupon-create-overlay');
}

function openAffiliateSettings() {
  document.getElementById('aff-set-err').style.display = 'none';
  openModal('affiliate-settings-overlay');
}

function openCreateAffiliate() {
  ['aff-email','aff-name','aff-coupon','aff-coupon-value','aff-commission','aff-pix'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('aff-err').style.display = 'none';
  document.getElementById('aff-result').style.display = 'none';
  openModal('affiliate-create-overlay');
}

function openPricesModal() {
  openModal('prices-overlay');
  loadPrices();
}

/* ── navigation ─────────────────────────────────────────────── */
const SECTION_META = {
  inicio: { title:'Inicio', desc:'Resumo geral da operacao, receita, clientes e atividade recente.' },
  usuarios: { title:'Usuarios', desc:'Contas, licencas, planos e dispositivos.' },
  eventos: { title:'Eventos', desc:'Auditoria recente de licencas, dispositivos e automacoes.' },
  pagamentos: { title:'Pagamentos', desc:'Vendas, cupons aplicados, afiliados e status de comissao.' },
  cupons: { title:'Cupons', desc:'Descontos comuns e cupons vinculados a afiliados.' },
  afiliados: { title:'Afiliados', desc:'Cadastro, aprovacao, PIX e regras de comissao dos afiliados.' },
  saques: { title:'Saques', desc:'Solicitacoes de saque e controle manual de pagamentos PIX.' },
  produtos: { title:'Produtos', desc:'Configuracao dos valores dos planos vendidos na landing.' },
};

function switchTab(name) {
  document.querySelectorAll('.side-link').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  const meta = SECTION_META[name] || SECTION_META.inicio;
  document.getElementById('section-title').textContent = meta.title;
  document.getElementById('section-desc').textContent = meta.desc;
  if (['inicio','usuarios','eventos','cupons','afiliados','saques'].includes(name)) loadAll();
}

/* ── badges ────────────────────────────────────────────────── */
function planBadgeHtml(planType, status) {
  if (!planType) return '<span class="badge no-plan">Sem plano</span>';
  const name = PLAN_MAP[planType] || planType;
  const cls = name === 'Vitalício' ? 'vitalicio' : (status === 'active' ? 'active' : (status==='revoked'?'expired':'inactive'));
  return `<span class="badge ${cls}">${name}</span>`;
}
function statusBadge(s) {
  const labels = { completed:'✓ pago', pending:'⏳ aguardando', failed:'✗ falhou' };
  return `<span class="badge ${s}">${labels[s] || s}</span>`;
}
function affiliateStatusBadge(s) {
  const labels = { active:'Ativo', pending:'Pendente', inactive:'Inativo' };
  const cls = s === 'active' ? 'active' : (s === 'pending' ? 'pending' : 'inactive');
  return `<span class="badge ${cls}">${labels[s] || s}</span>`;
}
function commissionStatusBadge(s) {
  const labels = { available:'Disponivel', requested:'Em saque', paid:'Pago' };
  const cls = s === 'paid' || s === 'available' ? 'completed' : 'pending';
  return `<span class="badge ${cls}">${labels[s] || s}</span>`;
}
function payoutStatusBadge(s) {
  const labels = { requested:'Solicitado', approved:'Aprovado', paid:'Pago', rejected:'Rejeitado' };
  const cls = s === 'paid' ? 'completed' : (s === 'rejected' ? 'failed' : 'pending');
  return `<span class="badge ${cls}">${labels[s] || s}</span>`;
}
function licenseStatusBadge(status) {
  const labels = { active:'● Ativa', inactive:'○ Inativa', revoked:'✕ Revogada', expired:'⏱ Expirada' };
  const cls = status === 'active' ? 'active' : (status === 'revoked' ? 'expired' : 'inactive');
  return `<span class="badge ${cls}">${labels[status]||status}</span>`;
}
function expiryCellFromData(planType, expiresAt, status) {
  if (!planType) return '—';
  if (planType === 'lifetime' && !expiresAt) return '<span style="color:#c084fc">∞ Vitalício</span>';
  if (status === 'expired' || status === 'revoked') return '<span style="color:#ff6060">' + (status==='revoked'?'Revogada':'Expirada') + '</span>';
  if (!expiresAt) return '<span style="color:#c084fc">∞ Vitalício</span>';
  const d = daysLeft(expiresAt);
  if (d === null || d < 0) return '<span style="color:#ff6060">Expirada</span>';
  const color = d <= 3 ? '#facc15' : '#aaa';
  return `<span style="color:${color}">${d}d restantes</span>`;
}
function discountBadge(type, value) {
  return `<span class="badge ${type}">${type === 'percent' ? value + '%' : 'R$ ' + value}</span>`;
}
function toggleSwitch(code, active) {
  return `<label class="toggle" title="${active ? 'Desativar' : 'Ativar'}" data-onclick="toggleCoupon('${escArg(code)}',${!active})">
    <input type="checkbox" ${active ? 'checked' : ''} data-onclick="event.preventDefault()"/>
    <div class="toggle-track"></div>
    <div class="toggle-thumb"></div>
  </label>`;
}

/* ── data ──────────────────────────────────────────────────── */
let _stats = null, _coupons = null, _licenses = null, _events = null, _affiliateData = null;

function setSyncing(on){
  const card = document.querySelector('.side-card');
  if (!card) return;
  card.classList.toggle('syncing', !!on);
}

async function loadAll() {
  setSyncing(true);
  try {
    const [sr, cr, ar, lr, er] = await Promise.all([
      fetch('/v1/admin/stats', {credentials:'same-origin'}),
      fetch('/v1/admin/coupons', {credentials:'same-origin'}),
      fetch('/v1/admin/affiliates', {credentials:'same-origin'}),
      fetch('/v1/admin/licenses', {credentials:'same-origin'}),
      fetch('/v1/admin/events', {credentials:'same-origin'}),
    ]);
    if (sr.status === 401) { doLogout(); return; }
    if (!sr.ok) { toast('Erro ao carregar dados', 'err'); return; }
    _stats   = await sr.json();
    _coupons = cr.ok ? (await cr.json()).coupons : [];
    _affiliateData = ar.ok ? await ar.json() : null;
    _licenses = lr.ok ? (await lr.json()).licenses : [];
    _events = er.ok ? (await er.json()).events : [];

    document.getElementById('s-users').textContent    = _stats.totalUsers;
    document.getElementById('s-active').textContent   = _stats.activeSubscriptions;
    document.getElementById('s-revenue').textContent  = brl(_stats.revenue);
    document.getElementById('s-discounts').textContent = brl(_stats.discountsGiven || 0);
    document.getElementById('updated').textContent    = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR');

    if (_affiliateData?.settings) {
      document.getElementById('aff-set-commission').value = _affiliateData.settings.defaultAffiliateCommissionPercent ?? 20;
      document.getElementById('aff-set-min').value = _affiliateData.settings.minimumPayoutAmount ?? 50;
    }

    renderHome(); renderUsuarios(); renderEvents(); renderPayments(); renderCoupons(); renderAffiliates(); renderPayouts();
  } catch(e) { console.error(e); toast('Erro ao carregar: ' + e.message, 'err'); }
  finally { setSyncing(false); }
}

function renderUsuarios() {
  const tu = document.getElementById('tbody-usuarios');
  if (!tu) return;
  const users = _stats?.users || [];
  const statsLicenses = _stats?.licenses || [];
  const detailedLicenses = _licenses || [];
  if (!users.length) {
    tu.innerHTML = '<tr><td colspan="8"><div class="empty">Nenhum usuario cadastrado</div></td></tr>';
    return;
  }
  const licByEmail = {};
  statsLicenses.forEach(l => { licByEmail[l.email] = l; });
  detailedLicenses.forEach(l => { licByEmail[l.email] = l; });
  tu.innerHTML = users.map(u => {
    const lic = licByEmail[u.email];
    const planType = lic?.planType || '';
    const status = lic?.effectiveStatus || '';
    const deviceCell = lic?.device
      ? `<span style="color:#4ade80;font-size:11px" title="${esc(lic.device.deviceLabel)}">${lic.device.id.slice(0,8)}…</span>`
      : '<span style="color:#333">—</span>';
    let actions = '';
    if (lic?.id) {
      actions = `
        <button class="btn btn-ghost" style="font-size:11px" data-onclick="openAssign('${escArg(u.email)}','${escArg(lic.id)}','${escArg(planType)}')">Editar plano</button>
        <button class="btn btn-green" style="font-size:11px" data-onclick="copyKey('${escArg(lic.id)}')">Copiar</button>
        <button class="btn btn-ghost" style="font-size:11px" data-onclick="resetDevice('${escArg(lic.id)}')">Reset</button>
        <button class="btn btn-red" style="font-size:11px" data-onclick="confirmRevoke('${escArg(lic.id)}','${escArg(u.email)}')">Revogar</button>`;
    } else {
      actions = `<button class="btn btn-ghost" style="font-size:11px" data-onclick="openAssign('${escArg(u.email)}','','')">+ Atribuir</button>`;
    }
    actions += `<button class="btn btn-red" style="font-size:11px" data-onclick="deleteUser('${escArg(u.email)}')">Apagar</button>`;
    return `<tr>
      <td>${esc(u.name) || '—'}</td>
      <td style="color:#aaa">${esc(u.email)}</td>
      <td>${planBadgeHtml(planType, status)}</td>
      <td>${lic ? licenseStatusBadge(status) : '<span style="color:#555">—</span>'}</td>
      <td>${lic ? expiryCellFromData(planType, lic.expiresAt, status) : '—'}</td>
      <td>${deviceCell}</td>
      <td style="color:#555">${fmt(u.createdAt)}</td>
      <td><div class="act-cell" style="flex-wrap:wrap">${actions}</div></td>
    </tr>`;
  }).join('');
}

function renderHome() {
  const payments = _stats?.payments || [];
  const licenses = _stats?.licenses || [];
  const coupons = _coupons || [];
  const affiliates = _affiliateData?.affiliates || [];
  const payouts = _affiliateData?.payouts || [];
  const sales = _affiliateData?.sales || [];
  const settings = _affiliateData?.settings || {};
  const openCommission = sales
    .filter(s => s.commissionStatus === 'available')
    .reduce((sum, s) => sum + (s.commissionAmount || 0), 0);
  const requestedPayouts = payouts.filter(p => p.status === 'requested' || p.status === 'approved');

  document.getElementById('home-payments').textContent = payments.length;
  document.getElementById('home-licenses').textContent = licenses.length;
  document.getElementById('home-coupons').textContent = coupons.length;
  document.getElementById('home-affiliates').textContent = affiliates.length;
  document.getElementById('home-aff-rate').textContent = `${settings.defaultAffiliateCommissionPercent ?? 20}%`;
  document.getElementById('home-min-payout').textContent = brl(settings.minimumPayoutAmount ?? 50);
  document.getElementById('home-payouts').textContent = requestedPayouts.length;
  document.getElementById('home-commissions').textContent = brl(openCommission);
  renderCharts();
}

function eventTypeBadge(type) {
  const normalized = String(type || 'evento');
  const lower = normalized.toLowerCase();
  const cls = lower.includes('revok') || lower.includes('fail') || lower.includes('erro') || lower.includes('denied')
    ? 'failed'
    : (lower.includes('activ') || lower.includes('renew') || lower.includes('create') ? 'completed' : 'pending');
  return `<span class="badge ${cls}">${esc(normalized)}</span>`;
}

function metadataCell(metadata) {
  if (!metadata || typeof metadata !== 'object') return '<span style="color:#333">—</span>';
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (!entries.length) return '<span style="color:#333">—</span>';
  return entries.slice(0, 4).map(([key, value]) => {
    const shown = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `<span class="token">${esc(key)}=${esc(shown).slice(0, 72)}</span>`;
  }).join(' ');
}

function renderEvents() {
  const te = document.getElementById('tbody-events');
  if (!te) return;
  const events = _events || [];
  if (!events.length) {
    te.innerHTML = '<tr><td colspan="5"><div class="empty">Nenhum evento registrado</div></td></tr>';
    return;
  }
  te.innerHTML = events.map((event) => `
    <tr>
      <td>${eventTypeBadge(event.type)}</td>
      <td style="color:#ddd">${esc(event.message || '—')}</td>
      <td class="token">${event.licenseId ? esc(event.licenseId).slice(0, 12) + '…' : '—'}</td>
      <td>${metadataCell(event.metadata)}</td>
      <td style="color:#555">${fmt(event.createdAt)}</td>
    </tr>
  `).join('');
}

/* ── license actions ────────────────────────────────────────── */
function renderPayments() {
  const tp = document.getElementById('tbody-payments');
  const payments = _stats?.payments || [];
  if (!payments.length) {
    tp.innerHTML = '<tr><td colspan="9"><div class="empty">Nenhum pagamento registrado</div></td></tr>';
    return;
  }
  tp.innerHTML = payments.map(p => {
    const discount = (p.baseAmount && p.finalAmount && p.baseAmount !== p.finalAmount)
      ? `<span style="color:#888;text-decoration:line-through;margin-right:4px">${brl(p.baseAmount)}</span>${brl(p.finalAmount)}`
      : brl(p.finalAmount ?? p.amount);
    const couponCell = p.couponCode
      ? `<span class="badge active" style="font-family:monospace">${esc(p.couponCode)}</span>`
      : '<span style="color:#333">—</span>';
    const affiliateCell = p.affiliateEmail
      ? `<span style="color:#c084fc">${esc(p.affiliateEmail)}</span>`
      : '<span style="color:#333">—</span>';
    const commissionCell = p.commissionAmount
      ? `<span class="money-ok">${brl(p.commissionAmount)}</span><div style="margin-top:3px">${commissionStatusBadge(p.commissionStatus || 'available')}</div>`
      : '<span style="color:#333">—</span>';
    return `<tr>
      <td class="token">${(p.id||'').slice(0,8)}…</td>
      <td style="color:#aaa">${esc(p.email)}</td>
      <td>${esc(p.plan) || '—'}</td>
      <td>${discount}</td>
      <td>${couponCell}</td>
      <td>${affiliateCell}</td>
      <td>${commissionCell}</td>
      <td>${statusBadge(p.status)}</td>
      <td style="color:#555">${fmt(p.createdAt)}</td>
    </tr>`;
  }).join('');
}

function renderCoupons() {
  const tc = document.getElementById('tbody-coupons');
  // A aba Cupons mostra somente promocoes gerais (sem afiliado). Cupons de afiliado
  // sao geridos por linha na aba Afiliados.
  const coupons = (_coupons || []).filter(c => !c.affiliateEmail);
  if (!coupons.length) {
    tc.innerHTML = '<tr><td colspan="7"><div class="empty">Nenhuma promoção geral criada ainda</div></td></tr>';
    return;
  }
  tc.innerHTML = coupons.map(c => `
    <tr>
      <td><span style="font-family:monospace;font-weight:600;color:#e5e5e5;letter-spacing:.05em">${esc(c.code)}</span></td>
      <td style="color:#aaa">${esc(c.affiliate)}</td>
      <td>${discountBadge(c.type, c.value)}</td>
      <td><b>${c.uses || 0}</b> <span style="color:#555">uso${(c.uses||0)!==1?'s':''}</span></td>
      <td>${toggleSwitch(c.code, c.active)}</td>
      <td style="color:#555">${fmt(c.createdAt)}</td>
      <td>
        <div class="act-cell">
          <button class="btn btn-ghost" data-onclick="openEditCoupon('${escArg(c.code)}','${escArg(c.affiliate)}','${escArg(c.type)}',${Number(c.value)})">Editar</button>
          <button class="btn btn-red" data-onclick="deleteCoupon('${escArg(c.code)}')">Deletar</button>
        </div>
      </td>
    </tr>`).join('');
}

function renderAffiliates() {
  const ta = document.getElementById('tbody-affiliates');
  const affiliates = _affiliateData?.affiliates || [];
  const sales = _affiliateData?.sales || [];
  if (!affiliates.length) {
    ta.innerHTML = '<tr><td colspan="9"><div class="empty">Nenhum afiliado cadastrado ainda</div></td></tr>';
    return;
  }
  const defaultRate = _affiliateData?.settings?.defaultAffiliateCommissionPercent ?? 20;
  const couponByCode = {};
  (_coupons || []).forEach(c => { couponByCode[c.code] = c; });
  ta.innerHTML = affiliates.map(a => {
    const affSales = sales.filter(s => s.affiliateEmail === a.email || s.couponCode === a.couponCode);
    const completed = affSales.filter(s => s.status === 'completed');
    const available = affSales
      .filter(s => s.commissionStatus === 'available')
      .reduce((sum, s) => sum + (s.commissionAmount || 0), 0);
    const coup = couponByCode[a.couponCode] || {};
    return `<tr class="aff-row">
      <td>${esc(a.name)}</td>
      <td class="link-cell">${esc(a.email)}</td>
      <td><span class="badge active" style="font-family:monospace">${esc(a.couponCode)}</span></td>
      <td>${a.commissionPercent ?? defaultRate}%</td>
      <td class="link-cell">${esc(a.pixKey) || '—'}</td>
      <td>${affiliateStatusBadge(a.status)}</td>
      <td><b>${completed.length}</b></td>
      <td class="money-ok">${brl(available)}</td>
      <td>
        <div class="act-cell wrap">
          <button class="btn btn-ghost" data-onclick="updateAffiliateStatus('${escArg(a.email)}','${a.status === 'active' ? 'inactive' : 'active'}')">${a.status === 'active' ? 'Desativar' : 'Ativar'}</button>
          <button class="btn btn-ghost" data-onclick="openEditAffiliateCoupon('${escArg(a.email)}','${escArg(a.couponCode)}','${escArg(coup.type || 'percent')}',${Number(coup.value ?? 0)})">Cupom</button>
          <button class="btn btn-ghost" data-onclick="editAffiliateCommission('${escArg(a.email)}', ${Number(a.commissionPercent ?? defaultRate)})">Comissao</button>
          <button class="btn btn-ghost" data-onclick="editAffiliatePix('${escArg(a.email)}', '${escArg(a.pixKey)}')">PIX</button>
          <button class="btn btn-red" data-onclick="resetAffiliatePassword('${escArg(a.email)}')">Reset senha</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderPayouts() {
  const tp = document.getElementById('tbody-payouts');
  const payouts = _affiliateData?.payouts || [];
  if (!tp) return;
  if (!payouts.length) {
    tp.innerHTML = '<tr><td colspan="8"><div class="empty">Nenhum saque solicitado ainda</div></td></tr>';
    return;
  }
  tp.innerHTML = payouts.map(p => `
    <tr>
      <td class="token">${(p.id || '').slice(0,8)}…</td>
      <td class="link-cell">${esc(p.affiliateEmail)}</td>
      <td class="${p.status === 'paid' ? 'money-ok' : 'money-warn'}">${brl(p.amount)}</td>
      <td>${payoutStatusBadge(p.status)}</td>
      <td class="link-cell">${esc(p.pixKey)}</td>
      <td>${p.paymentIds?.length || 0}</td>
      <td style="color:#555">${fmt(p.requestedAt)}</td>
      <td>
        <div class="act-cell wrap">
          <button class="btn btn-ghost" data-onclick="mutatePayout('${escArg(p.id)}','approve')">Aprovar</button>
          <button class="btn btn-green" data-onclick="mutatePayout('${escArg(p.id)}','mark-paid')">Pago</button>
          <button class="btn btn-red" data-onclick="mutatePayout('${escArg(p.id)}','reject')">Rejeitar</button>
        </div>
      </td>
    </tr>`).join('');
}

async function createUser() {
  const email = document.getElementById('cu-email').value.trim();
  const name = document.getElementById('cu-name').value.trim();
  const errEl = document.getElementById('cu-err');
  errEl.style.display = 'none';
  if (!email) { errEl.textContent = 'Informe o e-mail.'; errEl.style.display='block'; return; }
  try {
    const r = await fetch('/v1/admin/users', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'same-origin',
      body: JSON.stringify({ email, name: name || undefined })
    });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || 'Erro'; errEl.style.display='block'; return; }
    document.getElementById('cu-password').textContent = d.generatedPassword;
    document.getElementById('cu-result').style.display = 'block';
    toast('Usuario criado: ' + email);
    await loadAll();
  } catch(e) { errEl.textContent = e.message; errEl.style.display='block'; }
}

function copyGeneratedPassword() {
  const pw = document.getElementById('cu-password').textContent;
  navigator.clipboard.writeText(pw).then(
    () => toast('Senha copiada'),
    () => toast('Erro ao copiar', 'err')
  );
}

async function copyKey(licenseId) {
  try {
    const r = await fetch('/v1/admin/licenses/' + encodeURIComponent(licenseId), {credentials:'same-origin'});
    if (!r.ok) { toast('Erro ao buscar licença', 'err'); return; }
    const body = await r.json();
    const key = body?.license?.keyFull || body?.license?.licenseKey || body?.license?.keyPartial;
    if (!key) { toast('Chave indisponível', 'err'); return; }
    try {
      await navigator.clipboard.writeText(key);
      toast('Chave copiada para a área de transferência');
    } catch {
      toast('Não foi possível copiar', 'err');
    }
  } catch(e) { toast(e.message, 'err'); }
}

let _confirmCallback = null;

function confirmRevoke(licenseId, email) {
  document.getElementById('confirm-msg').textContent = 'Revogar licença de ' + email + '? O usuário perderá o acesso.';
  _confirmCallback = async () => {
    try {
      const r = await fetch('/v1/admin/licenses/' + encodeURIComponent(licenseId) + '/revoke', {method:'POST',credentials:'same-origin'});
      if (!r.ok) { const d = await r.json(); toast(d.error || 'Erro', 'err'); return; }
      toast('Licença revogada');
      closeConfirm();
      await loadAll();
    } catch(e) { toast(e.message, 'err'); }
  };
  document.getElementById('confirm-btn').onclick = _confirmCallback;
  document.getElementById('confirm-overlay').style.display = 'flex';
}

function closeConfirm() {
  document.getElementById('confirm-overlay').style.display = 'none';
  _confirmCallback = null;
}
document.getElementById('confirm-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeConfirm();
});

async function resetDevice(licenseId) {
  try {
    const r = await fetch('/v1/admin/licenses/' + encodeURIComponent(licenseId) + '/reset-device', {method:'POST',credentials:'same-origin'});
    if (!r.ok) { const d = await r.json(); toast(d.error || 'Erro', 'err'); return; }
    toast('Device resetado. Nova ativação será permitida.');
    await loadAll();
  } catch(e) { toast(e.message, 'err'); }
}


/* ── coupon actions ─────────────────────────────────────────── */
async function createCoupon() {
  const code      = document.getElementById('f-code').value.trim().toUpperCase();
  const affiliate = document.getElementById('f-affiliate').value.trim(); // rótulo/descrição (opcional)
  const type      = document.getElementById('f-type').value;
  const value     = Number(document.getElementById('f-value').value);
  const errEl     = document.getElementById('f-err');

  errEl.style.display = 'none';
  if (!code || !value) {
    errEl.textContent = 'Preencha código e desconto.';
    errEl.style.display = 'block'; return;
  }

  try {
    const r = await fetch('/v1/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials:'same-origin',
      body: JSON.stringify({ code, affiliate: affiliate || undefined, type, value }),
    });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error; errEl.style.display='block'; return; }

    ['f-code','f-affiliate','f-value'].forEach(id => document.getElementById(id).value = '');
    errEl.style.display = 'none';
    closeModal('coupon-create-overlay');
    toast(`Cupom ${code} criado com sucesso`);
    await loadAll();
  } catch(e) { errEl.textContent = e.message; errEl.style.display='block'; }
}

async function toggleCoupon(code, active) {
  try {
    await fetch('/v1/admin/coupons/' + encodeURIComponent(code), {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      credentials:'same-origin',
      body: JSON.stringify({ active }),
    });
    toast(`${code} ${active ? 'ativado' : 'desativado'}`);
    await loadAll();
  } catch(e) { toast(e.message, 'err'); }
}

let _editCode = '';

function openEditCoupon(code, affiliate, type, value) {
  _editCode = code;
  document.getElementById('edit-coupon-code-label').textContent = code;
  document.getElementById('edit-affiliate').value = affiliate;
  document.getElementById('edit-type').value = type;
  document.getElementById('edit-value').value = value;
  document.getElementById('edit-coupon-err').style.display = 'none';
  document.getElementById('edit-coupon-overlay').style.display = 'flex';
}

function closeEditCoupon() {
  document.getElementById('edit-coupon-overlay').style.display = 'none';
}

async function saveEditCoupon() {
  const affiliate = document.getElementById('edit-affiliate').value.trim();
  const type      = document.getElementById('edit-type').value;
  const value     = Number(document.getElementById('edit-value').value);
  const errEl     = document.getElementById('edit-coupon-err');

  if (!affiliate || !value) { errEl.textContent = 'Preencha todos os campos.'; errEl.style.display='block'; return; }
  errEl.style.display = 'none';

  try {
    const r = await fetch('/v1/admin/coupons/' + encodeURIComponent(_editCode), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials:'same-origin',
      body: JSON.stringify({ affiliate, value, type }),
    });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error; errEl.style.display='block'; return; }
    closeEditCoupon();
    toast(`Cupom ${_editCode} atualizado`);
    await loadAll();
  } catch(e) { errEl.textContent = e.message; errEl.style.display='block'; }
}

document.getElementById('edit-coupon-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEditCoupon();
});

async function deleteCoupon(code) {
  if (!confirm(`Deletar o cupom "${code}"? Esta ação não pode ser desfeita.`)) return;
  try {
    const r = await fetch('/v1/admin/coupons/' + encodeURIComponent(code), { method: 'DELETE', credentials:'same-origin' });
    if (!r.ok) { const d = await r.json(); toast(d.error, 'err'); return; }
    toast(`Cupom ${code} deletado`);
    await loadAll();
  } catch(e) { toast(e.message,'err'); }
}

/* ── input: uppercase automático ───────────────────────────── */
async function createAffiliate() {
  const email = document.getElementById('aff-email').value.trim();
  const name = document.getElementById('aff-name').value.trim();
  const couponCode = document.getElementById('aff-coupon').value.trim().toUpperCase();
  const couponValue = Number(document.getElementById('aff-coupon-value').value || 10);
  const commissionPercent = document.getElementById('aff-commission').value
    ? Number(document.getElementById('aff-commission').value)
    : undefined;
  const pixKey = document.getElementById('aff-pix').value.trim();
  const errEl = document.getElementById('aff-err');
  errEl.style.display = 'none';
  if (!email || !couponCode || !couponValue) {
    errEl.textContent = 'Informe e-mail, cupom e desconto.';
    errEl.style.display = 'block';
    return;
  }
  try {
    const r = await fetch('/v1/admin/affiliates', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      credentials:'same-origin',
      body: JSON.stringify({
        email,
        name: name || undefined,
        couponCode,
        couponType: 'percent',
        couponValue,
        commissionPercent,
        pixKey: pixKey || undefined,
        status: 'active'
      })
    });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || 'Erro'; errEl.style.display='block'; return; }
    ['aff-email','aff-name','aff-coupon','aff-coupon-value','aff-commission','aff-pix'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('aff-password').textContent = d.generatedPassword;
    document.getElementById('aff-result').style.display = 'block';
    toast('Afiliado criado: ' + email);
    await loadAll();
  } catch(e) { errEl.textContent = e.message; errEl.style.display='block'; }
}

function copyAffiliatePassword() {
  const pw = document.getElementById('aff-password').textContent;
  navigator.clipboard.writeText(pw).then(() => toast('Senha copiada'), () => toast('Erro ao copiar', 'err'));
}

/* ── cupom do afiliado (editado pelo cadastro do afiliado) ───── */
let _affCouponEmail = '';
function openEditAffiliateCoupon(email, code, type, value) {
  _affCouponEmail = email;
  document.getElementById('aff-coupon-email-label').textContent = email;
  document.getElementById('aff-edit-coupon-code').value = code;
  document.getElementById('aff-edit-coupon-type').value = type;
  document.getElementById('aff-edit-coupon-value').value = value;
  document.getElementById('aff-edit-coupon-err').style.display = 'none';
  document.getElementById('aff-edit-coupon-overlay').style.display = 'flex';
}

function closeEditAffiliateCoupon() {
  document.getElementById('aff-edit-coupon-overlay').style.display = 'none';
}

async function saveEditAffiliateCoupon() {
  const couponCode = document.getElementById('aff-edit-coupon-code').value.trim().toUpperCase();
  const couponType = document.getElementById('aff-edit-coupon-type').value;
  const couponValue = Number(document.getElementById('aff-edit-coupon-value').value);
  const errEl = document.getElementById('aff-edit-coupon-err');
  if (!couponCode || Number.isNaN(couponValue)) { errEl.textContent = 'Preencha código e desconto.'; errEl.style.display='block'; return; }
  errEl.style.display = 'none';
  try {
    const r = await fetch('/v1/admin/affiliates/' + encodeURIComponent(_affCouponEmail), {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      credentials:'same-origin',
      body: JSON.stringify({ couponCode, couponType, couponValue })
    });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || 'Erro'; errEl.style.display='block'; return; }
    closeEditAffiliateCoupon();
    toast('Cupom do afiliado atualizado');
    await loadAll();
  } catch(e) { errEl.textContent = e.message; errEl.style.display='block'; }
}

async function resetAffiliatePassword(email) {
  if (!confirm(`Gerar nova senha para ${email}? A senha atual deixará de funcionar.`)) return;
  try {
    const r = await fetch('/v1/admin/affiliates/' + encodeURIComponent(email) + '/reset-password', { method: 'POST', credentials:'same-origin' });
    const d = await r.json();
    if (!r.ok) { toast(d.error || 'Erro', 'err'); return; }
    document.getElementById('aff-reset-email-label').textContent = email;
    document.getElementById('aff-reset-password').textContent = d.generatedPassword;
    document.getElementById('aff-reset-overlay').style.display = 'flex';
  } catch(e) { toast(e.message, 'err'); }
}

function copyResetPassword() {
  const pw = document.getElementById('aff-reset-password').textContent;
  navigator.clipboard.writeText(pw).then(() => toast('Senha copiada'), () => toast('Erro ao copiar', 'err'));
}

async function saveAffiliateSettings() {
  const errEl = document.getElementById('aff-set-err');
  const defaultAffiliateCommissionPercent = Number(document.getElementById('aff-set-commission').value);
  const minimumPayoutAmount = Number(document.getElementById('aff-set-min').value);
  errEl.style.display = 'none';
  if (Number.isNaN(defaultAffiliateCommissionPercent) || Number.isNaN(minimumPayoutAmount) || minimumPayoutAmount < 1) {
    errEl.textContent = 'Informe valores validos.';
    errEl.style.display = 'block';
    return;
  }
  try {
    const r = await fetch('/v1/admin/affiliate-settings', {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      credentials:'same-origin',
      body: JSON.stringify({ defaultAffiliateCommissionPercent, minimumPayoutAmount })
    });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || 'Erro'; errEl.style.display='block'; return; }
    closeModal('affiliate-settings-overlay');
    toast('Regras de afiliado atualizadas');
    await loadAll();
  } catch(e) { errEl.textContent = e.message; errEl.style.display='block'; }
}

async function updateAffiliateStatus(email, status) {
  try {
    const r = await fetch('/v1/admin/affiliates/' + encodeURIComponent(email), {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      credentials:'same-origin',
      body: JSON.stringify({ status })
    });
    const d = await r.json();
    if (!r.ok) { toast(d.error || 'Erro', 'err'); return; }
    toast(status === 'active' ? 'Afiliado ativado' : 'Afiliado desativado');
    await loadAll();
  } catch(e) { toast(e.message, 'err'); }
}

async function editAffiliateCommission(email, current) {
  const value = prompt('Comissao percentual', String(current ?? ''));
  if (value === null) return;
  const commissionPercent = value.trim() ? Number(value) : null;
  if (commissionPercent !== null && (Number.isNaN(commissionPercent) || commissionPercent < 0 || commissionPercent > 100)) {
    toast('Comissao invalida', 'err');
    return;
  }
  try {
    const r = await fetch('/v1/admin/affiliates/' + encodeURIComponent(email), {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      credentials:'same-origin',
      body: JSON.stringify({ commissionPercent })
    });
    const d = await r.json();
    if (!r.ok) { toast(d.error || 'Erro', 'err'); return; }
    toast('Comissao atualizada');
    await loadAll();
  } catch(e) { toast(e.message, 'err'); }
}

async function editAffiliatePix(email, current) {
  const pixKey = prompt('Chave PIX', current || '');
  if (pixKey === null) return;
  try {
    const r = await fetch('/v1/admin/affiliates/' + encodeURIComponent(email), {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      credentials:'same-origin',
      body: JSON.stringify({ pixKey: pixKey.trim() || null })
    });
    const d = await r.json();
    if (!r.ok) { toast(d.error || 'Erro', 'err'); return; }
    toast('PIX atualizado');
    await loadAll();
  } catch(e) { toast(e.message, 'err'); }
}

async function mutatePayout(id, action) {
  const labels = { approve:'aprovado', 'mark-paid':'marcado como pago', reject:'rejeitado' };
  try {
    const r = await fetch('/v1/admin/affiliate-payouts/' + encodeURIComponent(id) + '/' + action, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      credentials:'same-origin',
      body: JSON.stringify({})
    });
    const d = await r.json();
    if (!r.ok) { toast(d.error || 'Erro', 'err'); return; }
    toast('Saque ' + (labels[action] || 'atualizado'));
    await loadAll();
  } catch(e) { toast(e.message, 'err'); }
}

document.getElementById('f-code').addEventListener('input', function() {
  this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
});
document.getElementById('aff-coupon').addEventListener('input', function() {
  this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
});
document.querySelectorAll('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal(overlay.id);
  });
});

/* ── Esc fecha qualquer modal aberto ────────────────────────── */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    if (overlay.style.display === 'flex') closeModal(overlay.id);
  });
  const editCoupon = document.getElementById('edit-coupon-overlay');
  if (editCoupon && editCoupon.style.display === 'flex') closeEditCoupon();
  const assign = document.getElementById('assign-overlay');
  if (assign && assign.style.display === 'flex') closeAssign();
  const confirmEl = document.getElementById('confirm-overlay');
  if (confirmEl && confirmEl.style.display === 'flex') closeConfirm();
});

/* ── deletar usuário ─────────────────────────────────────────── */
async function deleteUser(email) {
  if (!confirm(`Apagar o usuário "${email}"?\n\nEsta ação remove a conta e invalida todas as sessões.`)) return;
  try {
    const r = await fetch('/v1/admin/users/' + encodeURIComponent(email), { method: 'DELETE', credentials:'same-origin' });
    const d = await r.json();
    if (!r.ok) { toast(d.error, 'err'); return; }
    toast(`Usuário ${email} apagado`);
    await loadAll();
  } catch(e) { toast(e.message, 'err'); }
}

/* ── atribuir plano ─────────────────────────────────────────── */
let _assignEmail = '';
let _assignLicenseId = '';

function openAssign(email, licenseId, currentPlanType) {
  _assignEmail = email;
  _assignLicenseId = licenseId;
  document.getElementById('assign-email-label').textContent = email;
  document.getElementById('assign-err').style.display = 'none';
  document.querySelectorAll('input[name="assign-plan"]').forEach(r => {
    r.checked = r.value === currentPlanType;
  });
  document.getElementById('assign-remove-btn').style.display = licenseId ? 'flex' : 'none';
  document.getElementById('assign-overlay').style.display = 'flex';
}

function closeAssign() {
  document.getElementById('assign-overlay').style.display = 'none';
}

async function confirmAssign() {
  const planType = document.querySelector('input[name="assign-plan"]:checked')?.value;
  const errEl = document.getElementById('assign-err');
  if (!planType) { errEl.textContent = 'Selecione um plano.'; errEl.style.display='block'; return; }
  errEl.style.display = 'none';
  try {
    let r;
    if (_assignLicenseId) {
      // Renovar licença existente
      r = await fetch('/v1/admin/licenses/' + encodeURIComponent(_assignLicenseId) + '/renew', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'same-origin',
        body: JSON.stringify({ planType })
      });
    } else {
      // Criar nova licença
      r = await fetch('/v1/admin/licenses', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'same-origin',
        body: JSON.stringify({ email: _assignEmail, planType })
      });
    }
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || 'Erro'; errEl.style.display='block'; return; }
    closeAssign();
    toast(`Plano atribuído a ${_assignEmail}`);
    await loadAll();
  } catch(e) { errEl.textContent = e.message; errEl.style.display='block'; }
}

async function removePlan() {
  if (!_assignLicenseId) return;
  if (!confirm(`Remover o plano de ${_assignEmail}?`)) return;
  try {
    const r = await fetch('/v1/admin/licenses/' + encodeURIComponent(_assignLicenseId) + '/revoke', {method:'POST',credentials:'same-origin'});
    if (!r.ok) { const d = await r.json(); toast(d.error,'err'); return; }
    closeAssign();
    toast(`Plano removido de ${_assignEmail}`);
    await loadAll();
  } catch(e) { toast(e.message,'err'); }
}

document.getElementById('assign-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeAssign();
});

/* ── preços ─────────────────────────────────────────────────── */
const PLAN_INFO = {
  'Diário':    { desc:'Acesso por 24h', icon:'⏱' },
  'Mensal':    { desc:'Acesso por 30 dias', icon:'📅' },
  'Vitalício': { desc:'Acesso para sempre', icon:'∞' },
};

async function loadPrices() {
  try {
    const r = await fetch('/v1/admin/prices', {credentials:'same-origin'});
    if (r.status === 401) { doLogout(); return; }
    const prices = await r.json();
    const container = document.getElementById('price-fields');
    container.innerHTML = Object.entries(prices).map(([plan, val]) => `
      <div style="display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;background:#0d0d0d;border:1px solid #1f1f1f;border-radius:9px;padding:14px 16px">
        <div>
          <div style="font-size:15px;margin-bottom:2px">${PLAN_INFO[plan]?.icon || ''} <b style="color:#e5e5e5">${plan}</b></div>
          <div style="font-size:11px;color:#555">${PLAN_INFO[plan]?.desc || ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end">
          <span style="color:#555;font-size:13px">R$</span>
          <input
            id="price-${plan}"
            type="number"
            class="form-input"
            value="${val}"
            min="1"
            style="width:90px;text-align:right;font-size:16px;font-weight:700"
          />
        </div>
      </div>
    `).join('');
  } catch(e) { toast('Erro ao carregar preços: ' + e.message, 'err'); }
}

async function savePrices() {
  const plans = ['Diário','Mensal','Vitalício'];
  const updates = {};
  for (const p of plans) {
    const el = document.getElementById('price-' + p);
    if (!el) continue;
    const val = Number(el.value);
    if (!val || val < 1) { toast(`Valor inválido para ${p}`, 'err'); return; }
    updates[p] = val;
  }
  try {
    const r = await fetch('/v1/admin/prices', {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json' },
      credentials:'same-origin',
      body: JSON.stringify(updates),
    });
    const d = await r.json();
    if (!r.ok) { toast(d.error || 'Erro', 'err'); return; }
    closeModal('prices-overlay');
    toast('Preços atualizados com sucesso');
    loadPrices();
  } catch(e) { toast(e.message, 'err'); }
}

/* ── init ───────────────────────────────────────────────────── */
// Check if already logged in
async function init() {
  try {
    const r = await fetch('/v1/admin/me', {credentials:'same-origin'});
    if (r.ok) {
      document.getElementById('login-overlay').classList.remove('show');
      document.getElementById('main-shell').style.display='grid';
      loadAll();
    } else {
      showLogin();
    }
  } catch(e) {
    showLogin();
  }
}
init();
setInterval(loadAll, 30000);

/* ============================================================
   Dashboard charts — pure SVG, no dependencies, CSP-safe.
   ============================================================ */
function renderCharts() {
  try { renderRevenueChart(); renderPlansChart(); } catch (e) { console.error('[admin] charts', e); }
}

function brlShort(v) {
  if (v >= 1000) return 'R$' + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k';
  return 'R$' + Math.round(v);
}

function renderRevenueChart() {
  const mount = document.getElementById('chart-revenue');
  if (!mount) return;
  const completed = (_stats?.payments || []).filter((p) => p.status === 'completed');
  const days = 14;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const keyOf = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const buckets = [];
  const idx = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    idx[keyOf(d)] = buckets.length; buckets.push({ d, v: 0 });
  }
  completed.forEach((p) => {
    const k = keyOf(new Date(p.activatedAt || p.createdAt));
    if (k in idx) buckets[idx[k]].v += (p.finalAmount ?? p.amount ?? 0);
  });
  const vals = buckets.map((b) => b.v);
  const max = Math.max(1, ...vals);
  const total = vals.reduce((a, b) => a + b, 0);
  const W = 520, H = 176, pad = { t: 14, r: 12, b: 26, l: 46 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const X = (i) => pad.l + (buckets.length <= 1 ? 0 : (i / (buckets.length - 1)) * iw);
  const Y = (v) => pad.t + ih - (v / max) * ih;
  const line = buckets.map((b, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(b.v).toFixed(1)}`).join(' ');
  const area = `${line} L${X(buckets.length - 1).toFixed(1)},${(pad.t + ih).toFixed(1)} L${X(0).toFixed(1)},${(pad.t + ih).toFixed(1)} Z`;
  const dots = buckets.map((b, i) => b.v ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(b.v).toFixed(1)}" r="2.6" fill="#ff2020"/>` : '').join('');
  const grid = [0, 0.5, 1].map((t) => {
    const yy = (pad.t + ih - t * ih).toFixed(1);
    return `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="rgba(255,255,255,.06)"/>` +
      `<text x="${pad.l - 8}" y="${(+yy + 3).toFixed(1)}" text-anchor="end" class="ct">${brlShort(max * t)}</text>`;
  }).join('');
  const xlab = buckets.map((b, i) => (i % 3 === 0)
    ? `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="ct">${b.d.getDate()}/${b.d.getMonth() + 1}</text>` : '').join('');
  mount.innerHTML =
    `<div class="chart-total">${brl(total)} <span>nos 14 dias</span></div>` +
    `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="none">` +
    `<defs><linearGradient id="revgrad" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="rgba(255,32,32,.28)"/><stop offset="1" stop-color="rgba(255,32,32,0)"/></linearGradient></defs>` +
    `${grid}<path d="${area}" fill="url(#revgrad)"/>` +
    `<path d="${line}" fill="none" stroke="#ff2020" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
    `${dots}${xlab}</svg>`;
}

function renderPlansChart() {
  const mount = document.getElementById('chart-plans');
  if (!mount) return;
  const lic = _stats?.licenses || [];
  const defs = [['daily', 'Diário'], ['monthly', 'Mensal'], ['lifetime', 'Vitalício']];
  const rows = defs.map(([k, label]) => {
    const all = lic.filter((l) => l.planType === k);
    return { label, active: all.filter((l) => l.effectiveStatus === 'active').length, total: all.length };
  });
  const max = Math.max(1, ...rows.map((r) => r.total));
  mount.innerHTML =
    `<div class="bars">${rows.map((r) => `
      <div class="bar-row">
        <span class="bar-label">${r.label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(r.total / max * 100).toFixed(1)}%">` +
        `<i style="width:${r.total ? (r.active / r.total * 100).toFixed(1) : 0}%"></i></div></div>
        <span class="bar-val">${r.active}<small>/${r.total}</small></span>
      </div>`).join('')}</div>` +
    `<div class="bars-legend"><span><i class="dot active"></i>Ativas</span><span><i class="dot total"></i>Total emitidas</span></div>`;
}

Object.assign(window, {
  closeAssign,
  closeConfirm,
  closeEditAffiliateCoupon,
  closeEditCoupon,
  closeModal,
  confirmAssign,
  confirmRevoke,
  copyAffiliatePassword,
  copyGeneratedPassword,
  copyKey,
  copyResetPassword,
  createAffiliate,
  createCoupon,
  createUser,
  deleteCoupon,
  deleteUser,
  doLogin,
  doLogout,
  editAffiliateCommission,
  editAffiliatePix,
  loadAll,
  mutatePayout,
  openAffiliateSettings,
  openAssign,
  openCreateAffiliate,
  openCreateCoupon,
  openCreateUser,
  openEditAffiliateCoupon,
  openEditCoupon,
  openPricesModal,
  removePlan,
  resetAffiliatePassword,
  resetDevice,
  saveAffiliateSettings,
  saveEditAffiliateCoupon,
  saveEditCoupon,
  savePrices,
  switchTab,
  toggleCoupon,
  updateAffiliateStatus
});

/* ============================================================
   CSP-safe delegated action dispatcher — replaces inline onclick.
   Reads [data-onclick]="fnName(args)" and calls the global function,
   without eval and without inline event-handler attributes.
   ============================================================ */
(function () {
  function parseArgs(s) {
    s = String(s).trim();
    if (!s) return [];
    const out = [];
    let i = 0;
    while (i < s.length) {
      while (i < s.length && (s[i] === ' ' || s[i] === ',')) i++;
      if (i >= s.length) break;
      const ch = s[i];
      if (ch === "'" || ch === '"') {
        let j = i + 1, val = '';
        while (j < s.length) {
          if (s[j] === '\\') { val += s[j + 1] || ''; j += 2; continue; }
          if (s[j] === ch) break;
          val += s[j++];
        }
        out.push(val); i = j + 1;
      } else {
        let j = i;
        while (j < s.length && s[j] !== ',') j++;
        const t = s.slice(i, j).trim();
        out.push(t === 'true' ? true : t === 'false' ? false : t === 'null' ? null
          : (t !== '' && !isNaN(Number(t)) ? Number(t) : t));
        i = j;
      }
    }
    return out;
  }
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-onclick]');
    if (!el) return;
    const expr = el.getAttribute('data-onclick');
    if (!expr) return;
    if (el.tagName === 'A') e.preventDefault();
    if (expr.indexOf('event.preventDefault') === 0) { e.preventDefault(); return; }
    const m = expr.match(/^\s*([A-Za-z_$][\w$]*)\s*\(([\s\S]*)\)\s*$/);
    if (!m) return;
    const fn = window[m[1]];
    if (typeof fn !== 'function') return;
    try { fn.apply(null, parseArgs(m[2])); } catch (err) { console.error('[admin] action failed:', expr, err); }
  });
})();
