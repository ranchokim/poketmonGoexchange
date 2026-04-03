const tradeForm = document.getElementById("tradeForm");
const tradeList = document.getElementById("tradeList");
const searchForm = document.getElementById("searchForm");

let currentTrades = [];
let currentQuery = { pokemon: "", lat: "", lng: "" };

loadTrades();

tradeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const pokemon = document.getElementById("pokemonInput").value.trim();
  const lat = parseFloat(document.getElementById("latInput").value);
  const lng = parseFloat(document.getElementById("lngInput").value);
  const description = document.getElementById("descriptionInput").value.trim();

  if (!pokemon || Number.isNaN(lat) || Number.isNaN(lng)) {
    alert("포켓몬 이름과 좌표를 정확히 입력해 주세요.");
    return;
  }

  const response = await fetch("/api/trades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pokemon, lat, lng, description }),
  });

  if (!response.ok) {
    const error = await response.json();
    alert(error.error || "등록 실패");
    return;
  }

  tradeForm.reset();
  await loadTrades(currentQuery);
});

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  currentQuery = {
    pokemon: document.getElementById("searchPokemon").value.trim(),
    lat: document.getElementById("searchLat").value.trim(),
    lng: document.getElementById("searchLng").value.trim(),
  };

  await loadTrades(currentQuery);
});

tradeList.addEventListener("click", async (event) => {
  const target = event.target;

  if (target.matches(".add-comment")) {
    const tradeId = target.dataset.tradeId;
    const input = document.querySelector(`input[data-comment-input='${tradeId}']`);
    const message = input.value.trim();
    if (!message) return;

    await addComment(tradeId, message, null);
    await loadTrades(currentQuery);
    return;
  }

  if (target.matches(".add-reply")) {
    const tradeId = target.dataset.tradeId;
    const commentId = target.dataset.commentId;
    const input = document.querySelector(`input[data-reply-input='${commentId}']`);
    const message = input.value.trim();
    if (!message) return;

    await addComment(tradeId, message, commentId);
    await loadTrades(currentQuery);
    return;
  }

  if (target.matches(".toggle-complete")) {
    const tradeId = target.dataset.tradeId;
    const nextStatus = target.dataset.isCompleted !== "true";

    const response = await fetch(`/api/trades/${tradeId}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: nextStatus }),
    });

    if (!response.ok) {
      const error = await response.json();
      alert(error.error || "상태 변경 실패");
      return;
    }

    await loadTrades(currentQuery);
  }
});

async function addComment(tradeId, message, parentId) {
  const response = await fetch(`/api/trades/${tradeId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, parentId }),
  });

  if (!response.ok) {
    const error = await response.json();
    alert(error.error || "댓글 저장 실패");
  }
}

async function loadTrades({ pokemon = "", lat = "", lng = "" } = {}) {
  const query = new URLSearchParams();
  if (pokemon) query.append("pokemon", pokemon);
  if (lat && lng) {
    query.append("lat", lat);
    query.append("lng", lng);
    query.append("radiusKm", "2");
  }

  const response = await fetch(`/api/trades?${query.toString()}`);

  if (!response.ok) {
    tradeList.innerHTML = "<p>데이터를 불러오는 중 오류가 발생했습니다.</p>";
    return;
  }

  currentTrades = await response.json();
  renderTrades(currentTrades);
}

function renderTrades(trades) {
  if (!trades.length) {
    tradeList.innerHTML = "<p>검색 결과가 없습니다.</p>";
    return;
  }

  tradeList.innerHTML = trades
    .map(
      (trade) => `
      <article class="trade-item ${trade.isCompleted ? "completed" : ""}">
        <div class="trade-title-row">
          <h3>${escapeHtml(trade.pokemon)}</h3>
          <span class="status ${trade.isCompleted ? "done" : "open"}">
            ${trade.isCompleted ? "교환 완료" : "교환 가능"}
          </span>
        </div>

        <p class="trade-meta">📍 (${Number(trade.lat).toFixed(6)}, ${Number(trade.lng).toFixed(6)}) · ${formatDate(
        trade.createdAt,
      )}</p>
        <p>${escapeHtml(trade.description || "(상세 설명 없음)")}</p>

        <button class="toggle-complete" data-trade-id="${trade.id}" data-is-completed="${trade.isCompleted}">
          ${trade.isCompleted ? "다시 교환 가능으로 변경" : "교환 완료 처리"}
        </button>

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

function formatDate(dateString) {
  return new Date(dateString).toLocaleString("ko-KR", { hour12: false });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
