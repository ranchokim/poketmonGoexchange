const path = require("path");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "exchange.db");
const db = new sqlite3.Database(DB_PATH);

app.use(express.json());
app.use(express.static(__dirname));

initializeDatabase();

app.get("/api/trades", (req, res) => {
  const { pokemon = "", lat, lng, radiusKm = "2" } = req.query;
  const pokemonFilter = `%${String(pokemon).trim()}%`;

  db.all(
    `SELECT
      id,
      wanted_pokemon AS wantedPokemon,
      offered_pokemon AS offeredPokemon,
      lat,
      lng,
      location_label AS locationLabel,
      description,
      is_completed AS isCompleted,
      created_at AS createdAt
     FROM trades
     WHERE wanted_pokemon LIKE ? OR offered_pokemon LIKE ?
     ORDER BY created_at DESC`,
    [pokemonFilter, pokemonFilter],
    (tradeError, trades) => {
      if (tradeError) {
        return res.status(500).json({ error: "교환 글을 불러오지 못했습니다." });
      }

      db.all(
        `SELECT id, trade_id AS tradeId, parent_id AS parentId, message, created_at AS createdAt
         FROM comments
         ORDER BY created_at ASC`,
        [],
        (commentError, comments) => {
          if (commentError) {
            return res.status(500).json({ error: "댓글을 불러오지 못했습니다." });
          }

          const tradeMap = new Map(
            trades.map((trade) => [trade.id, { ...trade, isCompleted: !!trade.isCompleted, comments: [] }]),
          );
          const commentMap = new Map(comments.map((comment) => [comment.id, { ...comment, replies: [] }]));

          commentMap.forEach((comment) => {
            if (comment.parentId) {
              const parent = commentMap.get(comment.parentId);
              if (parent) parent.replies.push(comment);
            } else {
              const trade = tradeMap.get(comment.tradeId);
              if (trade) trade.comments.push(comment);
            }
          });

          let result = [...tradeMap.values()];
          if (lat && lng) {
            const baseLat = Number(lat);
            const baseLng = Number(lng);
            const limitKm = Number(radiusKm) || 2;

            if (Number.isNaN(baseLat) || Number.isNaN(baseLng)) {
              return res.status(400).json({ error: "검색 좌표는 숫자여야 합니다." });
            }

            result = result.filter((trade) => getDistanceKm(baseLat, baseLng, trade.lat, trade.lng) <= limitKm);
          }

          return res.json(result);
        },
      );
    },
  );
});

app.post("/api/trades", (req, res) => {
  const {
    wantedPokemon,
    offeredPokemon,
    lat,
    lng,
    locationLabel = "",
    description = "",
  } = req.body;

  if (!wantedPokemon || !offeredPokemon || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
    return res.status(400).json({ error: "포켓몬 이름/좌표를 정확히 입력해 주세요." });
  }

  db.run(
    `INSERT INTO trades (wanted_pokemon, offered_pokemon, lat, lng, location_label, description, is_completed)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [
      String(wantedPokemon).trim(),
      String(offeredPokemon).trim(),
      Number(lat),
      Number(lng),
      String(locationLabel).trim(),
      String(description).trim(),
    ],
    function insertTrade(insertError) {
      if (insertError) {
        return res.status(500).json({ error: "교환 글 저장 중 오류가 발생했습니다." });
      }

      db.get(
        `SELECT
          id,
          wanted_pokemon AS wantedPokemon,
          offered_pokemon AS offeredPokemon,
          lat,
          lng,
          location_label AS locationLabel,
          description,
          is_completed AS isCompleted,
          created_at AS createdAt
         FROM trades WHERE id = ?`,
        [this.lastID],
        (selectError, trade) => {
          if (selectError) {
            return res.status(500).json({ error: "저장된 글 조회에 실패했습니다." });
          }

          return res.status(201).json({ ...trade, isCompleted: !!trade.isCompleted, comments: [] });
        },
      );
    },
  );
});

app.patch("/api/trades/:id/complete", (req, res) => {
  const tradeId = Number(req.params.id);
  const { isCompleted } = req.body;

  if (Number.isNaN(tradeId) || typeof isCompleted !== "boolean") {
    return res.status(400).json({ error: "잘못된 요청입니다." });
  }

  db.run(
    `UPDATE trades SET is_completed = ? WHERE id = ?`,
    [isCompleted ? 1 : 0, tradeId],
    function updateErrorHandler(updateError) {
      if (updateError) {
        return res.status(500).json({ error: "교환 상태 변경 실패" });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "대상을 찾을 수 없습니다." });
      }
      return res.json({ id: tradeId, isCompleted });
    },
  );
});

app.post("/api/trades/:id/comments", (req, res) => {
  const tradeId = Number(req.params.id);
  const { message, parentId = null } = req.body;

  if (Number.isNaN(tradeId) || !String(message || "").trim()) {
    return res.status(400).json({ error: "댓글 내용을 입력해 주세요." });
  }

  if (parentId !== null && Number.isNaN(Number(parentId))) {
    return res.status(400).json({ error: "잘못된 답글 대상입니다." });
  }

  db.run(
    `INSERT INTO comments (trade_id, parent_id, message)
     VALUES (?, ?, ?)`,
    [tradeId, parentId === null ? null : Number(parentId), String(message).trim()],
    function insertComment(insertError) {
      if (insertError) {
        return res.status(500).json({ error: "댓글 저장 실패" });
      }

      db.get(
        `SELECT id, trade_id AS tradeId, parent_id AS parentId, message, created_at AS createdAt
         FROM comments WHERE id = ?`,
        [this.lastID],
        (selectError, comment) => {
          if (selectError) {
            return res.status(500).json({ error: "댓글 조회 실패" });
          }
          return res.status(201).json({ ...comment, replies: [] });
        },
      );
    },
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wanted_pokemon TEXT NOT NULL DEFAULT '',
        offered_pokemon TEXT NOT NULL DEFAULT '',
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        location_label TEXT,
        description TEXT,
        is_completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trade_id INTEGER NOT NULL,
        parent_id INTEGER,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
      )
    `);

    runSafeMigration("ALTER TABLE trades ADD COLUMN wanted_pokemon TEXT NOT NULL DEFAULT ''");
    runSafeMigration("ALTER TABLE trades ADD COLUMN offered_pokemon TEXT NOT NULL DEFAULT ''");
    runSafeMigration("ALTER TABLE trades ADD COLUMN location_label TEXT");

  });
}

function runSafeMigration(sql) {
  db.run(sql, (error) => {
    if (error && !String(error.message).includes("duplicate column name")) {
      console.error("Migration error:", error.message);
    }
  });
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
