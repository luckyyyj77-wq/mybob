-- 사용량 카운트 원자화 마이그레이션 (동시 요청 레이스 컨디션 방어)
-- 실행일: 2026-07-02
-- Supabase SQL Editor에서 실행
--
-- 배경: 기존 checkAnalysisLimit(읽기) → 분석 → incrementAnalysisCount(읽고-쓰기) 구조는
-- 병렬 요청 시 전부 limit 체크를 통과해 일일 제한을 우회할 수 있음 (Gemini 비용 공격).
-- 해결: "한도 미만이면 +1"을 단일 UPDATE로 처리해 행 잠금으로 원자성 보장.
-- 실패한 분석은 refund 함수로 크레딧 반환.

-- 1. AI 분석 크레딧 소진 — 반환값: 증가 후 사용량, 한도 초과 시 -1
CREATE OR REPLACE FUNCTION consume_analysis_credit(p_user_id uuid, p_limit int, p_today date)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count int;
BEGIN
  UPDATE profiles
  SET analyses_today = CASE WHEN last_analysis_date = p_today THEN COALESCE(analyses_today, 0) + 1 ELSE 1 END,
      last_analysis_date = p_today,
      updated_at = now()
  WHERE id = p_user_id
    AND (CASE WHEN last_analysis_date = p_today THEN COALESCE(analyses_today, 0) ELSE 0 END) < p_limit
  RETURNING analyses_today INTO new_count;

  RETURN COALESCE(new_count, -1);
END;
$$;

-- 2. AI 분석 크레딧 환불 (분석 실패 시 반환)
CREATE OR REPLACE FUNCTION refund_analysis_credit(p_user_id uuid, p_today date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET analyses_today = GREATEST(0, COALESCE(analyses_today, 0) - 1),
      updated_at = now()
  WHERE id = p_user_id
    AND last_analysis_date = p_today;
END;
$$;

-- 3. 업로드(저장) 크레딧 소진 — 반환값: 증가 후 사용량, 한도 초과 시 -1
CREATE OR REPLACE FUNCTION consume_upload_credit(p_user_id uuid, p_limit int, p_today date)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count int;
BEGIN
  UPDATE profiles
  SET uploads_today = CASE WHEN last_upload_date = p_today THEN COALESCE(uploads_today, 0) + 1 ELSE 1 END,
      last_upload_date = p_today,
      updated_at = now()
  WHERE id = p_user_id
    AND (CASE WHEN last_upload_date = p_today THEN COALESCE(uploads_today, 0) ELSE 0 END) < p_limit
  RETURNING uploads_today INTO new_count;

  RETURN COALESCE(new_count, -1);
END;
$$;

-- 4. 업로드 크레딧 환불 (저장 실패 시 반환)
CREATE OR REPLACE FUNCTION refund_upload_credit(p_user_id uuid, p_today date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET uploads_today = GREATEST(0, COALESCE(uploads_today, 0) - 1),
      updated_at = now()
  WHERE id = p_user_id
    AND last_upload_date = p_today;
END;
$$;

-- 5. 클라이언트 직접 호출 차단 (service_role 전용)
-- Supabase는 함수에 기본으로 PUBLIC EXECUTE를 부여하므로 반드시 회수해야 함.
-- 회수하지 않으면 로그인 유저가 REST(/rest/v1/rpc/...)로 직접 호출해 크레딧을 무한 환불 가능.
REVOKE EXECUTE ON FUNCTION consume_analysis_credit(uuid, int, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION refund_analysis_credit(uuid, date)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION consume_upload_credit(uuid, int, date)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION refund_upload_credit(uuid, date)         FROM PUBLIC, anon, authenticated;

-- 6. (보너스) 기존 decrement_founding_slot도 같은 이유로 클라이언트 호출 차단
--    현재는 로그인 유저가 REST로 직접 호출해 천인회 슬롯 카운트를 조작할 수 있음.
REVOKE EXECUTE ON FUNCTION decrement_founding_slot() FROM PUBLIC, anon, authenticated;
