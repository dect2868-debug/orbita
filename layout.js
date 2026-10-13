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
  const admin = staff
    ? `<a href="admin.html" class="btn btn-small btn-ghost admin-btn" title="Панель ${user.role === 'admin' ? 'администратора' : 'модератора'}">${
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

  const musicOn = !!(window.OrbAudio && OrbAudio.isOn());
  const music = `<button type="button" id="orbMusic" class="btn btn-small btn-ghost music-btn${musicOn ? ' on' : ''}"
      title="Фоновая музыка сайта">${musicOn ? '🔊' : '🔇'}<span class="mb-label"> Музыка</span></button>`;

  host.innerHTML = `
  <header class="nav">
    <a class="logo" href="index.html">
      <span class="logo-mark">◍</span>
      <span class="logo-text">ORBITA<small>космический сервис</small></span>
    </a>
    <nav class="menu">${links}</nav>
    <div class="auth-area">${music}${admin}${auth}
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

// ============ Фоновая музыка: космический эмбиент на Web Audio API ============
// Без файлов и загрузок — звук синтезируется прямо в браузере:
// мягкий аккордовый пад + редкие «искры» звёзд с эхом.
const ORB_MUSIC_KEY = 'orbita_music_on';
window.OrbAudio = (function () {
  let ctx = null, master = null, t1 = null, t2 = null, wantOn = false;

  try { wantOn = localStorage.getItem(ORB_MUSIC_KEY) === '1'; } catch {}

  function scheduleChord() {
    // аккорды меняются раз в 9 секунд, голоса плавно перетекают
    const chords = [
      [130.81, 164.81, 196.00, 246.94],
      [116.54, 146.83, 174.61, 220.00],
      [103.83, 130.81, 155.56, 196.00],
      [98.00, 123.47, 146.83, 185.00]
    ];
    let step = 0;
    return function next() {
      if (!ctx) return;
      const t = ctx.currentTime + 0.1;
      chords[step % chords.length].forEach((f, i) => {
        const v = voices[i];
        if (!v) return;
        v.o.frequency.cancelScheduledValues(t);
        v.o.frequency.setTargetAtTime(f, t, 2.5);
      });
      step++;
      t1 = setTimeout(next, 9000);
    };
  }
  let voices = [];
  let nextChord = null;

  function sparkle() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const penta = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = penta[Math.floor(Math.random() * penta.length)];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.connect(g); g.connect(filter); g.connect(delay);
    o.start(t); o.stop(t + 2.4);
    t2 = setTimeout(sparkle, 2500 + Math.random() * 5000);
  }

  let filter = null, delay = null;

  function start() {
    if (ctx) { ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      master.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 2.5);
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.4;
      filter.connect(master);
      delay = ctx.createDelay(1.5);
      delay.delayTime.value = 0.45;
      const fb = ctx.createGain();
      fb.gain.value = 0.4;
      const dw = ctx.createGain();
      dw.gain.value = 0.45;
      delay.connect(fb); fb.connect(delay);
      delay.connect(dw); dw.connect(master);

      voices = [];
      for (let i = 0; i < 4; i++) {
        const o = ctx.createOscillator();
        o.type = i < 2 ? 'triangle' : 'sine';
        const g = ctx.createGain();
        g.gain.value = i === 0 ? 0.5 : 0.26;
        o.connect(g); g.connect(filter);
        o.start();
        voices.push({ o, g });
      }
      nextChord = scheduleChord();
      t1 = setTimeout(nextChord, 150);
      t2 = setTimeout(sparkle, 1800);
    } catch { ctx = null; }
  }

  function stop() {
    if (!ctx) return;
    const c = ctx, m = master;
    ctx = null; master = null; voices = [];
    clearTimeout(t1); clearTimeout(t2);
    try {
      m.gain.cancelScheduledValues(c.currentTime);
      m.gain.setValueAtTime(m.gain.value, c.currentTime);
      m.gain.linearRampToValueAtTime(0, c.currentTime + 0.7);
      setTimeout(() => c.close().catch(() => {}), 900);
    } catch {}
  }

  function toggle() {
    wantOn = !wantOn;
    try { localStorage.setItem(ORB_MUSIC_KEY, wantOn ? '1' : '0'); } catch {}
    if (wantOn) start(); else stop();
    return wantOn;
  }

  function isOn() { return wantOn; }
  function resume() { if (wantOn) { start(); } }

  return { toggle, isOn, resume };
})();

// кнопка музыки в шапке (делегирование — шапка перерисовывается)
document.addEventListener('click', e => {
  const btn = e.target.closest && e.target.closest('#orbMusic');
  if (!btn) return;
  const on = OrbAudio.toggle();
  btn.classList.toggle('on', on);
  btn.innerHTML = (on ? '🔊' : '🔇') + '<span class="mb-label"> Музыка</span>';
});
// браузеры разрешают звук только после первого касания — добираем разрешение
if (window.OrbAudio && OrbAudio.isOn()) {
  const kick = () => { OrbAudio.resume(); };
  document.addEventListener('pointerdown', kick, { once: true });
  document.addEventListener('keydown', kick, { once: true });
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
