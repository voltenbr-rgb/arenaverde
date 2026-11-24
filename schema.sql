-- Arena Verde — esquema do banco D1 (SQLite)
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL DEFAULT '',
  apelido TEXT NOT NULL,
  nivel INTEGER NOT NULL DEFAULT 1,          -- maior onda já alcançada
  token TEXT NOT NULL,                        -- segredo do jogador (guardado só no aparelho dele)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS progresso (
  player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  wave_atual INTEGER NOT NULL DEFAULT 1,
  moedas INTEGER NOT NULL DEFAULT 350,
  pontuacao INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cartas_desbloqueadas (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  carta_id TEXT NOT NULL,
  PRIMARY KEY (player_id, carta_id)
);

CREATE TABLE IF NOT EXISTS ranking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  pontuacao INTEGER NOT NULL,
  wave_maxima INTEGER NOT NULL,
  zumbis_mortos INTEGER NOT NULL,
  data TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ranking_pontuacao ON ranking(pontuacao DESC);
