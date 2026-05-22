-- 260512 수정사항: profiles 테이블에 nickname_changed 컬럼 추가
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS nickname_changed boolean DEFAULT false;

-- 기존 PRO 사용자 중 이미 랜덤이 아닌 닉네임을 가진 경우는 변경하지 않음
-- (새 정책은 이 컬럼이 추가된 시점부터 적용됨)
