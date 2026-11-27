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
  cv.width = 1230;
  cv.height = 732;
  ctx.imageSmoothingEnabled = false;

  /* ---------- câmera isométrica ----------
     Tela virtual = tamanho do cenário (assets/maps/arena.jpg). ISO = canto do tabuleiro
     (coluna 0, linha 0) e vetores de uma casa ao longo da linha (c) e entre linhas (r). */
  let MODE = "def"; // "def" = defesa de torres, "tank" = modo tanque (ver MODO TANQUE)
  const CAM = { x: 40, y: 58 }; // recorte do cenário (aproxima a câmera do tabuleiro)
  const VW = 1310 - 2 * CAM.x,
    VH = 830 - CAM.y - 40;
  const ISO = { ox: 108 - CAM.x, oy: 522 - CAM.y, cx: 76.5, cy: -41.6, rx: 76.3, ry: 41.9 };
  const K = Math.hypot(ISO.cx, ISO.cy) / CELL; // unidades de tela por unidade da grade
  const LANE_ANG = Math.atan2(ISO.cy, ISO.cx); // inclinação das linhas na tela
  const laneY = (r) => r * CELL + CELL / 2; // centro da linha r
  const rowOf = (y) => Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL)));
  // ponto do chão da grade -> tela
  const iso = (x, y) => {
    const u = (x - GX) / CELL,
      v = y / CELL;
    return [ISO.ox + u * ISO.cx + v * ISO.rx, ISO.oy + u * ISO.cy + v * ISO.ry];
  };
  // ponto da grade com altura embutida no y (como no jogo 2D) -> tela
  const scr = (x, y, row = rowOf(y)) => {
    const [sx, sy] = iso(x, laneY(row));
    return [sx, sy - (row * CELL + CELL - 2 - y) * K];
  };
  // tela -> grade (para o toque/clique)
  const unproject = (sx, sy) => {
    const det = ISO.cx * ISO.ry - ISO.rx * ISO.cy,
      X = sx - ISO.ox,
      Y = sy - ISO.oy;
    return { x: GX + ((ISO.ry * X - ISO.rx * Y) / det) * CELL, y: ((-ISO.cy * X + ISO.cx * Y) / det) * CELL };
  };
  // efeitos (partículas) vivem no espaço da tela dividido por K
  const toFx = (x, y, row) => {
    if (MODE === "tank") return [x, y]; // no modo tanque os efeitos já chegam em espaço de efeitos
    const [sx, sy] = scr(x, y, row);
    return [sx / K, sy / K];
  };
  let MAPIMG = null;
  {
    const im = new Image();
    im.onload = () => (MAPIMG = im);
    im.src = "assets/maps/arena.jpg";
  }

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
  let radioIndex = 0,
    radioSeen = new Set(),
    radioQueue = [],
    radioCurrent = null;
  function radioPlayNext() {
    if (radioCurrent || !radioQueue.length) return;
    const src = radioQueue.shift();
    const a = new Audio(src);
    radioCurrent = a;
    a.preload = "auto";
    a.volume = 0.32;
    a.muted = !sound;
    const finish = () => {
      if (radioCurrent === a) radioCurrent = null;
      radioPlayNext();
    };
    a.onended = finish;
    a.onerror = finish;
    a.play().catch(finish);
  }
  function radioCue(key) {
    if (MODE !== "tank" || radioSeen.has(key) || radioIndex >= 11) return;
    radioSeen.add(key);
    radioIndex++;
    radioQueue.push("/audio/radio/radio_" + String(radioIndex).padStart(2, "0") + ".mp3");
    radioPlayNext();
  }
  function radioDamageCue(target) {
    radioCue("under-fire");
    const maxHp = target === T ? tStats().max : Math.round(CHASSIS[tcfg2.chassis].hp * (1 + 0.2 * (lv.armor || 0)));
    if (target.hp <= maxHp * 0.3) radioCue("critical");
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
  // partícula em pixel: nasce num ponto da grade e vive no espaço da tela (÷K)
  function part(x, y, vx, vy, life, col, s = 1, g = 0, row) {
    const [px, py] = toFx(x, y, row);
    parts.push({ x: px, y: py, vx, vy, life, max: life, col, s, g });
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
  // efeito: converte a posição da grade para o espaço da tela (÷K); o.row força a linha
  function add(o) {
    if (MODE === "tank") {
      if (o.gy != null) {
        o.lx = o.x;
        o.ly = o.gy;
      }
      fxs.push(o);
      return;
    }
    const row = o.row != null ? o.row : rowOf(o.y);
    if (o.gy != null) {
      o.lx = o.x; // ponto do chão (para a mancha no decal)
      o.ly = laneY(row) + rnd(-4, 4);
      o.gy = toFx(o.x, o.gy, row)[1];
    }
    [o.x, o.y] = toFx(o.x, o.y, row);
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
    if (MODE === "tank") return tScorch(x, y, r); // modo tanque: lista de manchas do mundo
    for (let i = 0; i < 3; i++) {
      dc.fillStyle = `rgba(22,16,8,${0.22 + i * 0.12})`;
      dc.beginPath();
      dc.ellipse(x, y, r * (1 - i * 0.3), r * 0.5 * (1 - i * 0.3), 0, 0, 7);
      dc.fill();
    }
  }
  function splat(x, y, c) {
    if (MODE === "tank") return tSplat(x, y, c);
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
    MODE === "tank" ? scorch(x, y + 3, 4 * k) : scorch(x, laneY(rowOf(y)) + 1, 4 * k);
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
  function txt(x, y, v, col = "255,236,150", row) {
    add({
      row,
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
            splat(p.lx + rnd(-2, 2), p.ly);
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
    if (MODE === "def") ambT -= dt;
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
    fx.setTransform(FS * K, 0, 0, FS * K, sx * FS, sy * FS); // espaço dos efeitos = tela ÷ K
    // projéteis com luz (rastro na direção da linha)
    fx.globalCompositeOperation = "lighter";
    const ldx = Math.cos(LANE_ANG),
      ldy = Math.sin(LANE_ANG);
    for (const p of proj) {
      const [x, y] = toFx(p.x, p.y, p.row);
      if (p.k === "bullet") {
        fx.globalAlpha = 1;
        fx.strokeStyle = "rgba(255,225,140,.95)";
        fx.lineWidth = 0.8;
        fx.beginPath();
        fx.moveTo(x - 9 * ldx, y - 9 * ldy);
        fx.lineTo(x, y);
        fx.stroke();
        fx.drawImage(GL.y, x - 2.5, y - 2.5, 5, 5);
      } else if (p.k === "shell") {
        fx.strokeStyle = "rgba(255,160,60,.9)";
        fx.lineWidth = 1.2;
        fx.beginPath();
        fx.moveTo(x - 12 * ldx, y - 12 * ldy);
        fx.lineTo(x, y);
        fx.stroke();
        fx.drawImage(GL.o, x - 4, y - 3.5, 8, 8);
      } else if (p.k === "missile") {
        const f = rnd(0.8, 1.3);
        fx.drawImage(GL.o, x - 8 * ldx - 4 * f, y - 8 * ldy - 4 * f, 8 * f, 8 * f);
        fx.drawImage(GL.w, x - 7 * ldx - 1.5, y - 7 * ldy - 1.5, 3, 3);
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
        fx.moveTo(x, y);
        fx.lineTo(x + 9 * ldx, y + 9 * ldy);
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
  function coins(x, y, row) {
    for (let i = 0; i < 5; i++)
      part(x, y, (Math.random() - 0.5) * 30, -40 - Math.random() * 25, 0.6, "#f2c230", 1, 120, row);
  }
  function zy(z) {
    return z.row * CELL + CELL - 2 - (z.d.big ? 18 : 8); // meio do corpo
  }
  function hurt(z, d, quiet) {
    if (z.dead) return;
    z.hp -= d;
    const y = zy(z);
    if (!quiet) {
      z.fl = 0.07;
      gore(z.x, y, 3);
      sfx("squish");
      if (d >= 40) txt(z.x, y - 10, d, undefined, z.row);
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
      txt(z.x, y - 16, "+$" + z.d.cash, "140,235,90", z.row);
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
      const row = (Math.random() * ROWS) | 0,
        ty = row * CELL + CELL - 2;
      crates.push({
        x: GX + 12 + Math.random() * (COLS * CELL - 24),
        row,
        y: ty - 60, // cai de paraquedas (altura)
        ty,
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
          puff(c.x, c.ty - 1, 5);
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
        if (Math.random() < 0.6)
          G(GL.sl, p.x, p.y, { add: false, a: 0.25, smoke: 1, r0: 0.8, r1: 3, life: 0.6, row: p.row });
        if (f >= 1) {
          splash(p.row, p.x, p.splash, p.dmg);
          boom(p.x, p.ty, 1.4);
          p.dead = true;
        }
        continue;
      }
      if (p.k === "gren") {
        p.t += dt;
        if (Math.random() < 0.5)
          G(GL.sl, p.x, p.y, { add: false, a: 0.25, smoke: 1, r0: 0.8, r1: 3, life: 0.5, row: p.row });
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
                puff(z.x, z.row * CELL + CELL - 2, 4);
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

  /* ==========================================================================
     DESENHO — VISTA ISOMÉTRICA
     A lógica do jogo continua em coordenadas "da grade" (x ao longo da linha,
     y atravessando as linhas). Aqui tudo é projetado no tabuleiro inclinado:
       • chão (grama, crateras, destaque da casa): transformação afim do canvas
       • bonecos, projéteis e caixas: em pé, no ponto projetado, ordenados por profundidade
     ========================================================================== */
  function groundTransform() {
    // grade -> tela: (x,y) vira O + (x-GX)/CELL·C + y/CELL·R
    const a = ISO.cx / CELL,
      b = ISO.cy / CELL,
      c = ISO.rx / CELL,
      d = ISO.ry / CELL;
    ctx.setTransform(FS * a, FS * b, FS * c, FS * d, FS * (ISO.ox - GX * a), FS * (ISO.oy - GX * b));
  }
  // desenha coisas em pixel art com escala K, com a origem no ponto (sx,sy) da tela
  function at(sx, sy, s = K) {
    ctx.setTransform(FS * s, 0, 0, FS * s, FS * sx, FS * sy);
  }
  const screenT = () => ctx.setTransform(FS, 0, 0, FS, 0, 0);

  function bar(cx, y, hp, max) {
    if (hp >= max) return;
    const w = 12 * K,
      f = Math.max(0, hp / max);
    ctx.fillStyle = "#000";
    ctx.fillRect(cx - w / 2 - K, y - K, w + 2 * K, 3 * K);
    ctx.fillStyle = f > 0.5 ? "#6ee04a" : f > 0.25 ? "#f2c230" : "#e0533a";
    ctx.fillRect(cx - w / 2, y, w * f, K);
  }
  /* Desenha um SPRITE DE AÇÃO (PNG) com a base em (cx,bottom) da tela e altura h (unidades de tela).
     Nunca usamos a arte da carta aqui. */
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
  // sprite em pixel art (cartas extras sem PNG): ampliado K vezes, sem suavizar
  function drawPix(img, cx, bottom, fl, a = 1) {
    ctx.save();
    at(cx - (img.width * K) / 2, bottom - img.height * K);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = a;
    ctx.drawImage(img, 0, 0);
    if (fl > 0) {
      ctx.globalAlpha = 0.75 * a;
      ctx.drawImage(wht(img), 0, 0);
    }
    ctx.restore();
  }
  function shadow(x, y, rx) {
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * 0.42, 0, 0, 7);
    ctx.fill();
  }
  /* Saída do tiro de cada unidade, medida no sprite (unidades da grade: dx à frente, dy para cima).
     Convertida para a grade levando em conta a diagonal da linha. */
  const MUZZLE_SPR = {
    rifle: [12.5, -12],
    missile: [9, -18.5],
    tank: [16, -14],
    grenade: [9, -14],
    mg: [12, -7],
    mortar: [7, -13],
  };
  const MUZZLE = {};
  for (const k in MUZZLE_SPR) {
    const [dx, dy] = MUZZLE_SPR[k],
      u = (dx * K) / (ISO.cx / CELL), // avanço ao longo da linha
      h = ((u * ISO.cy) / CELL - dy * K) / K; // altura que sobra
    MUZZLE[k] = [u, -h];
  }
  // Cano do tanque: na arte original ele fica atrás da explosão, então é desenhado aqui (e recua ao atirar)
  function drawBarrel(u, sx, sy, rx) {
    const len = 11 - (u.rec > 0.1 ? 2.5 : 0);
    ctx.save();
    at(sx + rx + 5 * K, sy - SPRITE_H.tank * 0.7 * K);
    ctx.rotate(LANE_ANG * 0.6);
    ctx.fillStyle = "#1d2410";
    ctx.fillRect(0, -1.2, len + 0.6, 2.6);
    ctx.fillStyle = "#5d6a32";
    ctx.fillRect(0, -0.6, len, 1.4);
    ctx.fillStyle = "#8a9a52";
    ctx.fillRect(0, -0.6, len, 0.45);
    ctx.fillStyle = "#1d2410";
    ctx.fillRect(len - 1.6, -1.6, 2.2, 3.4);
    ctx.restore();
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
    const [sx, sy] = iso(u.x, laneY(u.row)),
      im = IMG[u.type],
      atk = u.rec > 0 || u.throwT > 0 || u.wind > 0,
      still = u.type === "tank" || u.type === "mine" || u.type === "wire",
      rx = (u.rec > 0 ? (u.type === "tank" ? -1.5 : -1) : 0) * K,
      a = ghost ? 0.5 : u.type === "mine" && u.arm > 0 ? 0.6 : 1;
    if (!ghost && u.type !== "mine") shadow(sx, sy, (u.type === "tank" ? 12 : u.type === "wire" ? 9 : 7) * K);
    let top;
    if (im) {
      // 2 frames: PARADO (respira) e ATACANDO (recuo + leve esticada)
      const h = SPRITE_H[u.type] * K;
      let rot = 0;
      if (u.wind > 0) rot = -0.1;
      else if (u.throwT > 0) rot = 0.08;
      const breathe = 1 + Math.sin((u.t + (u.seed || 0)) * 3) * 0.015;
      drawImg(im, sx + rx, sy + (u.type === "tank" && !u.rec ? (((u.t * 12) | 0) % 2) * 0.35 * K : 0), h, {
        fl: u.fl,
        a,
        rot,
        sx: still ? 1 : atk ? 1.04 : 1,
        sy: still ? 1 : atk ? 0.96 : breathe,
      });
      if (u.type === "tank") drawBarrel(u, sx, sy, rx);
      top = sy - h;
    } else {
      const img = frameOf(u);
      drawPix(img, sx + rx, sy, u.fl, a);
      top = sy - img.height * K;
    }
    if (u.type === "mine" && !ghost && u.arm <= 0 && ((u.t * 3) | 0) % 2) {
      ctx.fillStyle = "#ff3b2a";
      ctx.fillRect(sx - 0.8 * K, top + 0.6 * K, 1.6 * K, K);
    }
    if (!ghost) bar(sx, top - 3 * K, u.hp, u.max);
  }
  function drawZ(z) {
    const [sx, sy0] = iso(z.x, laneY(z.row)),
      sy = sy0 + (z.d.big ? 2 * K : 0),
      im = IMG["z_" + z.type];
    shadow(sx, sy, (z.half + 1.5) * K);
    let top;
    if (im) {
      // 2 frames de andar (balanço alternado) + mordida (inclina para frente)
      const h = SPRITE_H["z_" + z.type] * K;
      let rot = 0,
        dy = 0;
      if (z.bite) rot = -(0.06 + 0.06 * Math.sin(z.t * 18));
      else if (z.stun > 0) rot = 0.12;
      else if (z.firing > 0) rot = 0.03 * Math.sin(z.t * 40);
      else {
        const ph = Math.sin(z.t * (z.type === "runner" ? 14 : z.d.big ? 5 : 7));
        rot = ph * 0.05;
        dy = -Math.abs(ph) * 0.8 * K;
      }
      drawImg(im, sx, sy + dy, h, { fl: z.fl, rot });
      top = sy - h;
    } else {
      const F = ZF[z.type],
        img = z.bite ? F.bite[((z.t * 6) | 0) % 2] : F.walk[((z.t * 5) | 0) % 4];
      drawPix(img, sx, sy, z.fl);
      top = sy - img.height * K;
    }
    if (!z.d.big) bar(sx, top - 3 * K, z.hp, z.max);
  }
  function drawCorpse(c) {
    const [sx, sy] = iso(c.x, laneY(c.row)),
      f = Math.min(1, c.t / 0.35);
    ctx.save();
    ctx.globalAlpha = c.t > 1.5 ? Math.max(0, 1 - (c.t - 1.5) / 1.1) : 1;
    ctx.translate(sx, sy + f * f * 2 * K);
    ctx.rotate(f * f * 1.45);
    const ch = (c.h || c.img.height) * K,
      cw = (c.img.width * ch) / c.img.height;
    ctx.imageSmoothingEnabled = !!c.h;
    ctx.drawImage(c.img, -cw / 2, -ch, cw, ch);
    if (c.t < 0.08) {
      ctx.globalAlpha = 0.8;
      ctx.drawImage(wht(c.img), -cw / 2, -ch, cw, ch);
    }
    ctx.restore();
  }
  // pilha de sacos de areia da base, em pé, no começo de cada linha
  function drawBags(r) {
    const [sx, sy] = iso(GX - 9, laneY(r));
    ctx.save();
    at(sx, sy);
    for (const [bx, by] of [
      [-9, -4],
      [-1, -4],
      [-5, -8],
    ]) {
      ctx.fillStyle = "#141a0e";
      ctx.fillRect(bx - 0.6, by - 0.6, 9.2, 5.2);
      ctx.fillStyle = "#b59a62";
      ctx.fillRect(bx, by, 8, 4);
      ctx.fillStyle = "#d8c189";
      ctx.fillRect(bx, by, 8, 1);
      ctx.fillStyle = "#86703f";
      ctx.fillRect(bx, by + 3, 8, 1);
    }
    ctx.restore();
  }
  function drawCrate(c) {
    if (c.land && c.life < 2.5 && ((c.life * 8) | 0) % 2) return;
    const [sx, sy] = iso(c.x, laneY(c.row));
    if (c.land) shadow(sx, sy, 6 * K);
    ctx.save();
    at(sx, sy - (c.ty - c.y) * K);
    if (!c.land) {
      ctx.fillStyle = "#141a0e";
      ctx.fillRect(-7, -15, 15, 5);
      ctx.fillStyle = "#e9e4cc";
      ctx.fillRect(-6, -14, 13, 3);
      ctx.fillStyle = "#7f9f40";
      ctx.fillRect(-2, -14, 5, 3);
      ctx.fillStyle = "#141a0e";
      ctx.fillRect(-6, -11, 1, 6);
      ctx.fillRect(6, -11, 1, 6);
    }
    ctx.fillStyle = "#141a0e";
    ctx.fillRect(-5, -5, 11, 9);
    ctx.fillStyle = "#9a6a32";
    ctx.fillRect(-4, -4, 9, 7);
    ctx.fillStyle = "#f2c230";
    ctx.fillRect(0, -4, 1, 7);
    ctx.fillRect(-4, -1, 9, 1);
    ctx.restore();
  }
  function drawProjectile(p) {
    const [sx, sy] = scr(p.x, p.y, p.row);
    ctx.save();
    at(sx, sy);
    if (p.k === "shell") {
      ctx.rotate(LANE_ANG);
      ctx.fillStyle = "#141a0e";
      ctx.fillRect(-3, -1, 5, 3);
      ctx.fillStyle = "#c8a040";
      ctx.fillRect(-2, 0, 4, 1);
    } else if (p.k === "missile") {
      ctx.rotate(LANE_ANG);
      ctx.fillStyle = "#141a0e";
      ctx.fillRect(-5, -1, 8, 3);
      ctx.fillStyle = "#cfd3d6";
      ctx.fillRect(-4, 0, 6, 1);
      ctx.fillStyle = "#b8322a";
      ctx.fillRect(2, 0, 1, 1);
    } else if (p.k === "mort") {
      ctx.fillStyle = "#141a0e";
      ctx.fillRect(-2, -3, 4, 6);
      ctx.fillStyle = "#5c6268";
      ctx.fillRect(-1, -2, 2, 4);
    } else if (p.k === "gren") {
      ctx.fillStyle = "#141a0e";
      ctx.fillRect(-2, -2, 4, 4);
      ctx.fillStyle = "#4f6b2a";
      ctx.fillRect(-1, -1, 2, 2);
    } else if (p.k === "acid") {
      ctx.fillStyle = "#2f5a12";
      ctx.fillRect(-2, -2, 4, 4);
      ctx.fillStyle = "#9be22d";
      ctx.fillRect(-1, -1, 2, 2);
    }
    ctx.restore();
  }
  function render() {
    ctx.save();
    screenT();
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "#0b0f07";
    ctx.fillRect(0, 0, VW, VH);
    if (MAPIMG) ctx.drawImage(MAPIMG, -CAM.x, -CAM.y, 1310, 830); // cenário (muralhas, torres, barracas)
    // --- chão do tabuleiro, inclinado
    ctx.save();
    groundTransform();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bg, 0, 0);
    ctx.drawImage(decal, 0, 0);
    // marcador da mira do morteiro
    for (const p of proj)
      if (p.k === "mort" && ((p.t * 8) | 0) % 2) {
        ctx.fillStyle = "rgba(255,59,42,.85)";
        ctx.fillRect(p.tx - 4, p.row * CELL + CELL / 2 - 0.6, 8, 1.2);
        ctx.fillRect(p.tx - 0.6, p.row * CELL + CELL / 2 - 4, 1.2, 8);
      }
    let ghost = null;
    if (hover && sel && state === "play") {
      const occ = units.find((u) => u.col === hover.c && u.row === hover.r);
      const ok = sel === "shovel" ? !!occ : !occ && money >= U[sel].cost && cardCd[sel] <= 0;
      ctx.fillStyle = ok ? (sel === "shovel" ? "rgba(255,80,60,.35)" : "rgba(255,255,255,.28)") : "rgba(255,60,40,.25)";
      ctx.fillRect(GX + hover.c * CELL + 0.5, hover.r * CELL + 0.5, CELL - 1, CELL - 1);
      if (ok && sel !== "shovel")
        ghost = {
          type: sel,
          x: GX + hover.c * CELL + CELL / 2,
          row: hover.r,
          t: 0,
          rec: 0,
          fl: 0,
          arm: 0,
          hp: 1,
          max: 1,
        };
    }
    ctx.restore();
    // --- tudo o que fica em pé, do fundo para a frente (ordem pela altura na tela)
    const list = [];
    const push = (x, row, f, bias = 0) => list.push({ d: iso(x, laneY(row))[1] + bias, f });
    for (let r = 0; r < ROWS; r++) push(GX - 9, r, () => drawBags(r));
    for (const c of corpses) push(c.x, c.row, () => drawCorpse(c), -0.5);
    for (const u of units) push(u.x, u.row, () => drawUnit(u), u.type === "mine" ? -1 : 0);
    for (const z of zs) push(z.x, z.row, () => drawZ(z), 0.5);
    for (const c of crates) push(c.x, c.row, () => drawCrate(c), 0.2);
    if (ghost) push(ghost.x, ghost.row, () => drawUnit(ghost, true), 0.1);
    list.sort((a, b) => a.d - b.d);
    for (const it of list) it.f();
    for (const p of proj) drawProjectile(p);
    // partículas em pixel (cápsulas, moedas, poeira) — espaço dos efeitos
    ctx.setTransform(FS * K, 0, 0, FS * K, 0, 0);
    for (const p of parts) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.globalAlpha = 1;
    screenT();
    // barra de preparação da próxima onda (no pé da tela)
    if (waveState === "prep" && state === "play" && timer < 7.5) {
      const f = 1 - timer / (wave === 0 ? 10 : 7),
        w = VW * 0.4;
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect((VW - w) / 2, VH - 16, w, 8);
      ctx.fillStyle = "#f2c230";
      ctx.fillRect((VW - w) / 2, VH - 16, w * f, 8);
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
    // posição do toque na tela virtual
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * VW) / r.width, y: ((e.clientY - r.top) * VH) / r.height };
  }
  function cellAt(p) {
    const g = unproject(p.x, p.y), // tela -> grade
      c = Math.floor((g.x - GX) / CELL),
      r = Math.floor(g.y / CELL);
    return c >= 0 && c < COLS && r >= 0 && r < ROWS ? { c, r } : null;
  }
  cv.addEventListener("pointerdown", (e) => {
    audio();
    if (state !== "play") return;
    const p = toLocal(e);
    for (const c of crates) {
      const [cx, cy] = iso(c.x, laneY(c.row));
      if (Math.abs(p.x - cx) < 12 * K && Math.abs(p.y - (cy - (c.ty - c.y) * K) + 4 * K) < 12 * K) {
        c.life = 0;
        money += 25;
        coins(c.x, c.y, c.row);
        G(GL.y, c.x, c.y, { r0: 4, r1: 16, life: 0.3, row: c.row });
        txt(c.x, c.y - 8, "+$25", "255,214,90", c.row);
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
    if (MODE === "tank" || state === "tselect") {
      const k = e.key.toLowerCase();
      if (state === "tselect" && tankSetupPlayer===1) { const keys=Object.keys(CAMO); if(k==="a"||k==="arrowleft"||k==="d"||k==="arrowright"){e.preventDefault();const i=keys.indexOf(tcfg.camo),n=(i+(k==="a"||k==="arrowleft"?-1:1)+keys.length)%keys.length;tcfg.camo=keys[n];showTankSelect(1);return;} if(k==="enter"){e.preventDefault();showTankSelect(2);return;} }
      if (state === "play" && tKey(e, true)) return;
      if (k === "p" || k === "escape") togglePause();
      return;
    }
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
    if (radioCurrent) radioCurrent.muted = !sound;
    if (master) master.gain.setTargetAtTime(sound ? 0.85 : 0, AC.currentTime, 0.05);
  };

  $("bRestart").onclick = () => {
    audio();
    if (MODE === "tank") {
      if (state !== "menu" && state !== "tsetup") tRetry();
    } else if (state === "play" || state === "pause" || state === "over") startGame(false);
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
 <div class="menu-btns">${canContinue ? `<button class="big" data-a="continue">CONTINUAR · ONDA ${progress.wave_atual}</button>` : ""}<button class="${canContinue ? "alt" : "big"}" data-a="squad">${canContinue ? "NOVO JOGO" : "JOGAR ▶"}</button><button class="big tbtn" data-a="tsetup">MODO TANQUE ▶</button><button class="alt" data-a="enemies">INIMIGOS</button><button class="alt" data-a="profile">${profile ? "PERFIL" : "CRIAR PERFIL"}</button><button class="alt" id="bInstall" data-a="install" ${deferredInstall ? "" : "hidden"}>INSTALAR APP</button></div>
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
    } else if (k === "restart") MODE === "tank" ? tRetry() : startGame(false);
    else if (k === "tretry") tRetry();
    else if (k === "treset") {
      camp = { m: 0, money: 100, lv: {}, score: 0, acc: accDefault() };
      saveCamp();
      tStart();
    } else if (k === "tsetup") showTankPlayers();
    else if (k === "tplayers") { tankPlayers=+(a.dataset.n||1); if(tankPlayers===2) showTankSelect(1); else showTankSetup();
    } else if (k === "tselect") { const p=+(a.dataset.p||tankSetupPlayer), v=a.dataset.v, g=a.dataset.g||"camo"; if(v){ if(p===1) tcfg[g]=v; else tcfg2[g]=v; showTankSelect(p); return; } if(p===1) showTankSelect(2); else { store.set("tank2",tcfg2); showTankSetup(); }
    } else if (k === "tgo") {
      store.set("tank", tcfg); store.set("tank2",tcfg2);
      tStart();
    } else if (k === "tcfg") {
      tcfg[a.dataset.g] = a.dataset.v;
      store.set("tank", tcfg);
      sfx("place");
      const y = ov.scrollTop;
      showTankSetup();
      ov.scrollTop = y;
    } else if (k === "tup") buyUpgrade(a.dataset.k);
    else if (k === "tacc") buyAcc(a.dataset.k);
    else if (k === "trep") buyRepair();
    else if (k === "tnext") nextWave();
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
      if (MODE === "tank") tExit();
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

  /* ==========================================================================
     MODO TANQUE (campanha)
     O jogador pilota um tanque por mapas compridos, destrói objetos e ninhos
     de zumbi e chega à extração. h = altura acima do chão.
     Teclado: ↑↓ anda · ←→ gira o casco · A/D gira a torreta ·
              Espaço ou B = canhão · Enter = metralhadora (segure)
     Controle (PS4): analógico esq. anda · dir. mira · R2/R1/X canhão · L2/L1/□ metralhadora
     Celular: tela cheia, analógico esquerdo anda, direito gira a torreta, botões de tiro.
     ========================================================================== */
  const CAMO = {
    bravo: { n: "Bravo", base: "#b39a63", side: "#7a6842", dark: "#4a4030", blobs: ["#5f5e34", "#25241c", "#d0b980"] },
    verde: { n: "Verde", base: "#5b7530", side: "#2f3f18", dark: "#3d521f", blobs: ["#41571f", "#7a9442", "#2a3814"] },
    deserto: {
      n: "Deserto",
      base: "#bfa063",
      side: "#6e5a33",
      dark: "#8c7445",
      blobs: ["#9c7f48", "#dcc48d", "#6e5a33"],
    },
    neve: { n: "Neve", base: "#dcdfd8", side: "#7b807a", dark: "#a8ada6", blobs: ["#b3b8b0", "#f5f6f2", "#8e938c"] },
    urbano: {
      n: "Urbano",
      base: "#6d7278",
      side: "#34383c",
      dark: "#4f5459",
      blobs: ["#4f5459", "#9196a0", "#2c2f33"],
    },
  };
  const CANNON = {
    leve: {
      n: "Leve",
      dmg: 45,
      reload: 0.75,
      splash: 12,
      speed: 340,
      range: 300,
      len: 15,
      w: 2.2,
      k: 0.9,
      desc: "Recarrega rápido",
    },
    padrao: {
      n: "Padrão",
      dmg: 75,
      reload: 1.3,
      splash: 18,
      speed: 300,
      range: 320,
      len: 18,
      w: 2.8,
      k: 1.3,
      desc: "Equilibrado",
    },
    pesado: {
      n: "Pesado",
      dmg: 130,
      reload: 2.1,
      splash: 28,
      speed: 260,
      range: 330,
      len: 20,
      w: 3.8,
      k: 1.9,
      desc: "Explosão enorme, recarga lenta",
    },
  };
  const CHASSIS = {
    leve: { n: "Leve", hp: 260, speed: 62, turn: 2.7, L: 26, W: 17, desc: "Rápido, pouca blindagem" },
    medio: { n: "Médio", hp: 360, speed: 48, turn: 2.2, L: 29, W: 19, desc: "Equilibrado" },
    pesado: { n: "Pesado", hp: 520, speed: 36, turn: 1.8, L: 32, W: 21, desc: "Muita blindagem, lento" },
    abrams: { n: "M1 Abrams", hp: 620, speed: 44, turn: 2.0, L: 34, W: 22, desc: "Tanque de batalha americano · blindagem pesada e alta mobilidade" },
  };
  // melhorias compradas na oficina entre as ondas (valem só na partida)
  const UPG = [
    { k: "armor", n: "Blindagem", desc: "+20% de vida máxima" },
    { k: "dmg", n: "Munição perfurante", desc: "+20% de dano do canhão" },
    { k: "reload", n: "Carregador automático", desc: "-15% no tempo de recarga" },
    { k: "mg", n: "Metralhadora .50", desc: "+30% de dano e esquenta menos" },
    { k: "engine", n: "Motor turbo", desc: "+12% de velocidade" },
  ];
  const UPG_COST = [80, 140, 220];
  const REPAIR_COST = 60;
  let tcfg = Object.assign({ camo: "bravo", cannon: "padrao", chassis: "medio" }, store.get("tank") || {});
  let tankBest = +(store.get("tankBest") || 0);
  let tankPlayers = 1, tankSetupPlayer = 1;
  let tcfg2 = Object.assign({ camo: "verde", cannon: "padrao", chassis: "medio" }, store.get("tank2") || {});
  const tkeys = new Set();
  const tin = { joy: null, joy2: null, cannon: false, mg: false, touch: false, mouse: null };
  // manchas de camuflagem (posições fixas, em fração do casco)
  const BLOBS = [];
  {
    let sd = 5;
    const r = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    // manchas angulares (camuflagem geométrica)
    for (let i = 0; i < 26; i++) {
      const n = 4 + ((r() * 2) | 0),
        pts = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 6.283 + r() * 0.8;
        pts.push([Math.cos(a) * (0.6 + r() * 0.6), Math.sin(a) * (0.6 + r() * 0.6)]);
      }
      BLOBS.push({ x: r() * 2.2 - 1.1, y: r() * 2.2 - 1.1, rx: 3 + r() * 4, ry: 2 + r() * 3, pts, c: i % 3 });
    }
  }
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const turnTo = (a, target, max) => {
    const d = angDiff(target, a);
    return a + Math.max(-max, Math.min(max, d));
  };
  const tStats = () => {
    const ch = CHASSIS[tcfg.chassis],
      cn = CANNON[tcfg.cannon];
    return {
      max: Math.round(ch.hp * (1 + 0.2 * (lv.armor || 0))),
      speed: ch.speed * (1 + 0.12 * (lv.engine || 0)),
      turn: ch.turn,
      dmg: cn.dmg * (1 + 0.2 * (lv.dmg || 0)),
      reload: cn.reload * Math.pow(0.85, lv.reload || 0),
      mgDmg: 9 * (1 + 0.3 * (lv.mg || 0)),
      mgHeat: 0.045 * (1 - 0.15 * (lv.mg || 0)),
    };
  };

  /* ---------- desenho do tanque (pseudo-3D: camadas empilhadas no plano do chão) ---------- */
  function oct(c, rx, ry) {
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      c.lineTo(Math.cos(a) * rx, Math.sin(a) * ry);
    }
    c.closePath();
    c.fill();
  }
  // M = matriz do chão (grade -> pixels), hk = pixels por unidade de altura
  /* Tanque T-90 BRAVO desenhado em camadas (gira 360°).
     Peças: esteiras, casco com saias laterais blindadas, grade do motor, torre angular
     com cesto traseiro, lançadores de fumaça, miras, metralhadora remota (RCWS),
     antenas e canhão longo com extrator de fumaça. M = matriz do chão, hk = px por unidade de altura. */
  function drawTank(c, M, hk, t, cfg, fl = 0) {
    const ch = CHASSIS[cfg.chassis],
      cn = CANNON[cfg.cannon],
      cm = CAMO[cfg.camo],
      L = ch.L,
      W = ch.W,
      tw = 4.6;
    const lay = (h) => {
      c.setTransform(M[0], M[1], M[2], M[3], M[4], M[5] - h * hk);
      c.translate(t.x, t.y);
      c.rotate(t.ang);
    };
    const R = W * 0.35,
      px = -2.5;
    const tur = (h) => {
      lay(h);
      c.translate(px, 0);
      c.rotate(t.tur - t.ang);
    };
    // ponto local da torreta -> tela (para antenas, que ficam em pé)
    const turToScreen = (lx, ly, h) => {
      const ra = t.tur,
        wx = t.x + Math.cos(t.ang) * px + Math.cos(ra) * lx - Math.sin(ra) * ly,
        wy = t.y + Math.sin(t.ang) * px + Math.sin(ra) * lx + Math.cos(ra) * ly;
      return [M[0] * wx + M[2] * wy + M[4], M[1] * wx + M[3] * wy + M[5] - h * hk];
    };
    const poly = (pts) => {
      c.beginPath();
      for (const [x, y] of pts) c.lineTo(x, y);
      c.closePath();
      c.fill();
    };
    // manchas geométricas da camuflagem, recortadas numa forma
    const camo = (shape, sc, shift) => {
      c.save();
      shape();
      c.clip();
      for (const b of BLOBS) {
        c.fillStyle = cm.blobs[(b.c + shift) % 3];
        const cx = b.x * sc[0],
          cy = b.y * sc[1];
        poly(b.pts.map(([x, y]) => [cx + x * b.rx, cy + y * b.ry]));
      }
      c.restore();
    };
    c.save();
    // sombra
    lay(0);
    c.fillStyle = "rgba(0,0,0,.34)";
    c.beginPath();
    c.ellipse(2, 2, L / 2 + 5, W / 2 + 4, 0, 0, 7);
    c.fill();
    // esteiras
    for (let h = 0; h <= 2.5; h += 0.5) {
      lay(h);
      c.fillStyle = h < 2.5 ? "#121510" : "#2a2d22";
      for (const s of [-1, 1]) c.fillRect(-L / 2 - 1, s * (W / 2 - tw / 2) - tw / 2, L + 2, tw);
    }
    lay(2.5);
    c.fillStyle = "#4a4d3e";
    for (const s of [-1, 1])
      for (let i = 0; i < L + 2; i += 2.2) {
        const x = -L / 2 - 1 + ((((i + t.phase) % (L + 2)) + L + 2) % (L + 2));
        c.fillRect(x, s * (W / 2 - tw / 2) - tw / 2, 0.8, tw);
      }
    // saias laterais blindadas (painéis)
    for (let h = 2.5; h <= 6; h += 0.5) {
      lay(h);
      c.fillStyle = h < 6 ? cm.side : cm.base;
      for (const s of [-1, 1]) c.fillRect(-L / 2 + 0.5, s * (W / 2 - 1) - 1, L - 1, 2);
    }
    lay(6);
    camo(
      () => {
        c.beginPath();
        for (const sg of [-1, 1]) c.rect(-L / 2 + 0.5, sg * (W / 2 - 1) - 1, L - 1, 2);
      },
      [L / 2, W / 2],
      2,
    );
    c.fillStyle = "rgba(0,0,0,.45)";
    for (const s of [-1, 1]) for (let x = -L / 2 + 4; x < L / 2; x += 4) c.fillRect(x, s * (W / 2 - 1) - 1, 0.5, 2);
    // casco
    const hullShape = () => {
      c.beginPath();
      if (cfg.chassis === "abrams") {
        c.moveTo(-L / 2 + 1, -W / 2 + 2);
        c.lineTo(L / 2 - 7, -W / 2 + 2);
        c.lineTo(L / 2, -W / 2 + 6);
        c.lineTo(L / 2, W / 2 - 6);
        c.lineTo(L / 2 - 7, W / 2 - 2);
        c.lineTo(-L / 2 + 1, W / 2 - 2);
      } else {
        c.moveTo(-L / 2 + 0.5, -W / 2 + 2);
        c.lineTo(L / 2 - 3, -W / 2 + 2);
        c.lineTo(L / 2, -W / 2 + 4.5);
        c.lineTo(L / 2, W / 2 - 4.5);
        c.lineTo(L / 2 - 3, W / 2 - 2);
        c.lineTo(-L / 2 + 0.5, W / 2 - 2);
      }
      c.closePath();
    };
    for (let h = 3; h <= 7; h += 0.5) {
      lay(h);
      c.fillStyle = h < 7 ? cm.side : cm.base;
      hullShape();
      c.fill();
    }
    lay(7);
    camo(hullShape, [L / 2, W / 2], 0);
    // grade do motor (traseira) e rebites
    c.fillStyle = "rgba(10,10,6,.6)";
    c.fillRect(-L / 2 + 1.5, -W / 2 + 4, 6.5, W - 8);
    c.fillStyle = "rgba(255,255,255,.12)";
    for (let i = 0; i < 6; i++) c.fillRect(-L / 2 + 2 + i * 1.05, -W / 2 + 4.5, 0.4, W - 9);
    c.fillStyle = "rgba(255,255,255,.2)";
    c.fillRect(L / 2 - 3.2, -W / 2 + 4, 1.4, W - 8); // placa frontal iluminada
    c.fillStyle = "#e8e0a8";
    c.fillRect(L / 2 - 1.4, -W / 2 + 3, 1, 1.6);
    c.fillRect(L / 2 - 1.4, W / 2 - 4.6, 1, 1.6);
    c.fillStyle = "#3a3524";
    c.fillRect(L / 2 - 6, W / 2 - 6, 3, 2); // caixa de ferramentas
    if (fl > 0) {
      c.fillStyle = `rgba(255,70,50,${Math.min(0.35, fl * 5)})`;
      hullShape();
      c.fill();
    }
    // torre angular com cesto traseiro
    const turShape = () => {
      c.beginPath();
      if (cfg.chassis === "abrams") {
        c.moveTo(-R * 1.5, -R * 0.72);
        c.lineTo(-R * 0.95, -R * 1.02);
        c.lineTo(R * 0.72, -R * 0.92);
        c.lineTo(R * 1.42, -R * 0.48);
        c.lineTo(R * 1.42, R * 0.48);
        c.lineTo(R * 0.72, R * 0.92);
        c.lineTo(-R * 0.95, R * 1.02);
        c.lineTo(-R * 1.5, R * 0.72);
      } else {
        c.moveTo(-R * 1.45, -R * 0.7);
        c.lineTo(-R * 0.3, -R * 0.95);
        c.lineTo(R * 0.75, -R * 0.85);
        c.lineTo(R * 1.25, -R * 0.3);
        c.lineTo(R * 1.25, R * 0.3);
        c.lineTo(R * 0.75, R * 0.85);
        c.lineTo(-R * 0.3, R * 0.95);
        c.lineTo(-R * 1.45, R * 0.7);
      }
      c.closePath();
    };
    for (let h = 7; h <= 11.5; h += 0.5) {
      tur(h);
      c.fillStyle = h < 11.5 ? (h < 8.5 ? cm.dark : cm.side) : cm.base;
      turShape();
      c.fill();
    }
    tur(11.5);
    camo(turShape, [R * 1.2, R * 0.9], 1);
    // cesta traseira alongada característica da torre do M1 Abrams
    if (cfg.chassis === "abrams") {
      tur(9.5);
      c.fillStyle = cm.side;
      c.fillRect(-R * 1.62, -R * 0.48, R * 0.58, R * 0.96);
      c.strokeStyle = "rgba(15,18,12,.7)";
      c.lineWidth = 0.8;
      c.strokeRect(-R * 1.62, -R * 0.48, R * 0.58, R * 0.96);
      c.fillStyle = "rgba(0,0,0,.28)";
      for (let j = 0; j < 4; j++) c.fillRect(-R * 1.53 + j * R * 0.12, -R * 0.4, 0.6, R * 0.8);
    }
    // escotilha do comandante e miras
    c.fillStyle = cm.dark;
    c.beginPath();
    c.arc(-R * 0.35, R * 0.35, R * 0.33, 0, 7);
    c.fill();
    c.fillStyle = "rgba(0,0,0,.35)";
    c.beginPath();
    c.arc(-R * 0.35, R * 0.35, R * 0.2, 0, 7);
    c.fill();
    c.fillStyle = "#2a2a22";
    c.fillRect(R * 0.35, -R * 0.75, 2.4, 2);
    c.fillStyle = "#4fe3d0";
    c.fillRect(R * 0.35 + 1.9, -R * 0.7, 0.6, 1.2); // lente da mira
    // lançadores de fumaça nas laterais
    c.fillStyle = "#1b1c16";
    for (const s of [-1, 1])
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.arc(R * 0.55 - i * 1.4, s * R * 0.98, 0.65, 0, 7);
        c.fill();
      }
    // canhão longo (recua ao atirar): tubo, extrator de fumaça e freio de boca
    const rec = Math.max(0, t.rec || 0) * 12,
      bx = R * 1.1 - rec,
      blen = cn.len + 6;
    for (let h = 9; h <= 10.5; h += 0.5) {
      tur(h);
      c.fillStyle = h < 10.5 ? "#141a0c" : cm.dark;
      c.fillRect(bx, -cn.w / 2, blen, cn.w);
      c.fillStyle = h < 10.5 ? "#141a0c" : cm.base;
      c.fillRect(bx + blen * 0.38, -cn.w / 2 - 0.5, blen * 0.2, cn.w + 1); // extrator de fumaça
      c.fillStyle = "#141a0c";
      c.fillRect(bx + blen - 2.4, -cn.w / 2 - 0.6, 2.8, cn.w + 1.2); // freio de boca
    }
    tur(10.5);
    c.fillStyle = cm.blobs[1];
    c.fillRect(bx + blen * 0.12, -cn.w / 2, 2, cn.w);
    c.fillRect(bx + blen * 0.7, -cn.w / 2, 1.6, cn.w);
    // metralhadora remota (RCWS) no teto
    for (let h = 11.5; h <= 13.5; h += 0.5) {
      tur(h);
      c.fillStyle = h < 13.5 ? "#1d1f17" : "#3a3c30";
      c.fillRect(-R * 0.1, -R * 0.62, 3.2, 2.6);
    }
    tur(13.2);
    c.fillStyle = "#15160f";
    c.fillRect(-R * 0.1 + 2.5, -R * 0.62 + 0.9, 9, 0.9);
    c.fillStyle = "#4fe3d0";
    c.fillRect(-R * 0.1 + 2.6, -R * 0.62 + 2.1, 0.5, 0.5);
    // lançador de mísseis no teto (acessório), apontado para o alto
    if (t.pod) {
      for (let h = 11.5; h <= 18; h += 0.35) {
        tur(h);
        const sh = (h - 11.5) * 0.45;
        c.fillStyle = h < 18 ? (h < 13 ? "#1d1f17" : cm.side) : cm.base;
        c.fillRect(-R * 0.55 + sh - 3, R * 0.75 - 2.2, 6, 4.4);
      }
      tur(18);
      c.fillStyle = "#111";
      for (const [ox, oy] of [
        [-1.4, -1.1],
        [1.2, -1.1],
        [-1.4, 1.1],
        [1.2, 1.1],
      ]) {
        c.beginPath();
        c.arc(-R * 0.55 + 2.9 + ox, R * 0.75 + oy, 0.85, 0, 7);
        c.fill();
      }
    }
    // antenas (em pé, na tela)
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.strokeStyle = "rgba(20,20,14,.9)";
    c.lineWidth = Math.max(1, hk * 0.25);
    for (const [lx, ly] of [
      [-R * 1.25, -R * 0.55],
      [-R * 1.25, R * 0.55],
    ]) {
      const [sx, sy] = turToScreen(lx, ly, 11.5);
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(sx + hk * 0.5, sy - 15 * hk);
      c.stroke();
    }
    c.restore();
  }
  let engine = null;
  function engineOn() {
    try {
      if (!AC || engine) return;
      const o = AC.createOscillator(),
        f = AC.createBiquadFilter(),
        g = AC.createGain();
      o.type = "sawtooth";
      o.frequency.value = 38;
      f.type = "lowpass";
      f.frequency.value = 190;
      g.gain.value = 0;
      o.connect(f);
      f.connect(g);
      g.connect(sfxG);
      o.start();
      engine = { o, g };
    } catch (e) {}
  }
  function engineOff() {
    if (!engine) return;
    try {
      engine.g.gain.setTargetAtTime(0, AC.currentTime, 0.05);
      const o = engine.o;
      setTimeout(() => o.stop(), 300);
    } catch (e) {}
    engine = null;
  }

  /* ==========================================================================
     CAMPANHA DO TANQUE
     Mundo comprido (L casas de comprimento × W de largura), com câmera que segue
     o tanque. Coordenadas do mundo em unidades (1 casa = CELL). wiso() projeta
     para a "tela do mundo"; a câmera (cam) é subtraída ao desenhar.
     ========================================================================== */
  const MISSIONS = [
    {
      n: "Saída da Base",
      L: 44,
      theme: "grama",
      nests: 2,
      zs: ["normal", "runner"],
      trees: 0.5,
      intro: "Destrua os ninhos e chegue à extração",
    },
    {
      n: "Floresta Densa",
      L: 52,
      theme: "floresta",
      nests: 3,
      zs: ["normal", "runner", "armored"],
      trees: 1.6,
      intro: "A mata esconde os zumbis. Use o canhão nas árvores!",
    },
    {
      n: "Deserto Queimado",
      L: 56,
      theme: "deserto",
      nests: 3,
      zs: ["normal", "runner", "armored", "spitter"],
      trees: 0.3,
      intro: "Cuidado com os barris: eles explodem",
    },
    {
      n: "Cidade em Ruínas",
      L: 60,
      theme: "cidade",
      nests: 4,
      zs: ["normal", "runner", "armored", "spitter"],
      trees: 0.2,
      intro: "Derrube os prédios para abrir caminho",
    },
    {
      n: "Fortaleza Zumbi",
      L: 64,
      theme: "fortaleza",
      nests: 5,
      zs: ["normal", "runner", "armored", "spitter"],
      trees: 0.4,
      boss: true,
      intro: "O Chefão protege a extração. Acabe com ele!",
    },
  ];
  const THEMES = {
    grama: {
      g: ["#5aa83b", "#4e9a32"],
      tuft: "#3e8128",
      road: "#8a6a42",
      road2: "#7a5c38",
      edge: "#2c4a1c",
      leaf: ["#2e6a1e", "#3f8a2a", "#58a838"],
      rock: "#8d8f86",
    },
    floresta: {
      g: ["#3f8a2a", "#367a24"],
      tuft: "#2a6219",
      road: "#6e5234",
      road2: "#5f462c",
      edge: "#1a3311",
      leaf: ["#1f4f17", "#2e6a1e", "#3f7f26"],
      rock: "#7a7c74",
    },
    deserto: {
      g: ["#d2b47a", "#c8a86c"],
      tuft: "#b08f58",
      road: "#a8855a",
      road2: "#9a784f",
      edge: "#a88a58",
      leaf: ["#6e7a3a", "#88904a", "#a0a45a"],
      rock: "#a08766",
    },
    cidade: {
      g: ["#7c8078", "#72766e"],
      tuft: "#5e625b",
      road: "#4a4d50",
      road2: "#404346",
      edge: "#3a3d3a",
      leaf: ["#3d5a26", "#4f6f30", "#62853a"],
      rock: "#8a8c88",
    },
    fortaleza: {
      g: ["#5a6b3a", "#506034"],
      tuft: "#3f4d28",
      road: "#5b4632",
      road2: "#4e3c2a",
      edge: "#232b16",
      leaf: ["#2a3d1a", "#3b5224", "#4a632b"],
      rock: "#6b6d66",
    },
  };
  // objetos destrutíveis: r = raio de colisão, block = bloqueia, crush = o tanque esmaga andando
  const OBJ = {
    tree: { hp: 40, r: 6, block: true, crush: true, pts: 20 },
    barrel: { hp: 20, r: 4, block: true, crush: false, pts: 30 },
    crate: { hp: 25, r: 5, block: true, crush: true, pts: 25 },
    bags: { hp: 90, r: 8, block: true, crush: false, pts: 40 },
    fence: { hp: 12, r: 7, block: true, crush: true, pts: 10 },
    rock: { hp: 160, r: 7, block: true, crush: false, pts: 30 },
    hut: { hp: 220, r: 15, block: true, crush: false, pts: 150 },
    tower: { hp: 120, r: 9, block: true, crush: false, pts: 120 },
    ruin: { hp: 320, r: 18, block: true, crush: false, pts: 200 },
    car: { hp: 70, r: 9, block: true, crush: false, pts: 60 },
    nest: { hp: 300, r: 14, block: true, crush: false, pts: 1000 },
  };
  const VIEW = { w: 1230, h: 640 }; // tela virtual do modo tanque (largura acompanha a tela)
  const cam = { x: 0, y: 0 };
  let T = null,
    LV = null, // nível atual: { m, L, W, theme, objs, decor, ex }
    tz = [],
    tp = [],
    zp = [],
    tcorpse = [],
    tdrops = [],
    tdec = [], // manchas no chão (crateras, sangue, entulho) em espaço de efeitos
    lv = {},
    camp = Object.assign({ m: 0, money: 100, lv: {}, score: 0 }, store.get("tankCamp") || {}),
    snap = null, // estado salvo no início da missão (para tentar de novo)
    hint = "";
  const W_CELLS = 11;
  // mundo -> tela do mundo (sem câmera)
  const wiso = (x, y) => [(x * ISO.cx + y * ISO.rx) / CELL, (x * ISO.cy + y * ISO.ry) / CELL];
  // tela do mundo -> mundo
  const wunproject = (sx, sy) => {
    const det = ISO.cx * ISO.ry - ISO.rx * ISO.cy;
    return { x: ((ISO.ry * sx - ISO.rx * sy) / det) * CELL, y: ((-ISO.cy * sx + ISO.cx * sy) / det) * CELL };
  };
  // ponto do mundo -> espaço dos efeitos (tela do mundo ÷ K)
  const P = (x, y, h = 0) => {
    const [sx, sy] = wiso(x, y);
    return [sx / K, sy / K - h];
  };
  const screenToGroundDir = (dx, dy) => {
    const det = ISO.cx * ISO.ry - ISO.rx * ISO.cy;
    return Math.atan2((-ISO.cy * dx + ISO.cx * dy) / det, (ISO.ry * dx - ISO.rx * dy) / det);
  };
  const groundM = () => [
    (FS * ISO.cx) / CELL,
    (FS * ISO.cy) / CELL,
    (FS * ISO.rx) / CELL,
    (FS * ISO.ry) / CELL,
    -cam.x * FS,
    -cam.y * FS,
  ];
  const roadY = (x) => (W_CELLS / 2 + 2.3 * Math.sin((x / CELL) * 0.16 + (LV ? LV.m * 1.7 : 0))) * CELL;
  const hash = (a, b) => {
    const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  // manchas do chão do modo tanque (chamadas por scorch/splat)
  function tScorch(x, y, r) {
    tdec.push({ k: "s", x, y, r });
    if (tdec.length > 420) tdec.splice(0, tdec.length - 420);
  }
  function tSplat(x, y, c) {
    tdec.push({ k: "p", x, y, c: c || "rgba(70,150,30,.6)" });
    if (tdec.length > 420) tdec.splice(0, tdec.length - 420);
  }

  /* ---------- geração do nível ---------- */
  function buildLevel(m) {
    const M = MISSIONS[m],
      Lc = M.L,
      Wc = W_CELLS;
    let sd = 1000 + m * 77;
    const R = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    LV = { m, L: Lc * CELL, W: Wc * CELL, theme: THEMES[M.theme], objs: [], decor: [], ex: null, M };
    const objs = LV.objs;
    const nearRoad = (x, y, pad) => Math.abs(y - roadY(x)) < pad * CELL;
    const free = (x, y, r) => objs.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r + 4) && x > 4 * CELL;
    const put = (type, x, y, o = {}) => {
      const d = OBJ[type];
      if (!free(x, y, d.r)) return null;
      const ob = Object.assign({ type, x, y, hp: d.hp, max: d.hp, r: d.r, ang: 0, fl: 0, seed: R() }, o);
      objs.push(ob);
      return ob;
    };
    // árvores e pedras fora da estrada
    const nTrees = Math.round(Lc * 2.2 * M.trees + 10);
    for (let i = 0; i < nTrees * 3 && objs.length < nTrees; i++) {
      const x = R() * Lc * CELL,
        y = (0.5 + R() * (Wc - 1)) * CELL;
      if (!nearRoad(x, y, 1.6)) put(M.theme === "deserto" && R() < 0.5 ? "rock" : "tree", x, y);
    }
    for (let i = 0; i < Lc / 4; i++) {
      const x = R() * Lc * CELL,
        y = (0.5 + R() * (Wc - 1)) * CELL;
      if (!nearRoad(x, y, 1.4)) put("rock", x, y);
    }
    // grupos de barris e caixas
    for (let i = 0; i < Lc / 3; i++) {
      const x = (6 + R() * (Lc - 10)) * CELL,
        y = (1 + R() * (Wc - 2)) * CELL;
      const n = 2 + ((R() * 3) | 0);
      for (let k = 0; k < n; k++) put(R() < 0.55 ? "barrel" : "crate", x + (R() - 0.5) * 30, y + (R() - 0.5) * 30);
    }
    // barricadas atravessando a estrada
    for (let x = 12 * CELL; x < (Lc - 8) * CELL; x += (7 + R() * 6) * CELL) {
      const y = roadY(x);
      if (R() < 0.55) {
        put("bags", x, y - 12, { ang: 1.57 });
        put("bags", x, y + 12, { ang: 1.57 });
      } else for (let k = -2; k <= 2; k++) put("fence", x, y + k * 15, { ang: 1.57 });
    }
    // construções por tema
    const nB = M.theme === "cidade" ? Lc / 3 : Lc / 9;
    for (let i = 0; i < nB; i++) {
      const x = (6 + R() * (Lc - 10)) * CELL,
        y = (R() < 0.5 ? 1.6 + R() * 2 : Wc - 1.6 - R() * 2) * CELL;
      const t = M.theme === "cidade" ? (R() < 0.7 ? "ruin" : "car") : R() < 0.5 ? "hut" : "tower";
      put(t, x, y, { ang: R() < 0.5 ? 0 : 1.57 });
    }
    if (M.theme === "cidade" || M.theme === "fortaleza")
      for (let i = 0; i < Lc / 5; i++)
        put("car", (6 + R() * (Lc - 10)) * CELL, roadY(0) + (R() - 0.5) * 4 * CELL, { ang: R() * 3 });
    // ninhos (objetivo), espalhados ao longo do mapa
    for (let i = 0; i < M.nests; i++) {
      const fx = (i + 1) / (M.nests + 1),
        x = (8 + fx * (Lc - 16)) * CELL;
      let y = (R() < 0.5 ? 2.5 : Wc - 2.5) * CELL;
      for (let k = 0; k < 20; k++) {
        if (put("nest", x + k * 8, y, { hp: 300 + m * 80, max: 300 + m * 80, spawnT: 2, nest: true })) break;
        y = (2 + R() * (Wc - 4)) * CELL;
      }
    }
    // zumbis espalhados, dormindo até o tanque chegar perto
    LV.sleepers = [];
    for (let i = 0; i < Lc * 0.6; i++) {
      const x = (8 + R() * (Lc - 10)) * CELL,
        y = (1 + R() * (Wc - 2)) * CELL;
      LV.sleepers.push({ x, y, type: M.zs[(R() * M.zs.length) | 0] });
    }
    // caixas azuis de armas (acessórios); a primeira missão tem uma logo no começo
    LV.arms = [];
    if (m === 0) LV.arms.push({ x: 9 * CELL, y: roadY(9 * CELL) + 14 });
    for (let i = 0; i < 2; i++) {
      const x = (14 + R() * (Lc - 20)) * CELL;
      LV.arms.push({ x, y: roadY(x) + (R() - 0.5) * 2 * CELL });
    }
    // extração no fim
    LV.ex = { x: (Lc - 2.5) * CELL, y: roadY((Lc - 2.5) * CELL) };
    if (M.boss) LV.sleepers.push({ x: (Lc - 6) * CELL, y: roadY((Lc - 6) * CELL), type: "boss" });
    // árvores decorativas fora do mapa (bordas)
    for (let x = -6 * CELL; x < (Lc + 6) * CELL; x += 14 + R() * 14) {
      LV.decor.push({ x, y: -(0.6 + R() * 2.2) * CELL, s: 1 + R() * 0.6, seed: R() });
      LV.decor.push({ x, y: (Wc + 0.6 + R() * 2.2) * CELL, s: 1 + R() * 0.6, seed: R() });
    }
    for (let y = 0; y < Wc * CELL; y += 16 + R() * 10) {
      LV.decor.push({ x: -(0.8 + R() * 2) * CELL, y, s: 1 + R() * 0.5, seed: R() });
      LV.decor.push({ x: (Lc + 0.8 + R() * 2) * CELL, y, s: 1 + R() * 0.5, seed: R() });
    }
  }

  /* ---------- início / fim de missão ---------- */
  function saveCamp() {
    store.set("tankCamp", camp);
  }
  function goFullscreen() {
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen && matchMedia("(pointer: coarse)").matches)
        el.requestFullscreen({ navigationUI: "hide" })
          .then(
            () => screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape").catch(() => {}),
          )
          .catch(() => {});
    } catch (e) {}
  }
  function tStart() {
    MODE = "tank";
    // Cada missão tem sua própria sequência de rádio; as comunicações voltam na fase seguinte.
    if (radioCurrent) { radioCurrent.pause(); radioCurrent = null; }
    radioQueue = [];
    radioIndex = 0;
    radioSeen.clear();
    document.body.classList.add("tank");
    reset();
    $("banner").classList.remove("show");
    goFullscreen();
    if (camp.m >= MISSIONS.length) camp.m = 0;
    lv = Object.assign({}, camp.lv);
    money = camp.money;
    score = camp.score;
    snap = { money: camp.money, lv: Object.assign({}, camp.lv), score: camp.score, acc: cloneAcc(camp.acc) };
    buildLevel(camp.m);
    wave = camp.m + 1;
    const st = tStats();
    T = {
      x: 2 * CELL,
      y: roadY(2 * CELL),
      ang: 0,
      tur: 0,
      vel: 0,
      hp: st.max,
      cd: 0.5,
      mgCd: 0,
      heat: 0,
      over: false,
      rec: 0,
      phase: 0,
      fl: 0,
    };
    T2 = tankPlayers === 2 ? { x: T.x, y: T.y + 58, ang: 0, tur: 0, vel: 0, hp: Math.round(CHASSIS[tcfg2.chassis].hp * (1 + 0.2 * (lv.armor || 0))), cd: 0.8, mgCd: 0, phase: 0, fl: 0 } : null;
    tz = [];
    tp = [];
    zp = [];
    tcorpse = [];
    tdrops = [];
    tdec = [];
    for (const a of LV.arms) tdrops.push({ x: a.x, y: a.y, kind: "arm", t: 0, life: 1e9 });
    acc = Object.assign(accDefault(), cloneAcc(camp.acc));
    if (!acc[specSel] || !acc[specSel].own) specSel = SPECIALS.find((k) => acc[k].own) || "missile";
    tmines = [];
    clouds = [];
    accCd = { missile: 0, heavy: 0, mine: 0, smoke: 0 };
    accCd2 = { missile: 0, heavy: 0, mine: 0, smoke: 0 };
    specSel2 = specSel;
    kills = 0;
    state = "play";
    waveState = "fight";
    hideOv();
    fit();
    const [sx, sy] = wiso(T.x, T.y);
    cam.x = sx - VIEW.w * 0.35;
    cam.y = sy - VIEW.h * 0.55;
    audio();
    engineOn();
    radioCue("mission-start");
    banner(`MISSÃO ${camp.m + 1}: ${LV.M.n.toUpperCase()}`, 2.6);
    hint = LV.M.intro;
    setTimeout(() => state === "play" && MODE === "tank" && banner(LV.M.intro.toUpperCase(), 3), 2800);
  }
  function tExit() {
    T2=null; pad2.lx=pad2.ly=pad2.rx=pad2.ry=0; pad2.cannon=pad2.mg=false;
    engineOff();
    MODE = "def";
    document.body.classList.remove("tank");
    tkeys.clear();
    tin.cannon = tin.mg = false;
    tin.joy = tin.joy2 = null;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
    } catch (e) {}
    fit();
  }
  function tEnd(won) {
    if (state !== "play") return;
    if (won) radioCue("mission-complete");
    state = "over";
    engineOff();
    sfx(won ? "wave" : "lose");
    if (won) {
      const bonus = 150 + camp.m * 50;
      money += bonus;
      score += 2000 + camp.m * 1000;
      camp.m++;
      camp.money = money;
      camp.lv = Object.assign({}, lv);
      camp.score = score;
      camp.acc = cloneAcc(acc);
      saveCamp();
      if (score > tankBest) {
        tankBest = score;
        store.set("tankBest", tankBest);
      }
      const last = camp.m >= MISSIONS.length;
      setTimeout(() => {
        if (last) {
          showOv(`<h2 class="title" style="font-size:clamp(24px,6vw,42px)">CAMPANHA<br>CONCLUÍDA!</h2><p class="sub">Você destruiu a Fortaleza Zumbi</p>
 <div class="res"><div>PONTOS<b>${score}</b></div><div>RECORDE<b>${tankBest}</b></div></div>
 <button class="big" data-a="treset">NOVA CAMPANHA</button><button class="alt" data-a="menu">MENU</button>`);
          camp = { m: 0, money: 100, lv: {}, score: 0, acc: accDefault() };
          saveCamp();
        } else showShop(bonus);
      }, 1400);
    } else {
      setTimeout(
        () =>
          showOv(`<h2 class="title" style="font-size:clamp(24px,6vw,42px)">TANQUE<br>DESTRUÍDO</h2><p class="sub">Missão ${camp.m + 1}: ${LV.M.n}</p>
 <div class="res"><div>ABATES<b>${kills}</b></div><div>NINHOS<b>${LV.objs.filter((o) => o.nest && o.dead).length}/${LV.M.nests}</b></div></div>
 <button class="big" data-a="tretry">TENTAR DE NOVO</button><button class="alt" data-a="tsetup">GARAGEM</button><button class="alt" data-a="menu">MENU</button>`),
        1200,
      );
    }
  }
  function tRetry() {
    camp.money = snap.money;
    camp.lv = snap.lv;
    camp.score = snap.score;
    camp.acc = cloneAcc(snap.acc);
    saveCamp();
    tStart();
  }

  /* ---------- telas: garagem e oficina ---------- */
  function optRow(title, group, table, extra) {
    return `<div class="trow"><span class="tlab">${title}</span><div class="topts">${Object.keys(table)
      .map(
        (k) =>
          `<button class="opt${tcfg[group] === k ? " on" : ""}" data-a="tcfg" data-g="${group}" data-v="${k}">${group === "camo" ? `<i class="sw" style="background:${table[k].base}"></i>` : ""}${table[k].n}${extra ? `<small>${extra(table[k])}</small>` : ""}</button>`,
      )
      .join("")}</div></div>`;
  }
  function showTankPlayers() {
    state="tplayers";
    showOv(`<h2 class="title">MODO TANK</h2><p class="sub">Quantos jogadores vão entrar na missão?</p><button class="big" data-a="tplayers" data-n="1">1 JOGADOR</button><button class="big" data-a="tplayers" data-n="2">2 JOGADORES · COOPERATIVO LOCAL</button><button class="alt" data-a="menu">VOLTAR</button>`);
  }
  function showTankSelect(player) {
    tankSetupPlayer=player; state="tselect"; const cfg=player===1?tcfg:tcfg2;
    const choices=(group,table)=>`<div class="trow"><span class="tlab">${group==="camo"?"COR":group==="chassis"?"MODELO":"CANHÃO"}</span><div class="topts">${Object.keys(table).map(k=>`<button class="opt${cfg[group]===k?" on":""}" data-a="tselect" data-p="${player}" data-g="${group}" data-v="${k}">${group==="camo"?`<i class="sw" style="background:${table[k].base}"></i>`:""}${table[k].n}</button>`).join("")}</div></div>`;
    showOv(`<h2 class="title">JOGADOR ${player}</h2><p class="sub">${player===1?"PC · ENTER PARA CONFIRMAR":"CONTROLE · X PARA CONFIRMAR"}</p><p class="tname">MONTE SEU TANQUE</p>${choices("camo",CAMO)}${choices("chassis",CHASSIS)}${choices("cannon",CANNON)}<p class="hint">${player===1?"Escolha as opções e aperte ENTER.":"Escolha as opções e aperte X no controle."}</p><button class="big" data-a="tselect" data-p="${player}">CONFIRMAR JOGADOR ${player}</button><button class="alt" data-a="menu">CANCELAR</button>`);
  }
  function showTankSetup() {
    state = "tsetup";
    const ch = CHASSIS[tcfg.chassis],
      cn = CANNON[tcfg.cannon],
      m = Math.min(camp.m, MISSIONS.length - 1);
    showOv(`<h2 class="title" style="font-size:clamp(22px,5vw,40px)">GARAGEM</h2><img class="tart" src="assets/tank/bravo.jpg" alt="Tanque T-90 Bravo"><p class="tname">T-90 BRAVO · TANQUE DE GUERRA</p><p class="sub">Campanha · Missão ${m + 1}/${MISSIONS.length}: ${MISSIONS[m].n}</p>
 <canvas id="tprev" width="560" height="300"></canvas>
 <div class="tstats"><span>VIDA <b>${ch.hp}</b></span><span>VELOC. <b>${ch.speed}</b></span><span>DANO <b>${cn.dmg}</b></span><span>RECARGA <b>${cn.reload}s</b></span><span>MOEDAS <b>${camp.money}</b></span></div>
 ${optRow("CAMUFLAGEM", "camo", CAMO)}
 ${optRow("CANHÃO", "cannon", CANNON, (o) => o.desc)}
 ${optRow("CHASSI", "chassis", CHASSIS, (o) => o.desc)}
 <p class="hint">PC: W/S frente e ré · A/D giram o tanque · setas ou mouse = torreta · ESPAÇO ou clique esq. = canhão · SHIFT ou clique dir. = metralhadora · E = acessório · Q = fumaça · TAB/roda = troca<br>Controle PS4: analógico esq. frente/ré e giro · analógico dir. torreta · R2 canhão · R1 metralhadora · L1 acessório · L2 fumaça · ←/→ troca · OPTIONS pausa<br>Celular: os mesmos comandos nos analógicos e botões da tela</p>
 <p class="hint">${tankPlayers===2?`JOGADOR 1: ${CAMO[tcfg.camo].n} · JOGADOR 2: ${CAMO[tcfg2.camo].n}`:""}</p><button class="big" data-a="tgo">${camp.m > 0 ? "CONTINUAR CAMPANHA ▶" : "INICIAR CAMPANHA ▶"}</button>${camp.m > 0 ? '<button class="alt" data-a="treset">RECOMEÇAR</button>' : ""}<button class="alt" data-a="menu">VOLTAR</button>`);
    drawPreview(0);
  }
  function drawPreview(time) {
    const c = $("tprev");
    if (!c) return;
    const x = c.getContext("2d"),
      s = 6.6;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    const g = x.createRadialGradient(280, 175, 20, 280, 175, 260);
    g.addColorStop(0, "#5a8a32");
    g.addColorStop(1, "#22331a");
    x.fillStyle = g;
    x.fillRect(0, 0, c.width, c.height);
    const M = [s * 0.95, -s * 0.52, s * 0.95, s * 0.52, 270, 205];
    const pod = !!(camp.acc && camp.acc.missile && camp.acc.missile.own);
    drawTank(
      x,
      M,
      s * 1.08,
      { x: 0, y: 0, ang: 0.5, tur: 0.5 + Math.sin(time * 0.8) * 0.7, phase: time * 8, rec: 0, pod },
      tcfg,
    );
  }
  function showShop(bonus) {
    state = "shop";
    const st = tStats(),
      next = MISSIONS[camp.m];
    showOv(`<h2 class="title" style="font-size:clamp(22px,5vw,40px)">MISSÃO<br>CUMPRIDA!</h2><p class="sub">${bonus ? `Bônus +$${bonus} · ` : ""}Oficina: melhore o tanque para a missão ${camp.m + 1}: ${next.n}</p>
 <div class="bbar" style="position:static;margin-bottom:10px"><span><i class="coin"></i>MOEDAS: ${money}</span><span>PONTOS ${score}</span></div>
 <div class="ugrid">${UPG.map((u) => {
   const l = lv[u.k] || 0,
     cost = UPG_COST[l];
   return `<div class="ucard"><div class="nm">${u.n}</div><div class="d">${u.desc}</div><div class="lvl">${"★".repeat(l)}${"☆".repeat(3 - l)}</div>${l >= 3 ? '<div class="lock">NÍVEL MÁXIMO</div>' : `<button class="alt" data-a="tup" data-k="${u.k}" ${money < cost ? "disabled" : ""} style="margin:0"><i class="coin"></i>${cost}</button>`}</div>`;
 }).join("")}${Object.keys(ACC)
   .map((k) => {
     const d = ACC[k],
       a = acc[k];
     const key = k === "smoke" ? "L2 · Q" : "L1 · E";
     return `<div class="ucard acc"><div class="nm">${d.n}</div><div class="d">${d.desc}<br><b>${key}</b></div><div class="lvl">${a.own ? "x" + a.ammo : "—"}</div>${!a.own ? `<button class="alt" data-a="tacc" data-k="${k}" ${money < d.unlock ? "disabled" : ""} style="margin:0"><i class="coin"></i>${d.unlock}</button>` : a.ammo >= d.max ? '<div class="lock">CHEIO</div>' : `<button class="alt" data-a="tacc" data-k="${k}" ${money < d.packCost ? "disabled" : ""} style="margin:0">+${d.pack} <i class="coin"></i>${d.packCost}</button>`}</div>`;
   })
   .join("")}</div>
 <button class="big" data-a="tnext">PRÓXIMA MISSÃO ▶</button><button class="alt" data-a="tsetup">GARAGEM</button>`);
  }
  function buyUpgrade(k) {
    const l = lv[k] || 0;
    if (l >= 3 || money < UPG_COST[l]) return;
    money -= UPG_COST[l];
    lv[k] = l + 1;
    camp.money = money;
    camp.lv = Object.assign({}, lv);
    saveCamp();
    sfx("coin");
    showShop();
  }
  function buyRepair() {}
  function nextWave() {
    tStart();
  }

  /* ---------- combate ---------- */
  function tSpawn(type, x, y) {
    const d = ZD[type],
      hp = Math.round(d.hp * (1 + camp.m * 0.18));
    tz.push({
      type,
      d,
      x,
      y,
      hp,
      max: hp,
      r: d.big ? 13 : 7,
      t: rnd(0, 3),
      fl: 0,
      bite: false,
      sc: 1.5,
      gun: 2,
      burst: 0,
      bt: 0,
      firing: 0,
    });
    if (d.big) {
      $("bossbar").hidden = false;
      radioCue("boss-contact");
    } else radioCue("contact");
  }
  function tHurt(z, dmg, quiet) {
    if (z.dead) return;
    z.hp -= dmg;
    if (z.d.big) radioCue("boss-engaged");
    z.fl = 0.07;
    const [fx0, fy0] = P(z.x, z.y, z.d.big ? 20 : 11);
    if (!quiet) {
      gore(fx0, fy0, 3);
      if (dmg >= 40) txt(fx0, fy0 - 6, dmg);
    }
    if (z.hp <= 0) {
      if (!z.d.big) radioCue("first-kill");
      z.dead = true;
      kills++;
      money += z.d.cash;
      score += z.d.pts;
      gore(fx0, fy0, z.d.big ? 40 : 16, z.d.big);
      coins(fx0, fy0 - 4);
      txt(fx0, fy0 - 12, "+$" + z.d.cash, "140,235,90");
      sfx("hit");
      tcorpse.push({
        img: IMG["z_" + z.type],
        h: SPRITE_H["z_" + z.type] * K,
        x: z.x,
        y: z.y,
        t: 0,
        flip: T.x > z.x - (T.y - z.y) * 0.9,
      });
      if (z.d.big) {
        radioCue("boss-down");
        boom(fx0, fy0, 3);
        slowT = 0.7;
        flashA = 0.5;
        banner("CHEFÃO ABATIDO!");
      }
    }
  }
  function lootAt(x, y, chance) {
    if (Math.random() < chance)
      tdrops.push({ x, y, kind: Math.random() < 0.45 ? "rep" : "cash", t: 0, life: 14, z0: 0 });
  }
  // dano num objeto destrutível
  function hitObj(o, dmg) {
    if (o.dead) return;
    o.hp -= dmg;
    o.fl = 0.08;
    if (o.hp > 0) return;
    o.dead = true;
    if (o.nest) radioCue("nest-down");
    score += OBJ[o.type].pts;
    const [fx0, fy0] = P(o.x, o.y, 4),
      th = LV.theme;
    const debris = (n, cols, sz = 1.6, sp = 90) => {
      for (let i = 0; i < n; i++) {
        const a = rnd(3.4, 6),
          v = rnd(30, sp);
        add({
          k: "d",
          x: fx0 + rnd(-4, 4),
          y: fy0 + rnd(-6, 2),
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          rot: rnd(0, 6),
          vr: rnd(-12, 12),
          sz: rnd(0.6, sz),
          col: cols[i % cols.length],
          gy: fy0 + 4 + rnd(-3, 5),
          life: rnd(1.2, 2.2),
          max: 2.2,
        });
      }
    };
    switch (o.type) {
      case "barrel":
        // explode e machuca tudo em volta (reação em cadeia)
        boomAt(o.x, o.y, 90, 46, 1.9, true);
        break;
      case "nest":
        boom(fx0, fy0, 2.6);
        gore(fx0, fy0 - 6, 40, true);
        money += 80;
        txt(fx0, fy0 - 20, "NINHO DESTRUÍDO!", "140,235,90");
        lootAt(o.x, o.y, 1);
        flashA = 0.3;
        flashC = "180,255,120";
        {
          const left = LV.objs.filter((n) => n.nest && !n.dead).length;
          banner(left ? `NINHO DESTRUÍDO! FALTAM ${left}` : "TODOS OS NINHOS DESTRUÍDOS! VÁ PARA A EXTRAÇÃO", 2.4);
        }
        break;
      case "hut":
      case "tower":
      case "ruin":
        boom(fx0, fy0 - 10, 2.2);
        debris(40, o.type === "ruin" ? ["#7a7c78", "#5c5e5a", "#9a9c96"] : ["#7a5a3a", "#5a3f26", "#3d5224"], 2.6, 130);
        tScorch(fx0, fy0 + 4, 14);
        lootAt(o.x, o.y, 0.8);
        if (Math.random() < 0.22) {
          tdrops.push({ x: o.x + rnd(-12, 12), y: o.y + rnd(-10, 10), kind: "heavy", t: 0, life: 18 });
        }
        break;
      case "car":
        boomAt(o.x, o.y, 60, 30, 1.5, true);
        debris(16, ["#8a4a2a", "#3a3a3a", "#c0c4c8"]);
        break;
      case "tree":
        debris(18, th.leaf, 2, 70);
        debris(5, ["#6b4a2a", "#4e3520"]);
        tSplat(fx0, fy0 + 3, "rgba(60,40,20,.7)");
        break;
      case "rock":
        debris(18, [th.rock, "#5e605a", "#b0b2aa"], 2.2);
        puff(fx0, fy0, 5);
        break;
      case "crate":
        debris(12, ["#9a6a32", "#6b4a22", "#c89a55"]);
        lootAt(o.x, o.y, 0.6);
        break;
      default:
        debris(14, o.type === "bags" ? ["#b59a62", "#d8c189", "#86703f"] : ["#7a5a3a", "#a0a5aa"]);
        puff(fx0, fy0, 4);
    }
    sfx("hit");
  }
  // explosão no mundo: zumbis, objetos e o próprio tanque
  function boomAt(x, y, dmg, rad, k, hurtTank = false) {
    for (const z of tz) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - x, z.y - y) - z.r;
      if (d <= rad) tHurt(z, dmg * (d <= rad * 0.4 ? 1 : 0.6));
    }
    for (const o of LV.objs) {
      if (o.dead) continue;
      const d = Math.hypot(o.x - x, o.y - y) - o.r;
      if (d <= rad) setTimeout(() => hitObj(o, dmg * (d <= rad * 0.4 ? 1 : 0.6)), 60); // atraso = reação em cadeia
    }
    const dt = Math.hypot(T.x - x, T.y - y);
    if (hurtTank && dt < rad * 0.8) {
      T.hp -= dmg * 0.25;
      radioDamageCue(T);
      T.fl = 0.1;
    }
    const [fx0, fy0] = P(x, y, 1);
    boom(fx0, fy0, k);
  }
  function blocked(x, y, r, ignoreCrush) {
    if (x < CELL * 0.6 || x > LV.L - CELL * 0.6 || y < CELL * 0.55 || y > LV.W - CELL * 0.55) return { wall: true };
    for (const o of LV.objs) {
      if (o.dead || !OBJ[o.type].block) continue;
      if (Math.hypot(o.x - x, o.y - y) < o.r + r) {
        if (ignoreCrush && OBJ[o.type].crush) continue;
        return o;
      }
    }
    return null;
  }
  function fireCannon(st) {
    const cn = CANNON[tcfg.cannon],
      dx = Math.cos(T.tur),
      dy = Math.sin(T.tur),
      piv = [T.x + Math.cos(T.ang) * -2, T.y + Math.sin(T.ang) * -2],
      R = CHASSIS[tcfg.chassis].W * 0.37,
      l = R * 0.85 + cn.len + 1,
      x = piv[0] + dx * l,
      y = piv[1] + dy * l;
    tp.push({
      k: "shell",
      x,
      y,
      h: 9.8,
      vx: dx * cn.speed,
      vy: dy * cn.speed,
      life: cn.range / cn.speed,
      dmg: st.dmg,
      splash: cn.splash,
      bk: cn.k,
    });
    T.cd = st.reload;
    T.rec = 0.22;
    T.vel -= 14 * cn.k;
    const [fx0, fy0] = P(x, y, 9.8);
    G(GL.y, fx0, fy0, { r0: 4 * cn.k, r1: 7 * cn.k, life: 0.09 });
    G(GL.w, fx0, fy0, { r0: 2.4, r1: 3, life: 0.06 });
    G(GL.gs, fx0, fy0, { r0: 16, r1: 20, life: 0.1, a: 0.45 });
    for (let i = 0; i < 6; i++) {
      const [a, b] = P(x + dx * rnd(2, 10), y + dy * rnd(2, 10), 9.8);
      G(GL.sl, a, b, {
        add: false,
        a: 0.45,
        smoke: 1,
        vx: rnd(-8, 8),
        vy: -rnd(4, 12),
        r0: 2,
        r1: rnd(6, 10),
        life: rnd(0.7, 1.2),
        drag: 1.5,
      });
    }
    const [bx, by] = P(T.x - Math.cos(T.ang) * 14, T.y - Math.sin(T.ang) * 14, 1);
    puff(bx, by, 4);
    trauma = Math.min(1, trauma + 0.12 * cn.k);
    rumble(0.6, 120);
    sfx("cannon");
  }
  function fireMG(st) {
    const R = CHASSIS[tcfg.chassis].W * 0.37,
      a = T.tur + rnd(-0.05, 0.05),
      side = T.tur - Math.PI / 2,
      ox = T.x + Math.cos(T.ang) * -2 + Math.cos(side) * R * 0.5 + Math.cos(T.tur) * 11,
      oy = T.y + Math.sin(T.ang) * -2 + Math.sin(side) * R * 0.5 + Math.sin(T.tur) * 11;
    tp.push({ k: "mg", x: ox, y: oy, h: 12, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, life: 0.5, dmg: st.mgDmg });
    T.mgCd = 0.085;
    T.heat += st.mgHeat;
    if (T.heat >= 1) {
      T.over = true;
      txt(...P(T.x, T.y, 30), "SUPERAQUECEU!", "255,120,80");
    }
    const [fx0, fy0] = P(ox, oy, 12);
    G(GL.y, fx0, fy0, { r0: 1.8, r1: 3, life: 0.05 });
    part(fx0, fy0, rnd(-20, 20), -rnd(30, 50), 0.6, "#d9a440", 1, 260);
    sfx("shot");
  }

  /* ---------- ACESSÓRIOS (armas extras) ----------
     L1 / E = acessório especial selecionado (mísseis ou minas) · ←/→ do controle, Tab ou roda do mouse trocam
     L2 / Q = lança-fumaça. Compre na Oficina ou ache nas caixas azuis do mapa. */
  const ACC = {
    missile: { n:"Míssil leve", desc:"Sobe e cai no ponto marcado pela mira", unlock:150, pack:4, packCost:90, max:12, cd:1.1 },
    heavy: { n:"Míssil pesado", desc:"Projétil raro de trajetória reta e explosão poderosa", unlock:0, pack:0, packCost:0, max:4, cd:2.2 },
    mine: { n: "Minas", desc: "Solta uma mina atrás do tanque", unlock: 120, pack: 3, packCost: 70, max: 9, cd: 0.7 },
    smoke: {
      n: "Fumaça",
      desc: "Nuvem que deixa os zumbis perdidos",
      unlock: 100,
      pack: 2,
      packCost: 60,
      max: 6,
      cd: 2.5,
    },
  };
  const SPECIALS = ["missile", "heavy", "mine"];
  const accDefault = () => ({
    missile: { own: false, ammo: 0 },
    heavy: { own: false, ammo: 0 },
    mine: { own: false, ammo: 0 },
    smoke: { own: false, ammo: 0 },
  });
  const cloneAcc = (a) => JSON.parse(JSON.stringify(a || accDefault()));
  let acc = accDefault(),
    specSel = "missile",
    specSel2 = "missile",
    accCd = { missile: 0, heavy: 0, mine: 0, smoke: 0 },
    accCd2 = { missile: 0, heavy: 0, mine: 0, smoke: 0 },
    tmines = [],
    clouds = [],
    aimDist = 170;
  function cycleSpec(dir, player = 1) {
    const own = SPECIALS.filter((k) => acc[k].own);
    if (!own.length) return banner("SEM ACESSÓRIO: COMPRE NA OFICINA OU ACHE NO MAPA", 1.8);
    const selected = player === 2 ? specSel2 : specSel;
    const i = own.indexOf(selected);
    const next = own[(i + dir + own.length) % own.length];
    if (player === 2) specSel2 = next; else specSel = next;
    sfx("reload");
    banner(`P${player} · ${ACC[next].n.toUpperCase()} x${acc[next].ammo}`, 1);
  }
  // ponto onde o míssil cai: o mouse (PC) ou a frente da torreta (controle/celular)
  function aimPoint() {
    if (tin.mouse) {
      const dx = tin.mouse.x - T.x,
        dy = tin.mouse.y - T.y,
        d = Math.hypot(dx, dy) || 1,
        k = Math.max(40, Math.min(320, d)) / d;
      return { x: T.x + dx * k, y: T.y + dy * k };
    }
    return { x: T.x + Math.cos(T.tur) * aimDist, y: T.y + Math.sin(T.tur) * aimDist };
  }
  function useAcc(k, tank = T, player = 1) {
    const a = acc[k], cooldown = player === 2 ? accCd2 : accCd;
    if (!tank || tank.hp <= 0) return;
    if (!a.own) {
      if (!useAcc.warned || performance.now() - useAcc.warned > 1500) {
        useAcc.warned = performance.now();
        banner(`${ACC[k].n.toUpperCase()}: COMPRE NA OFICINA OU ACHE NO MAPA`, 1.6);
      }
      return;
    }
    if (cooldown[k] > 0) return;
    if (a.ammo <= 0) {
      cooldown[k] = 0.6;
      txt(...P(tank.x, tank.y, 30), "SEM MUNIÇÃO", "255,120,80");
      return;
    }
    a.ammo--;
    cooldown[k] = ACC[k].cd;
    if (k === "missile") {
      // míssil leve: sobe em arco e desce no ponto marcado pela mira
      const tg = player === 2
          ? { x: tank.x + Math.cos(tank.tur) * aimDist, y: tank.y + Math.sin(tank.tur) * aimDist }
          : aimPoint(),
        dx = tg.x - tank.x,
        dy = tg.y - tank.y,
        ang = Math.atan2(dy, dx),
        cfg = player === 2 ? tcfg2 : tcfg,
        R = CHASSIS[cfg.chassis].W * 0.37,
        x0 = tank.x + Math.cos(ang) * (R + 10),
        y0 = tank.y + Math.sin(ang) * (R + 10),
        d = Math.hypot(tg.x - x0, tg.y - y0) || 1,
        speed = 560;
      tp.push({ k:"msl",x0,y0,x:x0,y:y0,tx:tg.x,ty:tg.y,h:16,t:0,T:0.7+d/420,vx:0,vy:0 });
      const [a2,b2]=P(x0,y0,17);
      for(let i=0;i<6;i++)G(GL.sl,a2,b2,{add:false,a:.5,smoke:1,vx:rnd(-14,14),vy:rnd(-4,10),r0:2,r1:rnd(6,11),life:rnd(.8,1.4),drag:1.5});
      G(GL.o,a2,b2,{r0:4,r1:8,life:.12}); sfx("launch"); rumble(.3,80);
    } else if (k === "heavy") {
      const ang=tank.tur,dx=Math.cos(ang),dy=Math.sin(ang),cfg=player===2?tcfg2:tcfg,
        R=CHASSIS[cfg.chassis].W*.37,x0=tank.x+dx*(R+10),y0=tank.y+dy*(R+10),speed=430;
      tp.push({k:"hmsl",x:x0,y:y0,h:11,vx:dx*speed,vy:dy*speed,life:1.8,dmg:240,splash:78,ang});
      const [a2,b2]=P(x0,y0,11); G(GL.y,a2,b2,{r0:6,r1:13,life:.2,a:1});
      sfx("launch"); rumble(.65,180);
    } else if (k === "mine") {
      const x = tank.x - Math.cos(tank.ang) * 18,
        y = tank.y - Math.sin(tank.ang) * 18;
      tmines.push({ x, y, arm: 0.8, t: 0 });
      sfx("place");
    } else if (k === "smoke") {
      // 4 granadas de fumaça em leque à frente da torreta
      for (let i = 0; i < 4; i++) {
        const a3 = tank.tur + (i - 1.5) * 0.45,
          d = 55 + Math.abs(i - 1.5) * 8;
        tp.push({
          k: "smk",
          x0: tank.x,
          y0: tank.y,
          x: tank.x,
          y: tank.y,
          tx: tank.x + Math.cos(a3) * d,
          ty: tank.y + Math.sin(a3) * d,
          h: 12,
          t: 0,
          T: 0.55,
          vx: 0,
          vy: 0,
        });
      }
      sfx("throw");
    }
  }
  function buyAcc(k) {
    const a = acc[k],
      d = ACC[k];
    if (!a.own) {
      if (money < d.unlock) return;
      money -= d.unlock;
      a.own = true;
      a.ammo = d.pack;
      if (SPECIALS.includes(k)) specSel = k;
    } else {
      if (money < d.packCost || a.ammo >= d.max) return;
      money -= d.packCost;
      a.ammo = Math.min(d.max, a.ammo + d.pack);
    }
    camp.money = money;
    camp.acc = cloneAcc(acc);
    saveCamp();
    sfx("coin");
    showShop();
  }
  // caixa azul de armas achada no mapa
  function pickArmCrate() {
    const notOwned = Object.keys(ACC).filter((k) => !acc[k].own);
    let k;
    if (notOwned.length) {
      k = notOwned.includes("missile") ? "missile" : notOwned[0];
      acc[k].own = true;
      acc[k].ammo = ACC[k].pack;
      if (SPECIALS.includes(k)) specSel = k;
      banner(`NOVO ACESSÓRIO: ${ACC[k].n.toUpperCase()}! (${k === "smoke" ? "L2 / Q" : "L1 / E"})`, 2.6);
    } else {
      k = Object.keys(ACC)[(Math.random() * 3) | 0];
      acc[k].ammo = Math.min(ACC[k].max, acc[k].ammo + ACC[k].pack);
      banner(`+${ACC[k].pack} ${ACC[k].n.toUpperCase()}`, 1.6);
    }
  }
  // atualiza mísseis, granadas de fumaça, minas e nuvens
  function accUpdate(dt) {
    for (const k in accCd) { accCd[k] = Math.max(0, accCd[k] - dt); accCd2[k] = Math.max(0, accCd2[k] - dt); }
    for (const p of tp) {
      if (p.k !== "msl" && p.k !== "smk") continue;
      p.t += dt;
      const f = Math.min(1, p.t / p.T),
        ox = p.x,
        oy = p.y;
      p.x = p.x0 + (p.tx - p.x0) * f;
      p.y = p.y0 + (p.ty - p.y0) * f;
      p.h = p.k === "msl" ? 16 * (1-f) + 95 * Math.sin(Math.PI*f) : 12*(1-f)+30*Math.sin(Math.PI*f);
      p.vx = (p.x - ox) / Math.max(dt, 0.001);
      p.vy = (p.y - oy) / Math.max(dt, 0.001);
      if(p.k==="msl"){const [a,b]=P(p.x,p.y,p.h);G(Math.random()<.55?GL.sl:GL.sd,a,b,{add:false,a:.42,smoke:1,vx:rnd(-5,5),vy:rnd(-4,2),r0:1.5,r1:rnd(5,8),life:rnd(.8,1.3),drag:1});G(GL.o,a,b,{r0:2.5,r1:1,life:.06});}
      if (f >= 1) {
        p.dead = true;
        if (p.k === "msl") {
          boomAt(p.tx, p.ty, 130, 34, 2.1);
          rumble(0.5, 150);
        } else clouds.push({ x: p.tx, y: p.ty, r: 42, life: 7, t: 0 });
      }
    }
    for (const m of tmines) {
      m.t += dt;
      m.arm -= dt;
      if (m.arm > 0) continue;
      for (const z of tz)
        if (!z.dead && Math.hypot(z.x - m.x, z.y - m.y) < z.r + 6) {
          m.dead = true;
          boomAt(m.x, m.y, 150, 30, 1.9);
          break;
        }
    }
    tmines = tmines.filter((m) => !m.dead);
    for (const c of clouds) {
      c.life -= dt;
      c.t += dt;
      if (Math.random() < dt * 30) {
        const a = rnd(0, 6.28),
          r = Math.sqrt(Math.random()) * c.r,
          [fx0, fy0] = P(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, rnd(0, 6));
        G(Math.random() < 0.7 ? GL.sl : GL.dust, fx0, fy0, {
          add: false,
          a: c.life < 1.5 ? 0.35 : 0.75,
          smoke: 1,
          vx: rnd(-6, 6),
          vy: -rnd(2, 6),
          r0: 8,
          r1: rnd(20, 32),
          life: rnd(1.8, 2.8),
          drag: 0.4,
        });
      }
      // zumbis dentro da fumaça ficam perdidos: andam sem rumo e não atacam
      for (const z of tz) if (!z.dead && Math.hypot(z.x - c.x, z.y - c.y) < c.r + z.r) z.lost = 1.2;
    }
    clouds = clouds.filter((c) => c.life > 0);
  }
  function drawMine(M, m) {
    const lay = layerFn(M, m.x, m.y, 0);
    lay(0);
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath();
    ctx.arc(1, 1, 4.5, 0, 7);
    ctx.fill();
    cyl(lay, 3.6, 1.6, "#2a2d22", "#5a5e4c");
    if (m.arm <= 0 && ((m.t * 3) | 0) % 2) {
      lay(1.7);
      ctx.fillStyle = "#ff3b2a";
      ctx.beginPath();
      ctx.arc(0, 0, 0.9, 0, 7);
      ctx.fill();
    }
  }

  /* ---------- controle de videogame (Gamepad API, PS4 genérico) ---------- */
  const pad2 = { lx:0, ly:0, rx:0, ry:0, cannon:false, mg:false, id:"" };
  let T2 = null;
  const pad = {
    lx: 0,
    ly: 0,
    rx: 0,
    ry: 0,
    cannon: false,
    mg: false,
    spec: false,
    smoke: false,
    prev: [],
    id: "",
  };
  function rumble(strength, ms) {
    try {
      const gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find((g) => g && g.connected);
      if (gp && gp.vibrationActuator)
        gp.vibrationActuator
          .playEffect("dual-rumble", { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 })
          .catch(() => {});
    } catch (e) {}
  }
  function pollPad() {
    let gp = null;
    try {
      const allPads = [...(navigator.getGamepads ? navigator.getGamepads() : [])];
      gp = allPads.find((g) => g && g.connected && g.axes.length >= 2);
      const gp2 = tankPlayers === 2 ? gp : allPads.filter((g) => g && g.connected && g.axes.length >= 2).find((g) => g.index !== (gp && gp.index));
      if (tankPlayers === 2) gp = null;
      if (gp2) { const dz2=v=>Math.abs(v)<.18?0:v, b2=i=>!!(gp2.buttons[i]&&(gp2.buttons[i].pressed||gp2.buttons[i].value>.4)), edge2=i=>b2(i)&&!pad2.prev[i]; pad2.lx=dz2(gp2.axes[0]||0);pad2.ly=dz2(gp2.axes[1]||0);pad2.rx=dz2(gp2.axes[2]||0);pad2.ry=dz2((gp2.mapping==="standard"?gp2.axes[3]:gp2.axes.length>5?gp2.axes[5]:gp2.axes[3])||0);pad2.cannon=b2(7);pad2.mg=b2(5);pad2.spec=edge2(4);pad2.smoke=b2(6);if(edge2(14))cycleSpec(-1,2);if(edge2(15))cycleSpec(1,2);pad2.id=gp2.id; if(state==="tselect" && tankSetupPlayer===2){const keys=Object.keys(CAMO),i=keys.indexOf(tcfg2.camo);if(edge2(14))tcfg2.camo=keys[(i+keys.length-1)%keys.length];if(edge2(15))tcfg2.camo=keys[(i+1)%keys.length];if(edge2(0)){store.set("tank2",tcfg2);showTankSetup();}} pad2.prev=gp2.buttons.map((_,i)=>b2(i)); } else {pad2.lx=pad2.ly=pad2.rx=pad2.ry=0;pad2.cannon=pad2.mg=false;pad2.id="";}
    } catch (e) {}
    if (!gp) {
      pad.lx = pad.ly = pad.rx = pad.ry = 0;
      pad.cannon = pad.mg = pad.spec = pad.smoke = false;
      return;
    }
    if (pad.id !== gp.id) {
      pad.id = gp.id;
      banner("CONTROLE CONECTADO", 1.8);
    }
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    const btn = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4));
    const std = gp.mapping === "standard";
    pad.lx = dz(gp.axes[0] || 0);
    pad.ly = dz(gp.axes[1] || 0);
    // controles genéricos sem mapeamento padrão costumam usar os eixos 2 e 5 para o analógico direito
    pad.rx = dz(gp.axes[2] || 0);
    pad.ry = dz((std ? gp.axes[3] : gp.axes.length > 5 ? gp.axes[5] : gp.axes[3]) || 0);
    // R2 = canhão · R1 = metralhadora · L1 = acessório · L2 = fumaça · direcional ←/→ troca o acessório
    pad.cannon = btn(7);
    pad.mg = btn(5);
    pad.spec = btn(4);
    pad.smoke = btn(6);
    const pressed = gp.buttons.map((b, i) => btn(i)),
      edge = (i) => pressed[i] && !pad.prev[i];
    if (MODE === "tank" && state === "play") {
      if (edge(14)) cycleSpec(-1);
      if (edge(15)) cycleSpec(1);
    }
    // OPTIONS/START = pausa; X confirma o botão principal das telas
    if (edge(9)) {
      if (MODE === "tank" && (state === "play" || state === "pause")) togglePause();
    }
    if ((edge(std ? 0 : 1) || edge(9)) && !ov.classList.contains("hide") && state !== "play") {
      const b = panel.querySelector(".big:not([disabled])");
      if (b) b.click();
    }
    pad.prev = pressed;
    if (pad.lx || pad.ly || pad.rx || pad.ry || pad.cannon || pad.mg || pad.spec || pad.smoke) {
      tin.mouse = null;
      tin.touch = false;
    }
  }
  addEventListener("gamepadconnected", () => banner("CONTROLE CONECTADO", 1.8));

  function tUpdate(dt) {
    const st = tStats();
    // COOPERATIVO LOCAL: o segundo controle pilota um segundo tanque independente.
    if (T2 && state === "play") {
      const st2={max:Math.round(CHASSIS[tcfg2.chassis].hp*(1+0.2*(lv.armor||0))),speed:CHASSIS[tcfg2.chassis].speed*(1+0.12*(lv.engine||0)),turn:CHASSIS[tcfg2.chassis].turn,dmg:CANNON[tcfg2.cannon].dmg*(1+0.2*(lv.dmg||0)),reload:CANNON[tcfg2.cannon].reload*Math.pow(0.85,lv.reload||0),mgDmg:9*(1+0.3*(lv.mg||0))};
      const f2=-pad2.ly, r2=pad2.lx; T2.ang+=(Math.abs(r2)>.18?r2:0)*st2.turn*dt;
      const v2=(Math.abs(f2)>.18?f2:0)*st2.speed*(f2<0?.6:1); T2.vel+=(v2-T2.vel)*Math.min(1,dt*5);
      const nx2=T2.x+Math.cos(T2.ang)*T2.vel*dt, ny2=T2.y+Math.sin(T2.ang)*T2.vel*dt;
      if(!blocked(nx2,T2.y,11,false))T2.x=nx2; if(!blocked(T2.x,ny2,11,false))T2.y=ny2;
      T2.phase+=T2.vel*dt*.8+Math.abs(r2)*dt*10;
      if(Math.hypot(pad2.rx,pad2.ry)>.28)T2.tur=turnTo(T2.tur,screenToGroundDir(pad2.rx,pad2.ry),4.5*dt);
      T2.cd-=dt;T2.mgCd-=dt;T2.fl=Math.max(0,T2.fl-dt); const c2=CANNON[tcfg2.cannon];
      if(pad2.cannon&&T2.cd<=0){const dx2=Math.cos(T2.tur),dy2=Math.sin(T2.tur),xx=T2.x+dx2*(c2.len+18),yy=T2.y+dy2*(c2.len+18);tp.push({k:"shell",x:xx,y:yy,h:9.8,vx:dx2*c2.speed,vy:dy2*c2.speed,life:c2.range/c2.speed,dmg:st2.dmg,splash:c2.splash,bk:c2.k,owner:2});T2.cd=st2.reload;sfx("cannon");}
      if(pad2.mg&&T2.mgCd<=0){const a2=T2.tur+(Math.random()-.5)*.08;tp.push({k:"mg",x:T2.x+Math.cos(a2)*15,y:T2.y+Math.sin(a2)*15,h:12,vx:Math.cos(a2)*560,vy:Math.sin(a2)*560,life:.5,dmg:st2.mgDmg,owner:2});T2.mgCd=.085;}
      if(pad2.spec) useAcc(specSel2,T2,2);
      if(pad2.smoke) useAcc("smoke",T2,2);
    }
    // --- movimento estilo tanque (igual em teclado, controle e tela):
    // frente = acelera, trás = ré (sem girar), lados = giram o casco
    let fwd = (tkeys.has("w") ? 1 : 0) - (tkeys.has("s") ? 1 : 0),
      rot = (tkeys.has("d") ? 1 : 0) - (tkeys.has("a") ? 1 : 0);
    const stick = tin.joy || (pad.lx || pad.ly ? { x: pad.lx, y: pad.ly } : null);
    if (stick) {
      const sy = -stick.y,
        sx = stick.x;
      fwd = Math.abs(sy) > 0.2 ? Math.max(-1, Math.min(1, sy * 1.15)) : 0;
      rot = Math.abs(sx) > 0.2 ? Math.max(-1, Math.min(1, sx * 1.15)) : 0;
    }
    T.ang += rot * st.turn * dt;
    const target = fwd * st.speed * (fwd < 0 ? 0.6 : 1);
    T.vel += (target - T.vel) * Math.min(1, dt * 5);
    const nx = T.x + Math.cos(T.ang) * T.vel * dt,
      ny = T.y + Math.sin(T.ang) * T.vel * dt;
    // colisão: o que é esmagável (cerca, árvore, caixa) quebra se o tanque passa por cima
    const tryMove = (x, y) => {
      const b = blocked(x, y, 11, false);
      if (!b) return true;
      if (!b.wall && OBJ[b.type].crush && Math.abs(T.vel) > 12) {
        hitObj(b, 999);
        T.vel *= 0.7;
        trauma = Math.min(1, trauma + 0.08);
        return true;
      }
      return false;
    };
    if (tryMove(nx, ny)) {
      T.x = nx;
      T.y = ny;
    } else if (tryMove(nx, T.y)) T.x = nx;
    else if (tryMove(T.x, ny)) T.y = ny;
    else T.vel *= 0.3;
    T.phase += T.vel * dt * 0.8 + Math.abs(rot) * dt * 10;
    if (Math.abs(T.vel) > 15 && Math.random() < 0.25) {
      const [bx, by] = P(T.x - Math.cos(T.ang) * 15, T.y - Math.sin(T.ang) * 15, 0);
      puff(bx, by, 1);
    }
    if (engine) {
      const f = Math.min(1, Math.abs(T.vel) / st.speed);
      engine.g.gain.setTargetAtTime(sound ? 0.05 + 0.1 * f : 0, AC.currentTime, 0.08);
      engine.o.frequency.setTargetAtTime(36 + 34 * f, AC.currentTime, 0.1);
    }
    // --- torreta: A/D, analógico direito (tela ou controle) ou mouse
    // torreta: setas (direção na tela), analógico direito (tela ou controle) ou mouse
    const ax = (tkeys.has("arrowright") ? 1 : 0) - (tkeys.has("arrowleft") ? 1 : 0),
      ay = (tkeys.has("arrowdown") ? 1 : 0) - (tkeys.has("arrowup") ? 1 : 0),
      aim =
        tin.joy2 || (Math.hypot(pad.rx, pad.ry) > 0.3 ? { x: pad.rx, y: pad.ry } : ax || ay ? { x: ax, y: ay } : null);
    if (aim && Math.hypot(aim.x, aim.y) > 0.25) {
      T.tur = turnTo(T.tur, screenToGroundDir(aim.x, aim.y), 4.5 * dt);
      if (tin.joy2 || pad.rx || pad.ry) aimDist = 90 + 200 * Math.min(1, Math.hypot(aim.x, aim.y)); // empurrar mais = mira mais longe
    } else if (tin.mouse) T.tur = turnTo(T.tur, Math.atan2(tin.mouse.y - T.y, tin.mouse.x - T.x), 4 * dt);
    // --- armas
    T.cd -= dt;
    T.mgCd -= dt;
    T.rec = Math.max(0, T.rec - dt);
    T.fl = Math.max(0, T.fl - dt);
    const wantCannon = tin.cannon || pad.cannon || tkeys.has(" "),
      wantMG = tin.mg || pad.mg || tkeys.has("shift");
    if (wantCannon && T.cd <= 0) fireCannon(st);
    if (wantMG && !T.over && T.mgCd <= 0) fireMG(st);
    T.heat = Math.max(0, T.heat - dt * (wantMG && !T.over ? 0.05 : 0.38));
    if (T.over && T.heat < 0.3) T.over = false;
    if (tin.spec || pad.spec || tkeys.has("e")) useAcc(specSel,T,1);
    if (tin.smoke || pad.smoke || tkeys.has("q")) useAcc("smoke",T,1);
    accUpdate(dt);
    // --- zumbis que acordam quando o tanque chega perto
    for (const s of LV.sleepers)
      if (!s.woke && Math.hypot(s.x - T.x, s.y - T.y) < (s.type === "boss" ? 260 : 300)) {
        s.woke = true;
        tSpawn(s.type, s.x, s.y);
      }
    // --- ninhos soltam zumbis enquanto o tanque está por perto
    const alive = tz.filter((z) => !z.dead).length;
    for (const o of LV.objs) {
      if (!o.nest || o.dead) continue;
      o.fl = Math.max(0, o.fl - dt);
      if (Math.hypot(o.x - T.x, o.y - T.y) > 430) continue;
      o.spawnT -= dt;
      if (o.spawnT <= 0 && alive < 14) {
        o.spawnT = Math.max(2.2, 4.5 - camp.m * 0.45) * rnd(0.7, 1.3);
        const a = rnd(0, 6.28);
        tSpawn(
          LV.M.zs[(Math.random() * LV.M.zs.length) | 0],
          o.x + Math.cos(a) * (o.r + 8),
          o.y + Math.sin(a) * (o.r + 8),
        );
        const [fx0, fy0] = P(o.x, o.y, 6);
        G(GL.g, fx0, fy0, { r0: 6, r1: 18, life: 0.4, a: 0.6 });
      }
    }
    for (const o of LV.objs) if (!o.nest) o.fl = Math.max(0, o.fl - dt);
    // caixas lançadas de paraquedas perto do tanque
    // --- zumbis
    for (const z of tz) {
      if (z.dead) continue;
      z.t += dt;
      z.fl = Math.max(0, z.fl - dt);
      z.firing = Math.max(0, z.firing - dt);
      const d = z.d,
        targetTank = T2 && T2.hp>0 && Math.hypot(T2.x-z.x,T2.y-z.y)<Math.hypot(T.x-z.x,T.y-z.y) ? T2 : T,
        dx = targetTank.x - z.x,
        dy = targetTank.y - z.y,
        dist = Math.hypot(dx, dy),
        reach = z.r + 13;
      let move = dist < 520;
      if (z.lost > 0) {
        // perdido na fumaça: anda sem rumo, devagar, e não ataca
        z.lost -= dt;
        z.bite = false;
        z.wa = (z.wa ?? rnd(0, 6.28)) + rnd(-2, 2) * dt;
        z.x += Math.cos(z.wa) * d.sp * 0.8 * dt;
        z.y += Math.sin(z.wa) * d.sp * 0.8 * dt;
        continue;
      }
      if (d.gun) {
        z.gun -= dt;
        if (z.burst > 0) {
          z.bt -= dt;
          move = false;
          if (z.bt <= 0) {
            z.bt = 0.1;
            z.burst--;
            z.firing = 0.15;
            const a = Math.atan2(dy, dx) + rnd(-0.08, 0.08);
            zp.push({
              k: "zb",
              x: z.x + Math.cos(a) * 18,
              y: z.y + Math.sin(a) * 18,
              h: 20,
              vx: Math.cos(a) * 300,
              vy: Math.sin(a) * 300,
              life: 1.2,
              dmg: d.gun,
            });
            const [fx0, fy0] = P(z.x + Math.cos(a) * 18, z.y + Math.sin(a) * 18, 20);
            G(GL.y, fx0, fy0, { r0: 3, r1: 5, life: 0.07 });
            trauma = Math.min(1, trauma + 0.05);
            sfx("shot");
          }
        } else if (z.gun <= 0 && dist < 220) {
          z.gun = 2.6;
          z.burst = 6;
        }
      }
      if (d.spit && dist < 115 && dist > reach) {
        move = false;
        z.sc -= dt;
        if (z.sc <= 0) {
          z.sc = 2.4;
          const a = Math.atan2(dy, dx);
          zp.push({
            k: "acid",
            x: z.x,
            y: z.y,
            h: 14,
            vx: Math.cos(a) * 110,
            vy: Math.sin(a) * 110,
            life: 1.4,
            dmg: d.spit,
          });
          sfx("spit");
        }
      }
      if (dist <= reach) {
        z.bite = true;
        targetTank.hp -= d.dps * dt;
        radioDamageCue(targetTank);
        targetTank.fl = 0.06;
        move = false;
        if (Math.abs(T.vel) > 20) tHurt(z, 70 * dt * (Math.abs(T.vel) / st.speed), true); // atropelar
      } else z.bite = false;
      if (move) {
        const sp = d.sp * 2.2;
        z.x += (dx / dist) * sp * dt;
        z.y += (dy / dist) * sp * dt;
      }
      // contorna objetos
      for (const o of LV.objs) {
        if (o.dead || !OBJ[o.type].block) continue;
        const ox = z.x - o.x,
          oy = z.y - o.y,
          od = Math.hypot(ox, oy) || 0.01,
          m = o.r + z.r - od;
        if (m > 0) {
          z.x += (ox / od) * m + (-oy / od) * m * 0.5;
          z.y += (oy / od) * m + (ox / od) * m * 0.5;
        }
      }
    }
    for (let i = 0; i < tz.length; i++) {
      const a = tz[i];
      if (a.dead) continue;
      for (let j = i + 1; j < tz.length; j++) {
        const b = tz[j];
        if (b.dead) continue;
        const dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy) || 0.01,
          m = a.r + b.r - d;
        if (m > 0) {
          a.x -= (dx / d) * m * 0.5;
          a.y -= (dy / d) * m * 0.5;
          b.x += (dx / d) * m * 0.5;
          b.y += (dy / d) * m * 0.5;
        }
      }
      const dx = a.x - T.x,
        dy = a.y - T.y,
        d = Math.hypot(dx, dy) || 0.01,
        m = a.r + 12 - d;
      if (m > 0) {
        a.x += (dx / d) * m;
        a.y += (dy / d) * m;
      }
    }
    // --- projéteis do tanque
    for (const p of tp) {
      if (p.k === "msl" || p.k === "smk") continue; // tratados em accUpdate
      if(p.k==="hmsl"){
        p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;const [fx,fy]=P(p.x,p.y,p.h),ang=p.ang;
        for(let j=0;j<3;j++){const [tx,ty]=P(p.x-Math.cos(ang)*rnd(2,12),p.y-Math.sin(ang)*rnd(2,12),p.h);G(GL.y,tx,ty,{r0:rnd(3,6),r1:rnd(7,13),life:rnd(.15,.28),a:.95});G(GL.o,tx,ty,{r0:2,r1:4,life:.12,a:.9});}
        G(GL.sl,fx,fy,{add:false,a:.28,smoke:1,vx:-Math.cos(ang)*15,vy:-Math.sin(ang)*15,r0:2,r1:6,life:.45,drag:1});
        let hit=false;for(const z of tz)if(!z.dead&&Math.hypot(z.x-p.x,z.y-p.y)<z.r+5){hit=true;break;}
        if(!hit)for(const o of LV.objs)if(!o.dead&&Math.hypot(o.x-p.x,o.y-p.y)<o.r+4){hit=true;break;}
        if(hit||p.life<=0||blocked(p.x,p.y,2,true)){p.dead=true;boomAt(p.x,p.y,p.dmg,p.splash,2.8);rumble(.75,220);}continue;
      }
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.k === "shell" && Math.random() < 0.7) {
        const [a, b] = P(p.x, p.y, p.h);
        G(GL.sl, a, b, { add: false, a: 0.22, smoke: 1, r0: 0.8, r1: 2.6, life: 0.45 });
      }
      let hit = null,
        hitO = null;
      for (const z of tz)
        if (!z.dead && Math.hypot(z.x - p.x, z.y - p.y) < z.r + 2) {
          hit = z;
          break;
        }
      if (!hit)
        for (const o of LV.objs)
          if (!o.dead && Math.hypot(o.x - p.x, o.y - p.y) < o.r + 1) {
            hitO = o;
            break;
          }
      if (hit || hitO) {
        p.dead = true;
        if (p.k === "shell") boomAt(p.x, p.y, p.dmg, p.splash, p.bk);
        else {
          if (hit) tHurt(hit, p.dmg);
          else hitObj(hitO, p.dmg);
          const [a, b] = P(p.x, p.y, 10);
          for (let i = 0; i < 3; i++)
            add({
              k: "s",
              x: a,
              y: b,
              vx: rnd(-80, 80),
              vy: rnd(-60, 10),
              life: 0.12,
              max: 0.12,
              g: 200,
              col: "255,240,180",
            });
        }
      } else if (p.life <= 0) {
        p.dead = true;
        if (p.k === "shell") boomAt(p.x, p.y, p.dmg, p.splash, p.bk);
      }
    }
    // --- projéteis dos zumbis
    for (const p of zp) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const targetHit = T2&&T2.hp>0&&Math.hypot(p.x-T2.x,p.y-T2.y)<Math.hypot(p.x-T.x,p.y-T.y)?T2:T;
      if (Math.hypot(p.x-targetHit.x,p.y-targetHit.y)<14) {
        p.dead = true;
        targetHit.hp -= p.dmg;
        radioDamageCue(targetHit);
        targetHit.fl = 0.1;
        rumble(0.3, 80);
        const [a, b] = P(p.x, p.y, 8);
        if (p.k === "acid") {
          G(GL.g, a, b, { r0: 3, r1: 10, life: 0.25, a: 0.7 });
          for (let i = 0; i < 6; i++) part(a, b, rnd(-30, 30), -rnd(10, 40), 0.6, "#9be22d", 1, 120);
        } else
          for (let i = 0; i < 3; i++)
            add({
              k: "s",
              x: a,
              y: b,
              vx: rnd(-90, 90),
              vy: rnd(-50, 20),
              life: 0.12,
              max: 0.12,
              g: 200,
              col: "255,240,180",
            });
      } else if (p.life <= 0 || blocked(p.x, p.y, 1, true)) p.dead = true;
    }
    // --- caixas de reparo / moedas
    for (const c of tdrops) {
      c.t += dt;
      c.life -= dt;
      const collector = T2&&T2.hp>0&&Math.hypot(c.x-T2.x,c.y-T2.y)<Math.hypot(c.x-T.x,c.y-T.y)?T2:T;
      if (Math.hypot(c.x-collector.x,c.y-collector.y)<(c.kind === "launcher" || c.kind === "missile" || c.kind === "heavy" ? 27 : 18)) {
        c.life = 0;
        const [a, b] = P(c.x, c.y, 6);
        G(GL.y, a, b, { r0: 4, r1: 16, life: 0.3 });
        if(c.kind==="heavy"){
          acc.heavy.own=true;acc.heavy.ammo=Math.min(ACC.heavy.max,acc.heavy.ammo+2);specSel="heavy";specSel2="heavy";
          if(T)T.pod=true;if(T2)T2.pod=true;txt(a,b-12,"MÍSSIL PESADO +2","255,150,70");banner("MÍSSIL PESADO LIBERADO! E / L1",2.5);
        } else if (c.kind === "launcher" || c.kind === "missile" || c.kind === "heavy") {
          acc.missile.own=true;acc.missile.ammo=Math.min(ACC.missile.max,Math.max(acc.missile.ammo,0)+4);specSel="missile";specSel2="missile";
          if(T)T.pod=true;if(T2)T2.pod=true;txt(a,b-12,"MÍSSIL LEVE +4","255,214,90");banner("MÍSSIL LEVE LIBERADO! E / L1",2.5);
        } else if (c.kind === "arm") pickArmCrate();
        else if (c.kind === "rep") {
          collector.hp = Math.min(st.max, collector.hp + st.max * 0.2);
          txt(a, b - 8, "REPARO +20%", "140,235,90");
        } else {
          money += 30;
          coins(a, b);
          txt(a, b - 8, "+$30", "255,214,90");
        }
        sfx("coin");
      }
    }
    tz = tz.filter((z) => !z.dead);
    tp = tp.filter((p) => !p.dead);
    zp = zp.filter((p) => !p.dead);
    tdrops = tdrops.filter((c) => c.life > 0);
    LV.objs = LV.objs.filter((o) => !o.dead);
    for (const c of tcorpse) c.t += dt;
    tcorpse = tcorpse.filter((c) => c.t < 2.6);
    // --- objetivo: ninhos (e chefão) destruídos + chegar à extração
    const nestsLeft = LV.objs.filter((o) => o.nest).length,
      bossLeft = LV.M.boss && (tz.some((z) => z.d.big) || LV.sleepers.some((s) => s.type === "boss" && !s.woke));
    const wasDone = LV.done;
    LV.done = !nestsLeft && !bossLeft;
    if (!wasDone && LV.done) radioCue("area-clear");
    if (Math.hypot(T.x-LV.ex.x,T.y-LV.ex.y)<34 || (T2&&T2.hp>0&&Math.hypot(T2.x-LV.ex.x,T2.y-LV.ex.y)<34)) {
      if (LV.done) return tEnd(true);
      if (!LV.warned) {
        LV.warned = true;
        banner(nestsLeft ? `DESTRUA OS NINHOS: FALTAM ${nestsLeft}` : "DERROTE O CHEFÃO!", 2.4);
        setTimeout(() => LV && (LV.warned = false), 4000);
      }
    }
    // --- câmera segue o tanque, olhando um pouco para a frente
    const fx=T2&&T2.hp>0?(T.x+T2.x)/2:T.x, fy=T2&&T2.hp>0?(T.y+T2.y)/2:T.y;
    const [sx, sy] = wiso(fx + Math.cos(T.tur) * 25, fy + Math.sin(T.tur) * 25);
    cam.x += (sx - VIEW.w * 0.5 - cam.x) * Math.min(1, dt * 3);
    cam.y += (sy - VIEW.h * 0.55 - cam.y) * Math.min(1, dt * 3);
    if (T.hp <= 0 && (!T2 || T2.hp<=0)) {
      T.hp = 0;
      const [a, b] = P(T.x, T.y, 6);
      boom(a, b, 3.2);
      boom(a + 6, b - 4, 2);
      slowT = 0.8;
      flashA = 0.6;
      flashC = "255,120,60";
      rumble(1, 600);
      tEnd(false);
    }
  }

  /* ---------- desenho dos objetos (pseudo-3D em camadas) ---------- */
  function layerFn(M, x, y, ang) {
    return (h) => {
      ctx.setTransform(M[0], M[1], M[2], M[3], M[4], M[5] - h * FS * K);
      ctx.translate(x, y);
      if (ang) ctx.rotate(ang);
    };
  }
  function box(lay, w, d, h, side, top, ox = 0, oy = 0, h0 = 0) {
    const step = w < 3 || d < 3 ? 0.25 : Math.min(0.7, Math.max(0.35, h / 10)); // peças finas precisam de mais camadas
    for (let k = h0; k < h0 + h; k += step) {
      lay(k);
      ctx.fillStyle = side;
      ctx.fillRect(ox - w / 2, oy - d / 2, w, d);
    }
    lay(h0 + h);
    ctx.fillStyle = top;
    ctx.fillRect(ox - w / 2, oy - d / 2, w, d);
  }
  function cyl(lay, r, h, side, top, h0 = 0) {
    const step = Math.max(0.6, h / 10);
    for (let k = h0; k < h0 + h; k += step) {
      lay(k);
      ctx.fillStyle = side;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, 7);
      ctx.fill();
    }
    lay(h0 + h);
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 7);
    ctx.fill();
  }
  function groundShadow(lay, rx, ry) {
    lay(0);
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(2, 2, rx, ry, 0, 0, 7);
    ctx.fill();
  }
  function drawTree(M, x, y, s, seed, th, fl) {
    const lay = layerFn(M, x, y, 0);
    groundShadow(lay, 8 * s, 7 * s);
    cyl(lay, 1.6 * s, 9 * s, "#3d2712", "#5a3f26");
    const L = th.leaf;
    for (let k = 0; k < 4; k++) {
      const h0 = (7 + k * 4.2) * s,
        r = (8.5 - k * 1.9) * s * (0.9 + seed * 0.25);
      for (let q = 0; q < 3; q++) {
        lay(h0 + q * 1.2 * s);
        ctx.fillStyle = q < 2 ? L[0] : L[1 + (((k + seed * 3) | 0) % 2)];
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, 7);
        ctx.fill();
      }
      lay(h0 + 3.6 * s);
      ctx.fillStyle = L[2];
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.3, r * 0.45, 0, 7);
      ctx.fill();
    }
    if (fl > 0) {
      lay(20 * s);
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.beginPath();
      ctx.arc(0, 0, 6 * s, 0, 7);
      ctx.fill();
    }
  }
  function drawObj(o, M, th) {
    const lay = layerFn(M, o.x, o.y, o.ang),
      fl = o.fl > 0;
    switch (o.type) {
      case "tree":
        return drawTree(M, o.x, o.y, 1 + o.seed * 0.4, o.seed, th, o.fl);
      case "barrel":
        groundShadow(lay, 5, 5);
        cyl(lay, 3.6, 9, fl ? "#fff" : "#7a1c14", "#c0392b");
        lay(4);
        ctx.fillStyle = "#f2c230";
        ctx.beginPath();
        ctx.arc(0, 0, 3.7, 0, 7);
        ctx.fill();
        cyl(lay, 3.6, 3.5, "#7a1c14", "#d24a3a", 5);
        lay(8.6);
        ctx.fillStyle = "#3a0d08";
        ctx.beginPath();
        ctx.arc(1.2, -0.8, 0.9, 0, 7);
        ctx.fill();
        return;
      case "crate":
        groundShadow(lay, 6, 6);
        box(lay, 9, 9, 8, fl ? "#fff" : "#5a3d1c", "#9a6a32");
        lay(8);
        ctx.fillStyle = "#6b4a22";
        ctx.fillRect(-4.5, -0.6, 9, 1.2);
        ctx.fillRect(-0.6, -4.5, 1.2, 9);
        return;
      case "bags":
        groundShadow(lay, 12, 5);
        for (let r = 0; r < 3; r++) {
          box(lay, 22 - r * 3, 6.5 - r, 2.6, fl ? "#fff" : "#86703f", r % 2 ? "#d8c189" : "#c8ad74", 0, 0, r * 2.6);
          lay(r * 2.6 + 2.6);
          ctx.fillStyle = "rgba(0,0,0,.25)";
          for (let k = -9 + r; k < 10 - r; k += 4) ctx.fillRect(k, -3, 0.5, 6);
        }
        return;
      case "fence":
        for (const px of [-11, 0, 11]) box(lay, 1.6, 1.6, 9, "#3d2712", "#6b4a2a", px, 0);
        for (const h of [3, 6]) {
          box(lay, 24, 0.7, 0.8, "#6b6e72", "#b0b4b8", 0, 0, h);
          lay(h + 0.8);
          ctx.fillStyle = "#d0d4d8";
          for (let k = -10; k < 11; k += 3) ctx.fillRect(k, -1, 0.6, 2);
        }
        return;
      case "rock": {
        groundShadow(lay, 8, 7);
        const pts = 7;
        for (let h = 0; h <= 6; h += 0.8) {
          lay(h);
          ctx.fillStyle = h < 6 ? "#4e504a" : th.rock;
          const sh = 1 - (h / 6) * 0.35;
          ctx.beginPath();
          for (let i = 0; i < pts; i++) {
            const a = (i / pts) * 6.283,
              r = (6 + hash(o.seed * 9, i) * 2.5) * sh;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.fill();
        }
        return;
      }
      case "hut":
        groundShadow(lay, 18, 14);
        box(lay, 28, 22, 16, fl ? "#fff" : "#4e3520", "#7a5a3a");
        box(lay, 30, 24, 3, "#2a3d1a", "#3d5224", 0, 0, 16);
        box(lay, 26, 14, 3, "#2a3d1a", "#4b6a2c", 0, 0, 19);
        box(lay, 20, 6, 2, "#2a3d1a", "#5b7a35", 0, 0, 22);
        return;
      case "tower":
        groundShadow(lay, 10, 10);
        for (const [px, py] of [
          [-6, -6],
          [6, -6],
          [-6, 6],
          [6, 6],
        ])
          box(lay, 1.6, 1.6, 26, "#3d2712", "#6b4a2a", px, py);
        box(lay, 16, 16, 7, fl ? "#fff" : "#5a3f26", "#7a5a3a", 0, 0, 24);
        box(lay, 18, 18, 2, "#2a3d1a", "#3d5224", 0, 0, 33);
        return;
      case "ruin":
        groundShadow(lay, 22, 18);
        for (let h = 0; h < 34; h += 1.2) {
          lay(h);
          ctx.fillStyle = fl ? "#fff" : ((h / 7) | 0) % 2 ? "#5c5e5a" : "#6c6e6a";
          ctx.fillRect(-17, -13, 34, 26);
        }
        lay(34);
        ctx.fillStyle = "#8a8c88";
        ctx.fillRect(-17, -13, 34, 26);
        ctx.fillStyle = "#4a4c48";
        ctx.fillRect(-12, -8, 10, 7);
        ctx.fillRect(3, 2, 11, 8);
        ctx.fillStyle = "#3a3c38";
        ctx.beginPath();
        ctx.moveTo(17, -13);
        ctx.lineTo(4, -13);
        ctx.lineTo(17, 0);
        ctx.fill();
        return;
      case "car":
        groundShadow(lay, 11, 7);
        box(lay, 20, 10, 4, fl ? "#fff" : "#4a2a18", "#8a4a2a", 0, 0, 1.5);
        box(lay, 9, 9, 4, "#3a2014", "#6a3a22", -2, 0, 5.5);
        lay(1);
        ctx.fillStyle = "#111";
        for (const [px, py] of [
          [-6, -5],
          [6, -5],
          [-6, 5],
          [6, 5],
        ])
          ctx.fillRect(px - 2, py - 1, 4, 2);
        return;
      case "nest": {
        groundShadow(lay, 18, 15);
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300 + o.seed * 6);
        for (let h = 0; h <= 12; h += 0.8) {
          lay(h);
          const r = 15 * (1 - (h / 12) ** 1.6) + 3;
          ctx.fillStyle = fl ? "#fff" : h < 12 ? (h % 2.4 < 1.2 ? "#2c3a17" : "#3b2a3a") : "#5a7a2a";
          ctx.beginPath();
          ctx.ellipse(0, 0, r, r * 0.92, 0, 0, 7);
          ctx.fill();
        }
        lay(12);
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(GL.g, -8, -8, 16, 16);
        ctx.globalAlpha = 0.4 + pulse * 0.5;
        ctx.drawImage(GL.g, -14, -14, 28, 28);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        lay(2);
        ctx.fillStyle = "#e8e4d0";
        for (let i = 0; i < 6; i++) {
          const a = i + o.seed * 5;
          ctx.fillRect(Math.cos(a) * 15, Math.sin(a) * 13, 3, 1);
        }
        return;
      }
    }
  }
  function drawFlag(M, ex, done) {
    const lay = layerFn(M, ex.x, ex.y, 0);
    lay(0);
    ctx.fillStyle = done ? "rgba(140,235,90,.35)" : "rgba(242,194,48,.22)";
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, 7);
    ctx.fill();
    ctx.strokeStyle = done ? "#8be04f" : "#f2c230";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
    cyl(lay, 1, 40, "#555", "#aaa");
    // bandeira em pé, na tela
    const [sx, sy] = wiso(ex.x, ex.y);
    ctx.setTransform(FS, 0, 0, FS, -cam.x * FS, -cam.y * FS);
    const t = performance.now() / 200,
      top = sy - 40 * K;
    ctx.fillStyle = done ? "#8be04f" : "#f2c230";
    ctx.beginPath();
    ctx.moveTo(sx, top);
    for (let i = 0; i <= 6; i++) ctx.lineTo(sx + i * 9, top + Math.sin(t + i) * 3);
    for (let i = 6; i >= 0; i--) ctx.lineTo(sx + i * 9, top + 26 + Math.sin(t + i) * 3);
    ctx.fill();
    ctx.fillStyle = "#141a0e";
    ctx.font = "bold 11px 'Press Start 2P',monospace";
    ctx.fillText("EXTRAÇÃO", sx - 34, top - 10);
  }

  /* ---------- desenho do modo tanque ---------- */
  function tRender() {
    const VWt = VIEW.w,
      VHt = VIEW.h,
      th = LV.theme;
    ctx.save();
    ctx.setTransform(FS, 0, 0, FS, 0, 0);
    ctx.fillStyle = th.edge;
    ctx.fillRect(0, 0, VWt, VHt);
    const M = groundM();
    // --- chão: só as casas visíveis
    const cs = [
      wunproject(cam.x, cam.y),
      wunproject(cam.x + VWt, cam.y),
      wunproject(cam.x, cam.y + VHt),
      wunproject(cam.x + VWt, cam.y + VHt),
    ];
    const u0 = Math.floor(Math.min(...cs.map((p) => p.x)) / CELL) - 1,
      u1 = Math.ceil(Math.max(...cs.map((p) => p.x)) / CELL) + 1,
      v0 = Math.floor(Math.min(...cs.map((p) => p.y)) / CELL) - 1,
      v1 = Math.ceil(Math.max(...cs.map((p) => p.y)) / CELL) + 1,
      Lc = LV.L / CELL,
      Wc = W_CELLS;
    ctx.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
    for (let u = Math.max(u0, -8); u <= Math.min(u1, Lc + 8); u++)
      for (let v = Math.max(v0, -6); v <= Math.min(v1, Wc + 6); v++) {
        const out = u < 0 || u >= Lc || v < 0 || v >= Wc,
          cx = (u + 0.5) * CELL,
          ry = roadY(cx),
          onRoad = !out && Math.abs((v + 0.5) * CELL - ry) < CELL * 1.1,
          hv = hash(u, v);
        ctx.fillStyle = out ? th.edge : onRoad ? ((u + v) % 2 ? th.road : th.road2) : th.g[(u + v) & 1];
        ctx.fillRect(u * CELL, v * CELL, CELL + 0.6, CELL + 0.6);
        if (!out) {
          ctx.fillStyle = onRoad ? "rgba(0,0,0,.12)" : th.tuft;
          for (let k = 0; k < 4; k++) {
            const px = u * CELL + hash(u + k, v) * 21 + 1,
              py = v * CELL + hash(u, v + k) * 21 + 1;
            ctx.fillRect(px, py, onRoad ? 2.5 : 1.2, onRoad ? 1.2 : 2.5);
          }
          if (hv > 0.93 && !onRoad) {
            ctx.fillStyle = "#e8d36a";
            ctx.fillRect(u * CELL + 8, v * CELL + 9, 1.6, 1.6);
          }
        }
      }
    // borda do mapa
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, LV.L, LV.W);
    // manchas (crateras, sangue, entulho)
    ctx.setTransform(FS * K, 0, 0, FS * K, -cam.x * FS, -cam.y * FS);
    for (const d of tdec) {
      if (d.k === "s")
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = `rgba(22,16,8,${0.18 + i * 0.1})`;
          ctx.beginPath();
          ctx.ellipse(d.x, d.y, d.r * (1 - i * 0.3), d.r * 0.5 * (1 - i * 0.3), 0, 0, 7);
          ctx.fill();
        }
      else {
        ctx.fillStyle = d.c;
        ctx.fillRect(d.x, d.y, 1.4, 0.9);
      }
    }
    drawFlag(M, LV.ex, LV.done);
    // linha de mira pontilhada (PC)
    if (!tin.touch && state === "play") {
      ctx.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
      ctx.translate(T.x, T.y);
      ctx.rotate(T.tur);
      ctx.fillStyle = "rgba(255,240,180,.35)";
      for (let i = 30; i < 160; i += 8) ctx.fillRect(i, -0.5, 3, 1);
    }
    // mira do míssil no chão
    if (acc.missile.own && specSel === "missile" && state === "play") {
      const ap = aimPoint(),
        pul = 1 + Math.sin(performance.now() / 160) * 0.12;
      ctx.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
      ctx.translate(ap.x, ap.y);
      ctx.strokeStyle = acc.missile.ammo > 0 && accCd.missile <= 0 ? "rgba(255,80,50,.85)" : "rgba(255,255,255,.35)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 12 * pul, 0, 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-17, 0);
      ctx.lineTo(-7, 0);
      ctx.moveTo(7, 0);
      ctx.lineTo(17, 0);
      ctx.moveTo(0, -17);
      ctx.lineTo(0, -7);
      ctx.moveTo(0, 7);
      ctx.lineTo(0, 17);
      ctx.stroke();
    }
    // --- tudo o que fica em pé, ordenado pela profundidade
    const vis = (x, y, m = 120) => {
      const [sx, sy] = wiso(x, y);
      return sx > cam.x - m && sx < cam.x + VWt + m && sy > cam.y - m && sy < cam.y + VHt + m * 2;
    };
    const list = [];
    const push = (x, y, f, b = 0) => vis(x, y) && list.push({ d: wiso(x, y)[1] + b, f });
    const scr = () => ctx.setTransform(FS, 0, 0, FS, -cam.x * FS, -cam.y * FS);
    for (const d of LV.decor) push(d.x, d.y, () => drawTree(M, d.x, d.y, d.s * 1.3, d.seed, th, 0));
    for (const o of LV.objs)
      push(o.x, o.y, () => {
        drawObj(o, M, th);
        if (o.hp < o.max && (o.nest || o.max >= 80)) {
          scr();
          const [sx, sy] = wiso(o.x, o.y);
          bar(sx, sy - (o.nest ? 22 : o.type === "ruin" ? 40 : 26) * K, o.hp, o.max);
        }
      });
    for (const c of tcorpse)
      push(
        c.x,
        c.y,
        () => {
          scr();
          const [sx, sy] = wiso(c.x, c.y),
            f = Math.min(1, c.t / 0.35);
          if (!c.img) return;
          ctx.save();
          ctx.globalAlpha = c.t > 1.5 ? Math.max(0, 1 - (c.t - 1.5) / 1.1) : 1;
          ctx.translate(sx, sy + f * f * 2 * K);
          ctx.scale(c.flip ? -1 : 1, 1);
          ctx.rotate(f * f * 1.45);
          const cw = (c.img.width * c.h) / c.img.height;
          ctx.drawImage(c.img, -cw / 2, -c.h, cw, c.h);
          ctx.restore();
        },
        -1,
      );
    for (const c of tdrops)
      push(c.x, c.y, () => {
        if (c.life < 3 && ((c.life * 8) | 0) % 2) return;
        scr();
        const [sx, sy] = wiso(c.x, c.y);
        shadow(sx, sy, c.kind === "launcher" || c.kind === "missile" || c.kind === "heavy" ? 15 * K : 6 * K);
        ctx.save();
        ctx.translate(sx, sy - Math.abs(Math.sin(c.t * 3)) * (c.kind === "launcher" || c.kind === "missile" || c.kind === "heavy" ? 5 : 3) * K);
        ctx.scale(K, K);
        if (c.kind === "launcher" || c.kind === "missile") {
          // Caixa grande com dois tubos de míssil, visível nos escombros antes da coleta.
          ctx.fillStyle = "#171b16"; ctx.fillRect(-13, -16, 27, 16);
          ctx.fillStyle = "#6b7655"; ctx.fillRect(-12, -15, 25, 13);
          ctx.fillStyle = "#30382b"; ctx.fillRect(-10, -20, 20, 7);
          for (const oy of [-16, -10]) {
            ctx.fillStyle = "#151a17"; ctx.fillRect(-8, oy, 16, 4);
            ctx.fillStyle = "#aab39a"; ctx.fillRect(-6, oy + 1, 11, 1);
            ctx.fillStyle = "#d7a64b"; ctx.fillRect(5, oy, 2, 4);
          }
          ctx.fillStyle = "#f2c230"; ctx.fillRect(-12, -3, 25, 2);
          ctx.restore();
          return;
        }
        ctx.fillStyle = "#141a0e";
        ctx.fillRect(-5, -9, 11, 9);
        ctx.fillStyle = c.kind === "arm" ? "#3a5a8a" : c.kind === "rep" ? "#d8dcd2" : "#9a6a32";
        ctx.fillRect(-4, -8, 9, 7);
        ctx.fillStyle = c.kind === "arm" ? "#e6eed2" : c.kind === "rep" ? "#c0392b" : "#f2c230";
        ctx.fillRect(0, -8, 1, 7);
        ctx.fillRect(-4, -5, 9, 1);
        ctx.restore();
      });
    for (const z of tz)
      push(
        z.x,
        z.y,
        () => {
          scr();
          const [sx, sy0] = wiso(z.x, z.y),
            sy = sy0 + (z.d.big ? 2 * K : 0),
            im = IMG["z_" + z.type],
            flip = wiso(T.x, T.y)[0] > sx;
          shadow(sx, sy, (z.r + 2) * K * 0.9);
          if (!im) return;
          const h = SPRITE_H["z_" + z.type] * K;
          let rot = 0,
            dy = 0;
          if (z.bite) rot = -(0.06 + 0.06 * Math.sin(z.t * 18));
          else if (z.firing > 0) rot = 0.03 * Math.sin(z.t * 40);
          else {
            const ph = Math.sin(z.t * (z.type === "runner" ? 14 : z.d.big ? 5 : 7));
            rot = ph * 0.05;
            dy = -Math.abs(ph) * 0.8 * K;
          }
          drawImg(im, sx, sy + dy, h, { fl: z.fl, rot: flip ? -rot : rot, sx: flip ? -1 : 1 });
          if (!z.d.big) bar(sx, sy - h - 3 * K, z.hp, z.max);
        },
        0.5,
      );
    T.pod = acc.missile.own;
    if (T2) T2.pod = acc.missile.own;
    push(T.x, T.y, () => { drawTank(ctx, M, FS * K, T, tcfg, T.fl); });
    if (T2 && T2.hp > 0) push(T2.x, T2.y, () => drawTank(ctx, M, FS * K, T2, tcfg2, T2.fl));
    for (const m of tmines) push(m.x, m.y, () => drawMine(M, m), -2);
    list.sort((a, b) => a.d - b.d);
    for (const it of list) it.f();
    // projéteis com brilho
    scr();
    ctx.globalCompositeOperation = "lighter";
    for (const p of [...tp, ...zp]) {
      const [sx, sy0] = wiso(p.x, p.y),
        sy = sy0 - p.h * K,
        [ex, ey0] = wiso(p.x - p.vx * 0.03, p.y - p.vy * 0.03),
        ey = ey0 - p.h * K;
      if (p.k === "acid") {
        ctx.drawImage(GL.g, sx - 5 * K, sy - 5 * K, 10 * K, 10 * K);
        continue;
      }
      if (p.k === "smk") {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#3a3d34";
        ctx.fillRect(sx - 1.5 * K, sy - 1.5 * K, 3 * K, 3 * K);
        ctx.globalCompositeOperation = "lighter";
        continue;
      }
      ctx.strokeStyle = p.k === "shell" || p.k === "msl" ? "rgba(255,170,70,.95)" : "rgba(255,228,150,.95)";
      ctx.lineWidth = (p.k === "shell" ? 1.4 : 0.7) * K;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      const r = (p.k === "shell" ? 4 : 2) * K;
      ctx.drawImage(p.k === "shell" ? GL.o : GL.y, sx - r, sy - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = "source-over";
    // partículas em pixel
    ctx.setTransform(FS * K, 0, 0, FS * K, -cam.x * FS, -cam.y * FS);
    for (const p of parts) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.globalAlpha = 1;
    // --- HUD da campanha (desenhado no canvas, por cima de tudo)
    ctx.setTransform(FS, 0, 0, FS, 0, 0);
    const st = tStats(),
      f = Math.max(0, T.hp / st.max),
      f2 = T2 ? Math.max(0, T2.hp / st.max) : 0,
      nests = LV.objs.filter((o) => o.nest).length;
    ctx.fillStyle = "rgba(13,18,8,.62)";
    ctx.fillRect(12, 12, 300, 142);
    ctx.font = "12px 'Press Start 2P',monospace";
    ctx.fillStyle = "#f2c230";
    ctx.fillText(`MISSÃO ${camp.m + 1}: ${LV.M.n.toUpperCase()}`, 22, 32);
    ctx.fillStyle = LV.done ? "#8be04f" : "#e6eed2";
    ctx.font = "10px 'Press Start 2P',monospace";
    ctx.fillText(
      LV.done ? "VÁ PARA A EXTRAÇÃO!" : `NINHOS: ${LV.M.nests - nests}/${LV.M.nests}${LV.M.boss ? " · CHEFÃO" : ""}`,
      22,
      50,
    );
    ctx.fillStyle = "#000";
    ctx.fillRect(22, 58, 190, 10);
    ctx.fillStyle = f > 0.5 ? "#6ee04a" : f > 0.25 ? "#f2c230" : "#e0533a";
    ctx.fillRect(22, 58, 190 * f, 10);
    ctx.fillStyle = "#e6eed2";
    ctx.fillText(`P1 ${Math.ceil(f * 100)}%`, 220, 68);
    ctx.fillStyle = "#000"; ctx.fillRect(22, 76, 190, 7);
    ctx.fillStyle = f2 > .5 ? "#59b9ff" : f2 > .25 ? "#f2c230" : "#e0533a";
    ctx.fillRect(22, 76, 190 * f2, 7);
    ctx.fillStyle = "#e6eed2"; ctx.fillText(`P2 ${T2 ? Math.ceil(f2 * 100) : "--"}%`, 220, 84);
    ctx.fillStyle = "#f2c230";
    ctx.fillText(`${money}  ★${score}`, 22, 102);
    // acessórios: o selecionado (L1/E) em destaque, e a fumaça (L2/Q)
    ctx.font = "9px 'Press Start 2P',monospace";
    let ax0 = 22;
    for (const k of [...SPECIALS, "smoke"]) {
      const a = acc[k],
        on = k === "smoke" || k === specSel;
      ctx.fillStyle = !a.own
        ? "rgba(230,238,210,.25)"
        : on
          ? k === "smoke"
            ? "#c8d0c0"
            : "#ff8a5a"
          : "rgba(230,238,210,.55)";
      const label = `${k === "missile" ? "LEVE" : k === "heavy" ? "PESADO" : k === "mine" ? "MINA" : "FUMAÇA"} ${a.own ? a.ammo : "-"}`;
      ctx.fillText(label, ax0, 116);
      if (on && a.own && k !== "smoke") ctx.fillRect(ax0, 120, ctx.measureText(label).width, 2);
      ax0 += ctx.measureText(label).width + 14;
    }
    // canhão / metralhadora
    const cf = 1 - Math.max(0, T.cd) / st.reload;
    ctx.fillStyle = "#000";
    ctx.fillRect(180, 80, 120, 5);
    ctx.fillRect(180, 90, 120, 5);
    ctx.fillStyle = cf >= 1 ? "#8be04f" : "#f2c230";
    ctx.fillRect(180, 80, 120 * Math.min(1, cf), 5);
    ctx.fillStyle = T.over ? "#ff5a2a" : T.heat > 0.7 ? "#ff9a3a" : "#e6eed2";
    ctx.fillRect(180, 90, 120 * T.heat, 5);
    // barra de progresso do mapa, com ninhos e extração
    const bw = Math.min(420, VWt * 0.36),
      bx = (VWt - bw) / 2,
      by = 18;
    ctx.fillStyle = "rgba(13,18,8,.62)";
    ctx.fillRect(bx - 8, by - 8, bw + 16, 22);
    ctx.fillStyle = "#3d5224";
    ctx.fillRect(bx, by, bw, 6);
    for (const o of LV.objs)
      if (o.nest) {
        ctx.fillStyle = "#b0ff5a";
        ctx.fillRect(bx + (o.x / LV.L) * bw - 2, by - 2, 5, 10);
      }
    ctx.fillStyle = LV.done ? "#8be04f" : "#f2c230";
    ctx.fillRect(bx + (LV.ex.x / LV.L) * bw - 2, by - 4, 4, 14);
    ctx.fillStyle = "#e6eed2";
    ctx.fillRect(bx + (T.x / LV.L) * bw - 4, by - 1, 8, 8);
    ctx.restore();
  }
  function tUI() {
    if (!T || !LV) return;
    const sl = `${ACC[specSel].n.toUpperCase()} · E / L1 · ${acc[specSel].own ? "x" + acc[specSel].ammo : "NÃO COLETADO"}`,
      fl = `FUMAÇA · Q / L2 ${acc.smoke.own ? "x" + acc.smoke.ammo : ""}`;
    if ($("tbSpec").textContent !== sl) $("tbSpec").textContent = sl;
    if ($("tbSmoke").textContent !== fl) $("tbSmoke").textContent = fl;
    const boss = tz.find((z) => z.d.big && !z.dead);
    if (boss) $("bossfill").style.width = Math.max(0, (boss.hp / boss.max) * 100) + "%";
    else if (!$("bossbar").hidden) $("bossbar").hidden = true;
  }

  /* ---------- controles: teclado, mouse e tela de toque ---------- */
  // W A S D = andar · setas = torreta · Espaço = canhão · Shift = metralhadora
  // E = acessório (míssil/mina) · Q = fumaça · Tab ou roda do mouse = troca o acessório
  const TANK_KEYS = new Set([
    "arrowup",
    "arrowdown",
    "arrowleft",
    "arrowright",
    "w",
    "a",
    "s",
    "d",
    " ",
    "shift",
    "e",
    "q",
    "tab",
  ]);
  function tKey(e, down) {
    const k = e.key.toLowerCase();
    if (!TANK_KEYS.has(k)) return false;
    e.preventDefault();
    if (down) {
      if (k === "tab" && !e.repeat) cycleSpec(1);
      tkeys.add(k);
      tin.touch = false;
      if (k.startsWith("arrow")) tin.mouse = null;
    } else tkeys.delete(k);
    return true;
  }
  addEventListener("keyup", (e) => {
    if (MODE === "tank") tKey(e, false);
  });
  addEventListener("blur", () => tkeys.clear());
  cv.addEventListener("pointermove", (e) => {
    if (MODE !== "tank" || e.pointerType !== "mouse") return;
    const r = cv.getBoundingClientRect(),
      sx = ((e.clientX - r.left) * VIEW.w) / r.width + cam.x,
      sy = ((e.clientY - r.top) * VIEW.h) / r.height + cam.y;
    tin.mouse = wunproject(sx, sy);
    tin.touch = false;
  });
  // mouse: botão esquerdo = canhão, botão direito = metralhadora
  cv.addEventListener("pointerdown", (e) => {
    if (MODE !== "tank" || state !== "play" || e.pointerType !== "mouse") return;
    if (e.button === 0) tin.cannon = true;
    if (e.button === 2) tin.mg = true;
  });
  addEventListener("pointerup", (e) => {
    if (MODE !== "tank" || e.pointerType !== "mouse") return;
    if (e.button === 0) tin.cannon = false;
    if (e.button === 2) tin.mg = false;
  });
  cv.addEventListener("contextmenu", (e) => MODE === "tank" && e.preventDefault());
  cv.addEventListener(
    "wheel",
    (e) => {
      if (MODE !== "tank" || state !== "play") return;
      e.preventDefault();
      cycleSpec(e.deltaY > 0 ? 1 : -1);
    },
    { passive: false },
  );
  // analógicos da tela (esquerdo = andar, direito = torreta)
  function stickCtl(el, key) {
    const knob = el.querySelector("i");
    let id = null;
    const set = (e) => {
      const r = el.getBoundingClientRect(),
        R = r.width / 2;
      let dx = (e.clientX - (r.left + R)) / R,
        dy = (e.clientY - (r.top + R)) / R;
      const m = Math.hypot(dx, dy);
      if (m > 1) {
        dx /= m;
        dy /= m;
      }
      tin[key] = { x: dx, y: dy };
      if (key === "joy2") tin.cannon = true;
      knob.style.transform = `translate(${dx * R * 0.6}px,${dy * R * 0.6}px)`;
    };
    el.addEventListener("pointerdown", (e) => {
      audio();
      id = e.pointerId;
      try {
        el.setPointerCapture(id);
      } catch (err) {}
      tin.touch = true;
      tin.mouse = null;
      set(e);
    });
    el.addEventListener("pointermove", (e) => e.pointerId === id && set(e));
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      tin[key] = null;
      if (key === "joy2") tin.cannon = false;
      knob.style.transform = "";
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }
  stickCtl($("joy"), "joy");
  stickCtl($("joy2"), "joy2");
  $("tbSwap").addEventListener("click", () => {
    audio();
    cycleSpec(1);
  });
  for (const [id, key] of [
    ["tbCannon", "cannon"],
    ["tbMG", "mg"],
    ["tbSpec", "spec"],
    ["tbSmoke", "smoke"],
  ]) {
    const b = $(id);
    b.addEventListener("pointerdown", (e) => {
      audio();
      e.preventDefault();
      try {
        b.setPointerCapture(e.pointerId);
      } catch (err) {}
      tin[key] = true;
      tin.touch = true;
      tin.mouse = null;
      b.classList.add("on");
    });
    const up = () => {
      tin[key] = false;
      b.classList.remove("on");
    };
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
  }
  $("tpause").addEventListener("click", () => {
    audio();
    togglePause();
  });

  /* ---------- layout + loop ---------- */
  function fit() {
    const st = $("stage");
    if (MODE === "tank") {
      // modo tanque: tela cheia, a largura da visão acompanha a proporção da tela
      const aw = st.clientWidth,
        ah = st.clientHeight;
      if (!aw || !ah) return;
      const dpr = devicePixelRatio || 1,
        vh = matchMedia("(pointer: coarse)").matches ? 560 : 680,
        vw = Math.round((vh * aw) / ah),
        s = ah / vh;
      VIEW.w = vw;
      VIEW.h = vh;
      cv.style.width = fxc.style.width = aw + "px";
      cv.style.height = fxc.style.height = ah + "px";
      CSS_S = s;
      const nf = Math.round(Math.min(1.6, s * dpr) * 20) / 20;
      if (nf !== FS || !vign || cv.width !== Math.round(vw * nf) || cv.height !== Math.round(vh * nf)) {
        FS = nf;
        fxc.width = cv.width = Math.round(vw * FS);
        fxc.height = cv.height = Math.round(vh * FS);
        buildVign();
      }
      return;
    }
    const aw = st.clientWidth - 10,
      ah = st.clientHeight - 12;
    const dpr = devicePixelRatio || 1;
    const s = Math.max(0.15, Math.min(aw / VW, ah / VH)); // tela virtual -> CSS px
    cv.style.width = fxc.style.width = Math.floor(VW * s) + "px";
    cv.style.height = fxc.style.height = Math.floor(VH * s) + "px";
    CSS_S = s;
    const nf = Math.round(Math.min(1.6, s * dpr) * 20) / 20; // pixels do canvas por unidade de tela
    if (nf !== FS || !vign || cv.width !== Math.round(VW * nf)) {
      FS = nf;
      fxc.width = cv.width = Math.round(VW * FS);
      fxc.height = cv.height = Math.round(VH * FS);
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
    if (state === "play") for (let i = 0; i < spd; i++) MODE === "tank" ? tUpdate(dt) : update(dt);
    if (state !== "pause") for (let i = 0; i < (state === "play" ? spd : 1); i++) stepFx(dt);
    trauma = Math.max(0, trauma - rdt * 1.3);
    flashA = Math.max(0, flashA - rdt * 2.2);
    const off = 7 * trauma * trauma,
      sx = rnd(-1, 1) * off,
      sy = rnd(-1, 1) * off * 0.7,
      tr = `translate(calc(-50% + ${(sx * K * CSS_S).toFixed(1)}px),calc(-50% + ${(sy * K * CSS_S).toFixed(1)}px))`;
    cv.style.transform = fxc.style.transform = tr;
    pollPad();
    if (MODE === "tank" && LV) {
      tRender();
      drawFx(-cam.x, -cam.y);
    } else {
      if (MODE !== "tank") render();
      drawFx(0, 0);
    }
    if (MODE === "tank") tUI();
    else updUI();
    if (state === "tsetup") drawPreview(now / 1000);
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
  var reloaded = false; // recarrega uma vez quando uma versão nova do app assume
  try {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost"))
      (navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!reloaded && state !== "play") {
          reloaded = true;
          location.reload();
        }
      }),
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })).catch(() => {});
  } catch (e) {}
}
