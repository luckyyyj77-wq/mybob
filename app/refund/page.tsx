import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

export default function RefundPage() {
  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white' }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 0', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>LEGAL</p>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>환불 정책</h1>
          </div>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ width: '36px', height: '36px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaArrowLeft size={13} color="black" />
            </div>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '40px 24px', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        <p style={{ fontSize: '12px', color: '#9ca3af' }}>최종 수정일: 2026년 5월 26일</p>

        {/* 핵심 요약 */}
        <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', padding: '20px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#6B21A8', marginBottom: '12px' }}>핵심 요약</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              '결제 후 7일 이내: 미사용 시 전액 환불',
              '구독 해지: 다음 결제일부터 청구 중단, 당월 이용 가능',
              '문의: luckyyyj77@gmail.com',
            ].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ color: '#6B21A8', fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>·</span>
                <span style={{ fontSize: '13px', color: '#374151' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {[
          {
            title: '1. 구독 해지',
            body: `PRO 월간 구독은 언제든지 해지할 수 있습니다.\n\n· 앱 설정 > 구독 관리에서 해지하거나, luckyyyj77@gmail.com으로 요청하시면 됩니다.\n· 해지 후에는 현재 결제 기간(월말)까지 PRO 기능이 유지됩니다.\n· 해지 다음 달부터 자동 결제가 중단됩니다.`,
          },
          {
            title: '2. 환불 조건',
            body: `[전액 환불 가능]\n· 최초 결제 후 7일 이내에 서비스를 실질적으로 이용하지 않은 경우\n· 서비스 장애로 PRO 기능을 7일 이상 연속으로 이용하지 못한 경우\n\n[환불 불가]\n· 결제 후 7일 초과 시\n· PRO 기능(AI 분석, 클라우드 저장 등)을 이미 사용한 경우\n· 단순 변심으로 구독 해지를 원하는 경우 (해지 후 당월 이용 가능)`,
          },
          {
            title: '3. 환불 신청 방법',
            body: `환불을 원하시면 아래 이메일로 연락해 주세요.\n\n이메일: luckyyyj77@gmail.com\n제목: [환불 요청] MyBob PRO 구독\n내용: 결제일, 결제 이메일 주소, 환불 사유\n\n접수 후 영업일 기준 3일 이내 확인 후 처리됩니다.`,
          },
          {
            title: '4. 환불 처리',
            body: `환불은 결제 수단인 Paddle을 통해 처리되며, 카드사에 따라 환불 반영까지 3~5 영업일이 소요될 수 있습니다.`,
          },
          {
            title: '5. 결제 오류',
            body: `중복 결제, 시스템 오류 등으로 발생한 잘못된 청구는 확인 즉시 전액 환불해 드립니다. 동일한 이메일 주소로 문의해 주세요.`,
          },
          {
            title: '6. 소비자 보호',
            body: `본 환불 정책은 전자상거래 등에서의 소비자보호에 관한 법률 및 관계 법령을 준수합니다. 법령에서 정한 소비자 권리는 본 정책보다 우선 적용됩니다.`,
          },
        ].map(({ title, body }) => (
          <div key={title}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'black', marginBottom: '10px' }}>{title}</p>
            <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.9, whiteSpace: 'pre-line' }}>{body}</p>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px', display: 'flex', gap: '16px' }}>
          <Link href="/terms" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>이용약관</Link>
          <Link href="/privacy" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>개인정보처리방침</Link>
        </div>

      </div>
    </div>
  );
}
