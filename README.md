# 포켓몬GO 교환 게시판

Express + SQLite 기반의 로컬 웹앱입니다.

- 교환 글 작성 (원하는 포켓몬 / 내가 줄 포켓몬 / 위치 / 설명)
- 댓글 / 답글 기능
- 포켓몬 검색 + 위치 반경 2km 검색
- 교환 완료 처리
- Google Ad 슬롯(placeholder)

---

## 1) 요구 사항

- Node.js 18 이상 (권장: 20+)
- npm

확인:

```bash
node -v
npm -v
```

---

## 2) 설치

프로젝트 루트에서:

```bash
npm install
```

설치되면 `node_modules/`가 생성됩니다.

---

## 3) 로컬 실행

```bash
npm start
```

실행 후 브라우저에서 아래 주소 접속:

- <http://localhost:3000>

서버는 시작 시 `exchange.db` SQLite 파일을 자동 생성/사용합니다.

---

## 4) 실제 로컬에서 동작시키는 방법 (빠른 순서)

1. 터미널에서 프로젝트 폴더로 이동
2. `npm install`
3. `npm start`
4. 브라우저에서 `http://localhost:3000` 열기
5. 교환 글 작성 후 목록/검색/댓글/답글/교환완료 기능 확인

---

## 5) 위치 입력 규칙

작성/검색 시 위치 입력은 아래 2가지 모두 지원합니다.

1. **위도,경도**
   - 예: `37.5665,126.9780`
2. **장소명**
   - 예: `서울시청`, `강남역`

장소명은 OpenStreetMap Nominatim API로 좌표 변환 후 사용됩니다.

> 인터넷이 끊겨 있거나 지오코딩 API 응답이 실패하면 장소명 검색/등록이 실패할 수 있습니다.

---

## 6) 데이터 저장 위치

- DB 파일: `exchange.db`
- DB 테이블: `trades`, `comments`

`.gitignore`에 따라 DB 파일은 Git에 포함되지 않습니다.

---

## 7) 주요 API

- `GET /api/trades`
  - 쿼리: `pokemon`, `lat`, `lng`, `radiusKm`
- `POST /api/trades`
- `PATCH /api/trades/:id/complete`
- `POST /api/trades/:id/comments`

---

## 8) 트러블슈팅

### Q. `Cannot find module 'express'` 에러가 나요

의존성이 설치되지 않은 상태입니다.

```bash
npm install
```

### Q. 포트 충돌이 나요

3000 포트를 이미 쓰고 있으면 기존 프로세스를 종료하거나 다른 포트로 실행하세요.

```bash
PORT=3001 npm start
```

접속 주소도 `http://localhost:3001`로 변경됩니다.

---

## 9) 참고

- Google Ad 영역은 placeholder 상태입니다. 실제 배포 시 본인 AdSense `data-ad-client`, `data-ad-slot` 값으로 교체하세요.
