-- ============================================================
-- 랜덤 번호 뽑기 앱 - Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ============================================================

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. sessions 테이블 - 세션 관리
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  total_count INTEGER     NOT NULL CHECK (total_count BETWEEN 1 AND 1000),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active);

-- ============================================================
-- 2. available_numbers 테이블 - 남은 번호 풀
-- ============================================================
CREATE TABLE IF NOT EXISTS available_numbers (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  number     INTEGER NOT NULL,
  UNIQUE (session_id, number)
);

CREATE INDEX IF NOT EXISTS idx_avail_session ON available_numbers(session_id);

-- ============================================================
-- 3. draws 테이블 - 번호 배정 기록
-- ============================================================
CREATE TABLE IF NOT EXISTS draws (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  number            INTEGER     NOT NULL,
  participant_token TEXT        NOT NULL,
  drawn_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, number),            -- 번호 중복 배정 방지
  UNIQUE (session_id, participant_token)  -- 1인 1번 보장
);

CREATE INDEX IF NOT EXISTS idx_draws_session ON draws(session_id);
CREATE INDEX IF NOT EXISTS idx_draws_token   ON draws(session_id, participant_token);

-- ============================================================
-- 4. draw_number RPC - 원자적 번호 뽑기 함수
--    동시 요청이 와도 절대 중복 배정되지 않음
-- ============================================================
CREATE OR REPLACE FUNCTION draw_number(
  p_session_id        UUID,
  p_participant_token TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_number   INTEGER;
  v_existing INTEGER;
BEGIN
  -- 이미 번호를 받은 참가자인지 확인 (멱등성)
  SELECT number INTO v_existing
  FROM draws
  WHERE session_id        = p_session_id
    AND participant_token = p_participant_token;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  -- 남은 번호 중 랜덤으로 하나를 원자적으로 획득
  -- FOR UPDATE SKIP LOCKED: 동시 요청 시 다른 행 선택 → 중복 없음
  DELETE FROM available_numbers
  WHERE id = (
    SELECT id
    FROM   available_numbers
    WHERE  session_id = p_session_id
    ORDER BY random()
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING number INTO v_number;

  -- 남은 번호 없음 → NULL 반환 (마감)
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 배정 기록 저장
  INSERT INTO draws (session_id, number, participant_token)
  VALUES (p_session_id, v_number, p_participant_token);

  RETURN v_number;
END;
$$;
