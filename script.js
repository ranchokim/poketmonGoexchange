const STORAGE_KEY = "pokemon-trades-v1";
const tradeForm = document.getElementById("tradeForm");
const tradeList = document.getElementById("tradeList");
const searchForm = document.getElementById("searchForm");

let trades = loadTrades();
renderTrades(trades);

tradeForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const pokemon = document.getElementById("pokemonInput").value.trim();
  const lat = parseFloat(document.getElementById("latInput").value);
  const lng = parseFloat(document.getElementById("lngInput").value);
  const description = document.getElementById("descriptionInput").value.trim();

  if (!pokemon || Number.isNaN(lat) || Number.isNaN(lng)) {
    alert("포켓몬 이름과 좌표를 정확히 입력해 주세요.");
    return;
  }

  const trade = {
    id: crypto.randomUUID(),
    pokemon,
    lat,
    lng,
    description,
    createdAt: new Date().toISOString(),
    comments: [],
  };

  trades.unshift(trade);
  saveTrades();
  renderTrades(trades);
  tradeForm.reset();
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const searchPokemon = document.getElementById("searchPokemon").value.trim().toLowerCase();
  const latRaw = document.getElementById("searchLat").value;
  const lngRaw = document.getElementById("searchLng").value;

  let filtered = [...trades];

  if (searchPokemon) {
    filtered = filtered.filter((trade) => trade.pokemon.toLowerCase().includes(searchPokemon));
  }

  if (latRaw && lngRaw) {
    const baseLat = parseFloat(latRaw);
    const baseLng = parseFloat(lngRaw);

    if (Number.isNaN(baseLat) || Number.isNaN(baseLng)) {
      alert("검색 좌표를 숫자로 입력해 주세요.");
      return;
    }

    filtered = filtered.filter((trade) => getDistanceKm(baseLat, baseLng, trade.lat, trade.lng) <= 2);
  }

  renderTrades(filtered);
});

tradeList.addEventListener("click", (event) => {
  const target = event.target;

  if (target.matches(".add-comment")) {
    const tradeId = target.dataset.tradeId;
    const input = document.querySelector(`input[data-comment-input='${tradeId}']`);
    const message = input.value.trim();
    if (!message) return;

    const trade = trades.find((item) => item.id === tradeId);
    trade.comments.push({
      id: crypto.randomUUID(),
      message,
      createdAt: new Date().toISOString(),
      replies: [],
    });

    saveTrades();
    renderTrades(trades);
  }

  if (target.matches(".add-reply")) {
    const tradeId = target.dataset.tradeId;
    const commentId = target.dataset.commentId;
    const input = document.querySelector(`input[data-reply-input='${commentId}']`);
    const message = input.value.trim();
    if (!message) return;

    const trade = trades.find((item) => item.id === tradeId);
    const comment = trade.comments.find((item) => item.id === commentId);

    comment.replies.push({
      id: crypto.randomUUID(),
      message,
      createdAt: new Date().toISOString(),
    });

    saveTrades();
    renderTrades(trades);
  }
});

function renderTrades(list) {
  if (!list.length) {
    tradeList.innerHTML = "<p>등록된 교환 글이 없습니다.</p>";
    return;
  }

  tradeList.innerHTML = list
    .map(
      (trade) => `
      <article class="trade-item">
        <h3>${escapeHtml(trade.pokemon)}</h3>
        <p class="trade-meta">좌표: (${trade.lat.toFixed(6)}, ${trade.lng.toFixed(6)}) · 작성일: ${formatDate(
        trade.createdAt,
      )}</p>
        <p>${escapeHtml(trade.description || "(상세 설명 없음)")}</p>

        <div class="comment-box">
          <input data-comment-input="${trade.id}" type="text" placeholder="이 글에 교환 요청 댓글 달기" />
          <button class="add-comment" data-trade-id="${trade.id}">댓글 등록</button>
        </div>

        <div class="comment-list">
          ${trade.comments
            .map(
              (comment) => `
                <div class="comment-item">
                  <strong>댓글</strong>: ${escapeHtml(comment.message)}
                  <div class="trade-meta">${formatDate(comment.createdAt)}</div>

                  <div class="reply-box">
                    <input data-reply-input="${comment.id}" type="text" placeholder="답글 작성" />
                    <button class="add-reply" data-trade-id="${trade.id}" data-comment-id="${comment.id}">답글 등록</button>
                  </div>

                  <div class="reply-list">
                    ${comment.replies
                      .map(
                        (reply) => `
                          <div class="reply-item">
                            <strong>답글</strong>: ${escapeHtml(reply.message)}
                            <div class="trade-meta">${formatDate(reply.createdAt)}</div>
                          </div>
                        `,
                      )
                      .join("")}
                  </div>
                </div>
              `,
            )
            .join("")}
        </div>
      </article>
      `,
    )
    .join("");
}

function loadTrades() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTrades() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString("ko-KR", { hour12: false });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
