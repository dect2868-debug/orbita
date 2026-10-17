// ORBITA — клиент авторизации, профиля, баланса и билетов.
// Режимы: 'server' (API server.py) или 'local' (запасной режим localStorage).
(() => {
  const K = {
    token: 'orbita_token',
    me: 'orbita_me',
    users: 'orbita_users',
    session: 'orbita_session',
    tickets: 'orbita_tickets'
  };

  const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const raw = k => { try { return localStorage.getItem(k); } catch { return null; } };

  let mode = 'local';
  let API = '';            // адрес сервера API (пусто = свой сайт, локальный режим)
  let ready = false;
  const queue = [];

  // ---------- HTTP ----------
  async function call(path, method = 'GET', body) {
    const token = raw(K.token);
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': '1'   // localtunnel: пропуск страницы-предупреждения
      }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(API + path, opts);
      return await res.json();
    } catch {
      return { ok: false, errors: ['Сервер недоступен. Проверьте соединение.'] };
    }
  }

  // ---------- локальный режим (без сервера) ----------
  const localUsers = () => readJSON(K.users, []);
  const localSave = list => writeJSON(K.users, list);
  const localFind = id => localUsers().find(u =>
    u.email.toLowerCase() === String(id).toLowerCase() ||
    String(u.login || '').toLowerCase() === String(id).toLowerCase());

  function localUserFrom(u) {
    const { pass, salt, ...rest } = u;
    return rest;
  }

  function localCurrent() {
    const email = raw(K.session);
    if (!email) return null;
    const u = localUsers().find(x => x.email === email);
    return u ? localUserFrom(u) : null;
  }

  // ---------- общий API ----------
  const OrbAuth = {
    mode: () => mode,
    isReady: () => ready,

    onReady(cb) {
      if (ready) cb(); else queue.push(cb);
    },

    current() {
      return readJSON(K.me, null);
    },

    async register(data) {
      const errs = [];
      const login = String(data.login || '').trim().toLowerCase();
      if (!data.name || data.name.trim().length < 3) errs.push('Укажите ФИО (минимум 3 символа).');
      if (!/^[a-z0-9][a-z0-9._-]{2,19}$/.test(login)) errs.push('Логин: 3-20 символов, латиница, цифры, точка, дефис или _ (например, ivanov).');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email || '')) errs.push('Некорректный e-mail.');
      if ((data.password || '').length < 6) errs.push('Пароль должен быть не короче 6 символов.');
      if (data.password !== data.confirm) errs.push('Пароли не совпадают.');
      if (mode === 'local') {
        if (localFind(data.email)) errs.push('Пользователь с таким e-mail уже зарегистрирован.');
        if (localFind(login)) errs.push('Такой логин уже занят - придумайте другой.');
      }
      if (errs.length) return { ok: false, errors: errs };

      if (mode === 'server') {
        const r = await call('/api/register', 'POST', data);
        if (r.ok) { localStorage.setItem(K.token, r.token); writeJSON(K.me, r.user); }
        return r;
      }

      const user = {
        name: data.name.trim(),
        login: String(data.login || '').trim().toLowerCase(),
        email: data.email.trim(),
        password: data.password,
        program: data.program || 'Суборбитальный полёт',
        birth: data.birth || '',
        city: data.city || '',
        phone: '', passport: '',
        role: 'user',
        balance: 500000,
        tasks: {},
        created: new Date().toISOString()
      };
      const list = localUsers();
      list.push(user);
      localSave(list);
      localStorage.setItem(K.session, user.email);
      writeJSON(K.me, localUserFrom(user));
      return { ok: true, user: localUserFrom(user) };
    },

    async login(email, password) {
      if (mode === 'server') {
        const r = await call('/api/login', 'POST', { email, password });
        if (r.ok) { localStorage.setItem(K.token, r.token); writeJSON(K.me, r.user); }
        return r;
      }
      const u = localFind(email);
      if (!u) return { ok: false, errors: ['Аккаунт с таким логином или e-mail не найден.'] };
      if (u.password !== password) return { ok: false, errors: ['Неверный пароль.'] };
      localStorage.setItem(K.session, u.email);
      writeJSON(K.me, localUserFrom(u));
      return { ok: true, user: localUserFrom(u) };
    },

    async logout() {
      if (mode === 'server') await call('/api/logout', 'POST', {});
      localStorage.removeItem(K.token);
      localStorage.removeItem(K.session);
      localStorage.removeItem(K.me);
    },

    async update(patch) {
      if (mode === 'server') {
        const r = await call('/api/me', 'POST', patch);
        if (r.ok) writeJSON(K.me, r.user);
        return r;
      }
      const email = raw(K.session);
      const list = localUsers();
      const i = list.findIndex(u => u.email === email);
      if (i < 0) return { ok: false, errors: ['Требуется вход.'] };
      Object.assign(list[i], patch);
      localSave(list);
      writeJSON(K.me, localUserFrom(list[i]));
      return { ok: true, user: localUserFrom(list[i]) };
    },

    async toggleTask(id) {
      const me = OrbAuth.current();
      if (!me) return { ok: false, errors: ['Требуется вход.'] };
      const next = !(me.tasks && me.tasks[id]);
      const tasks = Object.assign({}, me.tasks, { [id]: next });
      return OrbAuth.update({ tasks });
    },

    async removeAccount() {
      if (mode === 'server') { await call('/api/logout', 'POST', {}); return; }
      const email = raw(K.session);
      localSave(localUsers().filter(u => u.email !== email));
      localStorage.removeItem(K.session);
      localStorage.removeItem(K.me);
    },

    async refresh() {
      if (mode === 'server') {
        if (!raw(K.token)) { localStorage.removeItem(K.me); return null; }  // без тока — запрос не нужен
        const r = await call('/api/me');
        if (r.ok) writeJSON(K.me, r.user);
        else { localStorage.removeItem(K.token); localStorage.removeItem(K.me); }
        return r.ok ? r.user : null;
      }
      const u = localCurrent();
      if (u) writeJSON(K.me, u); else localStorage.removeItem(K.me);
      return u;
    },

    // стартовый режим — вызывается при загрузке
    async bootstrap() {
      const onPages = location.hostname.endsWith('.github.io');
      if (onPages) {
        // На GitHub Pages адрес нашего API лежит в файле api-config.js —
        // его обновляет скрипт start_orbita.ps1 при запуске туннеля.
        await new Promise(resolve => {
          const s = document.createElement('script');
          s.src = 'api-config.js?t=' + Date.now();   // без кэша — адрес туннеля меняется
          s.onload = resolve;
          s.onerror = resolve;                       // файла нет — работаем автономно
          document.head.appendChild(s);
        });
        API = String(window.ORBITA_API || '').replace(/\/+$/, '');
      }

      if (onPages && !API) {
        mode = 'local';   // туннель не настроен/выключен — сразу автономно, без запросов
      } else {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 3000);
          const res = await fetch(API + '/api/ping', {
            signal: ctrl.signal,
            headers: { 'bypass-tunnel-reminder': '1' }
          });
          clearTimeout(timer);
          mode = res.ok ? 'server' : 'local';
        } catch {
          mode = 'local';
        }
        if (mode === 'local') API = '';   // сервер недоступен — всё локально
      }
      window.ORBITA_API = API;   // адрес для остальных скриптов (поддержка и т.п.)
      await OrbAuth.refresh();
      ready = true;
      queue.splice(0).forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
      document.dispatchEvent(new CustomEvent('orb:ready', { detail: { mode } }));
    }
  };

  // ---------- продукты, билеты, платежи ----------
  const LOCAL_PRODUCTS = [
    { id: 'SUB-26', name: 'Полёт над линией Кармана', kind: 'Суборбитальный полёт', date: '15 июня 2026', duration: '15 минут', max_g: '3 g', price: 450000, seats: 6, desc: 'Парабола, 5 минут невесомости на высоте 103 км и вид на кривизну Земли.' },
    { id: 'LEO-26', name: 'Орбитальный полёт', kind: 'Орбитальный полёт', date: '12 сентября 2026', duration: '3 дня', max_g: '4 g', price: 3500000, seats: 4, desc: '16 витков вокруг Земли, сон в микрогравитации и программа наблюдений.' },
    { id: 'ISS-26', name: 'Полёт к станции', kind: 'Долгая программа', date: '3 ноября 2026', duration: '7 дней', max_g: '4 g', price: 7800000, seats: 2, desc: 'Стыковка с орбитальной станцией, научные эксперименты под руководством Земли.' },
    { id: 'LUN-29', name: 'Лунная программа', kind: 'Долгое путешествие', date: '20 марта 2029', duration: '12 дней', max_g: '6 g', price: 120000000, seats: 1, desc: 'Выход на окололунную орбиту и трансляция Земли с расстояния 384 000 км.' }
  ];

  function localTickets() { return readJSON(K.tickets, []); }

  const OrbitaApi = {
    mode: () => mode,

    async products() {
      if (mode === 'server') return call('/api/products');
      const mine = localTickets();
      const list = LOCAL_PRODUCTS.map(p => {
        const used = mine.filter(t => t.product_id === p.id && t.status === 'paid').length;
        return Object.assign({}, p, { seats: Math.max(0, p.seats - used) });
      });
      return { ok: true, products: list };
    },

    async tickets() {
      const me = OrbAuth.current();
      if (!me) return { ok: false, errors: ['Требуется вход.'] };
      if (mode === 'server') return call('/api/tickets');
      const mine = localTickets().filter(t => t.email === me.email);
      return { ok: true, tickets: mine, balance: me.balance };
    },

    async buyBalance(product_id) {
      const me = OrbAuth.current();
      if (!me) return { ok: false, errors: ['Требуется вход.'] };
      if (mode === 'server') return call('/api/buy', 'POST', { product_id });
      const p = LOCAL_PRODUCTS.find(x => x.id === product_id);
      if (!p) return { ok: false, errors: ['Рейс не найден.'] };
      const tickets = localTickets();
      const left = p.seats - tickets.filter(t => t.product_id === p.id && t.status === 'paid').length;
      if (left <= 0) return { ok: false, errors: ['Свободных мест нет.'] };
      if (me.balance < p.price) return { ok: false, errors: ['Недостаточно средств на балансе.'], balance: me.balance, price: p.price };
      await OrbAuth.update({ balance: me.balance - p.price });
      const ticket = {
        id: 'T' + Math.random().toString(16).slice(2, 10).toUpperCase(),
        product_id: p.id, name: p.name, date: p.date, duration: p.duration,
        price: p.price, seat: 'A' + (Math.floor(Math.random() * 6) + 1),
        status: 'paid', paid_by: 'balance', email: me.email,
        created: new Date().toISOString()
      };
      tickets.push(ticket);
      writeJSON(K.tickets, tickets);
      return { ok: true, ticket, balance: OrbAuth.current().balance, user: OrbAuth.current() };
    },

    async cancel(ticket_id) {
      const me = OrbAuth.current();
      if (!me) return { ok: false, errors: ['Требуется вход.'] };
      if (mode === 'server') return call('/api/tickets/cancel', 'POST', { ticket_id });
      // автономный режим
      const tickets = localTickets();
      const t = tickets.find(x => x.id === ticket_id && x.email === me.email);
      if (!t) return { ok: false, errors: ['Билет не найден.'] };
      if (t.status !== 'paid') return { ok: false, errors: ['Этот билет уже отменён.'] };
      t.status = 'cancelled';
      t.cancelled_at = new Date().toISOString();
      writeJSON(K.tickets, tickets);
      const r = await OrbAuth.update({ balance: (me.balance || 0) + t.price });
      if (!r.ok) return r;
      return { ok: true, ticket: t, balance: r.user.balance, user: r.user };
    },

    async payment(payload) {
      const me = OrbAuth.current();
      if (!me) return { ok: false, errors: ['Требуется вход.'] };
      if (mode === 'server') return call('/api/payment', 'POST', payload);
      // локальная заглушка эквайринга
      const card = String(payload.card || '').replace(/\D/g, '');
      const errs = [];
      if (card.length !== 16) errs.push('Номер карты должен содержать 16 цифр.');
      if (!/^\d{3,4}$/.test(payload.exp || '')) errs.push('Срок действия карты — ММ/ГГ.');
      if (!/^\d{3}$/.test(payload.cvc || '')) errs.push('CVC — 3 цифры.');
      if (payload.code !== '1234') errs.push('Неверный код 3-D Secure (в демо-режиме: 1234).');
      if (errs.length) return { ok: false, errors: errs };
      if (card.endsWith('0000')) return { ok: false, errors: ['Платёж отклонён платежной системой (демо-режим: карта, оканчивающаяся на 0000).'] };

      if (payload.kind === 'topup') {
        const amount = parseInt(payload.amount, 10) || 0;
        if (amount < 1000 || amount > 5000000) return { ok: false, errors: ['Сумма пополнения — от 1 000 до 5 000 000 ₽.'] };
        const u = OrbAuth.current();
        const r = await OrbAuth.update({ balance: (u.balance || 0) + amount });
        return Object.assign(r, { amount });
      }
      if (payload.kind === 'order') {
        const r = await OrbitaApi.buyBalance(payload.product_id);
        if (r.ok && r.ticket) r.ticket.paid_by = 'card';
        return r;
      }
      return { ok: false, errors: ['Неизвестный тип платежа.'] };
    },

    // ---------- администрирование (панель работает и без сервера) ----------
    // роли: 'user' | 'moderator' | 'admin'.
    // Модератор: статистика, пользователи, билеты, балансы, возвраты.
    // Администратор: плюс управление ролями и удаление.
    localStaff() {
      const me = OrbAuth.current();
      return !!(me && (me.role === 'admin' || me.role === 'moderator'));
    },

    adminLocal(fn, needAdmin) {
      if (!OrbitaApi.localStaff())
        return { ok: false, errors: ['Требуются права администратора или модератора.'] };
      if (needAdmin && OrbAuth.current().role !== 'admin')
        return { ok: false, errors: ['Действие доступно только администратору.'] };
      return fn();
    },

    async adminStats() {
      if (mode === 'server') return call('/api/admin/stats');
      return OrbitaApi.adminLocal(() => {
        const users = localUsers(), tickets = localTickets();
        const paid = tickets.filter(t => t.status === 'paid');
        return { ok: true, stats: {
          users: users.length,
          admins: users.filter(u => u.role === 'admin').length,
          balance_total: users.reduce((s, u) => s + (u.balance || 0), 0),
          tickets: tickets.length,
          tickets_paid: paid.length,
          revenue: paid.reduce((s, t) => s + (t.price || 0), 0),
          tx: 0,
          products: LOCAL_PRODUCTS.length
        }};
      });
    },

    async adminUsers() {
      if (mode === 'server') return call('/api/admin/users');
      return OrbitaApi.adminLocal(() => {
        const busy = {};
        localTickets().forEach(t => {
          if (t.status === 'paid') busy[t.email] = (busy[t.email] || 0) + 1;
        });
        const out = localUsers().map(u =>
          Object.assign(localUserFrom(u), { tickets: busy[u.email] || 0 }));
        out.sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')));
        return { ok: true, users: out };
      });
    },

    async adminUserAction(payload) {
      if (mode === 'server') return call('/api/admin/user', 'POST', payload);
      return OrbitaApi.adminLocal(() => {
        const me = OrbAuth.current();
        const list = localUsers();
        const target = list.find(u => u.email === payload.email);
        if (!target) return { ok: false, errors: ['Пользователь не найден.'] };

        if (payload.action === 'set_balance') {
          const value = parseInt(payload.value, 10);
          if (isNaN(value) || value < 0 || value > 10 ** 12)
            return { ok: false, errors: ['Баланс должен быть числом от 0 до 1 000 000 000 000 ₽.'] };
          target.balance = value;
          localSave(list);
        } else if (payload.action === 'set_role') {
          if (target.email === me.email)
            return { ok: false, errors: ['Нельзя изменить роль собственного аккаунта.'] };
          target.role = ['admin', 'moderator', 'user'].includes(payload.role) ? payload.role : 'user';
          localSave(list);
        } else if (payload.action === 'delete') {
          if (target.email === me.email)
            return { ok: false, errors: ['Нельзя удалить собственный аккаунт.'] };
          localSave(list.filter(u => u.email !== payload.email));
          writeJSON(K.tickets, localTickets().filter(t => t.email !== payload.email));
        } else {
          return { ok: false, errors: ['Неизвестное действие.'] };
        }
        return { ok: true };
      }, payload.action !== 'set_balance');
    },

    async adminTickets() {
      if (mode === 'server') return call('/api/admin/tickets');
      return OrbitaApi.adminLocal(() => {
        const out = localTickets().slice()
          .sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')));
        return { ok: true, tickets: out };
      });
    },

    async adminTicketAction(payload) {
      if (mode === 'server') return call('/api/admin/ticket', 'POST', payload);
      return OrbitaApi.adminLocal(() => {
        const tickets = localTickets();
        const t = tickets.find(x => x.id === payload.ticket_id);
        if (!t) return { ok: false, errors: ['Билет не найден.'] };

        if (payload.action === 'cancel') {
          if (t.status !== 'paid') return { ok: false, errors: ['Билет уже отменён.'] };
          t.status = 'cancelled';
          t.cancelled_at = new Date().toISOString();
          writeJSON(K.tickets, tickets);
          const list = localUsers();
          const owner = list.find(u => u.email === t.email);
          if (owner) { owner.balance = (owner.balance || 0) + (t.price || 0); localSave(list); }
        } else if (payload.action === 'delete') {
          writeJSON(K.tickets, tickets.filter(x => x.id !== payload.ticket_id));
        } else {
          return { ok: false, errors: ['Неизвестное действие.'] };
        }
        return { ok: true, ticket: t };
      }, payload.action === 'delete');
    }
  };

  window.OrbAuth = OrbAuth;
  window.OrbitaApi = OrbitaApi;
  OrbAuth.bootstrap();
})();
