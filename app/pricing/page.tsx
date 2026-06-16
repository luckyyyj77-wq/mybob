import Link from 'next/link';
import { FaArrowLeft, FaCheck } from 'react-icons/fa';

const FREE_FEATURES = [
  'AI 음식 분석 10회/일',
  '식단 기록 무제한',
  '일간·주간·월간 리포트',
  '로컬 저장 (기기 내)',
];

const PRO_FEATURES = [
  'AI 음식 분석 25회/일',
  '클라우드 저장 & 다기기 동기화',
  'AI 정밀 영양 진단 리포트',
  '닉네임 & 아바타 커스텀',
  '광고 없음',
  '우선 고객 지원',
];

export default function PricingPage() {
  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white' }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 0', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>PRICING</p>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>요금제</h1>
          </div>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaArrowLeft size={13} color="black" />
            </div>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '40px 24px', maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* 소개 */}
        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.8 }}>
          MyBob은 무료로 시작할 수 있으며, PRO 구독으로 더 많은 기능을 이용할 수 있습니다.
        </p>

        {/* FREE 플랜 */}
        <div style={{ border: '1px solid #e5e7eb', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', marginBottom: '4px' }}>FREE</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'black' }}>₩0</p>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>무료 · 영구 이용</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {FREE_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaCheck size={12} color="#9ca3af" />
                <span style={{ fontSize: '13px', color: '#374151' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PRO 플랜 */}
        <div style={{ border: '2px solid #6B21A8', padding: '24px', backgroundColor: '#faf5ff', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: '-1px', right: '20px',
            backgroundColor: '#6B21A8', color: 'white',
            fontSize: '10px', letterSpacing: '1px', padding: '4px 10px',
          }}>
            추천
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <p style={{ fontSize: '10px', color: '#6B21A8', letterSpacing: '2px', marginBottom: '4px' }}>PRO</p>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'black' }}>₩900</p>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>월간 구독 · 언제든 해지 가능</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {PRO_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaCheck size={12} color="#6B21A8" />
                <span style={{ fontSize: '13px', color: '#374151' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 천인회 프로모션 배너 */}
        <div style={{ backgroundColor: '#f5f3ff', border: '1px solid #e9d5ff', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '20px', marginBottom: '8px' }}>🎖️</p>
          <p style={{ fontSize: '14px', color: '#6B21A8', fontWeight: 600, marginBottom: '6px' }}>천인회 프로모션 진행 중</p>
          <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.7 }}>
            선착순 1,000명은 2026년 12월 31일까지<br />PRO 기능을 무료로 이용할 수 있어요.<br />
            지금 가입하면 자동으로 천인회 멤버가 됩니다.
          </p>
        </div>

        {/* CTA */}
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{
            width: '100%', padding: '16px', backgroundColor: '#6B21A8',
            color: 'white', textAlign: 'center', fontSize: '14px', fontWeight: 600,
            letterSpacing: '0.5px', cursor: 'pointer',
          }}>
            앱 시작하기
          </div>
        </Link>

        {/* 추후 결제 안내 */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
          <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.7, textAlign: 'center' }}>
            프로모션 종료 후 결제 시스템이 오픈됩니다.<br />
            · 구독은 매월 자동 결제되며 언제든 해지 가능<br />
            · 환불 정책은 <Link href="/legal/refund" style={{ color: '#6B21A8' }}>환불 정책</Link> 페이지를 참고해 주세요.
          </p>
        </div>

      </div>
    </div>
  );
}
