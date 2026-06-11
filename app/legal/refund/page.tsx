'use client';

import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

const SECTIONS = [
  {
    title: '환불 원칙',
    body: `MyBob PRO 구독은 결제 후 7일 이내 미사용 상태에서 전액 환불이 가능합니다. 이후에는 디지털 콘텐츠의 특성상 환불이 제공되지 않습니다.`,
  },
  {
    title: '환불 가능 조건',
    body: `다음 조건을 모두 충족하는 경우 환불 신청이 가능합니다.\n\n① 최초 결제일로부터 7일 이내\n② PRO 전용 기능(AI 정밀 진단, 닉네임 변경, 클라우드 저장 25회 등)을 실질적으로 이용하지 않은 경우\n③ 결제 오류, 중복 결제 등 서비스 측 귀책 사유가 있는 경우 (기간 무관 전액 환불)`,
  },
  {
    title: '환불 불가 사유',
    body: `다음의 경우 환불이 제공되지 않습니다.\n\n① 결제 후 7일 초과\n② PRO 기능을 실질적으로 이용한 경우\n③ 자동 해지 옵션을 선택했음에도 기간 내 직접 해지를 요청하는 경우\n④ 단순 변심 (7일 초과 후)`,
  },
  {
    title: '자동 갱신 및 해지',
    body: `① 구독은 각 주기(월간/6개월/연간) 종료 시 자동으로 갱신됩니다.\n② 갱신 전 해지하려면 앱 내 설정 > 이용 플랜 > 구독 해지를 통해 직접 해지하세요.\n③ 자동 해지 옵션을 선택한 경우, 구독 기간 종료 후 자동으로 해지되며 추가 결제가 발생하지 않습니다.\n④ 갱신 후 7일 이내 미사용 시 갱신 금액에 대한 환불을 요청할 수 있습니다.`,
  },
  {
    title: '환불 신청 방법',
    body: `환불 요청은 아래 이메일로 문의해 주세요.\n\n이메일: luckyyyj77@gmail.com\n제목: [환불 요청] 결제 계정 이메일\n내용: 결제일, 결제 금액, 환불 사유\n\n접수 후 3 영업일 이내 처리 결과를 안내해 드립니다.`,
  },
  {
    title: '결제 대행',
    body: `MyBob의 결제는 Lemon Squeezy(Merchant of Record)를 통해 처리됩니다. 카드사 청구서에는 "LEMONSQUEEZY" 또는 "LS" 로 표시될 수 있습니다. 결제 관련 세금계산서 또는 영수증이 필요한 경우 Lemon Squeezy 고객센터(support@lemonsqueezy.com)에 문의하세요.`,
  },
  {
    title: '전자상거래법 적용',
    body: `본 환불 정책은 전자상거래 등에서의 소비자보호에 관한 법률 및 관련 법령에 따릅니다. 디지털 콘텐츠는 동법 제17조 제2항 제5호에 따라 청약철회가 제한될 수 있으나, MyBob은 결제 후 7일 이내 미사용 시 환불을 보장합니다.`,
  },
];

export default function RefundPage() {
  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px 60px' }}>

        <div style={{ padding: '24px 0 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>LEGAL</p>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>환불정책</h1>
          </div>
          <Link href="/settings" style={{ textDecoration: 'none' }}>
            <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaArrowLeft size={13} color="black" />
            </div>
          </Link>
        </div>

        <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '32px', lineHeight: 1.6 }}>
          시행일: 2026년 6월 11일 · MyBob 서비스
        </p>

        {/* 요약 박스 */}
        <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', padding: '16px 20px', marginBottom: '32px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#6B21A8', marginBottom: '8px' }}>핵심 요약</p>
          <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
            <li style={{ fontSize: '12px', color: '#374151', lineHeight: 1.8 }}>결제 후 <strong>7일 이내 미사용</strong> → 전액 환불</li>
            <li style={{ fontSize: '12px', color: '#374151', lineHeight: 1.8 }}>결제 오류·중복 결제 → 기간 무관 전액 환불</li>
            <li style={{ fontSize: '12px', color: '#374151', lineHeight: 1.8 }}>7일 초과 또는 사용 후 → 환불 불가</li>
            <li style={{ fontSize: '12px', color: '#374151', lineHeight: 1.8 }}>자동 해지 옵션 → 기간 종료 후 추가 결제 없음</li>
          </ul>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'black', marginBottom: '10px' }}>{s.title}</h2>
              <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{s.body}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <Link href="/legal/terms" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>이용약관</Link>
          <Link href="/legal/privacy" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>개인정보처리방침</Link>
        </div>
      </div>
    </div>
  );
}
