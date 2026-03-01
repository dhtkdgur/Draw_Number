# CLAUDE.md — Draw_number

실시간 번호 뽑기 웹 애플리케이션. 바닐라 HTML/CSS/JS + Vercel Serverless + Supabase.

---

## 기술 스택

- **Frontend**: 바닐라 HTML5/CSS3/JavaScript (프레임워크 없음, 외부 CSS 파일 없음)
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Supabase (PostgreSQL)
- **Testing**: Playwright E2E
- **배포**: Vercel

---

## 프로젝트 구조

```
Draw_number/
├── admin.html              # 관리자 대시보드 (세션 설정, QR코드, 통계)
├── draw.html               # 참가자 번호 뽑기 (슬롯머신 애니메이션, confetti)
├── api/
│   ├── start-session.js    # 세션 생성 + 번호 풀 초기화
│   ├── draw-number.js      # 번호 뽑기 (PostgreSQL RPC 호출)
│   ├── session-status.js   # 세션 상태 조회
│   └── reset-session.js    # 세션 초기화
├── tests/app.spec.js       # Playwright E2E 테스트 (22개 케이스)
├── supabase-schema.sql     # DB 스키마 + draw_number RPC 함수
└── vercel.json             # 배포 설정 + URL 라우팅
```

---

## 스타일 규칙

### 색상 시스템 (CSS 변수 — :root에 정의)
| 변수 | 값 | 용도 |
|---|---|---|
| `--bg` | `#582B2B` | 메인 배경 (와인 레드) |
| `--bg2` | `#3D1A1A` | 서브 배경 |
| `--bg3` | `#4A2323` | 강조 배경 |
| `--text` | `#FAECB6` | 기본 텍스트 (크림 옐로) |
| `--muted` | `#C9A96E` | 보조 텍스트 (앰버 톤) |
| `--a` | `#F9A822` | A 선택지 / 강조 (황금) |
| `--b` | `#E8874A` | B 선택지 (앰버-오렌지) |
| `--accent` | `#C87A40` | 액센트 (구 --green, 이름 변경) |
| `--border` | `#7A4040` | 테두리 |
| `--focus-ring` | `#F9A822` | 포커스 인디케이터 |

### border-radius (3단계만 사용)
- `--radius-sm`: 8px
- `--radius-md`: 12px
- `--radius-lg`: 20px
- `--radius-pill`: 9999px

### box-shadow (3단계)
- `--shadow-sm`, `--shadow-md`, `--shadow-lg`

### 인터랙션
- hover: `translateY(-5px) scale(1.01)` + shadow (brightness() 사용 금지)
- transition: `transform 80ms`, `box-shadow 150ms`
- `:focus-visible` 포커스 링 필수 적용

### 폰트
- 스택: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- 큰 제목: `letter-spacing: -0.02em`
- `font-smoothing: antialiased`

---

## 코딩 규칙

### 일반
- 모든 스타일은 각 HTML 파일의 `<style>` 태그 안에 인라인으로 작성 (외부 CSS 파일 없음)
- CSS 변수는 반드시 `:root`에 정의 후 사용
- `var(--ease-spring)` 사용 금지 — transition에 직접 값 작성
- `backdrop-filter: blur()` 사용 전 성능 검토 필수

### JavaScript
- 프레임워크 없음, 순수 Vanilla JS
- API 호출은 `fetch()` 사용
- 에러 핸들링 필수 (try/catch 또는 .catch())

### API (Vercel Serverless)
- 모든 엔드포인트는 `api/` 폴더
- Supabase RPC 함수 호출 방식 유지
- 동시성 제어: PostgreSQL `FOR UPDATE SKIP LOCKED` (절대 변경 금지)
- 멱등성 보장: 같은 참가자 토큰 → 항상 같은 번호

---

## 핵심 제약사항

- **중복 배정 방지 로직 절대 수정 금지** — `draw-number.js`의 RPC 호출 방식
- **최대 1000명** 지원 구조 유지
- 색상 변경 시 반드시 CSS 변수만 수정 (하드코딩 금지)
- `--a`와 `--accent`는 다른 색상 유지 (시각적 구별 필요)

---

## 개발 명령어

```bash
# 로컬 개발 (Vercel CLI 필요)
vercel dev

# E2E 테스트
npx playwright test
npx playwright test --ui    # UI 모드

# 배포
vercel --prod
```

---

## 현재 작업 브랜치

`design/wine-theme` — 와인 레드 테마 디자인 개선 작업 중