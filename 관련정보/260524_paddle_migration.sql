-- Paddle 결제 연동을 위한 profiles 테이블 컬럼 추가
-- Supabase Dashboard > SQL Editor에서 실행

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT DEFAULT NULL;

-- 인덱스 (webhook에서 subscription_id로 업데이트할 때 사용)
CREATE INDEX IF NOT EXISTS idx_profiles_paddle_subscription_id
  ON profiles(paddle_subscription_id)
  WHERE paddle_subscription_id IS NOT NULL;
