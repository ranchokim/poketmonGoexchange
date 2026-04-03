const tradeForm = document.getElementById("tradeForm");
const tradeList = document.getElementById("tradeList");
const searchForm = document.getElementById("searchForm");

let currentQuery = { pokemon: "", lat: "", lng: "" };

loadTrades();

tradeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const wantedPokemon = document.getElementById("wantedPokemonInput").value.trim();
  const offeredPokemon = document.getElementById("offeredPokemonInput").value.trim();
  const locationInput = document.getElementById("locationInput").value.trim();
  const description = document.getElementById("descriptionInput").value.trim();

  if (!wantedPokemon || !offeredPokemon || !locationInput) {
    alert("받고 싶은 포켓몬, 교환할 포켓몬, 위치를 입력해 주세요.");
    return;
  }

  const location = await resolveLocationInput(locationInput);
  if (!location) {
    alert("위치를 찾을 수 없습니다. '위도,경도' 또는 정확한 장소명을 입력해 주세요.");
    return;
  }

  const response = await fetch("/api/trades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wantedPokemon,
      offeredPokemon,
      lat: location.lat,
      lng: location.lng,
      locationLabel: location.label,
      description,
    }),
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

  const pokemon = document.getElementById("searchPokemon").value.trim();
  const searchLocation = document.getElementById("searchLocation").value.trim();

  let lat = "";
  let lng = "";

  if (searchLocation) {
    const location = await resolveLocationInput(searchLocation);
    if (!location) {
      alert("검색 위치를 찾을 수 없습니다. '위도,경도' 또는 정확한 장소명을 입력해 주세요.");
      return;
    }
    lat = String(location.lat);
    lng = String(location.lng);
  }

  currentQuery = { pokemon, lat, lng };
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

  const trades = await response.json();
  renderTrades(trades);
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
          <h3>원함: ${escapeHtml(trade.wantedPokemon)}</h3>
          <span class="status ${trade.isCompleted ? "done" : "open"}">
            ${trade.isCompleted ? "교환 완료" : "교환 가능"}
          </span>
        </div>

        <p class="trade-exchange">내가 줄 포켓몬: <strong>${escapeHtml(trade.offeredPokemon)}</strong></p>
        <p class="trade-meta">📍 ${escapeHtml(trade.locationLabel || `${Number(trade.lat).toFixed(6)}, ${Number(trade.lng).toFixed(6)}`)} · ${formatDate(
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

async function resolveLocationInput(input) {
  const coordMatch = input.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coordMatch) {
    return {
      lat: Number(coordMatch[1]),
      lng: Number(coordMatch[2]),
      label: `${coordMatch[1]}, ${coordMatch[2]}`,
    };
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ko&q=${encodeURIComponent(input)}`,
    );
    if (!response.ok) return null;

    const result = await response.json();
    if (!result.length) return null;

    return {
      lat: Number(result[0].lat),
      lng: Number(result[0].lon),
      label: result[0].display_name || input,
    };
  } catch {
    return null;
  }
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
