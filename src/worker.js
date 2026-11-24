// Arena Verde — Cloudflare Worker: serve o jogo (public/) e o ranking global no D1.
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/scores') {
      if (request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT name, score, wave, created_at FROM scores ORDER BY score DESC, id ASC LIMIT 10'
        ).all();
        return json({ scores: results });
      }
      if (request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
        const name = String(body.name || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim().slice(0, 12);
        const score = Math.floor(Number(body.score));
        const wave = Math.floor(Number(body.wave));
        if (!name || !Number.isFinite(score) || score < 0 || score > 10_000_000 || !Number.isFinite(wave) || wave < 0 || wave > 1000)
          return json({ error: 'dados inválidos' }, 400);
        await env.DB.prepare('INSERT INTO scores (name, score, wave) VALUES (?1, ?2, ?3)').bind(name, score, wave).run();
        return json({ ok: true }, 201);
      }
      return json({ error: 'método não permitido' }, 405);
    }
    return env.ASSETS.fetch(request);
  },
};
