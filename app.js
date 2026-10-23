/* BuddyUp app — wallet, board, create / join / leave / close.
   Two data layers share one interface:
   - chainStore: ethers v6 against the BuddyUp contract on BOT Chain (used when config.js has an address)
   - demoStore:  localStorage-backed stand-in so the UI works before the contract is deployed */
(() => {
  'use strict';
  const CFG = window.BUDDYUP_CONFIG;
  const { pip, hydrate, KEY_BY_CATEGORY, esc } = window.Pip;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || '');
  const DEPLOYED = isAddr(CFG.MAINNET_CONTRACT_ADDRESS);
  const shortAddr = (a) => a.slice(0, 6) + '…' + a.slice(-4);
  const now = () => Math.floor(Date.now() / 1000);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const CATS = [
    { id: 0, label: 'Hackathon', key: 'hacky', say: "Let's ship it!" },
    { id: 1, label: 'Study', key: 'study', say: 'Books out!' },
    { id: 2, label: 'Active', key: 'active', say: "Let's move!" },
    { id: 3, label: 'Hangout', key: 'chill', say: 'Boba time!' },
    { id: 4, label: 'Other', key: 'classic', say: "Let's buddy up!" },
  ];

  /* ------------------------------------------------------------------ footer */
  (function fillFooter() {
    const short = DEPLOYED ? shortAddr(CFG.MAINNET_CONTRACT_ADDRESS) : 'COMING SOON';
    $('#chain-id').textContent = CFG.CHAIN_ID;
    $('#contract-short').textContent = short;
    $('#tile-botchain').href = CFG.SITE_URL;
    $('#explorer-link').href = DEPLOYED ? `${CFG.EXPLORER_URL}/address/${CFG.MAINNET_CONTRACT_ADDRESS}` : CFG.EXPLORER_URL;
  })();

  /* ------------------------------------------------------------------ errors */
  const fail = (reason) => Object.assign(new Error(reason), { reason });

  /* -------------------------------------------------------------- demo store */
  const DEMO_KEY = 'buddyup-demo-v1';
  function fakeAddr(n) {
    let x = (n * 2654435761) >>> 0, s = '';
    for (let i = 0; i < 5; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; s += x.toString(16).padStart(8, '0'); }
    return '0x' + s;
  }
  const DEMO_WALLETS = [{ name: 'Alice', addr: fakeAddr(901) }, { name: 'Bob', addr: fakeAddr(902) }, { name: 'Cleo', addr: fakeAddr(903) }];

  const demoStore = (() => {
    let db;
    const seed = () => {
      const t = now(), H = 3600, D = 86400;
      const mk = (host, title, description, category, area, contact, spots, filled, when, closed = false) =>
        ({ host: fakeAddr(host), title, description, category, area, contact, spots, filled, when, closed, createdAt: t - 5 * H });
      return {
        wallet: 0,
        posts: [
          mk(1, 'Need 2 teammates for BOT Chain hackathon', 'Building a tiny dapp over the weekend. Solidity or frontend — both welcome!', 0, 'Online', '@ship_it_sam', 2, 1, t + 2 * D),
          mk(2, 'Calculus II study group', 'Working through past papers together. Bring snacks.', 1, 'Taipei · Da’an', '@mei_studies', 4, 2, t + 20 * H),
          mk(3, 'Sunday morning run — easy 5k', 'Conversational pace, coffee after.', 2, 'Bangkok · Lumphini', '@runwithnok', 3, 3, t + 3 * D),
          mk(4, 'Boba + board games', 'Catan, Codenames, whatever people bring.', 3, 'Manila · BGC', '', 5, 1, t + 4 * D),
          mk(5, 'Beginner climbing buddy', 'First time on the wall, want someone to learn with.', 2, 'Singapore · Bishan', '@boulder_bea', 1, 0, t + 6 * D),
          mk(6, 'Rust reading club (wrapped up)', 'We read chapters 1–4 together.', 1, 'Online', '', 4, 2, t - 2 * H),
          mk(7, 'Movie night (host closed it)', 'Closed because of a venue change.', 3, 'Hanoi · Hoàn Kiếm', '@cine_linh', 6, 1, t + 5 * D, true),
        ],
        members: { 0: [fakeAddr(11)], 1: [fakeAddr(12), fakeAddr(13)], 2: [fakeAddr(14), fakeAddr(15), fakeAddr(16)], 3: [fakeAddr(17)], 5: [fakeAddr(18), fakeAddr(19)], 6: [fakeAddr(20)] },
      };
    };
    const load = () => {
      if (db) return db;
      try { db = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { db = null; }
      if (!db || !db.posts) db = seed();
      return db;
    };
    const save = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch { /* storage unavailable */ } };
    const withId = () => load().posts.map((p, id) => ({ ...p, id }));
    const same = (a, b) => a.toLowerCase() === b.toLowerCase();

    return {
      mode: 'demo',
      wallet: () => DEMO_WALLETS[load().wallet % DEMO_WALLETS.length],
      nextWallet() { load().wallet = (load().wallet + 1) % DEMO_WALLETS.length; save(); },
      reset() { try { localStorage.removeItem(DEMO_KEY); } catch { /* noop */ } db = null; },
      async list() { await delay(350); return withId(); },
      async get(id) { await delay(150); return withId()[id] || null; },
      async members(id) { return [...(load().members[id] || [])]; },
      async mine(addr) {
        const posts = withId();
        return {
          hosting: new Set(posts.filter((p) => same(p.host, addr)).map((p) => p.id)),
          joined: new Set(posts.filter((p) => (load().members[p.id] || []).some((m) => same(m, addr))).map((p) => p.id)),
        };
      },
      async stats() { const ps = load().posts; return { posts: ps.length, joins: ps.reduce((n, p) => n + p.filled, 0), full: ps.filter((p) => p.filled >= p.spots).length }; },
      async create(a, who) {
        await delay(900);
        const db = load();
        db.posts.push({ host: who, title: a.title, description: a.description, category: a.category, area: a.area, contact: a.contact, spots: a.spots, filled: 0, when: a.when, closed: false, createdAt: now() });
        save();
        return db.posts.length - 1;
      },
      async join(id, who) {
        await delay(900);
        const db = load(), p = db.posts[id], m = (db.members[id] = db.members[id] || []);
        if (!p) throw fail('Missing');
        if (same(p.host, who)) throw fail('Host');
        if (m.some((x) => same(x, who))) throw fail('Joined');
        if (p.closed) throw fail('Closed');
        if (now() >= p.when) throw fail('Ended');
        if (p.filled >= p.spots) throw fail('Full');
        m.push(who); p.filled += 1; save();
      },
      async leave(id, who) {
        await delay(700);
        const db = load(), p = db.posts[id], m = db.members[id] || [];
        if (!m.some((x) => same(x, who))) throw fail('NotJoined');
        if (now() >= p.when) throw fail('Ended');
        db.members[id] = m.filter((x) => !same(x, who)); p.filled -= 1; save();
      },
      async close(id, who) {
        await delay(700);
        const p = load().posts[id];
        if (!same(p.host, who)) throw fail('NotHost');
        if (p.closed) throw fail('Closed');
        p.closed = true; save();
      },
    };
  })();

  /* -------------------------------------------------------------- chain store */
  const ABI = [
    'function createPost(string title, string description, uint8 category, string area, string contact, uint8 spots, uint64 when) returns (uint256 id)',
    'function join(uint256 id)',
    'function leave(uint256 id)',
    'function close(uint256 id)',
    'function getPost(uint256 id) view returns (tuple(address host,string title,string description,uint8 category,string area,string contact,uint8 spots,uint8 filled,uint64 when,bool closed,uint64 createdAt))',
    'function getPosts(uint256 from, uint256 count) view returns (tuple(address host,string title,string description,uint8 category,string area,string contact,uint8 spots,uint8 filled,uint64 when,bool closed,uint64 createdAt)[])',
    'function getMembers(uint256 id) view returns (address[])',
    'function hostingOf(address who) view returns (uint256[])',
    'function joinedOf(address who) view returns (uint256[])',
    'function stats() view returns (uint256 totalPosts, uint256 joins, uint256 full)',
    'event PostCreated(uint256 indexed id, address indexed host, uint8 category, uint8 spots)',
  ];

  const chainStore = (() => {
    let ro;
    const reader = () => ro || (ro = new ethers.Contract(
      CFG.MAINNET_CONTRACT_ADDRESS, ABI,
      new ethers.JsonRpcProvider(CFG.RPC_URL, ethers.Network.from(CFG.CHAIN_ID), { staticNetwork: ethers.Network.from(CFG.CHAIN_ID) })));
    const norm = (p, id) => ({
      id, host: p.host, title: p.title, description: p.description, category: Number(p.category), area: p.area, contact: p.contact,
      spots: Number(p.spots), filled: Number(p.filled), when: Number(p.when), closed: p.closed, createdAt: Number(p.createdAt),
    });
    const writer = async () => {
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      return reader().connect(signer);
    };
    const send = async (fn) => { const tx = await fn(await writer()); return tx.wait(); };
    return {
      mode: 'chain',
      async list() {
        const { posts: total } = await this.stats();
        const out = [];
        for (let from = 0; from < total; from += 50) {
          const page = await reader().getPosts(from, 50);
          page.forEach((p, i) => out.push(norm(p, from + i)));
        }
        return out;
      },
      async get(id) {
        const { posts: total } = await this.stats();
        if (id >= total) return null;
        return norm(await reader().getPost(id), id);
      },
      async members(id) { return [...(await reader().getMembers(id))]; },
      async mine(addr) {
        const [h, j] = await Promise.all([reader().hostingOf(addr), reader().joinedOf(addr)]);
        return { hosting: new Set(h.map(Number)), joined: new Set(j.map(Number)) };
      },
      async stats() { const [p, j, f] = await reader().stats(); return { posts: Number(p), joins: Number(j), full: Number(f) }; },
      async create(a) {
        const rc = await send((c) => c.createPost(a.title, a.description, a.category, a.area, a.contact, a.spots, a.when));
        const ev = rc.logs.map((l) => { try { return reader().interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === 'PostCreated');
        return ev ? Number(ev.args.id) : null;
      },
      join: (id) => send((c) => c.join(id)),
      leave: (id) => send((c) => c.leave(id)),
      close: (id) => send((c) => c.close(id)),
    };
  })();

  const store = DEPLOYED ? chainStore : demoStore;

  /* ------------------------------------------------------------------- state */
  const state = {
    account: null, chainOk: true, posts: [], mine: { hosting: new Set(), joined: new Set() },
    filter: 'all', openOnly: false, sort: 'soon', tab: 'board', loading: true, error: null,
    celebrate: null, createCat: 0,
  };

  const status = (p) => (now() >= p.when ? 'ENDED' : p.closed ? 'CLOSED' : p.filled >= p.spots ? 'FULL' : 'OPEN');
  const catOf = (p) => CATS[p.category] || CATS[4];
  const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
  const fmtDate = (s) => new Date(s * 1000).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const handleOf = (c) => { const t = (c || '').trim(); return t ? (t.startsWith('@') ? t : '@' + t) : ''; };

  /* ----------------------------------------------------------------- dialogs */
  const dlgMsg = $('#dlg-msg'), dlgPending = $('#dlg-pending'), dlgCreate = $('#dlg-create');
  let msgOnClose = null;
  dlgMsg.addEventListener('close', () => { const f = msgOnClose; msgOnClose = null; if (f) f(); });
  dlgPending.addEventListener('cancel', (e) => e.preventDefault());
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  [dlgMsg, dlgCreate].forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  function confetti(host) {
    if (reduceMotion) return;
    const colors = ['#7B61FF', '#F2B53A', '#9BD84B', '#FF7A6B', '#1A0000'];
    for (let i = 0; i < 34; i++) {
      const el = document.createElement('i');
      el.style.background = colors[i % colors.length];
      el.style.setProperty('--dx', (Math.random() * 420 - 210) + 'px');
      el.style.setProperty('--dy', (Math.random() * 300 - 160) + 'px');
      el.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      el.style.animationDelay = (Math.random() * .15) + 's';
      host.append(el);
      setTimeout(() => el.remove(), 1600);
    }
  }

  function message({ pip: p = { key: 'classic', pose: 'wave' }, title, text = '', buttons = [], burst = false, pop = false, onClose = null, html = false }) {
    $('#msg-pip').innerHTML = pip(p);
    $('#msg-title').textContent = title;
    if (html) $('#msg-text').innerHTML = text; else $('#msg-text').textContent = text;
    $('#msg-text').hidden = !text;
    $('#msg-box').classList.toggle('pop', pop);
    const row = $('#msg-btns');
    row.innerHTML = '';
    (buttons.length ? buttons : [{ label: 'Got it', cls: 'btn-black' }]).forEach((b) => {
      const el = document.createElement(b.href ? 'a' : 'button');
      el.className = 'btn ' + (b.cls || 'btn-black');
      el.textContent = b.label;
      if (b.href) { el.href = b.href; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
      el.addEventListener('click', () => { if (b.onClick) { msgOnClose = null; dlgMsg.close(); b.onClick(); } else if (!b.href) dlgMsg.close(); });
      row.append(el);
    });
    msgOnClose = onClose;
    if (!dlgMsg.open) dlgMsg.showModal();
    if (burst) { const c = $('#msg-confetti'); c.innerHTML = ''; requestAnimationFrame(() => confetti(c)); }
  }

  function pending(text) {
    $('#pending-pip').innerHTML = pip({ key: 'classic', pose: 'sign', text: 'Saving on|BOT Chain…' });
    $('#pending-text').textContent = text || 'Confirm in your wallet, then hang tight.';
    if (!dlgPending.open) dlgPending.showModal();
  }
  const donePending = () => { if (dlgPending.open) dlgPending.close(); };

  function reasonOf(e) {
    if (e && (e.code === 'ACTION_REJECTED' || e.code === 4001 || e.info?.error?.code === 4001)) return 'REJECTED';
    if (e && e.reason && /^\w+$/.test(e.reason)) return e.reason;
    const txt = [e?.reason, e?.shortMessage, e?.message, e?.info?.error?.message, e?.data?.message].filter(Boolean).join(' ');
    const m = txt.match(/reason string '(\w+)'/) || txt.match(/\b(Full|Closed|Ended|Joined|Host|NotJoined|NotHost|Missing)\b/);
    return m ? m[1] : 'UNKNOWN';
  }

  function txError(e, retry) {
    const r = reasonOf(e);
    const again = retry ? [{ label: 'Try again', cls: 'btn-black', onClick: retry }, { label: 'Not now', cls: 'btn-ghost' }] : [];
    const map = {
      REJECTED: { pip: { key: 'classic', pose: 'shrug' }, title: 'No problem', text: "You closed the wallet prompt, so nothing was saved.", buttons: again },
      Full: { pip: { key: 'classic', pose: 'shrug' }, title: 'Just filled up — too late!', text: 'Someone took the last seat first. Nothing was charged or changed.' },
      Ended: { pip: { key: 'classic', pose: 'sleepy' }, title: 'That one has ended', text: 'The date has passed, so this post is locked.' },
      Closed: { pip: { key: 'classic', pose: 'shrug' }, title: 'Post is closed', text: 'The host stopped new joins on this post.' },
      Joined: { pip: { key: 'classic', pose: 'wave' }, title: "You're already in", text: 'One seat per wallet — you have yours.' },
      Host: { pip: { key: 'classic', pose: 'think' }, title: "It's your own post", text: "Hosts can't join their own post." },
      NotJoined: { pip: { key: 'classic', pose: 'think' }, title: "You're not in this one", text: "There's no seat to leave." },
      NotHost: { pip: { key: 'classic', pose: 'think' }, title: 'Hosts only', text: 'Only the host can close this post.' },
    };
    message(map[r] || { pip: { key: 'classic', pose: 'scratch' }, title: 'Hmm, that didn’t work', text: 'The transaction failed. Check your wallet and connection, then try again.', buttons: again });
  }

  /* ------------------------------------------------------------------ wallet */
  function updateWalletUI() {
    const b = $('#wallet-btn'), chip = $('#net-chip');
    chip.classList.remove('bad');
    if (!state.account) {
      b.textContent = !DEPLOYED || window.ethereum ? 'Connect wallet' : 'Install MetaMask';
      chip.hidden = true;
    } else if (!state.chainOk) {
      b.textContent = `Switch to ${CFG.CHAIN_NAME}`;
      chip.hidden = false; chip.textContent = 'Wrong network'; chip.classList.add('bad');
    } else {
      b.textContent = shortAddr(state.account);
      chip.hidden = false; chip.textContent = DEPLOYED ? CFG.CHAIN_NAME : 'Demo chain';
    }
    const demo = $('#demo-banner');
    demo.hidden = DEPLOYED;
    if (!DEPLOYED) { const w = demoStore.wallet(); $('#demo-who').textContent = `Demo wallet: ${w.name} · ${shortAddr(w.addr)}`; }
  }

  function installMessage() {
    message({
      pip: { key: 'classic', pose: 'wave' }, title: 'Install MetaMask',
      text: 'BuddyUp uses MetaMask to post and join. Browsing works without it.',
      buttons: [{ label: 'Get MetaMask ↗', cls: 'btn-black', href: 'https://metamask.io/download/' }, { label: 'Keep browsing', cls: 'btn-ghost' }],
    });
  }

  async function chainIdOk() {
    const id = await window.ethereum.request({ method: 'eth_chainId' });
    return parseInt(id, 16) === CFG.CHAIN_ID;
  }

  async function switchChain() {
    const hex = '0x' + CFG.CHAIN_ID.toString(16);
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    } catch (e) {
      if (e && (e.code === 4902 || /unrecognized|not been added/i.test(e.message || ''))) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{ chainId: hex, chainName: CFG.CHAIN_NAME, rpcUrls: [CFG.RPC_URL], blockExplorerUrls: [CFG.EXPLORER_URL], nativeCurrency: CFG.NATIVE_CURRENCY }],
        });
      } else throw e;
    }
    state.chainOk = await chainIdOk();
  }

  /** Returns the connected account, prompting connect / network switch as needed. null = user didn't complete it. */
  async function requireWallet() {
    if (!DEPLOYED) { state.account = demoStore.wallet().addr; state.chainOk = true; await afterAccount(); return state.account; }
    if (!window.ethereum) { installMessage(); return null; }
    try {
      if (!state.account) {
        const accts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        state.account = accts[0] || null;
      }
      state.chainOk = await chainIdOk();
      if (!state.chainOk) await switchChain();
    } catch (e) {
      if (reasonOf(e) !== 'REJECTED') txError(e);
      updateWalletUI();
      return null;
    }
    await afterAccount();
    return state.chainOk ? state.account : null;
  }

  async function afterAccount() {
    updateWalletUI();
    if (state.account) { try { state.mine = await store.mine(state.account); } catch { /* keep old */ } }
    render();
  }

  $('#wallet-btn').addEventListener('click', async () => {
    if (state.account && state.chainOk) { setTab('hosting'); $('#board').scrollIntoView(); return; }
    await requireWallet();
  });

  if (DEPLOYED && window.ethereum) {
    window.ethereum.request({ method: 'eth_accounts' }).then(async (a) => {
      if (a[0]) { state.account = a[0]; state.chainOk = await chainIdOk(); await afterAccount(); }
    }).catch(() => {});
    window.ethereum.on?.('accountsChanged', async (a) => { state.account = a[0] || null; state.mine = { hosting: new Set(), joined: new Set() }; await afterAccount(); });
    window.ethereum.on?.('chainChanged', async () => { state.chainOk = await chainIdOk(); updateWalletUI(); });
  }

  $('#demo-switch').addEventListener('click', async () => {
    demoStore.nextWallet();
    if (state.account) state.account = demoStore.wallet().addr;
    await afterAccount();
  });
  $('#demo-reset').addEventListener('click', () => { demoStore.reset(); location.href = location.pathname; });

  /* ----------------------------------------------------------------- rendering */
  const ICON = {
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  };

  function avatar(addr) {
    const h = parseInt(addr.slice(2, 8), 16) % 360;
    return `<span class="avatar" style="background:linear-gradient(135deg,hsl(${h} 80% 62%),hsl(${(h + 70) % 360} 80% 52%))"></span>`;
  }

  function seatsHTML(p) {
    const key = KEY_BY_CATEGORY[p.category] || 'classic';
    let out = '';
    for (let i = 0; i < p.spots; i++) out += i < p.filled ? pip({ key, pose: 'seat', label: 'Filled seat' }) : pip({ pose: 'seat-empty' });
    return out;
  }

  function cardHTML(p, detail = false) {
    const c = catOf(p), st = status(p);
    const isHost = same(p.host, state.account), isIn = state.mine.joined.has(p.id);
    const left = p.spots - p.filled;
    let foot = '';
    if (isHost) {
      foot = `<span class="state-line">You're hosting</span>` + (!p.closed && st !== 'ENDED' ? `<button class="btn btn-ghost btn-sm" data-act="close" data-id="${p.id}">Close post</button>` : '');
    } else if (isIn) {
      foot = `<span class="state-line">You're in ✓</span>` + (st !== 'ENDED' ? `<button class="btn btn-ghost btn-sm" data-act="leave" data-id="${p.id}">Leave</button>` : '');
    } else if (st === 'OPEN') {
      foot = `<span class="state-line">${left} ${left === 1 ? 'seat' : 'seats'} left</span><button class="btn btn-black btn-sm" data-act="join" data-id="${p.id}">Join</button>`;
    }
    const celebrating = state.celebrate === p.id ? ' celebrating' : '';
    return `<article class="post cat-${p.category}${st !== 'OPEN' ? ' dim' : ''}${celebrating}" data-id="${p.id}">
      <span class="chip"><span class="idle">${pip({ key: c.key, pose: 'head', props: false })}</span>${esc(c.label)}</span>
      <h3 class="display">${detail ? esc(p.title) : `<a href="?post=${p.id}" data-nav>${esc(p.title)}</a>`}</h3>
      <div class="host">${avatar(p.host)}<span>${shortAddr(p.host)}${isHost ? ' (you)' : ''}</span></div>
      <div class="meta"><span>${ICON.cal}${esc(fmtDate(p.when))}</span><span>${ICON.pin}${esc(p.area)}</span></div>
      <div class="seats" aria-label="${p.filled} of ${p.spots} seats filled">${seatsHTML(p)}</div>
      <div class="seat-count">${p.filled} of ${p.spots} seats filled</div>
      ${st !== 'OPEN' ? `<div class="stamp" aria-label="${st}">${st}</div>` : ''}
      ${foot ? `<div class="post-foot">${foot}</div>` : ''}
    </article>`;
  }

  function emptyHTML({ key = 'classic', pose = 'sleepy', title, text, btn = '' }) {
    return `<div class="empty" style="grid-column:1/-1">${pip({ key, pose })}<h3 class="display">${esc(title)}</h3><p>${esc(text)}</p>${btn}</div>`;
  }

  function visiblePosts() {
    let list = state.posts.slice();
    if (state.tab === 'hosting') list = list.filter((p) => state.mine.hosting.has(p.id));
    if (state.tab === 'joined') list = list.filter((p) => state.mine.joined.has(p.id));
    return list;
  }

  function renderPills(base) {
    const counts = { all: base.length };
    CATS.slice(0, 4).forEach((c) => { counts[c.id] = base.filter((p) => p.category === c.id).length; });
    const defs = [{ id: 'all', label: 'All', key: 'classic' }, ...CATS.slice(0, 4)];
    $('#pills').innerHTML = defs.map((d) =>
      `<button class="pill-filter" type="button" data-pill="${d.id}" aria-pressed="${String(state.filter) === String(d.id)}"><span>${pip({ key: d.key, pose: 'head', props: false })}</span>${d.label}<span class="n">${counts[d.id]}</span></button>`).join('');
  }

  function render() {
    const cards = $('#cards');
    $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === state.tab)));
    $('#open-only').checked = state.openOnly;
    $('#sort').value = state.sort;

    if (state.loading) {
      cards.innerHTML = emptyHTML({ pose: 'think', title: 'Rounding up posts…', text: 'One sec — Pip is thinking.' }).replace('class="empty"', 'class="empty spin-dot"');
      return;
    }
    if (state.error) {
      cards.innerHTML = emptyHTML({ pose: 'scratch', title: 'Hmm, that didn’t load', text: 'We couldn’t reach BOT Chain. Check your connection and try again.', btn: '<button class="btn btn-black" data-act="retry">Retry</button>' });
      return;
    }
    if ((state.tab !== 'board') && !state.account) {
      cards.innerHTML = emptyHTML({ pose: 'wave', title: 'Connect to see yours', text: `Your ${state.tab === 'hosting' ? 'hosted' : 'joined'} posts show up here once your wallet is connected.`, btn: '<button class="btn btn-black" data-act="connect">Connect wallet</button>' });
      renderPills([]);
      return;
    }

    const base = visiblePosts();
    renderPills(base);
    let list = base.filter((p) => state.filter === 'all' || String(p.category) === String(state.filter));
    if (state.openOnly) list = list.filter((p) => status(p) === 'OPEN');
    const open = (p) => (status(p) === 'OPEN' ? 0 : 1);
    list.sort((a, b) => open(a) - open(b) || (state.sort === 'new' ? b.id - a.id : a.when - b.when));

    if (!list.length) {
      const none = state.posts.length === 0;
      cards.innerHTML = emptyHTML({
        title: none ? 'No buddies here yet' : state.tab === 'board' ? 'Nothing matches' : state.tab === 'hosting' ? 'You’re not hosting anything' : 'You haven’t joined anything',
        text: none || state.tab !== 'board' ? 'Be the first to post!' : 'Try another filter, or post your own plan.',
        btn: '<button class="btn btn-black" data-open-create>+ Find buddies</button>',
      });
      return;
    }
    cards.innerHTML = list.map((p) => cardHTML(p)).join('');
  }

  /* --------------------------------------------------------------------- data */
  async function refresh({ quiet = false } = {}) {
    if (!quiet) { state.loading = true; state.error = null; render(); }
    try {
      const [posts, st] = await Promise.all([store.list(), store.stats()]);
      state.posts = posts;
      if (state.account) state.mine = await store.mine(state.account);
      state.loading = false; state.error = null;
      renderStats(st, posts);
    } catch (e) {
      console.error(e);
      state.loading = false; state.error = e;
    }
    render();
    if (new URLSearchParams(location.search).has('post')) renderPostView();
  }

  function countUp(el, to) {
    if (reduceMotion || to === 0) { el.textContent = to; return; }
    const from = Number(el.textContent) || 0, t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 900); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function renderStats(st, posts) {
    const matched = posts.filter((p) => p.filled >= p.spots).reduce((n, p) => n + p.spots + 1, 0); // members + host of each full post
    countUp($('#stat-posts'), st.posts); countUp($('#stat-seats'), st.joins); countUp($('#stat-matched'), matched);
    $('#stat-note').textContent = DEPLOYED ? 'Read straight from the BuddyUp contract on BOT Chain.' : 'Demo numbers from this browser — they switch to live on-chain counts once the contract is deployed.';
  }

  /* ------------------------------------------------------------- post detail */
  async function renderPostView() {
    const view = $('#post-view');
    const raw = new URLSearchParams(location.search).get('post');
    const hide = raw !== null;
    $('#cards').hidden = hide; $('#toolbar').hidden = hide; $('.tabs').hidden = hide;
    view.hidden = !hide;
    if (!hide) return;
    const back = '<button class="btn btn-ghost btn-sm" data-act="back">← All posts</button>';
    view.innerHTML = back + emptyHTML({ pose: 'think', title: 'Finding that post…', text: '' }).replace('class="empty"', 'class="empty spin-dot"');
    let p = null;
    if (/^\d+$/.test(raw)) { try { p = await store.get(Number(raw)); } catch { p = null; } }
    if (!p) {
      view.innerHTML = back + `<div class="empty">${pip({ pose: 'peek' })}<h3 class="display">This post wandered off.</h3><p>We couldn’t find a post with that link. It may not exist yet.</p></div>`;
      return;
    }
    const members = await store.members(p.id);
    const h = handleOf(p.contact);
    view.innerHTML = back + cardHTML(p, true) +
      `<div class="post" style="max-width:760px;margin-top:0;gap:16px">
        ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
        <div class="contact-box">${h ? `Host handle: <strong>${esc(h)}</strong>` : 'The host hasn’t shared a contact handle.'}</div>
        <div><span class="eyebrow">Who’s in</span>
          ${members.length ? `<ul class="members" style="margin-top:10px">${members.map((m) => `<li>${avatar(m)}${shortAddr(m)}${same(m, state.account) ? ' (you)' : ''}</li>`).join('')}</ul>` : '<p style="margin:8px 0 0">No one yet — be the first.</p>'}
        </div>
        <div><button class="btn btn-black btn-sm" data-act="share" data-id="${p.id}">Copy share link</button></div>
      </div>`;
  }

  function go(search) {
    history.pushState({}, '', location.pathname + search);
    renderPostView();
    if (search) $('#board').scrollIntoView();
  }
  window.addEventListener('popstate', renderPostView);

  /* ------------------------------------------------------------------ actions */
  async function doJoin(id) {
    const who = await requireWallet(); if (!who) return;
    pending('Joining — confirm in your wallet.');
    try { await store.join(id, who); } catch (e) { donePending(); txError(e, () => doJoin(id)); await refresh({ quiet: true }); return; }
    donePending();
    await refresh({ quiet: true });
    const p = state.posts.find((x) => x.id === id);
    const h = p && handleOf(p.contact);
    const wasLast = p && p.filled >= p.spots;
    message({
      pip: { key: p ? catOf(p).key : 'classic', pose: 'wave' }, title: "You're in!",
      text: h ? `Message the host at ${h} to sort details.` : 'The host hasn’t shared a handle — check the post for updates.',
      burst: true, pop: true,
      onClose: () => { if (wasLast) celebrate(id); },
    });
  }

  function celebrate(id) {
    state.celebrate = id; render();
    if (new URLSearchParams(location.search).has('post')) renderPostView();
    $(`.post[data-id="${id}"]`)?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    setTimeout(() => { state.celebrate = null; }, 4000);
  }

  async function doLeave(id) {
    const who = await requireWallet(); if (!who) return;
    pending('Leaving — confirm in your wallet.');
    try { await store.leave(id, who); } catch (e) { donePending(); txError(e, () => doLeave(id)); await refresh({ quiet: true }); return; }
    donePending();
    await refresh({ quiet: true });
    message({ pip: { key: 'classic', pose: 'wave' }, title: 'See you next time', text: 'Your seat is free again. Pip waves goodbye.' });
  }

  async function doClose(id) {
    const who = await requireWallet(); if (!who) return;
    pending('Closing — confirm in your wallet.');
    try { await store.close(id, who); } catch (e) { donePending(); txError(e, () => doClose(id)); await refresh({ quiet: true }); return; }
    donePending();
    await refresh({ quiet: true });
    message({ pip: { key: 'classic', pose: 'stand' }, title: 'Post closed', text: 'No new joins. Anyone already in keeps their seat.' });
  }

  async function doShare(id) {
    const url = new URL(location.href); url.search = `?post=${id}`; url.hash = '';
    try { await navigator.clipboard.writeText(url.toString()); message({ pip: { key: 'classic', pose: 'wave' }, title: 'Link copied', text: url.toString() }); }
    catch { message({ pip: { key: 'classic', pose: 'think' }, title: 'Copy this link', text: url.toString() }); }
  }

  function setTab(t) { state.tab = t; state.filter = 'all'; if (location.search) history.pushState({}, '', location.pathname); renderPostView(); render(); }

  /* ----------------------------------------------------------------- events */
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('a[data-nav]');
    if (nav) { e.preventDefault(); go(new URL(nav.href).search); return; }
    if (e.target.closest('[data-open-create]')) { openCreate(); return; }
    const filt = e.target.closest('[data-filter]');
    if (filt) { state.filter = filt.dataset.filter; state.tab = 'board'; if (location.search) history.pushState({}, '', location.pathname); renderPostView(); render(); return; }
    const pill = e.target.closest('[data-pill]');
    if (pill) { state.filter = pill.dataset.pill; render(); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) { setTab(tab.dataset.tab); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = Number(b.dataset.id);
    ({ join: () => doJoin(id), leave: () => doLeave(id), close: () => doClose(id), share: () => doShare(id), retry: () => refresh(), connect: () => requireWallet(), back: () => go('') }[b.dataset.act] || (() => {}))();
  });
  $('#open-only').addEventListener('change', (e) => { state.openOnly = e.target.checked; render(); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });

  /* ------------------------------------------------------------- create form */
  const f = {
    title: $('#f-title'), desc: $('#f-desc'), spots: $('#f-spots'), when: $('#f-when'), area: $('#f-area'), contact: $('#f-contact'),
  };

  function renderCats() {
    $('#cats').innerHTML = CATS.map((c) => `<button type="button" class="cat-opt" data-cat="${c.id}" aria-pressed="${state.createCat === c.id}"><span>${pip({ key: c.key, pose: 'head', props: false })}</span>${c.label}</button>`).join('');
    const c = CATS[state.createCat];
    $('#helper-pip').innerHTML = pip({ key: c.key, pose: 'stand', cls: 'idle-pip' });
    $('#helper-say').textContent = c.say;
    renderSeatPreview();
  }
  function renderSeatPreview() {
    const n = Math.max(0, Math.min(20, parseInt(f.spots.value, 10) || 0));
    const key = CATS[state.createCat].key;
    $('#seat-preview').innerHTML = Array.from({ length: n }, () => pip({ key, pose: 'seat' })).join('');
  }
  $('#cats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { state.createCat = Number(b.dataset.cat); renderCats(); } });
  f.spots.addEventListener('input', renderSeatPreview);

  function setErr(name, msg) {
    const field = $(`[data-field="${name}"]`);
    field.classList.toggle('err', !!msg);
    $('.err-msg', field).textContent = msg || '';
  }

  function validate() {
    const v = {
      title: f.title.value.trim(), description: f.desc.value.trim(), area: f.area.value.trim(), contact: f.contact.value.trim(),
      spots: Number(f.spots.value), whenMs: f.when.value ? new Date(f.when.value).getTime() : NaN,
    };
    const errs = {};
    if (!v.title) errs.title = 'Add a title so people know what this is.';
    else if (v.title.length > 80) errs.title = 'Keep it to 80 characters.';
    if (v.description.length > 400) errs.description = 'Keep it to 400 characters.';
    if (!Number.isInteger(v.spots) || v.spots < 1 || v.spots > 20) errs.spots = 'Spots must be a whole number from 1 to 20.';
    if (!f.when.value || Number.isNaN(v.whenMs)) errs.when = 'Pick a date and time.';
    else if (v.whenMs <= Date.now() + 60000) errs.when = 'That’s in the past — pick a future time.';
    if (!v.area) errs.area = 'Add a city or district, or "Online".';
    else if (v.area.length > 60) errs.area = 'Keep it to 60 characters.';
    if (v.contact.length > 40) errs.contact = 'Keep it to 40 characters.';
    ['title', 'description', 'spots', 'when', 'area', 'contact'].forEach((k) => setErr(k, errs[k]));
    return Object.keys(errs).length ? null : v;
  }

  function openCreate() {
    $('#form-error').hidden = true;
    ['title', 'description', 'spots', 'when', 'area', 'contact'].forEach((k) => setErr(k, ''));
    if (!f.when.value) {
      const d = new Date(Date.now() + 3 * 86400000); d.setMinutes(0, 0, 0); d.setHours(18);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      f.when.value = d.toISOString().slice(0, 16);
    }
    f.when.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    renderCats();
    if (!dlgCreate.open) dlgCreate.showModal();
  }

  $('#create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = validate(); if (!v) return;
    const who = await requireWallet(); if (!who) return;
    dlgCreate.close();
    pending('Posting — confirm in your wallet.');
    let id;
    const args = { title: v.title, description: v.description, category: state.createCat, area: v.area, contact: v.contact, spots: v.spots, when: Math.floor(v.whenMs / 1000) };
    try { id = await store.create(args, who); }
    catch (err) { donePending(); txError(err, () => { openCreate(); }); return; }
    donePending();
    $('#create-form').reset(); state.createCat = 0; f.spots.value = 3;
    state.tab = 'board'; state.filter = 'all';
    await refresh({ quiet: true });
    message({
      pip: { key: CATS[args.category].key, pose: 'jump' }, title: 'Your post is live!', text: 'Share the link and watch the seats fill up.', burst: true, pop: true,
      buttons: [
        ...(id !== null && id !== undefined ? [{ label: 'View post', cls: 'btn-black', onClick: () => go(`?post=${id}`) }] : []),
        { label: 'Done', cls: 'btn-ghost' },
      ],
    });
  });

  /* ------------------------------------------------------------------- boot */
  function hydrateSeats() {
    $$('[data-seats]').forEach((el) => {
      const [n, filled, key] = el.dataset.seats.split(':');
      el.innerHTML = Array.from({ length: +n }, (_, i) => (i < +filled ? pip({ key, pose: 'seat' }) : pip({ pose: 'seat-empty' }))).join('');
      el.removeAttribute('data-seats');
    });
  }
  hydrate(); hydrateSeats();
  updateWalletUI();
  render();
  refresh().then(() => renderPostView());
  if (DEPLOYED) setInterval(() => refresh({ quiet: true }), 30000);
})();
