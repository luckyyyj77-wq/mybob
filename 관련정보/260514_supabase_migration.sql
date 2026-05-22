-- 위험구역 PIN 초기화용 OTP 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS danger_pin_otp text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS danger_pin_otp_expires timestamptz DEFAULT NULL;
