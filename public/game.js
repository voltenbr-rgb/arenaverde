/* Arena Verde — lógica do jogo (canvas + Web Audio, sem frameworks) */
{
  const $ = (id) => document.getElementById(id);
  const cv = $("cv"),
    ctx = cv.getContext("2d");
  const COLS = 9,
    ROWS = 5,
    CELL = 24,
    BASE = 20,
    RIGHT = 26,
    GX = BASE,
    GRID_END = GX + COLS * CELL,
    W = GRID_END + RIGHT,
    H = ROWS * CELL;
  cv.width = W;
  cv.height = H;
  ctx.imageSmoothingEnabled = false;

  /* ---------- pixel art (original, gerado em código) ---------- */
  const PAL = {
    K: "#141a0e",
    G: "#4f6b2a",
    g: "#36491c",
    L: "#7f9f40",
    S: "#f1c08e",
    s: "#c98f5c",
    E: "#111111",
    B: "#5a3a1e",
    b: "#3d2712",
    M: "#9aa0a6",
    m: "#5c6268",
    R: "#8a5a2a",
    Y: "#f2c230",
    W: "#f4f4ec",
    Z: "#8fc06a",
    z: "#5d8a42",
    X: "#b8322a",
    O: "#e8812c",
    P: "#4b4560",
    p: "#352f47",
    T: "#7a5a3a",
    t: "#5a3f26",
    C: "#cfd3d6",
    c: "#a0a5aa",
    V: "#9be22d",
  };
  const SOLDIER = [
    "................",
    ".....KKKKKK.....",
    "....KGGLLGGK....",
    "...KGGLGGGGGK...",
    "...KgGGGGGGGgK..",
    "...KKKSSSSKKK...",
    "....KSSSSESK....",
    "....KSSSSSSK....",
    "....KKsSSsKK....",
    "...KgGGGGGGgK...",
    "...KgGLGGGGgK...",
    "...KgGGGGGGgK...",
    "....KggKKggK....",
    "....KgK..KgK....",
    "....KBK..KBK....",
    "...KBBK..KBBK...",
  ];
  const ZOMBIE = [
    "................",
    "....KKKKKK......",
    "...KZZZZZZK.....",
    "...KZZZzZZZK....",
    "...KZWEZZWEK....",
    "...KZZZZZZZK....",
    "...KZKXXKZZK....",
    "....KZZZZZK.....",
    "...KTTTTTTKKKKK.",
    "...KTtTTTTZZZZK.",
    "...KTTtTTTKKKKK.",
    "...KTTTTtTK.....",
    "....KPPPPK......",
    "....KPKKPK......",
    "....KPK.KPK.....",
    "...KZZK.KZZK....",
  ];
  const MINE = ["....KKKK....", "..KKmmmmKK..", ".KmMMMMMMmK.", "KmMCMMMMMMmK", "KmmmmmmmmmmK", ".KKKKKKKKKK."];
  const mk = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };
  function paint(c, map, re = {}, ox = 0, oy = 0) {
    const x = c.getContext("2d");
    map.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        let ch = row[i];
        if (ch === ".") continue;
        ch = re[ch] || ch;
        x.fillStyle = PAL[ch] || ch;
        x.fillRect(ox + i, oy + j, 1, 1);
      }
    });
    return c;
  }
  function rects(c, l) {
    const x = c.getContext("2d");
    for (const [a, b, w, h, col] of l) {
      x.fillStyle = PAL[col] || col;
      x.fillRect(a, b, w, h);
    }
    return c;
  }
  function flip(c) {
    const f = mk(c.width, c.height),
      x = f.getContext("2d");
    x.translate(c.width, 0);
    x.scale(-1, 1);
    x.drawImage(c, 0, 0);
    return f;
  }
  function x2(c) {
    const f = mk(c.width * 2, c.height * 2),
      x = f.getContext("2d");
    x.imageSmoothingEnabled = false;
    x.drawImage(c, 0, 0, f.width, f.height);
    return f;
  }
  function white(c) {
    const f = mk(c.width, c.height),
      x = f.getContext("2d");
    x.drawImage(c, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = "#fff";
    x.fillRect(0, 0, f.width, f.height);
    return f;
  }
  const SOLDIER_BLINK = SOLDIER.map((r, j) => (j === 6 ? r.replace("E", "s") : r));
  const soldier = (extra, blink) => {
    const c = mk(18, 16);
    paint(c, blink ? SOLDIER_BLINK : SOLDIER);
    return rects(c, extra);
  };
  const shiftR = (l, dx, dy = 0) => l.map(([a, b, w, h, c]) => [a + dx, b + dy, w, h, c]);
  const A_RIFLE = [
    [7, 9, 11, 1, "K"],
    [7, 11, 11, 1, "K"],
    [6, 10, 12, 1, "K"],
    [7, 10, 4, 1, "R"],
    [11, 10, 6, 1, "M"],
    [9, 10, 2, 1, "S"],
  ];
  const A_RELOAD = [
    [6, 11, 10, 3, "K"],
    [7, 12, 4, 1, "R"],
    [11, 12, 4, 1, "M"],
    [9, 8, 3, 4, "K"],
    [10, 9, 1, 2, "S"],
    [9, 13, 3, 3, "K"],
    [10, 13, 1, 2, "m"],
  ];
  const A_GREADY = [
    [4, 9, 1, 3, "B"],
    [12, 4, 3, 6, "K"],
    [13, 4, 1, 5, "G"],
    [11, 0, 5, 4, "K"],
    [12, 1, 3, 2, "g"],
    [13, 0, 1, 1, "M"],
  ];
  const A_GWIND = [
    [4, 9, 1, 3, "B"],
    [1, 3, 4, 7, "K"],
    [2, 4, 2, 5, "G"],
    [0, 0, 5, 4, "K"],
    [1, 1, 3, 2, "g"],
    [2, 0, 1, 1, "M"],
  ];
  const A_GTHROW = [
    [4, 9, 1, 3, "B"],
    [11, 7, 7, 3, "K"],
    [12, 8, 5, 1, "G"],
    [16, 8, 1, 1, "S"],
  ];
  const A_GEMPTY = [
    [4, 9, 1, 3, "B"],
    [11, 9, 3, 4, "K"],
    [12, 10, 1, 2, "G"],
    [12, 12, 1, 1, "S"],
  ];
  const A_MIS = [
    [1, 8, 17, 3, "K"],
    [2, 9, 15, 1, "M"],
    [15, 8, 2, 3, "m"],
    [6, 9, 1, 1, "Y"],
    [10, 10, 2, 1, "S"],
  ];
  const A_MEMPTY = [
    [1, 9, 15, 3, "K"],
    [2, 10, 13, 1, "m"],
    [10, 11, 2, 1, "S"],
    [13, 5, 4, 4, "K"],
    [14, 6, 2, 2, "X"],
  ];
  function tankSp(rec) {
    return rects(mk(26, 18), [
      [1, 12, 22, 6, "K"],
      [2, 13, 20, 4, "m"],
      [3, 13, 3, 3, "M"],
      [7, 13, 3, 3, "M"],
      [11, 13, 3, 3, "M"],
      [15, 13, 3, 3, "M"],
      [19, 13, 3, 3, "M"],
      [2, 8, 21, 5, "K"],
      [3, 9, 19, 3, "G"],
      [3, 9, 19, 1, "L"],
      [2, 12, 21, 1, "g"],
      [6, 3, 11, 6, "K"],
      [7, 4, 9, 4, "G"],
      [7, 4, 9, 1, "L"],
      [9, 2, 5, 2, "K"],
      [16 - rec, 4, 10, 3, "K"],
      [16 - rec, 5, 10, 1, "M"],
      [11, 5, 1, 1, "Y"],
      [10, 6, 3, 1, "Y"],
      [11, 7, 1, 1, "Y"],
      [4, 10, 2, 1, "Y"],
      [18, 10, 2, 1, "Y"],
    ]);
  }
  const A_MORT = [
    [8, 14, 9, 2, "K"],
    [9, 14, 7, 1, "m"],
  ];
  for (let i = 0; i < 5; i++) A_MORT.push([10 + i, 12 - 2 * i, 3, 3, "K"]);
  for (let i = 0; i < 5; i++) A_MORT.push([11 + i, 12 - 2 * i, 1, 3, "m"]);
  A_MORT.push([15, 4, 1, 1, "M"], [14, 9, 1, 6, "K"]);
  function mortSp(rec) {
    const c = mk(20, 16);
    paint(c, SOLDIER, {}, -3, 0);
    return rects(c, shiftR(A_MORT, 0, rec));
  }
  function mgSp(hot, rec) {
    const c = mk(23, 16);
    paint(c, SOLDIER.slice(0, 10), {}, -1, 1);
    return rects(c, [
      [8 - rec, 6, 14, 3, "K"],
      [9 - rec, 7, 8, 1, "m"],
      [17 - rec, 7, 5, 1, hot ? "#ff5a2a" : "M"],
      [11, 9, 2, 3, "K"],
      [12, 5, 3, 1, "K"],
      [7, 7, 2, 1, "S"],
      [0, 10, 23, 6, "K"],
      [1, 11, 10, 2, "#b59a62"],
      [12, 11, 10, 2, "#b59a62"],
      [1, 11, 10, 1, "#d8c189"],
      [12, 11, 10, 1, "#d8c189"],
      [1, 13, 6, 2, "#a38a55"],
      [8, 13, 7, 2, "#b59a62"],
      [16, 13, 6, 2, "#a38a55"],
    ]);
  }
  const FR = {
    mg: { idle: mgSp(0, 0), recoil: mgSp(0, 1), hot: mgSp(1, 0) },
    mortar: { idle: mortSp(0), recoil: mortSp(1) },
    rifle: {
      idle: soldier(A_RIFLE),
      blink: soldier(A_RIFLE, 1),
      recoil: soldier(shiftR(A_RIFLE, -1)),
      reload: soldier(A_RELOAD),
    },
    grenade: {
      idle: soldier(A_GREADY),
      blink: soldier(A_GREADY, 1),
      wind: soldier(A_GWIND),
      throw: soldier(A_GTHROW),
      empty: soldier(A_GEMPTY),
    },
    missile: {
      idle: soldier(A_MIS),
      blink: soldier(A_MIS, 1),
      recoil: soldier(shiftR(A_MIS, -1)),
      reload: soldier(A_MEMPTY),
    },
    tank: { idle: tankSp(0), recoil: tankSp(3) },
  };
  const SP = {
    rifle: FR.rifle.idle,
    grenade: FR.grenade.idle,
    missile: FR.missile.idle,
    tank: FR.tank.idle,
    mg: FR.mg.idle,
    mortar: FR.mortar.idle,
    mine: paint(mk(12, 6), MINE),
    shovel: rects(mk(16, 16), [
      [7, 1, 2, 9, "t"],
      [5, 1, 6, 2, "t"],
      [4, 9, 8, 6, "K"],
      [5, 10, 6, 4, "M"],
      [5, 10, 6, 1, "C"],
    ]),
  };
  {
    const wl = [
      [2, 1, 2, 13, "K"],
      [16, 1, 2, 13, "K"],
      [2, 1, 1, 13, "t"],
      [16, 1, 1, 13, "t"],
    ];
    for (const y of [3, 7, 11]) {
      wl.push([0, y, 20, 1, "c"]);
      for (let x = 1; x < 20; x += 3) wl.push([x, y - 1, 1, 3, "C"]);
    }
    SP.wire = rects(mk(20, 14), wl);
  }
  const ZHEAD = ZOMBIE.slice(0, 8),
    ZHEAD_B = ZHEAD.map((r, j) => (j === 6 ? "...KZXXXXZZK...." : j === 7 ? "....KXXZZZK....." : r));
  const ZTORSO = ["...KTTTTTTK.....", "...KTtTTTTK.....", "...KTTtTTTK.....", "...KTTTTtTK....."];
  const ZLEGS = [
    ["....KPPPPK......", "....KPKKPK......", "....KPK.KPK.....", "...KZZK.KZZK...."],
    ["....KPPPPK......", "...KpK.KPK......", "..KpK...KPK.....", ".KzzK....KZZK..."],
    ["....KPPPPK......", ".....KPPK.......", ".....KPPK.......", "....KZZZZK......"],
    ["....KPPPPK......", "...KPK.KpK......", "..KPK...KpK.....", ".KZZK....KzzK..."],
  ];
  function zframe(re, hx, bx, legs, dy, headX, bite) {
    const c = mk(17, 16);
    rects(c, [
      [9, 9 - dy, 5, 2, "K"],
      [10, 9 - dy, 3, 1, "z"],
    ]);
    paint(c, ZTORSO, re, 0, 8);
    paint(c, ZLEGS[legs], re, 0, 12);
    paint(c, bite ? ZHEAD_B : ZHEAD, re, headX, 0);
    if (hx) rects(c, shiftR(hx, headX));
    if (bx) rects(c, bx);
    rects(c, [
      [10, 8 + dy, 5, 3, "K"],
      [10, 9 + dy, 4, 1, "Z"],
      [14, 9 + dy, 1, 1, "z"],
    ]);
    return c;
  }
  function zset(re, hx, bx, big) {
    const f = (c) => {
      const v = flip(c);
      return big ? x2(v) : v;
    };
    return {
      walk: [
        [1, -1],
        [2, 0],
        [3, 1],
        [2, 0],
      ].map(([l, dy]) => f(zframe(re, hx, bx, l, dy, 0, 0))),
      bite: [f(zframe(re, hx, bx, 0, 1, 1, 1)), f(zframe(re, hx, bx, 0, 0, 0, 0))],
    };
  }
  const HELM = [
    [3, 0, 9, 3, "K"],
    [4, 1, 7, 1, "M"],
    [4, 2, 7, 1, "m"],
  ];
  const ZF = {
    normal: zset({}),
    runner: zset({ T: "c", t: "C" }),
    armored: zset({ T: "M", t: "m" }, HELM),
    spitter: zset({ T: "W", t: "C", E: "V" }, [
      [4, 4, 3, 1, "Y"],
      [9, 4, 3, 1, "Y"],
    ]),
    boss: zset(
      { T: "G", t: "g", P: "g", p: "b" },
      [
        [3, 0, 9, 3, "K"],
        [4, 1, 7, 1, "L"],
        [4, 2, 7, 1, "G"],
      ],
      [
        [5, 9, 1, 1, "Y"],
        [7, 10, 1, 1, "Y"],
        [6, 8, 1, 1, "Y"],
      ],
      true,
    ),
  };
  for (const k in ZF) SP["z_" + k] = ZF[k].walk[0];
  const WH = new Map();
  const wht = (c) => {
    if (!WH.has(c)) WH.set(c, white(c));
    return WH.get(c);
  };

  /* ==========================================================================
     DADOS DAS UNIDADES E ZUMBIS
     Para criar uma carta nova: adicione uma entrada em U, um sprite em
     assets/sprites/<chave>.png (+ altura em SPRITE_H) e a lógica de tiro em update().
     range = alcance em casas da grade (Infinity = linha inteira).
     ========================================================================== */
  const U = {
    rifle: {
      n: "Fuzileiro",
      cost: 50,
      hp: 100,
      dmg: 25,
      rate: 0.72,
      cd: 3,
      ammo: 6,
      reload: 1.3,
      range: 5,
      desc: "Rajadas de 6 tiros · alcance médio",
    },
    grenade: {
      n: "Granadeiro",
      cost: 75,
      hp: 120,
      dmg: 40,
      rate: 1.8,
      cd: 5,
      splash: 14,
      range: 5,
      desc: "Granada com dano em área · alcance médio",
    },
    tank: {
      n: "Tanque Pesado",
      cost: 200,
      hp: 300,
      dmg: 60,
      rate: 1.5,
      cd: 12,
      splash: 8,
      range: 7,
      desc: "Canhão forte e blindagem · alcance longo",
    },
    missile: {
      n: "Lança-Mísseis",
      cost: 120,
      hp: 150,
      dmg: 80,
      rate: 2.6,
      cd: 8,
      splash: 22,
      range: Infinity,
      desc: "Míssil com explosão · alcance muito longo",
    },
    mine: { n: "Mina Terrestre", cost: 30, hp: 50, dmg: 30, cd: 10, splash: 22, desc: "Explode uma vez quando pisam" },
    wire: { n: "Arame Farpado", cost: 60, hp: 200, dmg: 10, cd: 6, desc: "Segura o zumbi até ser destruída" },
    // cartas extras, desbloqueadas ao avançar nas ondas (ver UNLOCK_AT)
    mg: {
      n: "Metralhadora",
      cost: 150,
      hp: 250,
      dmg: 10,
      rate: 0.15,
      cd: 10,
      ammo: 20,
      reload: 2.2,
      range: 6,
      desc: "Rajada longa, superaquece",
    },
    mortar: {
      n: "Morteiro",
      cost: 125,
      hp: 80,
      dmg: 70,
      rate: 3.4,
      cd: 8,
      splash: 24,
      min: 40,
      range: Infinity,
      desc: "Bombardeia de longe, não acerta perto",
    },
  };
  const ALL = ["rifle", "grenade", "tank", "missile", "mine", "wire", "mg", "mortar"];
  const BASE_CARDS = ["rifle", "grenade", "tank", "missile", "mine", "wire"];
  const UNLOCK_AT = { mg: 4, mortar: 7 }; // onda em que a carta é desbloqueada
  for (const k of BASE_CARDS) {
    U[k].art = `assets/cards/art-${k}.jpg`; // ARTE DA CARTA (só nas cartas)
    U[k].card = `assets/cards/card-${k}.jpg`; // carta completa (visualizador)
  }

  // Zumbis — dps = dano por segundo da mordida; base = vida que tiram da base
  const ZD = {
    normal: { n: "Zumbi Normal", desc: "Velocidade normal", hp: 100, sp: 5, dps: 10, cash: 15, base: 10, pts: 100 },
    runner: { n: "Zumbi Corredor", desc: "Muito rápido, corre", hp: 80, sp: 11, dps: 10, cash: 12, base: 8, pts: 120 },
    armored: {
      n: "Zumbi Blindado",
      desc: "Lento, tem armadura",
      hp: 250,
      sp: 3.5,
      dps: 15,
      cash: 30,
      base: 20,
      pts: 250,
    },
    spitter: {
      n: "Zumbi Cuspidor",
      desc: "Cospe veneno de longe",
      hp: 120,
      sp: 5,
      dps: 10,
      cash: 20,
      base: 12,
      pts: 200,
      spit: 20,
    },
    boss: {
      n: "Chefão Metralhadora",
      desc: "Gigante armado · onda 10",
      hp: 1000,
      sp: 2.4,
      dps: 50,
      cash: 300,
      base: 50,
      pts: 3000,
      big: 1,
      gun: 8,
    },
  };
  const MAX_WAVE = 10;

  /* ==========================================================================
     SALVAMENTO LOCAL (sempre) + D1 (quando online, via Worker /api)
     ========================================================================== */
  const store = {
    get(k) {
      try {
        return JSON.parse(localStorage.getItem("arenaverde." + k));
      } catch (e) {
        return null;
      }
    },
    set(k, v) {
      try {
        if (v == null) localStorage.removeItem("arenaverde." + k);
        else localStorage.setItem("arenaverde." + k, JSON.stringify(v));
      } catch (e) {}
    },
  };
  let profile = store.get("player"); // { nome, apelido, id, token }
  let progress = store.get("progress"); // { wave_atual, moedas, pontuacao, squad }
  const unlocked = new Set(store.get("unlocked") || []);
  const isUnlocked = (k) => BASE_CARDS.includes(k) || unlocked.has(k);
  let ORDER = BASE_CARDS.slice();
  {
    const q = store.get("squad");
    if (Array.isArray(q) && q.length && q.length <= 6 && q.every((k) => U[k] && isUnlocked(k))) ORDER = q;
  }

  // Chamada à API do Worker. Falha em silêncio quando offline ou na prévia.
  async function api(path, opts = {}) {
    const headers = { "content-type": "application/json" };
    if (profile && profile.id) {
      headers["x-player-id"] = String(profile.id);
      headers["x-player-token"] = profile.token;
    }
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 4000);
    const r = await fetch("/api/" + path, { ...opts, headers, signal: ac.signal });
    if (!r.ok) throw new Error("api " + r.status);
    return r.json();
  }
  // Garante que o perfil local exista também no D1
  async function ensureRemotePlayer() {
    if (!profile) return false;
    if (profile.id) return true;
    const j = await api("players", {
      method: "POST",
      body: JSON.stringify({ nome: profile.nome, apelido: profile.apelido }),
    });
    profile = { ...profile, id: j.id, token: j.token };
    store.set("player", profile);
    return true;
  }
  async function syncFromServer() {
    try {
      if (!(await ensureRemotePlayer())) return;
      const j = await api("progress");
      if (j.progresso && (!progress || j.progresso.wave_atual > progress.wave_atual) && j.progresso.wave_atual > 1) {
        progress = { ...j.progresso, squad: (progress && progress.squad) || ORDER };
        store.set("progress", progress);
      }
      for (const c of j.cartas || []) unlocked.add(c);
      store.set("unlocked", [...unlocked]);
      if (state === "menu") showMenu();
    } catch (e) {}
  }
  function saveProgress() {
    store.set("progress", progress);
    ensureRemotePlayer()
      .then(
        (ok) =>
          ok &&
          api("progress", {
            method: "PUT",
            body: JSON.stringify(progress || { wave_atual: 1, moedas: 350, pontuacao: 0 }),
          }),
      )
      .catch(() => {});
  }
  function unlockCard(k) {
    if (unlocked.has(k)) return;
    unlocked.add(k);
    store.set("unlocked", [...unlocked]);
    banner(`NOVA CARTA: ${U[k].n.toUpperCase()}!`, 2.5);
    sfx("coin");
    ensureRemotePlayer()
      .then((ok) => ok && api("unlock", { method: "POST", body: JSON.stringify({ carta_id: k }) }))
      .catch(() => {});
  }

  /* SPRITES DE AÇÃO (só no campo): PNGs pequenos, de lado, com fundo transparente.
     SPRITE_H = altura do boneco em unidades da grade (1 casa = 24). */
  const SPRITE_H = {
    rifle: 22,
    grenade: 22,
    missile: 22,
    tank: 19,
    mine: 8,
    wire: 15,
    z_normal: 23,
    z_runner: 22,
    z_armored: 23,
    z_spitter: 23,
    z_boss: 46,
  };
  const IMG = {};
  for (const k in SPRITE_H) {
    const im = new Image();
    im.onload = () => {
      IMG[k] = im;
      if (state === "menu") drawScene();
    };
    im.src = `assets/sprites/${k}.png`;
  }

  /* ---------- fundo ---------- */
  const bg = mk(W, H),
    CRATERS = [];
  {
    const b = bg.getContext("2d");
    let seed = 11;
    const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        b.fillStyle = (x + y) % 2 ? "#4e9a32" : "#5aa83b";
        b.fillRect(GX + x * CELL, y * CELL, CELL, CELL);
        for (let i = 0; i < 7; i++) {
          const px = (GX + x * CELL + 2 + r() * (CELL - 4)) | 0,
            py = (y * CELL + 2 + r() * (CELL - 5)) | 0;
          b.fillStyle = r() < 0.55 ? "#3e8128" : "#78c24c";
          b.fillRect(px, py, 1, 2);
          b.fillRect(px + 1, py + 1, 1, 1);
        }
      }
    b.fillStyle = "rgba(0,0,0,.13)";
    for (let x = 0; x <= COLS; x++) b.fillRect(GX + x * CELL, 0, 1, H);
    for (let y = 1; y < ROWS; y++) b.fillRect(GX, y * CELL, COLS * CELL, 1);
    b.fillStyle = "#6b5233";
    b.fillRect(GRID_END, 0, RIGHT, H);
    for (let i = 0; i < 160; i++) {
      b.fillStyle = r() < 0.5 ? "#56412a" : "#836845";
      b.fillRect((GRID_END + r() * RIGHT) | 0, (r() * H) | 0, 2, 1);
    }
    for (let i = 0; i < 4; i++) {
      const cx = (GRID_END + 6 + r() * 14) | 0,
        cy = (6 + r() * (H - 12)) | 0;
      CRATERS.push([cx, cy]);
      b.fillStyle = "#3e2f1c";
      b.fillRect(cx - 3, cy - 1, 7, 3);
      b.fillRect(cx - 2, cy - 2, 5, 5);
    }
    b.fillStyle = "#3f3120";
    b.fillRect(0, 0, BASE, H);
    for (let y = 0; y < ROWS; y++)
      for (let k = 0; k < 3; k++)
        for (let j = 0; j < 2; j++) {
          const px = 1 + j * 8 + (k % 2) * 2,
            py = y * CELL + 4 + k * 6;
          b.fillStyle = "#141a0e";
          b.fillRect(px - 1, py - 1, 9, 6);
          b.fillStyle = "#b59a62";
          b.fillRect(px, py, 7, 4);
          b.fillStyle = "#d8c189";
          b.fillRect(px, py, 7, 1);
          b.fillStyle = "#86703f";
          b.fillRect(px, py + 3, 7, 1);
        }
  }

  /* ---------- som ---------- */
  let AC = null,
    sound = true,
    master,
    comp,
    sfxG,
    musG,
    verb,
    NB,
    LIM = {};
  function audio() {
    if (!AC) {
      try {
        AC = new (window.AudioContext || window.webkitAudioContext)();
        setupAudio();
      } catch (e) {
        AC = null;
      }
    }
    if (AC && AC.state === "suspended") AC.resume().catch(() => {});
  }
  function setupAudio() {
    comp = AC.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    master = AC.createGain();
    master.gain.value = sound ? 0.85 : 0;
    comp.connect(master);
    master.connect(AC.destination);
    sfxG = AC.createGain();
    sfxG.gain.value = 0.9;
    sfxG.connect(comp);
    musG = AC.createGain();
    musG.gain.value = 0.3;
    musG.connect(comp);
    verb = AC.createConvolver();
    const len = (AC.sampleRate * 2.2) | 0,
      ir = AC.createBuffer(2, len, AC.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.5);
    }
    verb.buffer = ir;
    const vg = AC.createGain();
    vg.gain.value = 0.5;
    verb.connect(vg);
    vg.connect(comp);
    NB = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = NB.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function route(n, bus, wet) {
    n.connect(bus);
    if (wet) {
      const w = AC.createGain();
      w.gain.value = wet;
      n.connect(w);
      w.connect(verb);
    }
  }
  function envG(t, a, peak, dec) {
    const g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    return g;
  }
  function nz(t, dur, o = {}) {
    const s = AC.createBufferSource();
    s.buffer = NB;
    const f = AC.createBiquadFilter();
    f.type = o.type || "lowpass";
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    f.Q.value = o.q || 0.7;
    const g = envG(t, o.a || 0.002, o.peak || 0.3, dur);
    s.connect(f);
    f.connect(g);
    route(g, o.bus || sfxG, o.wet);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  }
  function tn(t, dur, o = {}) {
    const s = AC.createOscillator();
    s.type = o.type || "sine";
    s.frequency.setValueAtTime(o.f || 200, t);
    if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    if (o.det) s.detune.value = o.det;
    let n = s;
    if (o.lp) {
      const f = AC.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = o.lp;
      s.connect(f);
      n = f;
    }
    const g = envG(t, o.a || 0.003, o.peak || 0.3, dur);
    n.connect(g);
    route(g, o.bus || sfxG, o.wet);
    s.start(t);
    s.stop(t + dur + 0.05);
    return s;
  }
  function lim(k, gap) {
    const n = AC.currentTime;
    if (LIM[k] && n - LIM[k] < gap) return false;
    LIM[k] = n;
    return true;
  }
  function groan(t, type) {
    const f0 = { normal: 105, runner: 140, armored: 85, spitter: 125, boss: 52 }[type] || 105,
      dur = type === "boss" ? 1.7 : rnd(0.7, 1.1);
    const o = AC.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f0 * rnd(1, 1.15), t);
    o.frequency.linearRampToValueAtTime(f0 * rnd(0.7, 0.85), t + dur);
    const lfo = AC.createOscillator(),
      lg = AC.createGain();
    lfo.frequency.value = rnd(4, 7);
    lg.gain.value = f0 * 0.06;
    lfo.connect(lg);
    lg.connect(o.frequency);
    const f1 = AC.createBiquadFilter(),
      f2 = AC.createBiquadFilter();
    f1.type = f2.type = "bandpass";
    f1.frequency.value = type === "boss" ? 420 : 650;
    f2.frequency.value = type === "boss" ? 900 : 1150;
    f1.Q.value = f2.Q.value = 5;
    const g = envG(t, 0.12, type === "boss" ? 0.55 : 0.22, dur);
    o.connect(f1);
    o.connect(f2);
    f1.connect(g);
    f2.connect(g);
    route(g, sfxG, 0.35);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.2);
    lfo.stop(t + dur + 0.2);
  }
  function sfx(t, k = 1) {
    if (!sound || !AC) return;
    try {
      const n = AC.currentTime + 0.005,
        r = rnd(0.92, 1.08);
      switch (t) {
        case "shot":
          if (!lim("shot", 0.045)) return;
          nz(n, 0.07, { type: "bandpass", f: 2400 * r, q: 0.9, peak: 0.45, wet: 0.12 });
          nz(n, 0.16, { f: 900, f2: 200, peak: 0.25 });
          tn(n, 0.06, { type: "square", f: 170 * r, f2: 55, peak: 0.18, lp: 900 });
          break;
        case "cannon":
          nz(n, 0.05, { type: "highpass", f: 3500, peak: 0.5 });
          tn(n, 0.55, { f: 95, f2: 28, peak: 1 });
          nz(n, 0.6, { f: 1800, f2: 180, peak: 0.8, wet: 0.6 });
          break;
        case "boom":
          if (!lim("boom", 0.05)) return;
          {
            const L = 0.55 + 0.3 * k;
            tn(n, L, { f: 75 * r, f2: 24, peak: Math.min(1, 0.55 + 0.2 * k) });
            nz(n, L + 0.25, { f: 2600, f2: 120, peak: Math.min(1, 0.45 + 0.2 * k), wet: 0.7 });
            nz(n, 0.05, { type: "highpass", f: 2500, peak: 0.35 });
            for (let i = 0; i < 3 + k * 2; i++)
              nz(n + rnd(0.05, 0.45), 0.04, { type: "bandpass", f: rnd(1500, 4000), q: 2, peak: rnd(0.05, 0.15) });
          }
          break;
        case "mortar":
          tn(n, 0.22, { f: 200, f2: 60, peak: 0.6 });
          nz(n, 0.18, { f: 1400, f2: 300, peak: 0.4, wet: 0.3 });
          tn(n + 0.35, k - 0.45, { f: 2100, f2: 520, peak: 0.05, wet: 0.3 });
          break;
        case "launch":
          nz(n, 0.5, { type: "bandpass", f: 500, f2: 2600, q: 1.4, peak: 0.35, wet: 0.25 });
          nz(n, 0.08, { f: 600, peak: 0.4 });
          break;
        case "throw":
          nz(n, 0.16, { type: "bandpass", f: 1400, f2: 450, q: 1.2, peak: 0.15 });
          break;
        case "reload":
          nz(n, 0.03, { type: "highpass", f: 3000, peak: 0.25 });
          tn(n, 0.03, { type: "square", f: 1300, peak: 0.06 });
          nz(n + 0.28, 0.04, { type: "highpass", f: 2200, peak: 0.3 });
          tn(n + 0.28, 0.04, { type: "square", f: 900, peak: 0.07 });
          break;
        case "hit":
        case "squish":
          if (!lim("sq", 0.03)) return;
          nz(n, 0.09, { f: 900 * r, f2: 250, peak: 0.3 });
          tn(n, 0.08, { f: 130 * r, f2: 60, peak: 0.22 });
          break;
        case "groan":
          if (!lim("groan", 0.5)) return;
          groan(n, k);
          break;
        case "stomp":
          if (!lim("stomp", 0.2)) return;
          tn(n, 0.3, { f: 62, f2: 28, peak: 0.7 });
          nz(n, 0.25, { f: 350, f2: 90, peak: 0.4, wet: 0.3 });
          break;
        case "spit":
          nz(n, 0.25, { type: "bandpass", f: 1800, f2: 380, q: 2, peak: 0.3 });
          tn(n, 0.2, { type: "triangle", f: 420, f2: 150, peak: 0.12 });
          break;
        case "coin":
          tn(n, 0.08, { type: "triangle", f: 988, peak: 0.14, wet: 0.3 });
          tn(n + 0.08, 0.25, { type: "triangle", f: 1319, peak: 0.14, wet: 0.3 });
          break;
        case "place":
          tn(n, 0.14, { f: 150, f2: 70, peak: 0.45 });
          nz(n, 0.03, { type: "highpass", f: 3200, peak: 0.18 });
          nz(n + 0.06, 0.03, { type: "highpass", f: 2600, peak: 0.12 });
          break;
        case "alarm":
          for (let i = 0; i < 2; i++)
            tn(n + i * 0.32, 0.28, { type: "square", f: 700, f2: 470, peak: 0.09, lp: 2500, wet: 0.3 });
          break;
        case "wave":
          [392, 523, 659, 784].forEach((f, i) =>
            tn(n + i * 0.14, i === 3 ? 0.5 : 0.13, { type: "sawtooth", f, peak: 0.13, lp: 1900, a: 0.02, wet: 0.4 }),
          );
          break;
        case "lose":
          [392, 330, 262, 196].forEach((f, i) =>
            tn(n + i * 0.3, 0.35, { type: "sawtooth", f, peak: 0.13, lp: 1400, a: 0.02, wet: 0.5 }),
          );
          break;
      }
    } catch (e) {}
  }
  /* trilha militar procedural */
  let nextStep = 0,
    step = 0;
  const SPB = 60 / 104 / 4,
    BASS = [73.42, 73.42, 58.27, 65.41];
  function music() {
    if (!AC || !sound || state !== "play") {
      nextStep = 0;
      return;
    }
    const now = AC.currentTime;
    if (nextStep < now) nextStep = now + 0.05;
    const fight = waveState === "fight",
      boss = zs.some((z) => z.d.big);
    while (nextStep < now + 0.15) {
      const t = nextStep,
        i = step % 16,
        bar = ((step / 16) | 0) % 4,
        M = { bus: musG };
      if (i === 0 || i === 8 || (fight && i === 10)) tn(t, 0.28, { f: 110, f2: 38, peak: 0.8, ...M });
      if (i === 4 || i === 12) {
        nz(t, 0.14, { type: "highpass", f: 1400, peak: 0.5, ...M, wet: 0.15 });
        tn(t, 0.07, { type: "triangle", f: 190, peak: 0.2, ...M });
      } else if ((bar === 3 && i >= 13) || i === 15 || (fight && i % 4 === 2))
        nz(t, 0.06, { type: "highpass", f: 1800, peak: 0.14, ...M });
      if (fight && i % 2 === 0) nz(t, 0.03, { type: "highpass", f: 7500, peak: i % 4 === 0 ? 0.07 : 0.04, ...M });
      if ([0, 3, 6, 8, 11, 14].includes(i))
        tn(t, 0.17, {
          type: "sawtooth",
          f: BASS[bar] * (i === 14 ? 1.5 : 1),
          peak: fight ? 0.24 : 0.15,
          lp: fight ? 520 : 320,
          ...M,
        });
      if (boss && (i === 0 || i === 6)) {
        for (const m of [1, 1.19, 1.5])
          tn(t, 0.22, { type: "square", f: BASS[bar] * 4 * m, peak: 0.035, lp: 1600, ...M, wet: 0.2 });
      }
      nextStep += SPB;
      step++;
    }
  }
  /* ---------- estado ---------- */
  let bannerTO;
  function banner(t, s = 1.8) {
    const b = $("banner");
    b.textContent = t;
    b.classList.add("show");
    clearTimeout(bannerTO);
    bannerTO = setTimeout(() => b.classList.remove("show"), s * 1000);
  }
  let groanT = 2,
    state = "menu",
    spd = 1,
    units,
    zs,
    proj,
    parts,
    crates,
    money,
    life,
    score,
    wave,
    waveState,
    timer,
    queue,
    spawnT,
    crateT,
    cardCd,
    sel = null,
    hover = null,
    kills = 0,
    incomeT = 5,
    submitted = false;
  let best = 0;
  try {
    best = +localStorage.getItem("arenaverde.best") || 0;
  } catch (e) {}
  function reset() {
    fxs = [];
    corpses = [];
    trauma = 0;
    flashA = 0;
    slowT = 0;
    dc.clearRect(0, 0, W, H);
    units = [];
    zs = [];
    proj = [];
    parts = [];
    crates = [];
    money = 350;
    life = 100;
    score = 0;
    wave = 0;
    kills = 0;
    waveState = "prep";
    timer = 10;
    queue = [];
    spawnT = 0;
    crateT = 7;
    cardCd = {};
    ALL.forEach((k) => (cardCd[k] = 0));
    sel = null;
    submitted = false;
    incomeT = 5;
    $("bossbar").hidden = true;
    banner("PREPARE A DEFESA!", 2.2);
  }
  // Continua de onde parou (início da próxima onda, com moedas e pontos salvos)
  function resumeFrom(p) {
    reset();
    wave = Math.max(0, Math.min(MAX_WAVE - 1, p.wave_atual - 1));
    money = p.moedas;
    score = p.pontuacao;
    timer = 8;
    banner(`CONTINUANDO · ONDA ${wave + 1}`, 2.2);
  }

  function buildWave(n) {
    const cnt = 4 + n * 2,
      out = [];
    const w = {
      normal: 6,
      runner: n >= 2 ? 3 + n * 0.3 : 0,
      armored: n >= 3 ? 1.5 + n * 0.25 : 0,
      spitter: n >= 4 ? 1.5 + n * 0.2 : 0,
    };
    const tot = Object.values(w).reduce((a, b) => a + b, 0);
    for (let i = 0; i < cnt; i++) {
      let r = Math.random() * tot;
      for (const k in w) {
        r -= w[k];
        if (r <= 0) {
          out.push(k);
          break;
        }
      }
    }
    if (n === MAX_WAVE) out.push("boss"); // Chefão só na onda final
    return out;
  }
  function startWave() {
    wave++;
    queue = buildWave(wave);
    spawnT = 1.5;
    waveState = "fight";
    banner(wave === MAX_WAVE ? `ONDA ${wave} · CHEFÃO!` : `ONDA ${wave} / ${MAX_WAVE}`);
    sfx("wave");
    for (const k in UNLOCK_AT) if (wave >= UNLOCK_AT[k]) setTimeout(() => unlockCard(k), 2200);
  }
  function spawn(type) {
    const d = ZD[type],
      hs = 1 + (wave - 1) * 0.08;
    const hp = Math.round(d.hp * hs);
    zs.push({
      type,
      d,
      row: (Math.random() * ROWS) | 0,
      x: GRID_END + 12 + Math.random() * 10,
      hp,
      max: hp,
      half: d.big ? 11 : 6,
      t: Math.random() * 3,
      fl: 0,
      sc: 1,
      gun: 2, // chefão: tempo até a próxima rajada
      burst: 0,
      bt: 0,
      firing: 0,
      bite: false,
      dead: false,
    });
    if (d.big) $("bossbar").hidden = false;
  }

  /* ---------- efeitos ---------- */
  function part(x, y, vx, vy, life, col, s = 1, g = 0) {
    parts.push({ x, y, vx, vy, life, max: life, col, s, g });
  }
  const fxc = $("fx"),
    fx = fxc.getContext("2d");
  let FS = 3,
    CSS_S = 1,
    vign = null;
  const decal = mk(W, H),
    dc = decal.getContext("2d");
  function glowImg(r, g, b, hard) {
    const c = mk(64, 64),
      x = c.getContext("2d"),
      gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
    gr.addColorStop(hard ? 0.3 : 0.2, `rgba(${r},${g},${b},${hard ? 0.85 : 0.55})`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    return c;
  }
  const GL = {
    w: glowImg(255, 250, 235, 1),
    y: glowImg(255, 214, 90, 1),
    o: glowImg(255, 130, 25, 1),
    r: glowImg(190, 45, 15, 1),
    g: glowImg(150, 240, 60, 1),
    sd: glowImg(38, 36, 32),
    sl: glowImg(125, 122, 112),
    dust: glowImg(150, 120, 80),
    gs: glowImg(255, 225, 160),
  };
  const FIRE = [GL.w, GL.y, GL.o, GL.r];
  let fxs = [],
    corpses = [],
    trauma = 0,
    flashA = 0,
    flashC = "255,255,255",
    slowT = 0,
    ambT = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function add(o) {
    fxs.push(o);
    if (fxs.length > 1200) fxs.splice(0, fxs.length - 1200);
  }
  function G(img, x, y, o) {
    const p = Object.assign(
      { k: "g", img, x, y, vx: 0, vy: 0, r0: 2, r1: 4, life: 0.3, add: true, a: 1, drag: 0, g: 0 },
      o,
    );
    p.max = p.life;
    add(p);
  }
  function scorch(x, y, r) {
    for (let i = 0; i < 3; i++) {
      dc.fillStyle = `rgba(22,16,8,${0.22 + i * 0.12})`;
      dc.beginPath();
      dc.ellipse(x, y, r * (1 - i * 0.3), r * 0.5 * (1 - i * 0.3), 0, 0, 7);
      dc.fill();
    }
  }
  function splat(x, y, c) {
    dc.fillStyle = c || "rgba(70,150,30,.6)";
    dc.fillRect(x | 0, y | 0, 1 + ((Math.random() * 2) | 0), 1);
  }
  function puff(x, y, n = 4, img = GL.dust) {
    for (let i = 0; i < n; i++)
      G(img, x + rnd(-4, 4), y, {
        add: false,
        a: 0.45,
        vx: rnd(-14, 14),
        vy: -rnd(2, 8),
        r0: 2,
        r1: rnd(6, 9),
        life: rnd(0.5, 0.9),
        drag: 2,
      });
  }
  function boom(x, y, k = 1) {
    sfx("boom", k);
    trauma = Math.min(1, trauma + 0.2 * k);
    if (k >= 1.8) {
      flashA = Math.max(flashA, 0.12 * k);
      flashC = "255,236,190";
    }
    G(GL.gs, x, y, { r0: 14 * k, r1: 34 * k, life: 0.22, a: 0.9 });
    G(GL.w, x, y, { r0: 5 * k, r1: 12 * k, life: 0.12 });
    add({ k: "ring", x, y: y + 2, r0: 2, r1: 18 * k, life: 0.35, max: 0.35, w: 1.8 });
    for (let i = 0; i < 10 * k; i++) {
      const a = rnd(0, 6.28),
        v = rnd(5, 30) * k;
      G(null, x + rnd(-3, 3) * k, y + rnd(-3, 2) * k, {
        fire: true,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * 0.6 - rnd(8, 24),
        r0: rnd(2, 4) * k,
        r1: rnd(6, 11) * k,
        life: rnd(0.35, 0.75),
        drag: 2.6,
      });
    }
    for (let i = 0; i < 7 * k; i++)
      G(Math.random() < 0.55 ? GL.sd : GL.sl, x + rnd(-5, 5) * k, y - rnd(0, 6) * k, {
        add: false,
        a: 0.55,
        smoke: 1,
        vx: rnd(-6, 12),
        vy: -rnd(6, 18),
        r0: rnd(3, 5) * k,
        r1: rnd(12, 22) * k,
        life: rnd(1.6, 3),
        drag: 0.7,
      });
    for (let i = 0; i < 14 * k; i++) {
      const a = rnd(3.3, 6.1),
        v = rnd(60, 160) * Math.sqrt(k);
      add({
        k: "s",
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rnd(0.25, 0.6),
        max: 0.6,
        g: 240,
        col: Math.random() < 0.5 ? "255,225,130" : "255,150,50",
      });
    }
    for (let i = 0; i < 8 * k; i++) {
      const a = rnd(3.5, 5.9),
        v = rnd(40, 120);
      add({
        k: "d",
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        rot: rnd(0, 6),
        vr: rnd(-15, 15),
        sz: rnd(0.8, 2.2),
        col: Math.random() < 0.6 ? "#3b2a17" : "#5c5c54",
        gy: y + rnd(2, 7),
        life: rnd(1.2, 2.2),
        max: 2.2,
      });
    }
    for (let i = 0; i < 6 * k; i++)
      G(GL.o, x + rnd(-6, 6) * k, y - rnd(0, 6), {
        vx: rnd(-12, 12),
        vy: -rnd(12, 34),
        r0: 1.1,
        r1: 0.3,
        life: rnd(0.8, 1.9),
        drag: 0.5,
        ember: rnd(0, 6),
      });
    scorch(x, y + 3, 4 * k);
  }
  function muzzle(x, y, s = 1) {
    G(GL.y, x + 2 * s, y, { r0: 3 * s, r1: 5 * s, life: 0.07 });
    G(GL.w, x + 1, y, { r0: 1.6 * s, r1: 2.2 * s, life: 0.05 });
    G(GL.gs, x, y, { r0: 13 * s, r1: 15 * s, life: 0.08, a: 0.4 });
    for (let i = 0; i < 3; i++)
      add({ k: "s", x: x + 1, y, vx: rnd(90, 170), vy: rnd(-35, 35), life: 0.06, max: 0.06, g: 0, col: "255,232,150" });
    G(GL.sl, x + 3, y, {
      add: false,
      a: 0.35,
      vx: rnd(8, 18),
      vy: -rnd(3, 8),
      r0: 1.5 * s,
      r1: 5 * s,
      life: 0.6,
      drag: 1.5,
      smoke: 1,
    });
  }
  function gore(x, y, n, big) {
    for (let i = 0; i < n; i++)
      add({
        k: "d",
        x: x + rnd(-2, 2),
        y: y + rnd(-3, 3),
        vx: rnd(-25, 75),
        vy: -rnd(20, 80),
        rot: 0,
        vr: 0,
        sz: rnd(0.6, big ? 2.4 : 1.5),
        col: Math.random() < 0.5 ? "#86e33e" : "#3f8a1c",
        gy: y + rnd(6, 11),
        life: rnd(0.8, 1.6),
        max: 1.6,
        blood: 1,
      });
    G(GL.g, x, y, { r0: 2, r1: 7, life: 0.12, a: 0.45 });
  }
  function txt(x, y, v, col = "255,236,150") {
    add({
      k: "t",
      x: x + rnd(-3, 3),
      y,
      vy: -22,
      txt: typeof v === "number" ? String(Math.round(v)) : v,
      life: 0.75,
      max: 0.75,
      col,
    });
  }
  function stepFx(dt) {
    for (const p of fxs) {
      p.life -= dt;
      if (p.k === "g") {
        p.vy += p.g * dt;
        const dr = Math.max(0, 1 - p.drag * dt);
        p.vx *= dr;
        p.vy *= dr;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.smoke) p.vx += 4 * dt;
        if (p.ember !== undefined) p.x += Math.sin(p.life * 9 + p.ember) * 0.15;
      } else if (p.k === "s") {
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.k === "d") {
        p.vy += 320 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.y > p.gy) {
          p.y = p.gy;
          if (p.blood && !p.sp) {
            p.sp = 1;
            splat(p.x, p.y);
          }
          p.vy *= -0.3;
          p.vx *= 0.55;
          p.vr *= 0.5;
        }
      } else if (p.k === "t") {
        p.y += p.vy * dt;
        p.vy *= 0.95;
      }
    }
    fxs = fxs.filter((p) => p.life > 0);
    for (const c of corpses) c.t += dt;
    corpses = corpses.filter((c) => c.t < 2.6);
    ambT -= dt;
    if (ambT <= 0) {
      ambT = 0.35;
      const c = CRATERS[(Math.random() * CRATERS.length) | 0];
      if (c)
        G(GL.sd, c[0] + rnd(-2, 2), c[1], {
          add: false,
          a: 0.28,
          smoke: 1,
          vx: rnd(-2, 3),
          vy: -rnd(5, 9),
          r0: 2,
          r1: rnd(9, 14),
          life: rnd(2.5, 4),
          drag: 0.2,
        });
    }
  }
  function drawFx(sx, sy) {
    fx.setTransform(1, 0, 0, 1, 0, 0);
    fx.clearRect(0, 0, fxc.width, fxc.height);
    fx.setTransform(FS, 0, 0, FS, sx * FS, sy * FS);
    // projéteis com luz
    fx.globalCompositeOperation = "lighter";
    for (const p of proj) {
      const x = p.x,
        y = p.y;
      if (p.k === "bullet") {
        fx.globalAlpha = 1;
        fx.strokeStyle = "rgba(255,225,140,.95)";
        fx.lineWidth = 0.8;
        fx.beginPath();
        fx.moveTo(x - 9, y + 0.5);
        fx.lineTo(x, y + 0.5);
        fx.stroke();
        fx.drawImage(GL.y, x - 2.5, y - 2, 5, 5);
      } else if (p.k === "shell") {
        fx.strokeStyle = "rgba(255,160,60,.9)";
        fx.lineWidth = 1.2;
        fx.beginPath();
        fx.moveTo(x - 12, y + 0.5);
        fx.lineTo(x, y + 0.5);
        fx.stroke();
        fx.drawImage(GL.o, x - 4, y - 3.5, 8, 8);
      } else if (p.k === "missile") {
        const f = rnd(0.8, 1.3);
        fx.drawImage(GL.o, x - 9 - 4 * f, y - 4 * f + 0.5, 8 * f, 8 * f);
        fx.drawImage(GL.w, x - 7 - 1.5, y - 1, 3, 3);
        fx.globalAlpha = 0.35;
        fx.drawImage(GL.gs, x - 20, y - 14, 28, 28);
        fx.globalAlpha = 1;
      } else if (p.k === "acid") {
        fx.drawImage(GL.g, x - 5, y - 5, 10, 10);
      } else if (p.k === "zb") {
        fx.globalAlpha = 1;
        fx.strokeStyle = "rgba(255,200,120,.95)";
        fx.lineWidth = 0.8;
        fx.beginPath();
        fx.moveTo(x, y + 0.5);
        fx.lineTo(x + 9, y + 0.5);
        fx.stroke();
        fx.drawImage(GL.o, x - 2.5, y - 2, 5, 5);
      } else if (p.k === "gren" && ((p.t * 20) | 0) % 2) {
        fx.globalAlpha = 0.4;
        fx.drawImage(GL.r, x - 2, y - 2, 4, 4);
        fx.globalAlpha = 1;
      }
    }
    for (const p of fxs) {
      const f = 1 - p.life / p.max;
      if (p.k === "g") {
        const e = 1 - (1 - f) * (1 - f),
          r = p.r0 + (p.r1 - p.r0) * e;
        let a = p.smoke ? p.a * Math.min(1, f * 5) * (1 - f) : p.a * Math.pow(1 - f, 1.3);
        if (a <= 0.003 || r <= 0) continue;
        const img = p.fire ? FIRE[Math.min(3, (f * 4.2) | 0)] : p.img;
        fx.globalCompositeOperation = p.add ? "lighter" : "source-over";
        fx.globalAlpha = Math.min(1, a);
        fx.drawImage(img, p.x - r, p.y - r, r * 2, r * 2);
      } else if (p.k === "s") {
        fx.globalCompositeOperation = "lighter";
        fx.globalAlpha = 1 - f;
        fx.strokeStyle = `rgb(${p.col})`;
        fx.lineWidth = 0.6;
        fx.beginPath();
        fx.moveTo(p.x, p.y);
        fx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        fx.stroke();
      } else if (p.k === "ring") {
        const e = 1 - (1 - f) ** 3,
          r = p.r0 + (p.r1 - p.r0) * e;
        fx.globalCompositeOperation = "lighter";
        fx.globalAlpha = (1 - f) * 0.8;
        fx.strokeStyle = "rgb(255,236,200)";
        fx.lineWidth = p.w * (1 - f) + 0.2;
        fx.beginPath();
        fx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, 7);
        fx.stroke();
      } else if (p.k === "d") {
        fx.globalCompositeOperation = "source-over";
        fx.globalAlpha = Math.min(1, p.life / (p.max * 0.3));
        fx.save();
        fx.translate(p.x, p.y);
        fx.rotate(p.rot);
        fx.fillStyle = p.col;
        fx.fillRect(-p.sz / 2, -p.sz / 2, p.sz, p.sz);
        fx.restore();
      } else if (p.k === "t") {
        fx.globalCompositeOperation = "source-over";
        fx.globalAlpha = Math.min(1, (1 - f) * 2);
        fx.font = "5px 'Press Start 2P',monospace";
        fx.textAlign = "center";
        fx.lineWidth = 1.5;
        fx.strokeStyle = "#141a0e";
        fx.strokeText(p.txt, p.x, p.y);
        fx.fillStyle = `rgb(${p.col})`;
        fx.fillText(p.txt, p.x, p.y);
      }
    }
    fx.globalCompositeOperation = "source-over";
    fx.globalAlpha = 1;
    fx.setTransform(1, 0, 0, 1, 0, 0);
    if (vign) fx.drawImage(vign, 0, 0);
    if (flashA > 0.01) {
      fx.fillStyle = `rgba(${flashC},${flashA})`;
      fx.fillRect(0, 0, fxc.width, fxc.height);
    }
  }
  function buildVign() {
    const w = fxc.width,
      h = fxc.height,
      c = mk(w, h),
      x = c.getContext("2d");
    const gr = x.createRadialGradient(w / 2, h * 0.45, h * 0.35, w / 2, h / 2, w * 0.62);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(1, "rgba(8,10,2,.5)");
    x.fillStyle = gr;
    x.fillRect(0, 0, w, h);
    const lg = x.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, "rgba(255,226,150,.09)");
    lg.addColorStop(0.5, "rgba(255,226,150,0)");
    x.fillStyle = lg;
    x.fillRect(0, 0, w, h);
    vign = c;
  }
  function coins(x, y) {
    for (let i = 0; i < 5; i++)
      part(x, y, (Math.random() - 0.5) * 30, -40 - Math.random() * 25, 0.6, "#f2c230", 1, 120);
  }
  function zy(z) {
    return z.row * CELL + CELL - 1 - (z.d.big ? 0 : 8);
  }
  function hurt(z, d, quiet) {
    if (z.dead) return;
    z.hp -= d;
    const y = zy(z);
    if (!quiet) {
      z.fl = 0.07;
      gore(z.x, y, 3);
      sfx("squish");
      if (d >= 40) txt(z.x, y - 10, d);
      if (!z.d.big && d >= 25) {
        z.x += d >= 60 ? 3 : 1.2;
        z.stun = d >= 60 ? 0.25 : 0.1;
      }
    }
    if (z.hp <= 0) {
      z.dead = true;
      kills++;
      money += z.d.cash;
      score += z.d.pts;
      gore(z.x, y, z.d.big ? 40 : 16, z.d.big);
      corpses.push({
        img: IMG["z_" + z.type] || ZF[z.type].walk[1],
        h: IMG["z_" + z.type] ? SPRITE_H["z_" + z.type] : 0,
        x: z.x,
        b: z.row * CELL + CELL - 1 + (z.d.big ? 2 : 0),
        t: 0,
      });
      coins(z.x, y - 4);
      txt(z.x, y - 16, "+$" + z.d.cash, "140,235,90");
      sfx("hit");
      if (z.d.big) {
        boom(z.x, y, 3);
        slowT = 0.7;
        flashA = 0.5;
        banner("CHEFE ABATIDO!");
      }
    }
  }
  function splash(row, x, r, d) {
    for (const z of zs) if (!z.dead && z.row === row && Math.abs(z.x - x) <= r + z.half) hurt(z, d);
  }
  function killUnit(u) {
    u.dead = true;
    if (u.type === "tank") {
      boom(u.x, u.y + 2, 1.7);
      return;
    }
    for (let i = 0; i < 12; i++)
      add({
        k: "d",
        x: u.x,
        y: u.y,
        vx: rnd(-50, 50),
        vy: -rnd(30, 80),
        rot: rnd(0, 6),
        vr: rnd(-12, 12),
        sz: rnd(0.8, 1.8),
        col: i % 2 ? "#4f6b2a" : "#5c6268",
        gy: u.y + rnd(4, 9),
        life: 1.4,
        max: 1.4,
      });
    puff(u.x, u.y + 8, 5, GL.sl);
    sfx("hit");
  }
  function mineBoom(u) {
    u.dead = true;
    splash(u.row, u.x, U.mine.splash, U.mine.dmg);
    boom(u.x, u.y + 4, 2.3);
    slowT = Math.max(slowT, 0.25);
  }

  /* ---------- atualização ---------- */
  function mortTarget(u) {
    let best = null,
      bs = -1;
    for (const z of zs) {
      if (z.dead || z.row !== u.row || z.x < u.x + U.mortar.min || z.x > GRID_END + 8) continue;
      let n = 0;
      for (const o of zs) if (!o.dead && o.row === u.row && Math.abs(o.x - z.x) < 24) n++;
      if (n > bs || (n === bs && z.x < best.x)) {
        bs = n;
        best = z;
      }
    }
    return best;
  }
  // Zumbi mais próximo à frente, na mesma linha, dentro do alcance (em casas)
  function target(row, x, range = Infinity) {
    let b = null;
    const maxX = x + range * CELL;
    for (const z of zs)
      if (!z.dead && z.row === row && z.x > x - 4 && z.x < GRID_END + 8 && z.x - z.half <= maxX && (!b || z.x < b.x))
        b = z;
    return b;
  }
  function update(dt) {
    for (const k of ALL) cardCd[k] = Math.max(0, cardCd[k] - dt);
    if (waveState === "prep") {
      timer -= dt;
      if (timer <= 0) startWave();
    } else {
      spawnT -= dt;
      if (spawnT <= 0 && queue.length) {
        spawn(queue.shift());
        spawnT = Math.max(0.8, 3.4 - wave * 0.2) * (0.6 + Math.random() * 0.8);
      }
      if (!queue.length && !zs.some((z) => !z.dead)) {
        const b = 50 + wave * 10;
        money += b;
        score += wave * 500;
        if (wave >= MAX_WAVE) return victory();
        waveState = "prep";
        timer = 7;
        banner(`ONDA LIMPA! +$${b}`);
        sfx("coin");
        // salva o progresso automaticamente (local + D1)
        progress = { wave_atual: wave + 1, moedas: money, pontuacao: score, squad: ORDER };
        saveProgress();
      }
    }
    // moedas com o tempo
    incomeT -= dt;
    if (incomeT <= 0) {
      incomeT = 5;
      money += 10;
    }
    crateT -= dt;
    if (crateT <= 0) {
      crateT = 9 + Math.random() * 6;
      crates.push({
        x: GX + 12 + Math.random() * (COLS * CELL - 24),
        y: -10,
        ty: 16 + Math.random() * (H - 26),
        land: false,
        life: 9,
      });
    }
    for (const c of crates) {
      if (!c.land) {
        c.y += 24 * dt;
        if (c.y >= c.ty) {
          c.y = c.ty;
          c.land = true;
          puff(c.x, c.y + 3, 5);
        }
      } else c.life -= dt;
    }
    crates = crates.filter((c) => c.life > 0);

    for (const u of units) {
      if (u.dead) continue;
      u.t += dt;
      u.fl = Math.max(0, u.fl - dt);
      u.rec = Math.max(0, u.rec - dt);
      u.throwT = Math.max(0, (u.throwT || 0) - dt);
      const d = U[u.type],
        b = u.row * CELL + CELL - 2;
      if (u.type === "mine") {
        u.arm -= dt;
        continue;
      }
      if (u.type === "wire") continue;
      if (u.type === "tank") {
        u.ex = (u.ex || 0) - dt;
        if (u.ex <= 0) {
          u.ex = rnd(0.5, 1.1);
          G(GL.sd, u.x - 12, b - 9, {
            add: false,
            a: 0.3,
            smoke: 1,
            vx: -rnd(4, 10),
            vy: -rnd(4, 9),
            r0: 1,
            r1: rnd(3, 5),
            life: 1.1,
            drag: 0.5,
          });
        }
      }
      if (u.wind > 0) {
        u.wind -= dt;
        if (u.wind <= 0) {
          const tg = target(u.row, u.x, d.range);
          if (tg) {
            const T = 0.8,
              tx = Math.max(u.x + 8, tg.x - (tg.bite ? 0 : tg.d.sp * T)),
              [mx, my] = MUZZLE.grenade;
            proj.push({
              k: "gren",
              x0: u.x + mx,
              y0: b + my,
              x: u.x + mx,
              y: b + my,
              tx,
              ty: b - 4,
              t: 0,
              T,
              row: u.row,
              dmg: d.dmg,
              splash: d.splash,
            });
          }
          u.throwT = 0.22;
          sfx("throw");
        }
        continue;
      }
      if (u.reload > 0) {
        u.reload -= dt;
        if (u.reload <= 0) u.ammo = d.ammo;
        continue;
      }
      u.cd -= dt;
      if (u.cd > 0) continue;
      const tg = u.type === "mortar" ? mortTarget(u) : target(u.row, u.x, d.range);
      if (!tg) continue;
      u.cd = d.rate;
      u.rec = u.type === "tank" ? 0.22 : 0.1;
      const [mx, my] = MUZZLE[u.type] || [9, -7]; // saída do tiro
      if (u.type === "rifle") {
        proj.push({ k: "bullet", x: u.x + mx, y: b + my, vx: 220, row: u.row, dmg: d.dmg });
        muzzle(u.x + mx + 1, b + my, 0.8);
        part(u.x + 3, b + my, -rnd(10, 30), -rnd(30, 50), 0.7, "#d9a440", 1, 260);
        sfx("shot");
        if (--u.ammo <= 0) {
          u.reload = d.reload;
          sfx("reload");
        }
      } else if (u.type === "tank") {
        proj.push({ k: "shell", x: u.x + mx, y: b + my, vx: 240, row: u.row, dmg: d.dmg, splash: d.splash });
        muzzle(u.x + mx + 1, b + my, 1.7);
        puff(u.x + 10, b - 1, 4);
        trauma = Math.min(1, trauma + 0.12);
        sfx("cannon");
      } else if (u.type === "missile") {
        proj.push({ k: "missile", x: u.x + mx, y: b + my, vx: 40, row: u.row, dmg: d.dmg, splash: d.splash });
        G(GL.o, u.x - 9, b + my + 1, { r0: 4, r1: 2, life: 0.12 }); // jato traseiro
        for (let i = 0; i < 5; i++)
          G(GL.sl, u.x - 9, b + my + 1, {
            add: false,
            a: 0.45,
            smoke: 1,
            vx: -rnd(20, 50),
            vy: rnd(-8, 4),
            r0: 2,
            r1: rnd(6, 9),
            life: rnd(0.6, 1),
            drag: 2,
          });
        sfx("launch");
      } else if (u.type === "grenade") {
        u.wind = 0.2;
        u.rec = 0;
      } else if (u.type === "mg") {
        proj.push({ k: "bullet", x: u.x + mx, y: b + my, vx: 240, row: u.row, dmg: d.dmg });
        muzzle(u.x + mx + 1, b + my, 0.6);
        if (Math.random() < 0.5) part(u.x + 2, b - 8, -rnd(10, 30), -rnd(30, 50), 0.6, "#d9a440", 1, 260);
        sfx("shot");
        if (--u.ammo <= 0) {
          u.reload = d.reload;
          sfx("reload");
          G(GL.sl, u.x + 16, b - 8, { add: false, a: 0.4, smoke: 1, vy: -10, r0: 2, r1: 7, life: 1.2 });
        }
      } else if (u.type === "mortar") {
        const T = 1.4;
        proj.push({
          k: "mort",
          x0: u.x + mx,
          y0: b + my,
          x: u.x + mx,
          y: b + my,
          tx: tg.x - (tg.bite || tg.stun > 0 ? 0 : tg.d.sp * T),
          ty: b - 4,
          t: 0,
          T,
          row: u.row,
          dmg: d.dmg,
          splash: d.splash,
        });
        muzzle(u.x + mx, b + my - 1, 0.9);
        puff(u.x + 4, b, 3);
        sfx("mortar", T);
      }
    }
    for (const p of proj) {
      if (p.dead) continue;
      if (p.k === "mort") {
        p.t += dt;
        const f = Math.min(1, p.t / p.T);
        p.x = p.x0 + (p.tx - p.x0) * f;
        p.y = p.y0 + (p.ty - p.y0) * f - Math.sin(f * Math.PI) * 70;
        if (Math.random() < 0.6) G(GL.sl, p.x, p.y, { add: false, a: 0.25, smoke: 1, r0: 0.8, r1: 3, life: 0.6 });
        if (f >= 1) {
          splash(p.row, p.x, p.splash, p.dmg);
          boom(p.x, p.ty, 1.4);
          p.dead = true;
        }
        continue;
      }
      if (p.k === "gren") {
        p.t += dt;
        if (Math.random() < 0.5) G(GL.sl, p.x, p.y, { add: false, a: 0.25, smoke: 1, r0: 0.8, r1: 3, life: 0.5 });
        const f = Math.min(1, p.t / p.T);
        p.x = p.x0 + (p.tx - p.x0) * f;
        p.y = p.y0 + (p.ty - p.y0) * f - Math.sin(f * Math.PI) * 26;
        if (f >= 1) {
          splash(p.row, p.x, p.splash, p.dmg);
          boom(p.x, p.ty, 1);
          p.dead = true;
        }
        continue;
      }
      if (p.k === "zb") {
        // bala do chefão: acerta a primeira unidade da linha (cerca leva o triplo)
        p.x += p.vx * dt;
        for (const u of units)
          if (!u.dead && u.row === p.row && u.type !== "mine" && Math.abs(u.x - p.x) < 6) {
            u.hp -= p.dmg * (u.type === "wire" ? 3 : 1);
            u.fl = 0.08;
            for (let i = 0; i < 3; i++)
              add({
                k: "s",
                x: p.x,
                y: p.y,
                vx: rnd(30, 90),
                vy: rnd(-50, 20),
                life: 0.12,
                max: 0.12,
                g: 200,
                col: "255,240,180",
              });
            if (u.hp <= 0) killUnit(u);
            p.dead = true;
            break;
          }
        if (p.x < BASE) p.dead = true;
        continue;
      }
      if (p.k === "acid") {
        p.x += p.vx * dt;
        if (Math.random() < 0.3)
          add({
            k: "d",
            x: p.x,
            y: p.y,
            vx: 0,
            vy: 0,
            rot: 0,
            vr: 0,
            sz: 0.8,
            col: "#9be22d",
            gy: p.y + 9,
            life: 0.8,
            max: 0.8,
            blood: 1,
          });
        for (const u of units)
          if (!u.dead && u.row === p.row && u.type !== "mine" && Math.abs(u.x - p.x) < 6) {
            u.hp -= p.dmg;
            u.fl = 0.1;
            for (let i = 0; i < 8; i++)
              add({
                k: "d",
                x: p.x,
                y: p.y,
                vx: rnd(-30, 30),
                vy: -rnd(10, 40),
                rot: 0,
                vr: 0,
                sz: rnd(0.6, 1.4),
                col: "#9be22d",
                gy: p.y + rnd(6, 10),
                life: 1,
                max: 1,
                blood: 1,
              });
            G(GL.g, p.x, p.y, { r0: 3, r1: 9, life: 0.2, a: 0.7 });
            if (u.hp <= 0) killUnit(u);
            p.dead = true;
            break;
          }
        if (p.x < BASE) p.dead = true;
        continue;
      }
      if (p.k === "missile") {
        p.vx = Math.min(260, p.vx + 420 * dt);
        G(Math.random() < 0.5 ? GL.sl : GL.sd, p.x - 7, p.y + 0.5, {
          add: false,
          a: 0.35,
          smoke: 1,
          vx: rnd(-6, 6),
          vy: -rnd(2, 7),
          r0: 1.2,
          r1: rnd(4, 7),
          life: rnd(0.7, 1.2),
          drag: 1,
        });
      }
      p.x += p.vx * dt;
      if (p.x > W + 4) {
        p.dead = true;
        continue;
      }
      for (const z of zs) {
        if (z.dead || z.row !== p.row) continue;
        if (p.x >= z.x - z.half && p.x <= z.x + z.half) {
          if (p.splash) {
            splash(p.row, p.x, p.splash, p.dmg);
            boom(p.x, p.y, p.k === "missile" ? 1.5 : 0.8);
          } else {
            hurt(z, p.dmg);
            for (let i = 0; i < 3; i++)
              add({
                k: "s",
                x: p.x,
                y: p.y,
                vx: -rnd(30, 90),
                vy: rnd(-50, 20),
                life: 0.12,
                max: 0.12,
                g: 200,
                col: "255,240,180",
              });
          }
          p.dead = true;
          break;
        }
      }
    }
    for (const z of zs) {
      if (z.dead) continue;
      z.t += dt;
      z.fl = Math.max(0, z.fl - dt);
      const d = z.d,
        front = z.x - z.half;
      let block = null;
      for (const u of units) {
        if (u.dead || u.row !== z.row) continue;
        if (u.type === "mine") {
          if (u.arm <= 0 && front <= u.x + 5 && z.x > u.x - 6) mineBoom(u);
          else if (u.arm > 0 && front <= u.x + 5 && z.x > u.x - 6) {
            block = u;
            break;
          }
          continue;
        }
        if (front <= u.x + 7 && z.x > u.x - 6) {
          block = u;
          break;
        }
      }
      if (z.dead) continue;
      // CHEFÃO: rajadas de metralhadora em quem estiver à frente na linha
      if (d.gun) {
        z.firing = Math.max(0, z.firing - dt);
        z.gun -= dt;
        let gt = null;
        for (const u of units)
          if (!u.dead && u.row === z.row && u.type !== "mine" && u.x < z.x && z.x - u.x < 120) gt = u;
        if (z.burst > 0) {
          z.bt -= dt;
          if (z.bt <= 0) {
            z.bt = 0.09;
            z.burst--;
            z.firing = 0.15;
            const gx = z.x - 19,
              gy = z.row * CELL + CELL - 19 + rnd(-0.8, 0.8);
            proj.push({ k: "zb", x: gx, y: gy, vx: -270, row: z.row, dmg: d.gun });
            G(GL.y, gx - 2, gy, { r0: 3, r1: 5, life: 0.07 });
            G(GL.gs, gx, gy, { r0: 12, r1: 14, life: 0.08, a: 0.4 });
            part(z.x - 8, gy, rnd(10, 30), -rnd(30, 50), 0.6, "#d9a440", 1, 260);
            trauma = Math.min(1, trauma + 0.06); // tremor quando o Chefão atira
            sfx("shot");
          }
        } else if (gt && z.gun <= 0 && z.x < GRID_END) {
          z.gun = 2.6;
          z.burst = 6;
          z.bt = 0;
        }
        if (z.burst > 0 && !block) continue; // para de andar enquanto atira
      }
      if (block) {
        z.bite = true;
        block.hp -= d.dps * dt * (d.big && block.type === "wire" ? 3 : 1); // chefão destrói cerca rápido
        block.fl = 0.05;
        if (block.type === "wire") hurt(z, U.wire.dmg * dt, true);
        if (block.hp <= 0) killUnit(block);
      } else {
        z.bite = false;
        if (d.spit) {
          let tg = null;
          for (const u of units)
            if (!u.dead && u.row === z.row && u.type !== "mine" && u.x < z.x && z.x - u.x < 72 && z.x < GRID_END) {
              tg = u;
              break;
            }
          if (tg) {
            z.sc -= dt;
            if (z.sc <= 0) {
              z.sc = 2.4;
              proj.push({ k: "acid", x: z.x - 7, y: z.row * CELL + CELL - 12, vx: -75, row: z.row, dmg: d.spit });
              sfx("spit");
            }
            continue;
          }
        }
        if (z.stun > 0) z.stun -= dt;
        else {
          z.x -= d.sp * dt;
          if (z.d.big) {
            const fi = ((z.t * 3) | 0) % 4;
            if (fi !== z.lf) {
              z.lf = fi;
              if (fi % 2 === 0 && z.x < GRID_END) {
                trauma = Math.min(1, trauma + 0.07);
                puff(z.x, z.row * CELL + CELL, 4);
                sfx("stomp");
              }
            }
          }
        }
      }
      if (z.x < BASE - 2) {
        z.dead = true;
        life = Math.max(0, life - d.base);
        boom(BASE, z.row * CELL + 12, 1.5);
        flashA = 0.35;
        flashC = "210,40,25";
        trauma = Math.min(1, trauma + 0.4);
        sfx("alarm");
        if (life <= 0) gameOver();
      }
    }
    groanT -= dt;
    if (groanT <= 0) {
      const alive = zs.filter((z) => !z.dead && z.x < GRID_END + 4);
      groanT = rnd(1.4, 3.5) / Math.min(3, 0.6 + alive.length / 4);
      if (alive.length) {
        const z = alive[(Math.random() * alive.length) | 0];
        sfx("groan", z.type);
      }
    }
    for (const p of parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.life -= dt;
    }
    units = units.filter((u) => !u.dead);
    zs = zs.filter((z) => !z.dead);
    proj = proj.filter((p) => !p.dead);
    parts = parts.filter((p) => p.life > 0);
    if (parts.length > 600) parts.splice(0, parts.length - 600);
  }

  /* ---------- desenho ---------- */
  function draw(img, cx, bottom, fl, a = 1) {
    const x = Math.round(cx - img.width / 2),
      y = Math.round(bottom - img.height);
    ctx.globalAlpha = a;
    ctx.drawImage(img, x, y);
    if (fl > 0) {
      ctx.globalAlpha = 0.75 * a;
      ctx.drawImage(wht(img), x, y);
    }
    ctx.globalAlpha = 1;
  }
  function bar(cx, y, hp, max) {
    if (hp >= max) return;
    const w = 12,
      f = Math.max(0, hp / max);
    ctx.fillStyle = "#000";
    ctx.fillRect((cx - w / 2 - 1) | 0, y - 1, w + 2, 3);
    ctx.fillStyle = f > 0.5 ? "#6ee04a" : f > 0.25 ? "#f2c230" : "#e0533a";
    ctx.fillRect((cx - w / 2) | 0, y, Math.ceil(w * f), 1);
  }
  /* Desenha um SPRITE DE AÇÃO (PNG) com a base em (cx,bottom), altura h em unidades da grade.
     O canvas roda em alta resolução, então o PNG fica nítido — nunca usamos a arte da carta aqui. */
  function drawImg(im, cx, bottom, h, o = {}) {
    const w = (im.width * h) / im.height;
    ctx.save();
    ctx.globalAlpha = o.a ?? 1;
    ctx.translate(cx, bottom);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(o.sx || 1, o.sy || 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(im, -w / 2, -h, w, h);
    if (o.fl > 0) {
      ctx.globalAlpha = 0.7 * (o.a ?? 1);
      ctx.drawImage(wht(im), -w / 2, -h, w, h);
    }
    ctx.restore();
    return w;
  }
  function shadow(x, y, rx) {
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, 1.6, 0, 0, 7);
    ctx.fill();
  }
  // Ponto de saída do tiro de cada unidade (relativo ao centro da casa e ao chão)
  const MUZZLE = {
    rifle: [12.5, -12],
    missile: [9, -18.5],
    tank: [17, -13],
    grenade: [9, -14],
    mg: [12, -7],
    mortar: [7, -13],
  };
  // Cano do tanque: na arte original ele fica atrás da explosão, então é desenhado aqui (e recua ao atirar)
  function drawBarrel(u, b, rx) {
    const h = SPRITE_H.tank,
      x0 = u.x + 6 + rx,
      len = 11 - (u.rec > 0.1 ? 2.5 : 0),
      y = b - h * 0.7;
    ctx.fillStyle = "#1d2410";
    ctx.fillRect(x0, y - 1.2, len + 0.6, 2.6);
    ctx.fillStyle = "#5d6a32";
    ctx.fillRect(x0, y - 0.6, len, 1.4);
    ctx.fillStyle = "#8a9a52";
    ctx.fillRect(x0, y - 0.6, len, 0.45);
    ctx.fillStyle = "#1d2410";
    ctx.fillRect(x0 + len - 1.6, y - 1.6, 2.2, 3.4);
  }
  function frameOf(u) {
    const F = FR[u.type];
    if (!F) return SP[u.type];
    if (u.type === "tank") return u.rec > 0 ? F.recoil : F.idle;
    if (u.type === "rifle") {
      if (u.reload > 0) return F.reload;
      if (u.rec > 0) return F.recoil;
    }
    if (u.type === "grenade") {
      if (u.wind > 0) return F.wind;
      if (u.throwT > 0) return F.throw;
      if (u.cd > 0.45) return F.empty;
    }
    if (u.type === "mg") {
      if (u.reload > 0) return F.hot;
      if (u.rec > 0) return F.recoil;
      return F.idle;
    }
    if (u.type === "mortar") return u.rec > 0 ? F.recoil : F.idle;
    if (u.type === "missile") {
      if (u.rec > 0) return F.recoil;
      if (u.cd > U.missile.rate * 0.45) return F.reload;
    }
    return (u.t + (u.seed || 0)) % 3.4 < 0.13 ? F.blink : F.idle;
  }
  function drawUnit(u, ghost) {
    const im = IMG[u.type];
    if (im) {
      // 2 frames: PARADO (respira) e ATACANDO (recuo + leve esticada)
      const b = u.row * CELL + CELL - 2,
        h = SPRITE_H[u.type],
        atk = u.rec > 0 || u.throwT > 0 || u.wind > 0,
        still = u.type === "tank" || u.type === "mine" || u.type === "wire",
        rx = u.rec > 0 ? (u.type === "tank" ? -1.5 : -1) : 0,
        a = ghost ? 0.5 : u.type === "mine" && u.arm > 0 ? 0.6 : 1;
      let rot = 0;
      if (u.wind > 0) rot = -0.1;
      else if (u.throwT > 0) rot = 0.08;
      if (!ghost && u.type !== "mine") shadow(u.x, b - 0.4, u.type === "tank" ? 11 : u.type === "wire" ? 8 : 6);
      const breathe = 1 + Math.sin((u.t + (u.seed || 0)) * 3) * 0.015;
      drawImg(im, u.x + rx, b + (u.type === "tank" && !u.rec ? (((u.t * 12) | 0) % 2) * 0.35 : 0), h, {
        fl: u.fl,
        a,
        rot,
        sx: still ? 1 : atk ? 1.04 : 1,
        sy: still ? 1 : atk ? 0.96 : breathe,
      });
      if (u.type === "tank") drawBarrel(u, b, rx);
      if (u.type === "mine" && !ghost && u.arm <= 0 && ((u.t * 3) | 0) % 2) {
        ctx.fillStyle = "#ff3b2a";
        ctx.fillRect(u.x - 0.75, b - h + 0.6, 1.5, 1);
      }
      if (!ghost) bar(u.x, b - h - 3, u.hp, u.max);
      return;
    }
    const b = u.row * CELL + CELL - 2,
      bob =
        u.type === "tank"
          ? (((u.t * 12) | 0) % 2) * (u.rec > 0 ? 0 : 1) - 0
          : u.type === "mine" || u.type === "wire"
            ? 0
            : (u.t + (u.seed || 0)) % 1.6 < 0.8
              ? 0
              : 1,
      rx = u.type === "tank" && u.rec > 0.1 ? -2 : 0;
    if (u.type === "mine") {
      draw(SP.mine, u.x, b, u.fl, ghost ? 0.5 : u.arm > 0 ? 0.55 : 1);
      if (!ghost && u.arm <= 0 && ((u.t * 3) | 0) % 2) {
        ctx.fillStyle = "#ff3b2a";
        ctx.fillRect(u.x | 0, b - 6, 2, 1);
      }
    } else {
      const img = frameOf(u);
      ctx.fillStyle = "rgba(0,0,0,.22)";
      ctx.fillRect((u.x - img.width / 2 + 3) | 0, b - 1, img.width - 6, 2);
      draw(img, u.x + rx, b + bob, u.fl, ghost ? 0.5 : 1);
      if (u.rec > 0.04) {
        ctx.fillStyle = "#fff6b0";
        const fy = { rifle: b - 7, tank: b - 14, missile: b - 8, mg: b - 8 }[u.type];
        if (u.type === "rifle" && u.reload > 0) return;
        if (fy) {
          const fx = u.x + (u.type === "tank" ? 13 : u.type === "mg" ? 12 : 9);
          ctx.fillRect(fx, fy, 3, 3);
          ctx.fillStyle = "#ffb02e";
          ctx.fillRect(fx + 3, fy + 1, 2, 1);
        }
      }
    }
    if (!ghost) bar(u.x, b - (u.type === "mine" ? 9 : u.type === "tank" ? 20 : 18), u.hp, u.max);
  }
  function drawZ(z) {
    const im = IMG["z_" + z.type];
    if (im) {
      // 2 frames de andar (balanço alternado) + mordida (inclina para frente)
      const b = z.row * CELL + CELL - 1 + (z.d.big ? 2 : 0),
        h = SPRITE_H["z_" + z.type];
      let rot = 0,
        dy = 0;
      if (z.bite) rot = -(0.06 + 0.06 * Math.sin(z.t * 18));
      else if (z.stun > 0) rot = 0.12;
      else if (z.firing > 0) rot = 0.03 * Math.sin(z.t * 40);
      else {
        const ph = Math.sin(z.t * (z.type === "runner" ? 14 : z.d.big ? 5 : 7));
        rot = ph * 0.05;
        dy = -Math.abs(ph) * 0.8;
      }
      shadow(z.x, b - 0.4, z.half + 1);
      drawImg(im, z.x, b + dy, h, { fl: z.fl, rot });
      if (!z.d.big) bar(z.x, b - h - 3, z.hp, z.max);
      return;
    }
    const F = ZF[z.type],
      fps = z.type === "runner" ? 12 : z.d.big ? 3 : z.type === "armored" ? 4 : 5,
      img = z.bite ? F.bite[((z.t * 6) | 0) % 2] : F.walk[z.stun > 0 ? 1 : ((z.t * (z.d.big ? 3 : fps)) | 0) % 4],
      b = z.row * CELL + CELL - 1 + (z.d.big ? 2 : 0);
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.fillRect((z.x - z.half) | 0, b - 1, z.half * 2, 2);
    draw(img, z.x + (z.stun > 0 ? 1 : 0), b, z.fl);
    bar(z.x, b - img.height - 3, z.hp, z.max);
  }
  function render() {
    ctx.save();
    ctx.setTransform(FS, 0, 0, FS, 0, 0); // canvas em alta resolução: 1 unidade da grade = FS pixels
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0b0f07";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(bg, 0, 0);
    ctx.drawImage(decal, 0, 0);
    for (const c of corpses) {
      const f = Math.min(1, c.t / 0.35);
      ctx.save();
      ctx.globalAlpha = c.t > 1.5 ? Math.max(0, 1 - (c.t - 1.5) / 1.1) : 1;
      ctx.translate(c.x, c.b + f * f * 2);
      ctx.rotate(f * f * 1.45);
      const ch = c.h || c.img.height,
        cw = (c.img.width * ch) / c.img.height;
      ctx.imageSmoothingEnabled = !!c.h;
      ctx.drawImage(c.img, -cw / 2, -ch, cw, ch);
      if (c.t < 0.08) {
        ctx.globalAlpha = 0.8;
        ctx.drawImage(wht(c.img), -cw / 2, -ch, cw, ch);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.restore();
    }
    if (hover && sel && state === "play") {
      const occ = units.find((u) => u.col === hover.c && u.row === hover.r);
      const ok = sel === "shovel" ? !!occ : !occ && money >= U[sel].cost && cardCd[sel] <= 0;
      ctx.fillStyle = ok ? (sel === "shovel" ? "rgba(255,80,60,.3)" : "rgba(255,255,255,.2)") : "rgba(255,60,40,.22)";
      ctx.fillRect(GX + hover.c * CELL + 1, hover.r * CELL + 1, CELL - 1, CELL - 1);
      if (ok && sel !== "shovel")
        drawUnit(
          {
            type: sel,
            x: GX + hover.c * CELL + CELL / 2,
            y: hover.r * CELL + CELL / 2,
            row: hover.r,
            t: 0,
            rec: 0,
            fl: 0,
            arm: 0,
            hp: 1,
            max: 1,
          },
          true,
        );
    }
    for (let r = 0; r < ROWS; r++) {
      for (const u of units) if (u.row === r && u.type === "mine") drawUnit(u);
      for (const u of units) if (u.row === r && u.type !== "mine") drawUnit(u);
      for (const z of zs) if (z.row === r) drawZ(z);
    }
    for (const p of proj) {
      const x = p.x | 0,
        y = p.y | 0;
      if (p.k === "bullet") {
      } else if (p.k === "shell") {
        ctx.fillStyle = "#141a0e";
        ctx.fillRect(x - 3, y - 1, 5, 3);
        ctx.fillStyle = "#c8a040";
        ctx.fillRect(x - 2, y, 4, 1);
      } else if (p.k === "missile") {
        ctx.fillStyle = "#141a0e";
        ctx.fillRect(x - 5, y - 1, 8, 3);
        ctx.fillStyle = "#cfd3d6";
        ctx.fillRect(x - 4, y, 6, 1);
        ctx.fillStyle = "#b8322a";
        ctx.fillRect(x + 2, y, 1, 1);
      } else if (p.k === "mort") {
        ctx.fillStyle = "#141a0e";
        ctx.fillRect(x - 2, y - 3, 4, 6);
        ctx.fillStyle = "#5c6268";
        ctx.fillRect(x - 1, y - 2, 2, 4);
        if (((p.t * 8) | 0) % 2) {
          const tx = p.tx | 0,
            ty = p.ty | 0;
          ctx.fillStyle = "#ff3b2a";
          ctx.fillRect(tx - 3, ty, 7, 1);
          ctx.fillRect(tx, ty - 2, 1, 5);
        }
      } else if (p.k === "gren") {
        ctx.fillStyle = "#141a0e";
        ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = "#4f6b2a";
        ctx.fillRect(x - 1, y - 1, 2, 2);
      } else if (p.k === "acid") {
        ctx.fillStyle = "#2f5a12";
        ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = "#9be22d";
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
    for (const c of crates) {
      const x = c.x | 0,
        y = c.y | 0;
      if (c.land && c.life < 2.5 && ((c.life * 8) | 0) % 2) continue;
      if (!c.land) {
        ctx.fillStyle = "#141a0e";
        ctx.fillRect(x - 7, y - 15, 15, 5);
        ctx.fillStyle = "#e9e4cc";
        ctx.fillRect(x - 6, y - 14, 13, 3);
        ctx.fillStyle = "#7f9f40";
        ctx.fillRect(x - 2, y - 14, 5, 3);
        ctx.fillStyle = "#141a0e";
        ctx.fillRect(x - 6, y - 11, 1, 6);
        ctx.fillRect(x + 6, y - 11, 1, 6);
      }
      ctx.fillStyle = "#141a0e";
      ctx.fillRect(x - 5, y - 5, 11, 9);
      ctx.fillStyle = "#9a6a32";
      ctx.fillRect(x - 4, y - 4, 9, 7);
      ctx.fillStyle = "#f2c230";
      ctx.fillRect(x, y - 4, 1, 7);
      ctx.fillRect(x - 4, y - 1, 9, 1);
    }
    for (const p of parts) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x | 0, p.y | 0, p.s, p.s);
    }
    ctx.globalAlpha = 1;
    if (waveState === "prep" && state === "play" && timer < 7.5) {
      const f = 1 - timer / (wave === 0 ? 10 : 7);
      ctx.fillStyle = "rgba(0,0,0,.5)";
      ctx.fillRect(GX, H - 3, COLS * CELL, 3);
      ctx.fillStyle = "#f2c230";
      ctx.fillRect(GX, H - 3, (COLS * CELL * f) | 0, 3);
    }
    ctx.restore();
  }

  /* ---------- HUD + cartas ---------- */
  const deck = $("deck"),
    cards = {};
  const icon = (img) => {
    const c = mk(32, 32),
      x = c.getContext("2d");
    x.imageSmoothingEnabled = false;
    const s = Math.min(30 / img.width, 30 / img.height);
    const w = img.width * s,
      h = img.height * s;
    x.drawImage(img, ((32 - w) / 2) | 0, ((32 - h) / 2) | 0, w, h);
    return c;
  };
  function buildDeck() {
    deck.innerHTML = "";
    for (const k in cards) delete cards[k];
    [...ORDER, "shovel"].forEach((k, i) => {
      const b = document.createElement("button");
      b.className = "card" + (k === "shovel" ? " tool" : "");
      const d = U[k];
      const bd = document.createElement("span");
      bd.className = "badge";
      bd.textContent = k === "shovel" ? "Q" : i + 1;
      b.append(bd);
      if (d && d.art) {
        const im = new Image();
        im.className = "art";
        im.src = d.art;
        im.alt = "";
        im.decoding = "async";
        b.append(im);
      } else b.append(icon(SP[k]));
      const nm = document.createElement("div");
      nm.className = "nm";
      nm.textContent = d ? d.n : "Remover";
      b.append(nm);
      const co = document.createElement("div");
      co.className = "cost";
      if (d) {
        const ci = document.createElement("i");
        ci.className = "coin";
        co.append(ci, String(d.cost));
      } else co.textContent = "+50%";
      b.append(co);
      if (d) {
        const hb = document.createElement("div");
        hb.className = "hpb";
        const hi = document.createElement("i");
        hi.style.width = Math.min(100, d.hp / 3) + "%";
        hb.append(hi);
        b.append(hb);
      }
      const st = document.createElement("div");
      st.className = "st";
      st.textContent = d ? `HP ${d.hp}·DMG ${d.dmg}` : "devolve";
      b.append(st);
      const cd = document.createElement("div");
      cd.className = "cd";
      b.append(cd);
      b.setAttribute("aria-label", d ? `${d.n}, custa ${d.cost}` : "Remover unidade");
      b.addEventListener("click", () => {
        audio();
        pick(k);
      });
      deck.append(b);
      cards[k] = { b, cd };
    });
  }
  buildDeck();
  const PXI = {
    skull: [
      [".XXXXX..", "XXXXXXX.", "X..X..X.", "X..X..X.", "XXXXXXX.", ".XX.XX..", ".X.X.X..", "........"],
      { X: "#f4f4ec" },
    ],
    heart: [
      [".XX.XX..", "XXYXXXX.", "XYXXXXX.", "XXXXXXX.", ".XXXXX..", "..XXX...", "...X....", "........"],
      { X: "#8be04f", Y: "#d6ffb0" },
    ],
    coin: [
      ["..XXX...", ".XYYYX..", "XYYXYYX.", "XYYXYYX.", "XYYXYYX.", ".XYYYX..", "..XXX...", "........"],
      { X: "#b98d12", Y: "#f2c230" },
    ],
    star: [
      ["...X....", "..XXX...", "XXXXXXX.", ".XXXXX..", "..XXX...", ".XX.XX..", "X.....X.", "........"],
      { X: "#f2c230" },
    ],
  };
  for (const el of document.querySelectorAll(".ic[data-ic]")) {
    const [m, pal] = PXI[el.dataset.ic];
    let r = "";
    m.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (pal[ch]) r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[ch]}"/>`;
      }),
    );
    el.innerHTML = `<svg viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
  }
  function can(k) {
    return money >= U[k].cost && cardCd[k] <= 0;
  }
  function pick(k) {
    if (state !== "play") return;
    if (!k || sel === k) {
      sel = null;
    } else if (k === "shovel" || can(k)) {
      sel = k;
    } else {
      const b = cards[k].b;
      b.classList.remove("nope");
      void b.offsetWidth;
      b.classList.add("nope");
    }
    syncCards();
  }
  let lastUI = "";
  function syncCards() {
    for (const k of ORDER) {
      const c = cards[k];
      c.b.classList.toggle("off", !can(k));
      c.b.classList.toggle("sel", sel === k);
      c.cd.style.height = (cardCd[k] / U[k].cd) * 100 + "%";
    }
    cards.shovel.b.classList.toggle("sel", sel === "shovel");
  }
  function updUI() {
    const s = `${wave}|${life}|${score}|${money}`;
    if (s !== lastUI) {
      lastUI = s;
      $("hWave").textContent = String(wave).padStart(2, "0") + "/" + MAX_WAVE;
      $("hLife").textContent = life;
      $("hLife").classList.toggle("low", life <= 30);
      $("hScore").textContent = score;
      $("hMoney").textContent = money;
      if (sel && sel !== "shovel" && !can(sel)) sel = null;
    }
    const boss = zs && zs.find((z) => z.d.big && !z.dead);
    if (boss) $("bossfill").style.width = Math.max(0, (boss.hp / boss.max) * 100) + "%";
    else if (!$("bossbar").hidden && state === "play") $("bossbar").hidden = true;
    syncCards();
  }

  /* ---------- entrada ---------- */
  function toLocal(e) {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  }
  function cellAt(p) {
    const c = Math.floor((p.x - GX) / CELL),
      r = Math.floor(p.y / CELL);
    return c >= 0 && c < COLS && r >= 0 && r < ROWS ? { c, r } : null;
  }
  cv.addEventListener("pointerdown", (e) => {
    audio();
    if (state !== "play") return;
    const p = toLocal(e);
    for (const c of crates) {
      if (Math.abs(p.x - c.x) < 10 && Math.abs(p.y - c.y) < 11) {
        c.life = 0;
        money += 25;
        coins(c.x, c.y);
        G(GL.y, c.x, c.y, { r0: 4, r1: 16, life: 0.3 });
        txt(c.x, c.y - 8, "+$25", "255,214,90");
        sfx("coin");
        return;
      }
    }
    const cell = cellAt(p);
    if (!cell || !sel) return;
    const occ = units.find((u) => u.col === cell.c && u.row === cell.r);
    if (sel === "shovel") {
      if (occ) {
        occ.dead = true;
        money += Math.floor(U[occ.type].cost / 2);
        coins(occ.x, occ.y);
        sfx("coin");
        units = units.filter((u) => !u.dead);
        sel = null;
      }
      return;
    }
    if (occ || !can(sel)) return;
    const d = U[sel];
    money -= d.cost;
    cardCd[sel] = d.cd;
    units.push({
      type: sel,
      col: cell.c,
      row: cell.r,
      x: GX + cell.c * CELL + CELL / 2,
      y: cell.r * CELL + CELL / 2,
      hp: d.hp,
      max: d.hp,
      cd: 0.3,
      t: 0,
      fl: 0,
      rec: 0,
      arm: 3,
      ammo: d.ammo || 0,
      reload: 0,
      wind: 0,
      throwT: 0,
      seed: Math.random() * 3,
    });
    puff(GX + cell.c * CELL + CELL / 2, cell.r * CELL + CELL - 3, 6);
    sfx("place");
    sel = null;
  });
  cv.addEventListener("pointermove", (e) => {
    hover = cellAt(toLocal(e));
  });
  cv.addEventListener("pointerleave", () => {
    hover = null;
  });
  addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    const k = e.key.toLowerCase(),
      i = "123456".indexOf(k);
    if (i >= 0 && k) pick(ORDER[i]);
    else if (k === "q" || k === "0") pick("shovel");
    else if (k === "p" || k === " ") {
      e.preventDefault();
      togglePause();
    } else if (k === "escape") {
      sel = null;
    } else if (k === "f") toggleSpeed();
  });
  function togglePause() {
    if (state === "play") {
      state = "pause";
      showPause();
    } else if (state === "pause") {
      state = "play";
      hideOv();
    }
  }
  function toggleSpeed() {
    spd = spd === 1 ? 2 : 1;
    $("bSpeed").textContent = spd + "x";
  }
  $("bPause").onclick = () => {
    audio();
    togglePause();
  };
  $("bSpeed").onclick = toggleSpeed;
  $("bSound").onclick = () => {
    audio();
    sound = !sound;
    $("bSound").textContent = sound ? "SOM" : "MUDO";
    if (master) master.gain.setTargetAtTime(sound ? 0.85 : 0, AC.currentTime, 0.05);
  };

  $("bRestart").onclick = () => {
    audio();
    if (state === "play" || state === "pause" || state === "over") startGame(false);
  };

  /* ---------- telas ---------- */
  const panel = $("panel"),
    ov = $("ov");
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function hideOv() {
    ov.classList.add("hide");
  }
  function showOv(html) {
    panel.innerHTML = html;
    ov.classList.remove("hide");
    const f = panel.querySelector(".big");
    if (f) f.focus({ preventScroll: true });
  }
  let deferredInstall = null;
  const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
    const b = $("bInstall");
    if (b) b.hidden = false;
  });
  addEventListener("appinstalled", () => {
    deferredInstall = null;
    const b = $("bInstall");
    if (b) b.hidden = true;
  });
  /* ==========================================================================
     TELAS: menu, perfil, esquadrão, inimigos, pausa, game over, vitória
     ========================================================================== */
  function showMenu() {
    const canContinue = progress && progress.wave_atual > 1 && progress.wave_atual <= MAX_WAVE;
    showOv(`<h1 class="title">ARENA<br>VERDE</h1><p class="sub">${profile ? `Soldado ${esc(profile.apelido)} · ` : ""}Defenda a base por ${MAX_WAVE} ondas</p><canvas id="scene" width="960" height="400"></canvas>
 <div class="menu-btns">${canContinue ? `<button class="big" data-a="continue">CONTINUAR · ONDA ${progress.wave_atual}</button>` : ""}<button class="${canContinue ? "alt" : "big"}" data-a="squad">${canContinue ? "NOVO JOGO" : "JOGAR ▶"}</button><button class="alt" data-a="enemies">INIMIGOS</button><button class="alt" data-a="profile">${profile ? "PERFIL" : "CRIAR PERFIL"}</button><button class="alt" id="bInstall" data-a="install" ${deferredInstall ? "" : "hidden"}>INSTALAR APP</button></div>
 ${isIOS && !isStandalone() ? '<p class="hint">No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início" para instalar.</p>' : ""}
 <details class="how"><summary>★ COMO JOGAR</summary><ul class="how"><li>Monte um esquadrão de até 6 cartas</li><li>Toque numa carta e depois numa casa da grade</li><li>Você ganha moedas com o tempo, abatendo zumbis e pegando caixas de suprimento</li><li>Zumbis que passam pelos sacos de areia tiram vida da base</li><li>Sobreviva às ${MAX_WAVE} ondas: na última vem o Chefão Metralhadora</li><li>Metralhadora libera na onda ${UNLOCK_AT.mg} e Morteiro na onda ${UNLOCK_AT.mortar}</li><li>PC: teclas 1–6, Q pá, P pausa, F velocidade</li></ul></details>
 <div class="rec">RECORDE: ${best}</div><ol class="board" id="board"></ol>`);
    drawScene();
    loadBoard();
  }
  function showProfile(next) {
    showOv(`<h2 class="title" style="font-size:clamp(22px,5vw,38px)">PERFIL DO<br>SOLDADO</h2><p class="sub">Seu apelido aparece no ranking e o progresso fica salvo</p>
 <form class="form" id="pform"><label>NOME<input id="pNome" maxlength="30" autocomplete="name" value="${profile ? esc(profile.nome || "") : ""}"></label>
 <label>APELIDO<input id="pApelido" maxlength="12" required autocomplete="nickname" value="${profile ? esc(profile.apelido) : ""}"></label></form>
 <button class="big" data-a="psave" data-next="${next || "menu"}">SALVAR</button><button class="alt" data-a="${next || "menu"}">${next ? "JOGAR SEM PERFIL" : "VOLTAR"}</button>`);
    $("pform").addEventListener("submit", (e) => e.preventDefault());
  }
  function saveProfile(next) {
    const apelido = $("pApelido")
      .value.trim()
      .toUpperCase()
      .replace(/[^A-Z0-9 _-]/g, "")
      .slice(0, 12);
    if (!apelido) return $("pApelido").focus();
    const nome = $("pNome").value.trim().slice(0, 30);
    const changed = !profile || profile.apelido !== apelido;
    profile = { ...(changed ? {} : profile), nome, apelido };
    store.set("player", profile);
    ensureRemotePlayer().catch(() => {});
    if (next === "squad") showSquad();
    else showMenu();
  }
  let pickSquad = [];
  function statRow(l, v, pct) {
    return (
      `<div class="row"><span>${l}</span><span>${v}</span></div>` +
      (pct != null ? `<div class="hpb"><i style="width:${pct}%"></i></div>` : "")
    );
  }
  function showSquad(keep) {
    if (!keep) pickSquad = ORDER.filter(isUnlocked);
    const y = ov.scrollTop;
    const cardHtml = (k, i) => {
      const d = U[k],
        o = pickSquad.indexOf(k),
        lock = !isUnlocked(k);
      const pic = d.art
        ? `<img class="uart" src="${d.art}" alt="${d.n}">`
        : `<canvas data-ic="${k}" width="40" height="40"></canvas>`;
      return `<div class="ucard${o >= 0 ? " on" : ""}${lock ? " locked" : ""}" data-u="${k}" role="button" tabindex="0" aria-pressed="${o >= 0}" aria-disabled="${lock}"><span class="badge">${o >= 0 ? o + 1 : i + 1}</span>${pic}<div class="nm">${d.n}</div><div class="cost"><i class="coin"></i>${d.cost}</div>${statRow("HP", d.hp, Math.min(100, d.hp / 3))}${statRow("DMG", d.dmg)}<div class="d">${d.desc}</div>${lock ? `<div class="lock">BLOQUEADA · CHEGUE NA ONDA ${UNLOCK_AT[k]}</div>` : d.card ? `<button class="vc" data-card="${k}">VER CARTA</button>` : ""}</div>`;
    };
    showOv(`<h2 class="title" style="font-size:clamp(22px,5vw,40px)">ESCOLHA SEU<br>ESQUADRÃO</h2><p class="sub">Selecione até 6 cartas para a missão</p>
 <div class="ugrid">${ALL.map(cardHtml).join("")}</div>
 <div class="bbar"><span><i class="coin"></i>MOEDAS: 350</span><span>${pickSquad.length}/6 SELECIONADAS</span><span><button class="alt" data-a="menu" style="margin:0 6px 0 0">VOLTAR</button><button class="big" data-a="start" ${pickSquad.length ? "" : "disabled"}>INICIAR MISSÃO ▶</button></span></div>`);
    for (const c of panel.querySelectorAll("canvas[data-ic]")) paintIcon(c, SP[c.dataset.ic]);
    ov.scrollTop = keep ? y : 0;
  }
  function showEnemies() {
    showOv(`<h2 class="title" style="font-size:clamp(22px,5vw,40px)">INIMIGOS</h2><p class="sub">Conheça a horda antes da batalha</p>
 <div class="ugrid">${Object.keys(ZD)
   .map((k, i) => {
     const d = ZD[k];
     return `<div class="ucard enemy"><span class="badge">${i + 1}</span><img class="uart zart" src="assets/sprites/z_${k}.png" alt="${d.n}"><div class="nm">${d.n}</div>${statRow("HP", d.hp, Math.min(100, d.hp / 10))}${statRow("DANO", d.gun ? d.dps + " + RAJADA" : d.spit ? d.spit + " (LONGE)" : d.dps)}${statRow("VELOC.", d.sp >= 10 ? "MUITO RÁPIDA" : d.sp >= 4.5 ? "NORMAL" : "LENTA")}<div class="d">${d.desc}</div></div>`;
   })
   .join("")}</div>
 <button class="big" data-a="menu">VOLTAR</button>`);
  }
  function paintIcon(c, img) {
    const x = c.getContext("2d");
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, 40, 40);
    const s = Math.min(36 / img.width, 36 / img.height),
      w = img.width * s,
      h = img.height * s;
    x.drawImage(img, ((40 - w) / 2) | 0, ((40 - h) / 2) | 0, w, h);
  }
  function showPause() {
    showOv(
      `<h2 class="title" style="font-size:clamp(24px,6vw,40px)">PAUSADO</h2><p class="sub">Onda ${wave}/${MAX_WAVE} · ${score} pontos</p><button class="big" data-a="resume">CONTINUAR</button><button class="alt" data-a="restart">REINICIAR</button><button class="alt" data-a="menu">MENU</button>`,
    );
  }
  // Fim de partida (derrota ou vitória): salva recorde, zera progresso e envia ao ranking
  function endGame(won) {
    if (state !== "play") return;
    state = "over";
    sfx(won ? "wave" : "lose");
    if (won) {
      flashA = 0.4;
      flashC = "255,240,190";
    }
    const nb = score > best;
    if (nb) {
      best = score;
      try {
        localStorage.setItem("arenaverde.best", best);
      } catch (e) {}
    }
    progress = null;
    saveProgress();
    if (profile) submitRanking();
    setTimeout(
      () =>
        showOv(`<h2 class="title" style="font-size:clamp(24px,6vw,42px)">${won ? "VITÓRIA!" : "GAME<br>OVER"}</h2><p class="sub">${won ? "A base resistiu às " + MAX_WAVE + " ondas e ao Chefão!" : nb ? "NOVO RECORDE!" : "A horda venceu desta vez"}</p>
 <div class="res"><div>PONTOS<b>${score}</b></div><div>ONDA<b>${wave}/${MAX_WAVE}</b></div><div>ABATES<b>${kills}</b></div><div>RECORDE<b>${best}</b></div></div>
 ${profile ? "" : `<div class="sendrow" id="send"><input id="nm" maxlength="12" placeholder="SEU APELIDO" autocomplete="nickname"><button class="alt" data-a="send" style="margin:0">ENTRAR NO RANKING</button></div>`}
 <ol class="board" id="board"></ol><button class="big" data-a="restart">JOGAR NOVAMENTE</button><button class="alt" data-a="menu">MENU</button>`),
      won ? 1600 : 900,
    );
    setTimeout(loadBoard, won ? 2400 : 1500);
  }
  const gameOver = () => endGame(false);
  const victory = () => endGame(true);

  ov.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".ucard[data-u]")) {
      e.preventDefault();
      e.target.click();
    }
  });
  $("cardv").addEventListener("click", () => {
    $("cardv").hidden = true;
  });
  function startGame(fromProgress) {
    if (fromProgress) {
      ORDER = (progress.squad || ORDER).filter(isUnlocked);
      buildDeck();
      resumeFrom(progress);
    } else {
      progress = null;
      store.set("progress", null);
      reset();
    }
    state = "play";
    hideOv();
  }
  ov.addEventListener("click", (e) => {
    const vc = e.target.closest("[data-card]");
    if (vc) {
      const cvw = $("cardv");
      cvw.querySelector("img").src = U[vc.dataset.card].card;
      cvw.querySelector("img").alt = U[vc.dataset.card].n;
      cvw.hidden = false;
      return;
    }
    const uc = e.target.closest("[data-u]");
    if (uc) {
      audio();
      const k = uc.dataset.u,
        o = pickSquad.indexOf(k);
      if (o >= 0) pickSquad.splice(o, 1);
      else if (isUnlocked(k) && pickSquad.length < 6) pickSquad.push(k);
      else {
        uc.classList.remove("nope");
        void uc.offsetWidth;
        uc.classList.add("nope");
        return;
      }
      sfx("place");
      showSquad(true);
      return;
    }
    const a = e.target.closest("[data-a]");
    if (!a) return;
    audio();
    const k = a.dataset.a;
    if (k === "start") {
      if (!pickSquad.length) return;
      ORDER = [...pickSquad];
      store.set("squad", ORDER);
      buildDeck();
      startGame(false);
    } else if (k === "restart") startGame(false);
    else if (k === "continue") startGame(true);
    else if (k === "squad") {
      if (!profile && !store.get("skipProfile")) {
        store.set("skipProfile", true);
        showProfile("squad");
      } else showSquad();
    } else if (k === "profile") showProfile();
    else if (k === "psave") saveProfile(a.dataset.next);
    else if (k === "enemies") showEnemies();
    else if (k === "install") {
      if (deferredInstall) {
        deferredInstall.prompt();
        deferredInstall.userChoice.finally(() => {
          deferredInstall = null;
          const b = $("bInstall");
          if (b) b.hidden = true;
        });
      }
    } else if (k === "resume") {
      state = "play";
      hideOv();
    } else if (k === "menu") {
      reset();
      state = "menu";
      $("banner").classList.remove("show");
      showMenu();
    } else if (k === "send") {
      const v = (($("nm") && $("nm").value) || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9 _-]/g, "")
        .slice(0, 12);
      if (!v) return;
      profile = { nome: "", apelido: v };
      store.set("player", profile);
      $("send").hidden = true;
      submitRanking();
    }
  });

  /* ---------- ranking (D1) ---------- */
  async function loadBoard() {
    const el = $("board");
    if (!el) return;
    try {
      const j = await api("ranking");
      if (!Array.isArray(j.ranking) || !j.ranking.length) return;
      el.innerHTML =
        '<li style="color:var(--hi)"><b>#</b><span>RANKING TOP 10</span>PTS · ONDA</li>' +
        j.ranking
          .slice(0, 10)
          .map(
            (r, i) =>
              `<li><b>${i + 1}</b><span>${esc(r.apelido)}</span>${esc(r.pontuacao)} · ${esc(r.wave_maxima)}</li>`,
          )
          .join("");
    } catch (e) {}
  }
  async function submitRanking() {
    if (submitted) return;
    submitted = true;
    try {
      await ensureRemotePlayer();
      await api("ranking", {
        method: "POST",
        body: JSON.stringify({ pontuacao: score, wave_maxima: wave, zumbis_mortos: kills }),
      });
    } catch (e) {}
    loadBoard();
  }
  function drawScene() {
    const c = $("scene");
    if (!c) return;
    const x = c.getContext("2d"),
      R = (a, b, w, h, col) => {
        x.fillStyle = col;
        x.fillRect(a | 0, b | 0, w, h);
      };
    x.setTransform(c.width / 240, 0, 0, c.width / 240, 0, 0); // cena desenhada em 240x100 e ampliada
    x.imageSmoothingEnabled = false;
    const sky = x.createLinearGradient(0, 0, 0, 62);
    sky.addColorStop(0, "#2c4a5e");
    sky.addColorStop(1, "#a9c7b0");
    x.fillStyle = sky;
    x.fillRect(0, 0, 240, 100);
    for (const [cx, cy, w] of [
      [22, 12, 28],
      [92, 7, 36],
      [168, 14, 30],
      [214, 5, 22],
    ]) {
      R(cx, cy, w, 4, "#dfe9e0");
      R(cx + 5, cy - 3, w - 12, 3, "#eef4ee");
      R(cx + 2, cy + 4, w - 4, 2, "#b5cbc0");
    }
    x.fillStyle = "#5f7d6e";
    x.beginPath();
    x.moveTo(0, 58);
    x.lineTo(38, 36);
    x.lineTo(70, 50);
    x.lineTo(112, 26);
    x.lineTo(150, 52);
    x.lineTo(188, 38);
    x.lineTo(240, 56);
    x.lineTo(240, 70);
    x.lineTo(0, 70);
    x.fill();
    x.fillStyle = "#4a6a5a";
    x.beginPath();
    x.moveTo(90, 60);
    x.lineTo(112, 26);
    x.lineTo(124, 40);
    x.lineTo(140, 60);
    x.fill();
    for (let i = 0; i < 9; i++) {
      x.fillStyle = `rgba(64,62,56,${0.55 - i * 0.055})`;
      x.beginPath();
      x.arc(206 + i * 3, 54 - i * 6, 4 + i * 1.3, 0, 7);
      x.fill();
    }
    for (let i = 0; i < 246; i += 6) {
      const h = 9 + ((i * 37) % 7);
      x.fillStyle = (i / 6) % 2 ? "#244a1e" : "#1c3a17";
      x.beginPath();
      x.arc(i, 65 - h / 2, h / 1.4, 0, 7);
      x.fill();
    }
    R(0, 63, 240, 6, "#1c3a17");
    R(0, 68, 240, 32, "#7a5c38");
    for (let i = 0; i < 240; i += 3) R(i, 70 + ((i * 13) % 26), 2, 1, "#634a2c");
    R(0, 68, 240, 2, "#3f6d22");
    x.fillStyle = "#937449";
    x.beginPath();
    x.moveTo(98, 100);
    x.lineTo(146, 100);
    x.lineTo(126, 69);
    x.lineTo(116, 69);
    x.fill();
    x.fillStyle = "rgba(255,240,170,.16)";
    x.beginPath();
    x.moveTo(42, 30);
    x.lineTo(126, 70);
    x.lineTo(104, 78);
    x.fill();
    R(30, 40, 2, 34, "#4e3520");
    R(46, 40, 2, 34, "#4e3520");
    for (let i = 0; i < 4; i++) R(31, 46 + i * 7, 16, 1, "#5a3f26");
    R(27, 36, 24, 5, "#5a3f26");
    R(26, 34, 26, 2, "#3d2712");
    R(29, 27, 20, 7, "#2f4a1c");
    R(27, 25, 24, 2, "#1f3312");
    R(37, 29, 5, 4, "#fff3b0");
    R(36, 28, 7, 1, "#141a0e");
    x.fillStyle = "#8a6b42";
    x.beginPath();
    x.ellipse(196, 70, 34, 12, 0, Math.PI, 0);
    x.fill();
    x.fillStyle = "#4f6b2a";
    x.beginPath();
    x.ellipse(196, 62, 14, 9, 0, Math.PI, 0);
    x.fill();
    R(190, 58, 12, 3, "#141a0e");
    R(184, 60, 26, 1, "#36491c");
    for (let i = 2; i < 240; i += 22) R(i, 59, 2, 13, "#5c6268");
    for (const yy of [61, 65, 69]) for (let i = 0; i < 240; i += 2) R(i, yy + ((i / 2) % 2), 1, 1, "#a0a5aa");
    const palm = (px, py, h, lean) => {
      for (let i = 0; i < h; i++) R(px + ((lean * i * i) / h / h) * 9, py - i, 3, 1, i % 3 ? "#6b4a2a" : "#4e3520");
      const tx = px + lean * 9,
        ty = py - h;
      for (const [dx, up] of [
        [-1, 0],
        [1, 0],
        [-1, 1],
        [1, 1],
        [0.3, 2],
      ])
        for (let k = 0; k < 13; k++)
          R(
            tx + 1 + dx * k,
            ty - (up === 2 ? k * 0.5 : up ? k * 0.15 : 0) + (k * k) / 15 - (up === 1 ? 2 : 0),
            2,
            2,
            k % 2 ? "#3f8a2a" : "#2e6a1e",
          );
    };
    palm(8, 84, 36, 0.6);
    palm(226, 84, 32, -0.7);
    palm(176, 74, 20, 0.4);
    palm(60, 72, 18, -0.3);
    const bags = (bx, by, n, rows) => {
      for (let r = 0; r < rows; r++)
        for (let k = 0; k < n - r; k++) {
          const sx = bx + k * 9 + r * 4,
            sy = by - r * 5;
          R(sx - 1, sy - 1, 10, 6, "#141a0e");
          R(sx, sy, 8, 4, "#b59a62");
          R(sx, sy, 8, 1, "#d8c189");
        }
    };
    bags(2, 86, 5, 2);
    bags(176, 86, 5, 2);
    for (const [cx, cy] of [
      [66, 78],
      [77, 78],
      [71, 71],
    ]) {
      R(cx, cy, 11, 8, "#141a0e");
      R(cx + 1, cy + 1, 9, 6, "#4f6b2a");
      R(cx + 1, cy + 1, 9, 1, "#7f9f40");
      R(cx + 4, cy + 1, 2, 6, "#36491c");
    }
    for (const [cx, col] of [
      [206, "#9a4a2a"],
      [215, "#4a5a7a"],
      [224, "#4a5a7a"],
    ]) {
      R(cx, 77, 8, 10, "#141a0e");
      R(cx + 1, 78, 6, 8, col);
      R(cx + 1, 80, 6, 1, "#00000055");
      R(cx + 1, 84, 6, 1, "#00000055");
      R(cx + 2, 78, 1, 8, "#ffffff22");
    }
    // esquadrão em formação: sprites de ação (PNG) quando carregados, pixel art como reserva
    const sb = (k, cx, b, h) => {
      const im = IMG[k];
      if (im) {
        const w = (im.width * h) / im.height;
        x.imageSmoothingEnabled = true;
        x.drawImage(im, cx - w / 2, b - h, w, h);
        x.imageSmoothingEnabled = false;
      } else x.drawImage(SP[k], (cx - SP[k].width / 2) | 0, b - SP[k].height);
    };
    x.drawImage(SP.mortar, 30 - SP.mortar.width / 2, 99 - SP.mortar.height);
    sb("rifle", 54, 99, 24);
    sb("grenade", 80, 99, 24);
    sb("tank", 110, 99, 22);
    x.drawImage(SP.mg, 138 - SP.mg.width / 2, 99 - SP.mg.height);
    sb("missile", 162, 99, 24);
  }

  /* ---------- layout + loop ---------- */
  function fit() {
    const st = $("stage");
    const aw = st.clientWidth - 10,
      ah = st.clientHeight - 12;
    const dpr = devicePixelRatio || 1;
    let s = Math.min(aw / W, ah / H);
    s = Math.max(s >= 4 ? Math.floor(s) : Math.floor(s * dpr * 8) / (dpr * 8), 0.4);
    cv.style.width = fxc.style.width = Math.floor(W * s) + "px";
    cv.style.height = fxc.style.height = Math.floor(H * s) + "px";
    CSS_S = s;
    const nf = Math.max(2, Math.min(5, Math.ceil(s * (devicePixelRatio || 1))));
    if (nf !== FS || !vign || cv.width !== W * nf) {
      FS = nf;
      fxc.width = cv.width = W * FS;
      fxc.height = cv.height = H * FS;
      buildVign();
    }
  }
  const ro = new ResizeObserver(fit);
  ro.observe($("stage"));
  fit();
  let last = performance.now();
  function frame(now) {
    const rdt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let dt = rdt;
    if (slowT > 0) {
      slowT -= rdt;
      dt *= 0.3;
    }
    if (state === "play") for (let i = 0; i < spd; i++) update(dt);
    if (state !== "pause") for (let i = 0; i < (state === "play" ? spd : 1); i++) stepFx(dt);
    trauma = Math.max(0, trauma - rdt * 1.3);
    flashA = Math.max(0, flashA - rdt * 2.2);
    const off = 7 * trauma * trauma,
      sx = rnd(-1, 1) * off,
      sy = rnd(-1, 1) * off * 0.7,
      tr = `translate(calc(-50% + ${(sx * CSS_S).toFixed(1)}px),calc(-50% + ${(sy * CSS_S).toFixed(1)}px))`;
    cv.style.transform = fxc.style.transform = tr;
    render();
    drawFx(0, 0);
    updUI();
    music();
    requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "play") {
      state = "pause";
      showPause();
    }
  });
  reset();
  state = "menu";
  $("banner").classList.remove("show");
  showMenu();
  requestAnimationFrame(frame);
  syncFromServer();
  try {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost"))
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  } catch (e) {}
}
