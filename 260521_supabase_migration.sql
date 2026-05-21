-- gemini_usage: Gemini API 토큰 사용량 기록
CREATE TABLE IF NOT EXISTS gemini_usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  model       text NOT NULL,          -- 예: 'gemini-2.5-pro', 'gemini-2.5-flash'
  plan        text NOT NULL DEFAULT 'free', -- 분석 시점 플랜
  tokens_in   integer,               -- 입력 토큰 수 (Gemini가 반환하는 경우)
  tokens_out  integer,               -- 출력 토큰 수
  mode        text DEFAULT 'vision', -- 'vision' | 'ocr'
  created_at  timestamptz DEFAULT now()
);

-- RLS: 관리자(service_role)만 조회
ALTER TABLE gemini_usage ENABLE ROW LEVEL SECURITY;

-- 인덱스 (날짜별, 모델별 집계용)
CREATE INDEX IF NOT EXISTS gemini_usage_created_at_idx ON gemini_usage(created_at);
CREATE INDEX IF NOT EXISTS gemini_usage_model_idx ON gemini_usage(model);
CREATE INDEX IF NOT EXISTS gemini_usage_user_id_idx ON gemini_usage(user_id);
