-- 천인회 프로모션 마이그레이션
-- 실행일: 2026-06-16
-- Supabase SQL Editor에서 실행

-- 1. profiles 테이블 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_founding_member   boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS founding_joined_at   timestamptz  DEFAULT null,
  ADD COLUMN IF NOT EXISTS pro_credit_expires_at timestamptz DEFAULT null;

-- 2. founding_slots 테이블 생성 (천인회 슬롯 현황)
CREATE TABLE IF NOT EXISTS founding_slots (
  id              int PRIMARY KEY DEFAULT 1,  -- 싱글 row
  total_slots     int NOT NULL DEFAULT 1000,
  used_slots      int NOT NULL DEFAULT 0,
  promotion_end   date NOT NULL DEFAULT '2026-12-31',
  updated_at      timestamptz DEFAULT now()
);

-- 초기 row 삽입 (이미 가입한 유저가 있으면 수동으로 used_slots 조정 필요)
INSERT INTO founding_slots (id, total_slots, used_slots, promotion_end)
VALUES (1, 1000, 0, '2026-12-31')
ON CONFLICT (id) DO NOTHING;

-- 3. RLS 설정
ALTER TABLE founding_slots ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능 (남은 슬롯 수 공개 표시용)
CREATE POLICY "founding_slots_read_all"
  ON founding_slots FOR SELECT
  USING (true);

-- 쓰기는 service_role만 (백엔드에서만 수정)
CREATE POLICY "founding_slots_write_service"
  ON founding_slots FOR ALL
  USING (auth.role() = 'service_role');

-- 4. 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_is_founding_member
  ON profiles (is_founding_member)
  WHERE is_founding_member = true;

-- 5. 슬롯 감소 RPC 함수 (탈퇴 시 원자적 감소)
CREATE OR REPLACE FUNCTION decrement_founding_slot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE founding_slots
  SET used_slots = GREATEST(0, used_slots - 1),
      updated_at = now()
  WHERE id = 1
    AND used_slots > 0
    AND CURRENT_DATE <= promotion_end;
END;
$$;
