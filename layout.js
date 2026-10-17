// Единая шапка и подвал для всех страниц сайта
const ORB_NAV = [
  ['index.html', 'Главная'],
  ['about.html', 'О сервисе'],
  ['science.html', 'Наука'],
  ['modules.html', 'Модули'],
  ['route.html', 'Маршрут'],
  ['calc.html', 'Калькулятор'],
  ['schedule.html', 'Расписание'],
  ['tickets.html', 'Билеты'],
  ['econ.html', 'Эффект'],
  ['team.html', 'Команда'],
  ['support.html', 'Поддержка']
];

function currentPage() {
  const p = location.pathname.split('/').pop();
  return p === '' ? 'index.html' : p;
}

function fmtMoney(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n || 0)) + ' ₽';
}

function renderHeader() {
  const host = document.getElementById('site-header');
  if (!host) return;
  const here = currentPage();
  const user = window.OrbAuth ? OrbAuth.current() : null;

  const links = ORB_NAV.map(([href, label]) =>
    `<a href="${href}"${href === here ? ' class="active"' : ''}>${label}</a>`
  ).join('');

  const staff = user && (user.role === 'admin' || user.role === 'moderator');
  // панель администратора живёт только на локальном сервере (не публикуется);
  // с GitHub Pages кнопка ведёт на localhost, если сервер запущен
  const adminHref = location.hostname.endsWith('.github.io')
    ? 'http://127.0.0.1:8080/admin.html' : 'admin.html';
  const admin = staff
    ? `<a href="${adminHref}" class="btn btn-small btn-ghost admin-btn" title="Панель ${user.role === 'admin' ? 'администратора' : 'модератора'}">${
        user.role === 'admin' ? '⚙ Админ' : '🛠 Мод'}</a>`
    : '';

  const auth = user
    ? `<a href="profile.html" class="chip-balance" title="Баланс профиля">
         <span class="coin">₽</span>${fmtMoney(user.balance)}
       </a>
       <a href="profile.html" class="btn btn-small btn-ghost profile-btn">
         <span class="dot"></span><span class="p-name">${escapeHtml(user.name.split(' ')[0])}</span>
       </a>`
    : `<a href="login.html" class="btn btn-small btn-ghost" target="_blank" rel="noopener" title="Вход откроется в новой вкладке">Войти</a>
       <a href="register.html" class="btn btn-small">Регистрация</a>`;

  host.innerHTML = `
  <header class="nav">
    <a class="logo" href="index.html">
      <span class="logo-mark">◍</span>
      <span class="logo-text">ORBITA<small>космический сервис</small></span>
    </a>
    <nav class="menu">${links}</nav>
    <div class="auth-area">${admin}${auth}
      <button class="burger" type="button" aria-label="Меню">☰</button>
    </div>
  </header>`;
}

function renderFooter() {
  const host = document.getElementById('site-footer');
  if (!host) return;
  host.innerHTML = `
  <footer class="footer">
    <div>
      <b>◍ ORBITA</b> — сервис для космического путешественника<br>
      Федеральный конкурс научных проектов · 2026
    </div>
    <div class="foot-links">
      <a href="about.html">О сервисе</a>
      <a href="science.html">Наука</a>
      <a href="modules.html">Модули</a>
      <a href="route.html">Маршрут</a>
      <a href="calc.html">Калькулятор</a>
      <a href="schedule.html">Расписание</a>
      <a href="tickets.html">Билеты</a>
      <a href="install.html">📱 Установка на телефон</a>
      <a href="support.html">Поддержка</a>
      <a href="register.html">Регистрация</a>
    </div>
    <div class="foot-note">Демонстрационный проект: платежи выполняются заглушкой эквайринга, данные хранятся на сервере проекта.</div>
  </footer>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ============ PWA: сайт ставится на телефон как приложение ============
// sw.js кэширует страницы — приложение открывается и без интернета
if ('serviceWorker' in navigator &&
    (location.protocol === 'https:' || location.hostname === 'localhost' ||
     location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

renderHeader();
renderFooter();
// перерисовываем шапку, когда профиль подгрузился с сервера
if (window.OrbAuth) {
  OrbAuth.onReady(renderHeader);
  document.addEventListener('orb:ready', renderHeader);
  document.addEventListener('orb:changed', renderHeader);
  // вход/выход, сделанный в другой вкладке, сразу виден здесь
  window.addEventListener('storage', async e => {
    if (['orbita_token', 'orbita_me', 'orbita_session'].indexOf(e.key) > -1) {
      try { await OrbAuth.refresh(); } catch {}
      renderHeader();
      document.dispatchEvent(new Event('orb:changed'));
    }
  });
}

// ============ Адрес API сервера (его обновляет start_orbita.ps1) ============
// Пустая строка = сайт работает автономно. На GitHub Pages — адрес туннеля.
window.ORBITA_API = location.hostname.endsWith('.github.io') ? 'https://fifty-cooks-march.loca.lt' : '';
window.dispatchEvent(new Event('orbita-config'));
