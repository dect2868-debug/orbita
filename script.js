// Общие скрипты: звёздное поле, счётчики, прогресс-бары, защита приватных страниц

// --- Звёздное поле ---
const canvas = document.getElementById('stars');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let stars = [];

  function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    stars = Array.from({ length: Math.min(220, Math.floor(innerWidth / 8)) }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + .3,
      s: Math.random() * .25 + .05,
      a: Math.random()
    }));
  }
  resize();
  addEventListener('resize', resize);

  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const st of stars) {
      st.a += .02;
      const alpha = .35 + Math.sin(st.a) * .35;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,220,255,${alpha})`;
      ctx.fill();
      st.y += st.s;
      if (st.y > canvas.height) st.y = 0;
    }
    requestAnimationFrame(draw);
  })();
}

// --- Счётчики при прокрутке ---
const counters = document.querySelectorAll('[data-count]');
if (counters.length) {
  const cObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = +el.dataset.count;
      let cur = 0;
      const step = Math.max(1, Math.round(target / 40));
      const t = setInterval(() => {
        cur += step;
        if (cur >= target) { cur = target; clearInterval(t); }
        el.textContent = cur;
      }, 35);
      cObs.unobserve(el);
    });
  }, { threshold: .6 });
  counters.forEach(c => cObs.observe(c));
}

// --- Прогресс-бары гипотез ---
const bars = document.querySelectorAll('.bar');
if (bars.length) {
  const bObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('on'); bObs.unobserve(e.target); }
    });
  }, { threshold: .5 });
  bars.forEach(b => bObs.observe(b));
}

// --- Фоновые видео (герой и страницы): уважаем настройку «меньше движения» ---
const motionVideos = document.querySelectorAll('.hero-video, .clip-video');
if (motionVideos.length) {
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const syncMotion = () => {
    motionVideos.forEach(v => {
      if (mq.matches) v.pause();
      else v.play().catch(() => {});
    });
  };
  syncMotion();
  if (mq.addEventListener) mq.addEventListener('change', syncMotion);
  else if (mq.addListener) mq.addListener(syncMotion);
  // некоторые браузеры запускают autoplay только после первого жеста
  const kick = () => { if (!mq.matches) motionVideos.forEach(v => v.play().catch(() => {})); };
  document.addEventListener('pointerdown', kick, { once: true });
  document.addEventListener('keydown', kick, { once: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncMotion(); });

  // если видео не загрузилось — прячем блок, чтобы не осталась пустая рамка
  motionVideos.forEach(v => {
    const fail = () => {
      const box = v.closest('.video-card, .hero-media');
      if (box) box.classList.add('video-failed');
    };
    v.addEventListener('error', fail);
    const src = v.querySelector('source');
    if (src) src.addEventListener('error', fail);
  });
}

// --- Мобильное меню ---
document.addEventListener('click', e => {
  const menu = document.querySelector('.menu');
  if (!menu) return;
  if (e.target.closest('.burger')) { menu.classList.toggle('open'); return; }
  if (e.target.closest('.menu a')) { menu.classList.remove('open'); return; }
  // закрываем, если кликнули где-то вне шапки
  if (menu.classList.contains('open') && !e.target.closest('.nav')) menu.classList.remove('open');
});
// закрытие по Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelector('.menu')?.classList.remove('open');
});
