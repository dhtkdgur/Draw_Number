// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = 'https://draw-number-smoky.vercel.app';

// ──────────────────────────────────────────────────────────
// 헬퍼: 세션 초기화 (각 테스트 격리용)
// ──────────────────────────────────────────────────────────
async function resetSession(request) {
  await request.post(`${BASE}/api/reset-session`);
}

async function startSession(request, totalCount = 5) {
  await request.post(`${BASE}/api/start-session`, {
    data: { total_count: totalCount },
  });
}

// ──────────────────────────────────────────────────────────
// Admin 페이지 테스트
// ──────────────────────────────────────────────────────────
test.describe('Admin 페이지', () => {

  test('세션 없을 때 설정 화면이 표시된다', async ({ page, request }) => {
    await resetSession(request);
    await page.goto('/');

    // 로딩 후 설정 화면 진입
    await expect(page.locator('#view-setup')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#inp-count')).toBeVisible();
    await expect(page.locator('#btn-start')).toBeVisible();

    // 현황 화면은 숨겨져 있어야 함
    await expect(page.locator('#view-active')).toBeHidden();
  });

  test('인원수 미입력 시 세션 시작이 거부된다', async ({ page, request }) => {
    await resetSession(request);
    await page.goto('/');
    await expect(page.locator('#view-setup')).toBeVisible({ timeout: 8000 });

    // 빈 상태로 시작 버튼 클릭
    await page.locator('#btn-start').click();

    // 토스트 에러 메시지 표시
    await expect(page.locator('.toast.error')).toBeVisible({ timeout: 4000 });
    // 여전히 설정 화면
    await expect(page.locator('#view-setup')).toBeVisible();
  });

  test('범위 초과 인원수 입력 시 세션 시작이 거부된다', async ({ page, request }) => {
    await resetSession(request);
    await page.goto('/');
    await expect(page.locator('#view-setup')).toBeVisible({ timeout: 8000 });

    await page.locator('#inp-count').fill('9999');
    await page.locator('#btn-start').click();

    await expect(page.locator('.toast.error')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('#view-setup')).toBeVisible();
  });

  test('올바른 인원수 입력 시 세션이 시작되고 현황 화면으로 전환된다', async ({ page, request }) => {
    await resetSession(request);
    await page.goto('/');
    await expect(page.locator('#view-setup')).toBeVisible({ timeout: 8000 });

    await page.locator('#inp-count').fill('10');
    await page.locator('#btn-start').click();

    // 현황 화면 전환
    await expect(page.locator('#view-active')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#view-setup')).toBeHidden();

    // 통계 표시
    await expect(page.locator('#stat-total')).toHaveText('10');
    await expect(page.locator('#stat-drawn')).toHaveText('0');
  });

  test('현황 화면에 QR 이미지와 URL이 표시된다', async ({ page, request }) => {
    await resetSession(request);
    await startSession(request, 10);
    await page.goto('/');

    await expect(page.locator('#view-active')).toBeVisible({ timeout: 8000 });

    // QR 이미지 로드 확인
    const qrImg = page.locator('#qr-img');
    await expect(qrImg).toBeVisible();
    await expect(qrImg).toHaveAttribute('src', /qrserver\.com/);

    // draw URL 텍스트 확인
    const urlText = page.locator('#draw-url-text');
    await expect(urlText).toContainText('/draw.html');
  });

  test('URL 복사 버튼이 동작한다', async ({ page, request, context }) => {
    await resetSession(request);
    await startSession(request, 10);
    await page.goto('/');
    await expect(page.locator('#view-active')).toBeVisible({ timeout: 8000 });

    // 클립보드 권한 부여
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('button:has-text("URL 복사")').click();

    await expect(page.locator('.toast.success')).toBeVisible({ timeout: 4000 });
  });

  test('세션 초기화 후 설정 화면으로 돌아온다', async ({ page, request }) => {
    await resetSession(request);
    await startSession(request, 10);
    await page.goto('/');
    await expect(page.locator('#view-active')).toBeVisible({ timeout: 8000 });

    // confirm 다이얼로그 자동 승인
    page.on('dialog', dialog => dialog.accept());
    await page.locator('button:has-text("세션 초기화")').click();

    await expect(page.locator('#view-setup')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#view-active')).toBeHidden();
  });

  test('3초 폴링으로 참가 인원수가 갱신된다', async ({ page, request }) => {
    await resetSession(request);
    await startSession(request, 10);
    await page.goto('/');
    await expect(page.locator('#view-active')).toBeVisible({ timeout: 8000 });

    const initialDrawn = await page.locator('#stat-drawn').textContent();

    // 다른 참가자가 번호 뽑기 시뮬레이션
    const statusRes = await request.get(`${BASE}/api/session-status`);
    const { session } = await statusRes.json();
    await request.post(`${BASE}/api/draw-number`, {
      data: { participant_token: `test-token-${Date.now()}` },
    });

    // 폴링 주기(3초) + 여유
    await page.waitForTimeout(4000);
    const updatedDrawn = await page.locator('#stat-drawn').textContent();
    expect(Number(updatedDrawn)).toBeGreaterThan(Number(initialDrawn));
  });

});

// ──────────────────────────────────────────────────────────
// Draw 페이지 테스트
// ──────────────────────────────────────────────────────────
test.describe('Draw 페이지', () => {

  test('세션 없을 때 "준비 중입니다" 화면이 표시된다', async ({ page, request }) => {
    await resetSession(request);
    await page.goto('/draw.html');

    await expect(page.locator('#s-nosession')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#s-nosession .closed-title')).toHaveText('준비 중입니다');
  });

  test('세션 있을 때 번호 뽑기 버튼이 표시된다', async ({ page, request }) => {
    await resetSession(request);
    await startSession(request, 10);
    await page.goto('/draw.html');

    await expect(page.locator('#s-draw')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#btn-draw')).toBeVisible();
  });

  test('번호 뽑기 → 슬롯 애니메이션 → 결과 표시', async ({ page, request }) => {
    await resetSession(request);
    await startSession(request, 10);

    // 고유 토큰으로 localStorage 초기화
    await page.goto('/draw.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator('#s-draw')).toBeVisible({ timeout: 8000 });
    await page.locator('#btn-draw').click();

    // 슬롯 애니메이션 상태
    await expect(page.locator('#s-drawing')).toBeVisible({ timeout: 3000 });

    // 결과 화면 전환 (최대 5초)
    await expect(page.locator('#s-result')).toBeVisible({ timeout: 5000 });

    // 결과 번호가 1~10 범위인지 확인
    const numText = await page.locator('#result-num').textContent();
    const num = Number(numText);
    expect(num).toBeGreaterThanOrEqual(1);
    expect(num).toBeLessThanOrEqual(10);
  });

  test('같은 기기에서 재방문 시 기존 번호가 유지된다', async ({ page, request }) => {
    await resetSession(request);
    await startSession(request, 10);

    await page.goto('/draw.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator('#s-draw')).toBeVisible({ timeout: 8000 });
    await page.locator('#btn-draw').click();
    await expect(page.locator('#s-result')).toBeVisible({ timeout: 5000 });

    const firstNum = await page.locator('#result-num').textContent();

    // 페이지 새로고침 후 동일 번호 표시 확인
    await page.reload();
    await expect(page.locator('#s-result')).toBeVisible({ timeout: 8000 });
    const secondNum = await page.locator('#result-num').textContent();

    expect(firstNum).toBe(secondNum);
  });

  test('슬롯 애니메이션 숫자가 총 인원 범위 내에 있다', async ({ page, request }) => {
    await resetSession(request);
    await startSession(request, 7);  // 총 7명

    await page.goto('/draw.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator('#s-draw')).toBeVisible({ timeout: 8000 });
    await page.locator('#btn-draw').click();
    await expect(page.locator('#s-drawing')).toBeVisible({ timeout: 3000 });

    // 애니메이션 중 숫자 샘플링
    const nums = [];
    for (let i = 0; i < 5; i++) {
      const txt = await page.locator('#slot-num').textContent();
      if (txt && txt !== '?') nums.push(Number(txt));
      await page.waitForTimeout(100);
    }

    for (const n of nums) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  test('모든 번호가 소진되면 "마감" 화면이 표시된다', async ({ page, request, context }) => {
    await resetSession(request);
    await startSession(request, 2);  // 총 2명만

    // 2개 모두 소진
    for (let i = 0; i < 2; i++) {
      await request.post(`${BASE}/api/draw-number`, {
        data: { participant_token: `exhaust-token-${i}` },
      });
    }

    // localStorage 비워서 새 사용자처럼 접근
    await page.goto('/draw.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator('#s-draw')).toBeVisible({ timeout: 8000 });
    await page.locator('#btn-draw').click();

    await expect(page.locator('#s-closed')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#s-closed .closed-title')).toHaveText('마감되었습니다');
  });

  test('세션 초기화 후 다른 기기의 기존 번호는 더 이상 유효하지 않다', async ({ page, request }) => {
    await resetSession(request);
    await startSession(request, 10);

    // 번호 뽑기
    await page.goto('/draw.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('#s-draw')).toBeVisible({ timeout: 8000 });
    await page.locator('#btn-draw').click();
    await expect(page.locator('#s-result')).toBeVisible({ timeout: 5000 });

    // 세션 초기화
    await resetSession(request);

    // localStorage도 지워서 "새 기기" 상황 시뮬레이션
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 세션도 없고 localStorage도 없으면 nosession 화면
    await expect(page.locator('#s-nosession')).toBeVisible({ timeout: 8000 });
  });

});

// ──────────────────────────────────────────────────────────
// API 테스트
// ──────────────────────────────────────────────────────────
test.describe('API', () => {

  test('session-status: 세션 없을 때 session이 null이다', async ({ request }) => {
    await resetSession(request);
    const res = await request.get(`${BASE}/api/session-status`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.session).toBeNull();
  });

  test('start-session: 세션 생성 성공', async ({ request }) => {
    await resetSession(request);
    const res = await request.post(`${BASE}/api/start-session`, {
      data: { total_count: 5 },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.session).toHaveProperty('id');
    expect(body.session.total_count).toBe(5);
  });

  test('start-session: 잘못된 인원수는 400을 반환한다', async ({ request }) => {
    await resetSession(request);
    const res = await request.post(`${BASE}/api/start-session`, {
      data: { total_count: 0 },
    });
    expect(res.status()).toBe(400);
  });

  test('draw-number: 정상 뽑기 후 1~N 범위 번호 반환', async ({ request }) => {
    await resetSession(request);
    await startSession(request, 10);

    const res = await request.post(`${BASE}/api/draw-number`, {
      data: { participant_token: `api-test-${Date.now()}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.number).toBeGreaterThanOrEqual(1);
    expect(body.number).toBeLessThanOrEqual(10);
  });

  test('draw-number: 동일 토큰은 항상 같은 번호를 반환한다 (멱등성)', async ({ request }) => {
    await resetSession(request);
    await startSession(request, 10);

    const token = `idempotent-token-${Date.now()}`;
    const res1 = await request.post(`${BASE}/api/draw-number`, { data: { participant_token: token } });
    const res2 = await request.post(`${BASE}/api/draw-number`, { data: { participant_token: token } });

    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.number).toBe(body2.number);
  });

  test('draw-number: 번호가 소진되면 closed:true를 반환한다', async ({ request }) => {
    await resetSession(request);
    await startSession(request, 2);

    await request.post(`${BASE}/api/draw-number`, { data: { participant_token: 'tok-a' } });
    await request.post(`${BASE}/api/draw-number`, { data: { participant_token: 'tok-b' } });

    const res = await request.post(`${BASE}/api/draw-number`, {
      data: { participant_token: 'tok-c' },
    });
    const body = await res.json();
    expect(body.closed).toBe(true);
  });

  test('reset-session: 초기화 후 세션이 null이 된다', async ({ request }) => {
    await startSession(request, 5);

    await request.post(`${BASE}/api/reset-session`);

    const res = await request.get(`${BASE}/api/session-status`);
    const body = await res.json();
    expect(body.session).toBeNull();
  });

});
