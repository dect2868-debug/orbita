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

// --- Мобильное меню ---
document.addEventListener('click', e => {
  if (e.target.closest('.burger')) document.querySelector('.menu')?.classList.toggle('open');
  if (e.target.closest('.menu a')) document.querySelector('.menu')?.classList.remove('open');
});
