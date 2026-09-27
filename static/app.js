// ИТ Школа Ростелеком — CRM (веб-интерфейс)
const state = { token: null, user: null, courses: [], editCourseId: null, editProductId: null,
  sortCfg: { courses: { key: 'end_date', dir: 1 }, projects: { key: 'end_date', dir: 1 } }, cache: { universities: [], directions: [], products: [], statuses: [], users: [] } };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

async function api(path, opts = {}) {
  opts.headers = Object.assign({}, opts.headers, { 'Authorization': 'Bearer ' + state.token });
  if (opts.json !== undefined) {
    opts.method = opts.method || 'POST';
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.json);
    delete opts.json;
  }
  const res = await fetch('/api' + path, opts);
  if (res.status === 401) { logout(); throw new Error('Сессия истекла'); }
  if (!res.ok) {
    let msg = res.status + ' ' + res.statusText;
    try { msg = (await res.json()).detail || msg; } catch (e) {}
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res;
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

function fmtDate(s) { return s ? s.slice(0, 16) : ''; }

const ROLE_NAMES = { user: 'Пользователь (КАМ)', manager: 'Руководитель', admin: 'Администратор' };

// ---------- auth ----------
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').textContent = '';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('login-username').value.trim(), password: $('login-password').value })
    });
    if (!res.ok) throw new Error('Неверный логин или пароль');
    const data = await res.json();
    state.token = data.token;
    state.user = data;
    enterApp();
  } catch (err) { $('login-error').textContent = err.message; }
});

// ---------- соглашение ----------
$('agree-link').addEventListener('click', (e) => { e.preventDefault(); $('modal-agreement').classList.remove('hidden'); });
$('agreement-close').addEventListener('click', () => $('modal-agreement').classList.add('hidden'));
$('modal-agreement').addEventListener('click', (e) => { if (e.target === $('modal-agreement')) $('modal-agreement').classList.add('hidden'); });

// ---------- cookie-баннер и телеметрия cookie ----------
function collectCookieInfo() {
  let count = 0;
  try { count = document.cookie ? document.cookie.split(';').filter(s => s.trim()).length : 0; } catch (e) {}
  let keys = [];
  try { keys = Object.keys(localStorage); } catch (e) {}
  return { cookie_enabled: navigator.cookieEnabled, cookie_count: count, local_keys: keys };
}

async function sendCookieTelemetry() {
  if (!state.token) return;
  try {
    const info = collectCookieInfo();
    await api('/telemetry/cookies', { method: 'POST', json: info });
  } catch (e) { /* ignore */ }
}

function initCookieBanner() {
  const banner = $('cookie-banner');
  if (localStorage.getItem('rtk_cookie_consent') === '1') { banner.classList.add('hidden'); return; }
  banner.classList.remove('hidden');
}

$('cookie-accept').addEventListener('click', async () => {
  localStorage.setItem('rtk_cookie_consent', '1');
  $('cookie-banner').classList.add('hidden');
  if (state.token) {
    try { await api('/cookies/consent', { method: 'POST', body: '' }); } catch (e) {}
    sendCookieTelemetry();
  }
  toast('Согласие на использование cookie сохранено');
});
$('cookie-details-btn').addEventListener('click', () => $('modal-cookies').classList.remove('hidden'));
$('cookies-close').addEventListener('click', () => $('modal-cookies').classList.add('hidden'));
$('modal-cookies').addEventListener('click', (e) => { if (e.target === $('modal-cookies')) $('modal-cookies').classList.add('hidden'); });
initCookieBanner();

function logout() {
  state.token = null; state.user = null;
  $('app').classList.add('hidden');
  $('login-screen').classList.remove('hidden');
}

$('logout-btn').addEventListener('click', logout);

// переключение форм вход/регистрация
$('auth-tab-login').addEventListener('click', () => {
  $('auth-tab-login').classList.add('active');
  $('auth-tab-register').classList.remove('active');
  $('login-form').classList.remove('hidden');
  $('register-form').classList.add('hidden');
});
$('auth-tab-register').addEventListener('click', () => {
  $('auth-tab-register').classList.add('active');
  $('auth-tab-login').classList.remove('active');
  $('register-form').classList.remove('hidden');
  $('login-form').classList.add('hidden');
});

// регистрация по e-mail с подтверждением
$('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').textContent = '';
  $('dev-link-box').classList.add('hidden');
  try {
    if (!$('reg-agree').checked) {
      $('login-error').textContent = 'Для регистрации примите пользовательское соглашение';
      return;
    }
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: $('reg-name').value.trim(),
        email: $('reg-email').value.trim(),
        password: $('reg-password').value,
        agree: true
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Ошибка регистрации');
    $('register-form').classList.add('hidden');
    $('login-form').classList.remove('hidden');
    $('auth-tab-login').classList.add('active');
    $('auth-tab-register').classList.remove('active');
    $('login-username').value = $('reg-email').value.trim();
    const n = $('login-notice');
    n.textContent = data.message;
    n.classList.remove('hidden', 'error-note');
    if (data.dev_confirm_link) {
      $('dev-link-box').classList.remove('hidden');
      const a = $('dev-link');
      a.href = data.dev_confirm_link;
      a.textContent = 'перейти к подтверждению';
    }
  } catch (err) { $('login-error').textContent = err.message; }
});

// подтверждение e-mail по ссылке из письма (#confirm=TOKEN)
(function handleEmailConfirm() {
  if (!location.hash.startsWith('#confirm=')) return;
  const token = location.hash.slice('#confirm='.length);
  history.replaceState(null, '', location.pathname);
  const n = $('login-notice');
  n.classList.remove('hidden');
  fetch('/api/auth/confirm?token=' + encodeURIComponent(token))
    .then(async r => {
      const data = await r.json();
      if (r.ok) {
        n.textContent = data.message;
        n.classList.remove('error-note');
      } else {
        n.textContent = data.detail || 'Ошибка подтверждения';
        n.classList.add('error-note');
      }
    })
    .catch(() => { n.textContent = 'Не удалось связаться с сервером'; n.classList.add('error-note'); });
})();

let sessionStart = Date.now();

async function getBatteryLevel() {
  try { const b = await navigator.getBattery(); return Math.round(b.level * 100); }
  catch (e) { return null; }
}

async function telemetryPing() {
  if (!state.token) return;
  try {
    await api('/telemetry/ping', { method: 'POST', json: {
      battery: await getBatteryLevel(),
      duration: Math.round((Date.now() - sessionStart) / 1000)
    }});
  } catch (e) { /* сессия недоступна — пропускаем */ }
}

function telemetryStart() {
  sessionStart = Date.now();
  telemetryPing();
  sendCookieTelemetry();
  setInterval(telemetryPing, 30000);
}

function fmtDur(sec) {
  sec = Math.round(sec || 0);
  if (sec < 60) return sec + ' сек';
  if (sec < 3600) return Math.floor(sec / 60) + ' мин ' + (sec % 60) + ' сек';
  return Math.floor(sec / 3600) + ' ч ' + Math.floor((sec % 3600) / 60) + ' мин';
}

function enterApp() {
  $('login-screen').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('user-name').textContent = state.user.full_name;
  $('user-role').textContent = ROLE_NAMES[state.user.role] || state.user.role;
  $('tab-admin').classList.toggle('hidden', state.user.role !== 'admin');
  // администратору профиль участника не нужен — управляет платформой
  const profileTab = document.querySelector('.tab[data-tab="profile"]');
  if (profileTab) profileTab.classList.toggle('hidden', state.user.role === 'admin');
  // служебные разделы — только руководитель/администратор
  const isStaff = state.user.role !== 'user';
  ['interactions', 'catalogs', 'reports'].forEach(t => {
    const b = document.querySelector('.tab[data-tab="' + t + '"]');
    if (b) b.classList.toggle('hidden', !isStaff);
  });
  if (!isStaff) {
    // обычному пользователю — «витрина»: стартовая вкладка «Курсы»
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    const coursesTab = document.querySelector('.tab[data-tab="courses"]');
    if (coursesTab) coursesTab.classList.add('active');
    document.querySelectorAll('.tabpage').forEach(p => p.classList.add('hidden'));
    $('tab-courses').classList.remove('hidden');
  }
  loadAll();
  if (state.user.role !== 'admin') loadProfile();
  telemetryStart();
  loadApplications();
}

// ---------- tabs ----------
document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.tabpage').forEach(p => p.classList.add('hidden'));
  $('tab-' + btn.dataset.tab).classList.remove('hidden');
  if (btn.dataset.tab === 'reports') refreshCharts();
}));

// ---------- data loading ----------
async function loadAll() {
  const [unis, dirs, prods, users] = await Promise.all([
    api('/universities'), api('/directions'), api('/products'),
    (state.user.role !== 'user') ? api('/users') : Promise.resolve([])
  ]);
  const wf = (await api('/workflows'))[0];
  const statuses = wf ? await api('/workflows/' + wf.id + '/statuses') : [];
  state.cache = { universities: unis, directions: dirs, products: prods, statuses: statuses, users: users };
  fillFilters(); fillTables(); fillNewForm(); fillAdmin(); renderProjects();
  loadInteractions(); refreshCharts(); loadCourses();
}

function fillSelect(el, items, nameKey, valueKey, keepAll) {
  const cur = el.value;
  let html = keepAll ? '<option value="">— все —</option>' : '';
  items.forEach(it => { html += '<option value="' + it[valueKey] + '">' + esc(it[nameKey]) + '</option>'; });
  el.innerHTML = html;
  if (cur) el.value = cur;
}

function fillFilters() {
  ['f', 'r'].forEach(p => {
    fillSelect($(p + '-university'), state.cache.universities, 'name', 'id', true);
    fillSelect($(p + '-direction'), state.cache.directions, 'name', 'id', true);
    fillSelect($(p + '-product'), state.cache.products, 'name', 'id', true);
    fillSelect($(p + '-status'), state.cache.statuses, 'name', 'id', true);
    fillSelect($(p + '-responsible'), state.cache.users, 'full_name', 'id', true);
  });
}

function fillTables() {
  $('universities-table').querySelector('tbody').innerHTML = state.cache.universities.map(u =>
    '<tr class="no-click"><td>' + esc(u.name) + '</td><td>' + esc(u.software) + '</td><td>' + esc(u.contract_number) + '</td><td>' + esc(u.manager_name) + '</td></tr>').join('');
  $('products-table').querySelector('tbody').innerHTML = state.cache.products.map(p =>
    '<tr class="no-click"><td>' + esc(p.name) + '</td><td>' + esc(p.direction || '') + '</td></tr>').join('');
  $('directions-list').innerHTML = state.cache.directions.map(d =>
    '<li><span>' + esc(d.name) + '</span></li>').join('');
}

function fillNewForm() {
  fillSelect($('ni-university'), state.cache.universities, 'name', 'id', false);
  fillSelect($('ni-product'), state.cache.products, 'name', 'id', true);
  fillSelect($('ni-responsible'), state.cache.users.length ? state.cache.users : [{ id: state.user.user_id, full_name: state.user.full_name }], 'full_name', 'id', false);
}

// ---------- interactions ----------
function filtersToQuery(prefix) {
  const p = [];
  const map = { from: 'from_date', to: 'to_date', university: 'university_id', direction: 'direction_id', product: 'product_id', status: 'status_id', responsible: 'responsible_id' };
  Object.keys(map).forEach(k => {
    const v = $(prefix + '-' + k).value;
    if (v) p.push(map[k] + '=' + encodeURIComponent(v));
  });
  return p.join('&');
}

function progressBar(position, total, extra) {
  const pos = (position == null ? 0 : position) + 1;
  const pct = Math.max(4, Math.round(pos / Math.max(total, 1) * 100));
  return '<div class="progress-wrap" title="Этап ' + pos + ' из ' + total + '">' +
    '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
    '<div class="progress-label">' + (extra || ('Этап ' + pos + ' из ' + total)) + '</div></div>';
}

async function loadInteractions() {
  try {
    const rows = await api('/interactions?' + filtersToQuery('f'));
    const total = Math.max(state.cache.statuses.length, 1);
    $('interactions-table').querySelector('tbody').innerHTML = rows.map(r =>
      '<tr data-id="' + r.id + '">' +
      '<td class="cell-uni"><b>' + esc(r.university) + '</b></td>' +
      '<td>' + esc(r.product || '—') + '</td>' +
      '<td class="muted">' + esc(r.direction || '—') + '</td>' +
      '<td><span class="status-chip">' + esc(r.status || '—') + '</span>' + progressBar(r.status_position, total) + '</td>' +
      '<td>' + esc(r.responsible || '—') + '</td>' +
      '<td class="muted nowrap">' + fmtDate(r.updated_at) + '</td></tr>').join('')
      || '<tr class="no-click"><td colspan="6" class="muted" style="text-align:center;padding:28px">Нет данных по выбранным фильтрам</td></tr>';
  } catch (err) { toast(err.message); }
}

$('interactions-table').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (tr) openDetail(+tr.dataset.id);
});
$('apply-filters').addEventListener('click', loadInteractions);
document.querySelectorAll('#tab-interactions .filters select, #tab-interactions .filters input')
  .forEach(el => el.addEventListener('change', loadInteractions));
$('reset-filters').addEventListener('click', () => {
  document.querySelectorAll('#tab-interactions input, #tab-interactions select').forEach(i => i.value = '');
  loadInteractions();
});

// ---------- detail modal ----------
async function openDetail(id) {
  try {
    const d = await api('/interactions/' + id);
    $('modal-title').textContent = d.university + (d.product ? ' · ' + d.product : '');
    const canManage = state.user.role !== 'user';
    const histHtml = d.history.map(h => {
      const files = d.attachments.filter(a => a.history_id === h.id)
        .map(a => '<a href="/api/attachments/' + a.id + '/download?token=' + state.token + '" target="_blank">📎 ' + esc(a.filename) + '</a>').join('');
      return '<div class="tl-item"><div class="tl-status">' + (h.from_status_name ? esc(h.from_status_name) + ' → ' : '') + esc(h.to_status_name || '') + '</div>' +
        (h.comment ? '<div class="tl-comment">' + esc(h.comment) + '</div>' : '') +
        '<div class="tl-meta">' + esc(h.user_name || '') + ' · ' + fmtDate(h.created_at) + '</div>' +
        (files ? '<div class="tl-files">' + files + '</div>' : '') + '</div>';
    }).join('');

    const totalSt = Math.max(d.available_statuses.length, 1);
    $('modal-body').innerHTML =
      progressBar(d.status_position, totalSt) +
      '<p style="margin-top:10px"><span class="status-chip">' + esc(d.status || '—') + '</span> <span class="muted">направление: ' + esc(d.direction || '—') + '</span></p>' +
      '<h3>История переходов</h3><div class="timeline">' + histHtml + '</div>' +
      '<h3>Перевод в статус</h3>' +
      '<label>Новый статус<select id="tr-status">' + d.available_statuses.map(s =>
        '<option value="' + s.id + '"' + (s.id === d.current_status_id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select></label>' +
      '<label>Комментарий<textarea id="tr-comment" rows="2" style="width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:8px;margin-top:4px" placeholder="Комментарий к переходу (необязательно)"></textarea></label>' +
      '<label>Прикрепить файл (png, jpeg, pdf, zip, gzip, rar, doc, docx, xls, xlsx)<input type="file" id="tr-file"></label>' +
      '<button class="btn btn-primary" id="tr-submit" style="margin-top:10px">Перевести статус</button>' +
      (canManage ? '<h3>Смена ответственного</h3><div class="inline-form"><select id="resp-select">' +
        state.cache.users.map(u => '<option value="' + u.id + '"' + (u.id === d.responsible_id ? ' selected' : '') + '>' + esc(u.full_name) + '</option>').join('') +
        '</select><button class="btn" id="resp-save">Назначить</button></div>' : '');

    $('tr-submit').onclick = async () => {
      try {
        await api('/interactions/' + id + '/transition', { json: { to_status_id: +$('tr-status').value, comment: $('tr-comment').value.trim() } });
        const f = $('tr-file').files[0];
        if (f) {
          const fd = new FormData();
          fd.append('file', f);
          await api('/interactions/' + id + '/attachments', { method: 'POST', body: fd });
        }
        toast('Статус обновлён');
        closeModal(); loadInteractions(); refreshCharts();
      } catch (err) { toast(err.message); }
    };
    const rs = $('resp-save');
    if (rs) rs.onclick = async () => {
      try {
        await api('/interactions/' + id + '/responsible', { method: 'PUT', json: { user_id: +$('resp-select').value } });
        toast('Ответственный назначен'); closeModal(); loadInteractions();
      } catch (err) { toast(err.message); }
    };
    $('modal').classList.remove('hidden');
  } catch (err) { toast(err.message); }
}

function closeModal() { $('modal').classList.add('hidden'); }
$('modal-close').addEventListener('click', closeModal);
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });

// ---------- new interaction ----------
$('btn-new-interaction').addEventListener('click', () => $('modal-new').classList.remove('hidden'));
$('modal-new-close').addEventListener('click', () => $('modal-new').classList.add('hidden'));
$('ni-create').addEventListener('click', async () => {
  $('ni-error').textContent = '';
  const uniVal = $('ni-university').value;
  if (!uniVal) { $('ni-error').textContent = 'Каталог вузов пуст — сначала добавьте вуз (вкладка «Каталоги» → импорт XLSX)'; toast('Не выбран вуз'); return; }
  const btn = $('ni-create');
  btn.disabled = true;
  try {
    await api('/interactions', { json: {
      university_id: +uniVal,
      product_id: $('ni-product').value ? +$('ni-product').value : null,
      responsible_id: $('ni-responsible').value ? +$('ni-responsible').value : null
    }});
    $('modal-new').classList.add('hidden');
    toast('Взаимодействие создано');
    loadInteractions(); refreshCharts();
  } catch (err) {
    $('ni-error').textContent = err.message;
    toast('Ошибка: ' + err.message);
  } finally { btn.disabled = false; }
});

// ---------- catalogs: import, add ----------
$('import-file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const fd = new FormData();
  fd.append('file', f);
  try {
    const res = await api('/catalogs/import', { method: 'POST', body: fd });
    $('import-result').textContent = 'Импорт завершён: создано ' + res.created + ', обновлено ' + res.updated + ', пропущено ' + res.skipped + '.';
    toast('Каталог обновлён');
    loadAll();
  } catch (err) { $('import-result').textContent = err.message; }
});
$('add-direction').addEventListener('click', async () => {
  const name = $('new-direction').value.trim();
  if (!name) return;
  try { await api('/directions', { json: { name } }); $('new-direction').value = ''; loadAll(); toast('Направление добавлено'); }
  catch (err) { toast(err.message); }
});
// цвет дедлайна: зелёный > 7 дней, жёлтый 1–7 дней, красный < 24 ч (последний день) или просрочен
function deadlineChip(start, end) {
  if (!start && !end) return '';
  const label = '📅 ' + esc(start || '…') + ' — ' + esc(end || '…');
  if (!end) return '<span class="course-dates">' + label + '</span>';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(end + 'T00:00:00');
  const days = Math.round((d - today) / 86400000);
  if (days < 1) {
    const txt = days < 0 ? ' · завершён' : ' · последний день!';
    return '<span class="course-dates tag-error" title="До окончания менее 24 часов">' + label + txt + '</span>';
  }
  if (days <= 7)
    return '<span class="course-dates tag-warning" title="До окончания: ' + days + ' дн.">' + label + '</span>';
  return '<span class="course-dates tag-success" title="До окончания: ' + days + ' дн.">' + label + '</span>';
}

// ---------- ИТ-проекты: карточки, детали, форма (manager/admin) ----------
function productCard(p) {
  const letter = (p.name || '?').charAt(0).toUpperCase();
  const photo = p.photo_url
    ? '<div class="course-photo"><img src="' + p.photo_url + '?token=' + state.token + '" alt=""></div>'
    : '<div class="course-photo">' + esc(letter) + '</div>';
  const dates = deadlineChip(p.start_date, p.end_date);
  return '<div class="course-card" data-id="' + p.id + '">' + photo +
    '<div class="course-body"><h4>' + esc(p.name) + '</h4>' +
    '<div class="course-info-row"><span class="tag">' + esc(p.direction || 'Без направления') + '</span>' + dates + '</div>' +
    (p.description ? '<p class="muted" style="margin:8px 0 0">' + esc(p.description.slice(0, 140)) + (p.description.length > 140 ? '…' : '') + '</p>' : '') +
    '</div></div>';
}

function renderProjects() {
  const isStaff = state.user.role !== 'user';
  $('btn-new-product').classList.toggle('hidden', !isStaff);
  const btn2 = $('btn-new-project-2');
  if (btn2) btn2.classList.toggle('hidden', !isStaff);
  const cfg = state.sortCfg.projects;
  const html = sortItems(state.cache.products, cfg.key, cfg.dir, 'name').map(productCard).join('') || '<p class="muted">Проектов пока нет</p>';
  ['products-grid', 'projects-grid'].forEach(gid => {
    const el = $(gid);
    if (!el) return;
    el.innerHTML = html;
    el.querySelectorAll('.course-card').forEach(card =>
      card.addEventListener('click', () => openProduct(+card.dataset.id)));
  });
}

async function openProduct(id) {
  try {
    const pr = await api('/products/' + id);
    $('product-title').textContent = pr.name;
    const letter = (pr.name || '?').charAt(0).toUpperCase();
    const photo = pr.photo_url
      ? '<div class="course-detail-photo"><img src="' + pr.photo_url + '?token=' + state.token + '" alt=""></div>'
      : '<div class="course-detail-photo">' + esc(letter) + '</div>';
    const canManage = state.user.role !== 'user';
    $('product-body').innerHTML = photo +
      '<div class="course-info-row"><span class="tag">' + esc(pr.direction || 'Без направления') + '</span>' +
      deadlineChip(pr.start_date, pr.end_date) + '</div>' +
      '<h3>Описание</h3><div class="course-text">' + esc(pr.description || '—') + '</div>' +
      '<h3>Кто может принимать участие</h3><div class="course-text">' + esc(pr.requirements || '—') + '</div>' +
      (!canManage ? '<div style="margin-top:12px"><button class="btn btn-primary" id="product-participate">🚀 Участвовать</button></div>' : '') +
      (canManage ? '<div style="margin-top:16px;display:flex;gap:8px">' +
        '<button class="btn btn-secondary" id="product-edit">Редактировать</button>' +
        '<button class="btn btn-outline" id="product-delete">Удалить</button></div>' : '');
    $('modal-product').classList.remove('hidden');
    const pp = $('product-participate');
    if (pp) pp.onclick = async () => {
      try {
        const apps = await api('/applications');
        if (!apps.some(a => a.product_id === id)) {
          await api('/applications', { json: { product_id: id, message: 'Заявка на участие в ИТ-проекте' } });
          toast('Заявка оставлена! Следите за статусом во вкладке «Заявки»');
        } else {
          toast('Вы уже подавали заявку на этот проект');
        }
        loadApplications();
      } catch (err) { toast(err.message); }
    };
    const eb = $('product-edit');
    if (eb) eb.onclick = () => { $('modal-product').classList.add('hidden'); openProductForm(pr); };
    const dbt = $('product-delete');
    if (dbt) dbt.onclick = async () => {
      if (!confirm('Удалить ИТ-проект «' + pr.name + '»?')) return;
      try { await api('/products/' + id, { method: 'DELETE' }); toast('ИТ-проект удалён'); closeProductModal(); loadAll(); }
      catch (err) { toast(err.message); }
    };
  } catch (err) { toast(err.message); }
}

function closeProductModal() { $('modal-product').classList.add('hidden'); }
$('product-close').addEventListener('click', closeProductModal);
$('modal-product').addEventListener('click', (e) => { if (e.target === $('modal-product')) closeProductModal(); });

function openProductForm(pr) {
  state.editProductId = pr ? pr.id : null;
  $('product-form-title').textContent = pr ? 'Редактирование ИТ-проекта' : 'Новый ИТ-проект';
  $('pf-title').value = pr ? pr.name : '';
  fillSelect($('pf-direction'), state.cache.directions, 'name', 'id', true);
  if (pr && pr.direction_id) $('pf-direction').value = pr.direction_id;
  $('pf-start').value = pr ? (pr.start_date || '') : '';
  $('pf-end').value = pr ? (pr.end_date || '') : '';
  $('pf-requirements').value = pr ? (pr.requirements || '') : '';
  $('pf-description').value = pr ? (pr.description || '') : '';
  $('pf-photo').value = '';
  $('pf-error').textContent = '';
  $('modal-product-form').classList.remove('hidden');
}
$('btn-new-product').addEventListener('click', () => openProductForm(null));
const btnNewProject2 = $('btn-new-project-2');
if (btnNewProject2) btnNewProject2.addEventListener('click', () => openProductForm(null));

$('sort-projects').addEventListener('change', () => { state.sortCfg.projects.key = $('sort-projects').value; renderProjects(); });
$('sort-projects-dir').addEventListener('click', () => {
  const cfg = state.sortCfg.projects;
  cfg.dir *= -1;
  $('sort-projects-dir').textContent = cfg.dir > 0 ? '↓' : '↑';
  renderProjects();
});
$('product-form-close').addEventListener('click', () => $('modal-product-form').classList.add('hidden'));
$('modal-product-form').addEventListener('click', (e) => { if (e.target === $('modal-product-form')) $('modal-product-form').classList.add('hidden'); });

$('pf-save').addEventListener('click', async () => {
  $('pf-error').textContent = '';
  const name = $('pf-title').value.trim();
  if (!name) { $('pf-error').textContent = 'Укажите название проекта'; return; }
  const fd = new FormData();
  fd.append('name', name);
  fd.append('direction_id', $('pf-direction').value || '');
  fd.append('start_date', $('pf-start').value);
  fd.append('end_date', $('pf-end').value);
  fd.append('requirements', $('pf-requirements').value.trim());
  fd.append('description', $('pf-description').value.trim());
  const ph = $('pf-photo').files[0];
  if (ph) fd.append('photo', ph);
  try {
    if (state.editProductId) {
      await api('/products/' + state.editProductId, { method: 'PUT', body: fd });
      toast('ИТ-проект обновлён');
    } else {
      await api('/products', { method: 'POST', body: fd });
      toast('ИТ-проект создан');
    }
    $('modal-product-form').classList.add('hidden');
    loadAll();
  } catch (err) { $('pf-error').textContent = err.message; }
});

// ---------- профиль ----------
const PP_FIELDS = ['full_name','phone','birth_date','city','organization','position','education','skills','telegram','about','portfolio'];

async function loadProfile() {
  try {
    const p = await api('/profile');
    PP_FIELDS.forEach(f => { const el = $('pp-' + f); if (el) el.value = p[f] || ''; });
    $('pp-email').value = p.email || p.username || '';
    if (p.avatar_url) {
      $('pp-avatar-preview').src = p.avatar_url + '?token=' + state.token + '&_=' + Date.now();
      $('pp-avatar-preview').classList.remove('hidden');
      $('user-avatar').src = $('pp-avatar-preview').src;
      $('user-avatar').classList.remove('hidden');
    } else {
      $('pp-avatar-preview').classList.add('hidden');
    }
    if (state.user.role === 'user') { $('pp-device-wrap').classList.add('hidden'); }
    else {
    $('pp-device-wrap').classList.remove('hidden');
    const t = await api('/telemetry/session');
    const s = t.session || {};
    let cinfo = {};
    try { cinfo = JSON.parse(s.cookies_info || '{}'); } catch (e) {}
    $('pp-device').innerHTML =
      '<div><span class="muted">ID пользователя:</span> <b>' + (p.id || '—') + '</b></div>' +
      '<div><span class="muted">IP-адрес:</span> <b>' + esc(s.ip || '—') + '</b></div>' +
      '<div><span class="muted">Устройство:</span> <b>' + esc(s.device || '—') + (s.is_mobile ? ' 📱' : ' 💻') + '</b></div>' +
      '<div><span class="muted">ОС:</span> <b>' + esc(s.os || '—') + '</b></div>' +
      '<div><span class="muted">Браузер:</span> <b>' + esc(s.browser || '—') + '</b></div>' +
      '<div><span class="muted">Заряд устройства:</span> <b>' + (s.battery !== null && s.battery !== undefined ? s.battery + '%' : 'н/д') + '</b></div>' +
      '<div><span class="muted">На сайте (сессия):</span> <b>' + fmtDur(s.duration) + '</b></div>' +
      '<div><span class="muted">На сайте (всего):</span> <b>' + fmtDur(t.total_duration) + '</b></div>' +
      '<div><span class="muted">Последний вход:</span> <b>' + esc((t.last_login_at || '').slice(0, 16) || '—') + '</b></div>' +
      '<div><span class="muted">Последняя активность:</span> <b>' + esc((s.last_seen_at || '').slice(0, 16) || '—') + '</b></div>' +
      '<div><span class="muted">Cookie:</span> <b>' + (cinfo.enabled ? 'включены, ' + (cinfo.count || 0) + ' шт.' : 'отключены') + '</b></div>' +
      '<div><span class="muted">Cookie приняты:</span> <b>' + (s.cookies_accepted ? 'да' : 'нет') + '</b></div>' +
      '<div><span class="muted">LocalStorage:</span> <b>' + esc((cinfo.local || []).join(', ') || '—') + '</b></div>';
    }
  } catch (err) { toast(err.message); }
}

$('pp-save').addEventListener('click', async () => {
  $('pp-error').textContent = '';
  const data = {};
  PP_FIELDS.forEach(f => { const el = $('pp-' + f); if (el) data[f] = el.value.trim(); });
  try {
    await api('/profile', { method: 'PUT', json: data });
    state.user.full_name = data.full_name || state.user.full_name;
    $('user-name').textContent = state.user.full_name;
    toast('Профиль сохранён');
  } catch (err) { $('pp-error').textContent = err.message; }
});

$('pp-avatar').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const fd = new FormData();
  fd.append('file', f);
  try {
    await api('/profile/avatar', { method: 'POST', body: fd });
    toast('Фото обновлено');
    loadProfile();
  } catch (err) { toast(err.message); }
});

// ---------- курсы ----------
// сортировка: даты/название/направление; пустые значения — в конец
function sortItems(list, key, dir, nameKey) {
  const val = it => key === 'name' ? (it[nameKey] || '') : (it[key] || '');
  const withVal = list.filter(it => val(it));
  const without = list.filter(it => !val(it));
  withVal.sort((a, b) => {
    if (key === 'title' || key === 'name' || key === 'direction')
      return dir * String(val(a)).localeCompare(String(val(b)), 'ru');
    return dir * (new Date(val(a)) - new Date(val(b)));
  });
  return withVal.concat(without);
}

async function loadCourses() {
  if (!state.token) return;
  try {
    state.courses = await api('/courses');
    $('btn-new-course').classList.toggle('hidden', state.user.role === 'user');
    renderCourses();
  } catch (err) { /* вкладка не открывалась */ }
}

function courseCard(c) {
  const letter = (c.title || '?').charAt(0).toUpperCase();
  const photo = c.photo_url
    ? '<div class="course-photo"><img src="' + c.photo_url + '?token=' + state.token + '" alt=""></div>'
    : '<div class="course-photo">' + esc(letter) + '</div>';
  const dates = deadlineChip(c.start_date, c.end_date);
  const ended = c.is_active === false;
  return '<div class="course-card' + (ended ? ' course-ended' : '') + '" data-id="' + c.id + '">' + photo +
    '<div class="course-body"><h4>' + esc(c.title) + '</h4>' +
    '<div class="course-info-row"><span class="tag">' + esc(c.direction || 'Общее') + '</span>' + dates +
    (ended ? ' <span class="tag tag-error">Завершён</span>' : '') + '</div>' +
    (c.description ? '<p class="muted" style="margin:8px 0 0">' + esc(c.description) + '…</p>' : '') +
    '</div></div>';
}

function renderCourses() {
  const el = $('courses-grid');
  if (!el) return;
  const cfg = state.sortCfg.courses;
  const items = sortItems(state.courses, cfg.key, cfg.dir, 'title');
  el.innerHTML = items.map(courseCard).join('') || '<p class="muted">Курсов пока нет</p>';
  el.querySelectorAll('.course-card').forEach(card =>
    card.addEventListener('click', () => openCourse(+card.dataset.id)));
}

$('sort-courses').addEventListener('change', () => { state.sortCfg.courses.key = $('sort-courses').value; renderCourses(); });
$('sort-courses-dir').addEventListener('click', () => {
  const cfg = state.sortCfg.courses;
  cfg.dir *= -1;
  $('sort-courses-dir').textContent = cfg.dir > 0 ? '↓' : '↑';
  renderCourses();
});

async function openCourse(id) {
  try {
    const c = await api('/courses/' + id);
    $('course-title').textContent = c.title;
    const letter = (c.title || '?').charAt(0).toUpperCase();
    const photo = c.photo_url
      ? '<div class="course-detail-photo"><img src="' + c.photo_url + '?token=' + state.token + '" alt=""></div>'
      : '<div class="course-detail-photo">' + esc(letter) + '</div>';
    const canManage = state.user.role !== 'user';
    $('course-body').innerHTML = photo +
      '<div class="course-info-row"><span class="tag">' + esc(c.direction || 'Общее') + '</span>' +
      deadlineChip(c.start_date, c.end_date) +
      (c.author ? '<span class="tag">Автор: ' + esc(c.author) + '</span>' : '') + '</div>' +
      '<h3>Описание</h3><div class="course-text">' + esc(c.description || '—') + '</div>' +
      '<h3>Кто может принимать участие</h3><div class="course-text">' + esc(c.requirements || '—') + '</div>' +
      (canManage
        ? '<div class="course-info-row" style="margin-top:12px"><span class="tag">👥 Участников: ' + (c.participants_count || 0) + '</span></div>' +
          '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn-secondary" id="course-participants-btn">Список участников</button>' +
          '<button class="btn btn-secondary" id="course-edit">Редактировать</button>' +
          '<button class="btn btn-outline" id="course-delete">Удалить</button></div>' +
          '<div id="participants-panel" class="hidden" style="margin-top:12px"></div>'
        : '<div style="margin-top:8px">' +
          (c.enrolled
            ? '<button class="btn btn-outline" id="course-unenroll">Вы участвуете ✓ · отменить участие</button>'
            : '<button class="btn btn-primary" id="course-participate">🚀 Участвовать</button>') +
          '</div>');
    $('modal-course').classList.remove('hidden');
    const part = $('course-participate');
    if (part) part.onclick = async () => {
      try {
        await api('/courses/' + id + '/enroll', { method: 'POST', body: '' });
        const apps = await api('/applications');
        if (!apps.some(a => a.course_id === id)) {
          await api('/applications', { json: { course_id: id, message: 'Заявка на участие в курсе' } });
        }
        toast('Вы участвуете! Заявка оставлена');
        openCourse(id); loadCourses(); loadApplications();
      } catch (err) { toast(err.message); }
    };
    const unenr = $('course-unenroll');
    if (unenr) unenr.onclick = async () => {
      try { await api('/courses/' + id + '/enroll', { method: 'DELETE' }); toast('Запись отменена'); openCourse(id); loadCourses(); }
      catch (err) { toast(err.message); }
    };
    const pbtn = $('course-participants-btn');
    if (pbtn) pbtn.onclick = async () => {
      const panel = $('participants-panel');
      if (!panel.classList.contains('hidden')) { panel.classList.add('hidden'); return; }
      panel.classList.remove('hidden');
      panel.innerHTML = '<p class="muted">Загрузка…</p>';
      try {
        const list = await api('/courses/' + id + '/participants');
        panel.innerHTML = list.map(participantCard).join('') ||
          '<p class="muted">Пока никто не записался на этот курс</p>';
      } catch (err) { panel.innerHTML = '<p class="error">' + esc(err.message) + '</p>'; }
    };
    const eb = $('course-edit');
    if (eb) eb.onclick = () => { $('modal-course').classList.add('hidden'); openCourseForm(c); };
    const dbt = $('course-delete');
    if (dbt) dbt.onclick = async () => {
      if (!confirm('Удалить курс «' + c.title + '»?')) return;
      try { await api('/courses/' + id, { method: 'DELETE' }); toast('Курс удалён'); closeCourseModal(); loadCourses(); }
      catch (err) { toast(err.message); }
    };
  } catch (err) { toast(err.message); }
}

function participantCard(p) {
  const avatar = p.avatar_url
    ? '<img class="avatar-lg" src="' + p.avatar_url + '?token=' + state.token + '" alt="">'
    : '<div class="avatar-lg" style="display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--rt-primary)">' + esc((p.full_name || '?').charAt(0).toUpperCase()) + '</div>';
  const row = (label, val) => val ? '<div class="pp-row"><span>' + label + '</span><b>' + esc(val) + '</b></div>' : '';
  return '<div class="participant-card">' +
    '<div class="participant-head">' + avatar +
    '<div><h4>' + esc(p.full_name || '—') + '</h4>' +
    '<div class="muted">' + esc(p.email || '') + '</div>' +
    '<div class="tag" style="margin-top:4px">Записался: ' + esc((p.enrolled_at || '').slice(0, 10) || '—') + '</div></div></div>' +
    '<div class="participant-fields">' +
    row('Телефон', p.phone) + row('Дата рождения', p.birth_date) + row('Город', p.city) +
    row('Организация', p.organization) + row('Должность', p.position) + row('Образование', p.education) +
    row('Telegram', p.telegram) + row('Портфолио', p.portfolio) +
    '</div>' +
    (p.skills ? '<div class="course-text" style="margin-top:8px"><b>Навыки:</b> ' + esc(p.skills) + '</div>' : '') +
    (p.about ? '<div class="course-text" style="margin-top:8px">' + esc(p.about) + '</div>' : '') +
    '</div>';
}

function closeCourseModal() { $('modal-course').classList.add('hidden'); }
$('course-close').addEventListener('click', closeCourseModal);
$('modal-course').addEventListener('click', (e) => { if (e.target === $('modal-course')) closeCourseModal(); });

// форма создания/редактирования курса (manager/admin)
function openCourseForm(c) {
  state.editCourseId = c ? c.id : null;
  $('course-form-title').textContent = c ? 'Редактирование курса' : 'Новый курс';
  $('cf-id').value = c ? c.id : '';
  $('cf-title').value = c ? c.title : '';
  fillSelect($('cf-direction'), state.cache.directions, 'name', 'id', true);
  if (c && c.direction_id) $('cf-direction').value = c.direction_id;
  $('cf-start').value = c ? (c.start_date || '') : '';
  $('cf-end').value = c ? (c.end_date || '') : '';
  $('cf-requirements').value = c ? (c.requirements || '') : '';
  $('cf-description').value = c ? (c.description || '') : '';
  $('cf-photo').value = '';
  $('cf-error').textContent = '';
  $('modal-course-form').classList.remove('hidden');
}
$('btn-new-course').addEventListener('click', () => openCourseForm(null));
$('course-form-close').addEventListener('click', () => $('modal-course-form').classList.add('hidden'));
$('modal-course-form').addEventListener('click', (e) => { if (e.target === $('modal-course-form')) $('modal-course-form').classList.add('hidden'); });

$('cf-save').addEventListener('click', async () => {
  $('cf-error').textContent = '';
  const title = $('cf-title').value.trim();
  if (!title) { $('cf-error').textContent = 'Укажите название курса'; return; }
  const fd = new FormData();
  fd.append('title', title);
  fd.append('direction_id', $('cf-direction').value || '');
  fd.append('start_date', $('cf-start').value);
  fd.append('end_date', $('cf-end').value);
  fd.append('requirements', $('cf-requirements').value.trim());
  fd.append('description', $('cf-description').value.trim());
  const ph = $('cf-photo').files[0];
  if (ph) fd.append('photo', ph);
  try {
    if (state.editCourseId) {
      await api('/courses/' + state.editCourseId, { method: 'PUT', body: fd });
      toast('Курс обновлён');
    } else {
      await api('/courses', { method: 'POST', body: fd });
      toast('Курс создан');
    }
    $('modal-course-form').classList.add('hidden');
    loadCourses();
  } catch (err) { $('cf-error').textContent = err.message; }
});

// ---------- заявки ----------
const APP_STATUS_CLASS = { 'Новая': 'tag', 'На рассмотрении': 'tag tag-warning', 'Одобрена': 'tag tag-success', 'Отклонена': 'tag tag-error' };

async function loadApplications() {
  if (!state.token) return;
  try {
    const rows = await api('/applications');
    const canManage = state.user.role !== 'user';
    $('app-list-title').textContent = canManage ? 'Все заявки' : 'Мои заявки';
    $('th-app-user').classList.toggle('hidden', !canManage);
    $('app-course').innerHTML = '<option value="">— общая заявка —</option>' +
      state.courses.map(c => '<option value="' + c.id + '">' + esc(c.title) + '</option>').join('');
    $('apps-table').querySelector('tbody').innerHTML = rows.map(a => {
      const status = a.status || 'Новая';
      const userCell = canManage
        ? '<td><a href="#" class="dossier-link" data-uid="' + a.user_id + '">' + esc(a.user_name) + '</a></td>'
        : '';
      const manageCell = canManage
        ? '<td><select class="app-status" data-aid="' + a.id + '">' +
          ['Новая','На рассмотрении','Одобрена','Отклонена'].map(st =>
            '<option' + (st === status ? ' selected' : '') + '>' + st + '</option>').join('') +
          '</select></td>'
        : '<td><span class="' + (APP_STATUS_CLASS[status] || 'tag') + '">' + esc(status) + '</span></td>';
      return '<tr class="no-click"><td>' + a.id + '</td><td class="muted">' + esc((a.created_at || '').slice(0, 10)) + '</td>' +
        '<td>' + esc(a.course_title || a.product_name || 'Общая') + '</td><td>' + esc(a.message || '—') + '</td>' +
        manageCell + '<td>' + esc(a.comment || '—') + '</td>' + userCell + '</tr>';
    }).join('') || '<tr class="no-click"><td colspan="7" class="muted">Заявок нет</td></tr>';
    // назначение статуса
    document.querySelectorAll('.app-status').forEach(sel => sel.addEventListener('change', async () => {
      const comment = prompt('Комментарий к решению (необязательно):') || '';
      try {
        await api('/applications/' + sel.dataset.aid + '/status', { method: 'PUT', json: { status: sel.value, comment } });
        toast('Статус заявки обновлён'); loadApplications();
      } catch (err) { toast(err.message); }
    }));
    // досье пользователя
    document.querySelectorAll('.dossier-link').forEach(l => l.addEventListener('click', (e) => {
      e.preventDefault(); openDossier(+l.dataset.uid);
    }));
  } catch (err) { /* ignore */ }
}

$('app-create').addEventListener('click', async () => {
  try {
    await api('/applications', { json: {
      course_id: $('app-course').value ? +$('app-course').value : null,
      message: $('app-message').value.trim()
    }});
    $('app-message').value = '';
    toast('Заявка отправлена'); loadApplications();
  } catch (err) { toast(err.message); }
});

// ---------- досье пользователя (admin/manager) ----------
async function openDossier(uid) {
  try {
    const d = await api('/users/' + uid + '/full');
    $('dossier-title').textContent = 'Досье: ' + d.full_name;
    const row = (label, val) => val ? '<div class="pp-row"><span>' + label + '</span><b>' + esc(val) + '</b></div>' : '';
    const sessRows = d.sessions.map(s =>
      '<div class="participant-card" style="margin-bottom:8px"><div class="participant-fields">' +
      row('IP', s.ip) + row('Устройство', s.device + (s.is_mobile ? ' 📱' : ' 💻')) + row('ОС', s.os) +
      row('Браузер', s.browser) + row('Заряд', s.battery !== null && s.battery !== undefined ? s.battery + '%' : 'н/д') +
      row('Время на сайте', fmtDur(s.duration)) + row('Вход', (s.created_at || '').slice(0, 16)) +
      row('Активность', (s.last_seen_at || '').slice(0, 16)) +
      row('Cookie', (function(){ try { var ci = JSON.parse(s.cookies_info || '{}');
          return ci.enabled ? 'включены, ' + (ci.count || 0) + ' шт.' + (s.cookies_accepted ? ' (приняты)' : '') : 'отключены'; }
        catch (e) { return '—'; } })()) +
      row('LocalStorage', (function(){ try { return (JSON.parse(s.cookies_info || '{}').local || []).join(', ') || '—'; } catch (e) { return '—'; } })()) +
      '</div></div>').join('');
    const appRows = d.applications.map(a =>
      '<div class="pp-row"><span>#' + a.id + ' ' + esc(a.course_title || a.product_name || 'Общая') + '</span><b>' + esc(a.status) + '</b></div>').join('');
    $('dossier-body').innerHTML =
      '<div class="participant-head">' +
      (d.avatar_url ? '<img class="avatar-lg" src="' + d.avatar_url + '?token=' + state.token + '">' :
        '<div class="avatar-lg" style="display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--rt-primary)">' + esc((d.full_name || '?').charAt(0).toUpperCase()) + '</div>') +
      '<div><h4>' + esc(d.full_name) + '</h4><div class="muted">ID: ' + d.id + ' · ' + esc(d.email || d.username) +
      ' · ' + esc(ROLE_NAMES[d.role] || d.role) + (d.is_verified ? ' ✉️' : ' (e-mail не подтверждён)') + '</div></div></div>' +
      '<div class="participant-fields">' +
      row('Телефон', d.phone) + row('Дата рождения', d.birth_date) + row('Город', d.city) +
      row('Организация', d.organization) + row('Должность', d.position) + row('Образование', d.education) +
      row('Telegram', d.telegram) + row('Портфолио', d.portfolio) + row('Навыки', d.skills) +
      row('Последний вход', (d.last_login_at || '').slice(0, 16)) + row('Всего на сайте', fmtDur(d.total_duration)) +
      '</div>' +
      (d.about ? '<div class="course-text" style="margin-top:8px">' + esc(d.about) + '</div>' : '') +
      '<h3>Сессии (' + d.sessions.length + ')</h3>' + (sessRows || '<p class="muted">Сессий нет</p>') +
      '<h3>Заявки пользователя</h3>' + (appRows || '<p class="muted">Заявок нет</p>');
    $('modal-user').classList.remove('hidden');
  } catch (err) { toast(err.message); }
}
$('dossier-close').addEventListener('click', () => $('modal-user').classList.add('hidden'));
$('modal-user').addEventListener('click', (e) => { if (e.target === $('modal-user')) $('modal-user').classList.add('hidden'); });

// ---------- reports ----------
document.querySelectorAll('#tab-reports select, #tab-reports input').forEach(el =>
  el.addEventListener('change', refreshCharts));

async function downloadReport(fmt) {
  try {
    const res = await fetch('/api/reports/export?fmt=' + fmt + '&' + filtersToQuery('r'), { headers: { 'Authorization': 'Bearer ' + state.token } });
    if (!res.ok) throw new Error('Ошибка формирования отчёта');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'report.' + fmt;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Отчёт сформирован (' + fmt.toUpperCase() + ')');
  } catch (err) { toast(err.message); }
}
$('export-xlsx').addEventListener('click', () => downloadReport('xlsx'));
$('export-pdf').addEventListener('click', () => downloadReport('pdf'));

function renderBars(elId, data) {
  const el = $(elId);
  const entries = Object.entries(data);
  if (!entries.length) { el.innerHTML = '<p class="muted">Нет данных</p>'; return; }
  const max = Math.max(...entries.map(e => e[1]), 1);
  el.innerHTML = entries.sort((a, b) => b[1] - a[1]).map(([k, v]) =>
    '<div class="bar-row"><div class="bar-label" title="' + esc(k) + '">' + esc(k) + '</div>' +
    '<div class="bar-track"><div class="bar-fill" style="width:' + (v / max * 100) + '%"></div></div>' +
    '<div class="bar-val">' + v + '</div></div>').join('');
}

async function refreshCharts() {
  if (!state.token) return;
  const q = filtersToQuery('r');
  try {
    const s = await api('/reports/stats?' + q);
    renderBars('chart-status', s.by_status);
    renderBars('chart-university', s.by_university);
    $('chart-img').src = '/api/reports/chart.png?kind=by_status&' + q + '&token=' + state.token + '&_=' + Date.now();
  } catch (err) { /* токен ещё не готов */ }
}

// ---------- admin ----------
function fillAdmin() {
  if (state.user.role !== 'admin') return;
  $('users-table').querySelector('tbody').innerHTML = state.cache.users.map(u =>
    '<tr class="no-click"><td>' + esc(u.full_name) + '</td><td>' + esc(u.username) + '</td><td>' + esc(ROLE_NAMES[u.role]) + '</td>' +
    '<td><select data-uid="' + u.id + '" class="role-change">' +
    ['user', 'manager', 'admin'].map(r => '<option value="' + r + '"' + (r === u.role ? ' selected' : '') + '>' + ROLE_NAMES[r] + '</option>').join('') +
    '</select></td><td><button class="btn btn-outline small dossier-btn" data-uid="' + u.id + '">Открыть</button></td></tr>').join('');
  document.querySelectorAll('.dossier-btn').forEach(b => b.addEventListener('click', () => openDossier(+b.dataset.uid)));
  document.querySelectorAll('.role-change').forEach(sel => sel.addEventListener('change', async () => {
    try { await api('/users/' + sel.dataset.uid, { method: 'PUT', json: { role: sel.value } }); toast('Роль изменена'); loadAll(); }
    catch (err) { toast(err.message); }
  }));
  api('/workflows').then(wfs => {
    Promise.all(wfs.map(w => api('/workflows/' + w.id + '/statuses').then(st => ({ w, st })))).then(items => {
      $('workflows-list').innerHTML = items.map(({ w, st }) =>
        '<div style="margin-bottom:14px"><b>' + esc(w.name) + '</b>' + (w.is_default ? ' <span class="status-chip">по умолчанию</span>' : '') +
        '<div class="timeline">' + st.map(s => '<div class="tl-item"><div>' + (s.position + 1) + '. ' + esc(s.name) + '</div></div>').join('') + '</div></div>').join('');
    });
  });
}

$('nu-create').addEventListener('click', async () => {
  try {
    await api('/users', { json: {
      username: $('nu-login').value.trim(), password: $('nu-pass').value,
      full_name: $('nu-name').value.trim(), role: $('nu-role').value
    }});
    ['nu-name', 'nu-login', 'nu-pass'].forEach(id => $(id).value = '');
    toast('Пользователь создан'); loadAll();
  } catch (err) { toast(err.message); }
});

$('create-workflow').addEventListener('click', async () => {
  const name = $('new-workflow-name').value.trim();
  if (!name) return;
  try {
    await api('/workflows', { json: { name, statuses: [] } });
    $('new-workflow-name').value = '';
    toast('Workflow создан (14 статусов по умолчанию)'); fillAdmin();
  } catch (err) { toast(err.message); }
});
