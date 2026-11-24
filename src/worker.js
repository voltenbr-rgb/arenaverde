// Arena Verde — Cloudflare Worker
// Serve o jogo (pasta public/) e a API que salva tudo no banco D1 "arenaverde".
//
// Rotas:
//   POST /api/players        { nome, apelido }                         -> { id, token }
//   GET  /api/progress       (cabeçalhos do jogador)                   -> { progresso, cartas }
//   PUT  /api/progress       { wave_atual, moedas, pontuacao }
//   POST /api/unlock         { carta_id }
//   POST /api/ranking        { pontuacao, wave_maxima, zumbis_mortos }
//   GET  /api/ranking                                                  -> { ranking: top 10 }
//
// Rotas que mudam dados de um jogador pedem os cabeçalhos x-player-id e x-player-token.
// O token é criado aqui e fica guardado só no aparelho do jogador.

const CARTAS = new Set(["rifle", "grenade", "tank", "missile", "mine", "wire", "mg", "mortar"]);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const int = (v, min, max) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const clean = (s, max) =>
  String(s || "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .trim()
    .slice(0, max);

async function body(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Confere id + token do jogador
async function auth(request, env) {
  const id = int(request.headers.get("x-player-id"), 1, 1e12);
  const token = request.headers.get("x-player-token") || "";
  if (!id || token.length < 20) return null;
  const row = await env.DB.prepare("SELECT id FROM players WHERE id = ?1 AND token = ?2").bind(id, token).first();
  return row ? id : null;
}

async function api(request, env, path) {
  const m = request.method;

  if (path === "players" && m === "POST") {
    const b = await body(request);
    const apelido = clean(b && b.apelido, 12)
      .toUpperCase()
      .replace(/[^A-Z0-9 _-]/g, "");
    if (!apelido) return json({ error: "apelido obrigatório" }, 400);
    const nome = clean(b.nome, 30);
    const token = crypto.randomUUID() + crypto.randomUUID();
    const r = await env.DB.prepare("INSERT INTO players (nome, apelido, token) VALUES (?1, ?2, ?3)")
      .bind(nome, apelido, token)
      .run();
    return json({ id: r.meta.last_row_id, token }, 201);
  }

  if (path === "ranking" && m === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT p.apelido, r.pontuacao, r.wave_maxima, r.zumbis_mortos, r.data
         FROM ranking r JOIN players p ON p.id = r.player_id
        ORDER BY r.pontuacao DESC, r.id ASC LIMIT 10`,
    ).all();
    return json({ ranking: results });
  }

  // daqui em diante: precisa ser o próprio jogador
  const pid = await auth(request, env);
  if (!pid) return json({ error: "jogador não autenticado" }, 401);

  if (path === "progress" && m === "GET") {
    const progresso = await env.DB.prepare("SELECT wave_atual, moedas, pontuacao FROM progresso WHERE player_id = ?1")
      .bind(pid)
      .first();
    const { results } = await env.DB.prepare("SELECT carta_id FROM cartas_desbloqueadas WHERE player_id = ?1")
      .bind(pid)
      .all();
    return json({ progresso, cartas: results.map((r) => r.carta_id) });
  }

  if (path === "progress" && m === "PUT") {
    const b = await body(request);
    const w = int(b && b.wave_atual, 1, 11),
      mo = int(b && b.moedas, 0, 1e7),
      pt = int(b && b.pontuacao, 0, 1e8);
    if (w == null || mo == null || pt == null) return json({ error: "dados inválidos" }, 400);
    await env.DB.prepare(
      `INSERT INTO progresso (player_id, wave_atual, moedas, pontuacao, updated_at) VALUES (?1, ?2, ?3, ?4, datetime('now'))
       ON CONFLICT(player_id) DO UPDATE SET wave_atual = ?2, moedas = ?3, pontuacao = ?4, updated_at = datetime('now')`,
    )
      .bind(pid, w, mo, pt)
      .run();
    await env.DB.prepare("UPDATE players SET nivel = MAX(nivel, ?2) WHERE id = ?1").bind(pid, w).run();
    return json({ ok: true });
  }

  if (path === "unlock" && m === "POST") {
    const b = await body(request);
    const carta = clean(b && b.carta_id, 20);
    if (!CARTAS.has(carta)) return json({ error: "carta inválida" }, 400);
    await env.DB.prepare("INSERT OR IGNORE INTO cartas_desbloqueadas (player_id, carta_id) VALUES (?1, ?2)")
      .bind(pid, carta)
      .run();
    return json({ ok: true });
  }

  if (path === "ranking" && m === "POST") {
    const b = await body(request);
    const pt = int(b && b.pontuacao, 0, 1e8),
      w = int(b && b.wave_maxima, 0, 10),
      k = int(b && b.zumbis_mortos, 0, 1e6);
    if (pt == null || w == null || k == null) return json({ error: "dados inválidos" }, 400);
    await env.DB.prepare(
      "INSERT INTO ranking (player_id, pontuacao, wave_maxima, zumbis_mortos) VALUES (?1, ?2, ?3, ?4)",
    )
      .bind(pid, pt, w, k)
      .run();
    await env.DB.prepare("UPDATE players SET nivel = MAX(nivel, ?2) WHERE id = ?1").bind(pid, w).run();
    return json({ ok: true }, 201);
  }

  return json({ error: "rota não encontrada" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(request, env, url.pathname.slice(5));
      } catch (e) {
        return json({ error: "erro interno" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
