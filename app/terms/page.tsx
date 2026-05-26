import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white' }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 0', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>LEGAL</p>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>이용약관</h1>
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

        {[
          {
            title: '제1조 (목적)',
            body: `이 약관은 MyBob(이하 "서비스")이 제공하는 AI 기반 식단 기록 및 분석 서비스의 이용과 관련하여 서비스와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.`,
          },
          {
            title: '제2조 (정의)',
            body: `① "서비스"란 mybob.kr 도메인을 통해 제공되는 모든 기능을 의미합니다.\n② "이용자"란 이 약관에 동의하고 서비스를 이용하는 자를 의미합니다.\n③ "PRO 회원"이란 유료 구독 플랜을 결제한 이용자를 의미합니다.`,
          },
          {
            title: '제3조 (약관의 효력 및 변경)',
            body: `① 이 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용됩니다.\n② 서비스는 관련 법령을 위반하지 않는 범위 내에서 이 약관을 변경할 수 있으며, 변경 시 앱 내 공지를 통해 사전 안내합니다.`,
          },
          {
            title: '제4조 (서비스 이용)',
            body: `① 서비스는 Google 계정을 통한 소셜 로그인 방식으로 회원가입이 가능합니다.\n② 이용자는 타인의 정보를 도용하거나 서비스를 불법적인 목적으로 사용할 수 없습니다.\n③ 서비스는 AI 음식 분석, 식단 기록, 영양 리포트 등의 기능을 제공하며, 의료적 진단을 대체하지 않습니다.`,
          },
          {
            title: '제5조 (유료 서비스)',
            body: `① PRO 플랜은 월 ₩900의 구독료가 자동 결제됩니다.\n② 결제는 Paddle(paddle.com)을 통해 처리되며, 카드 정보는 서비스가 저장하지 않습니다.\n③ 구독 해지는 앱 설정 내 또는 Paddle 고객센터를 통해 가능하며, 해지 후 현재 구독 기간 종료 시까지 PRO 기능이 유지됩니다.`,
          },
          {
            title: '제6조 (서비스 중단)',
            body: `서비스는 시스템 점검, 천재지변, 기술적 문제 등 불가피한 사유로 서비스 제공이 일시 중단될 수 있으며, 이 경우 사전 공지를 통해 이용자에게 안내합니다.`,
          },
          {
            title: '제7조 (이용자 의무)',
            body: `① 이용자는 서비스를 이용함에 있어 관계 법령, 이 약관의 규정을 준수해야 합니다.\n② 타인의 개인정보를 무단으로 수집·저장·공개하는 행위를 금지합니다.\n③ 서비스의 정상적인 운영을 방해하는 행위를 금지합니다.`,
          },
          {
            title: '제8조 (책임 제한)',
            body: `① 서비스가 제공하는 AI 분석 결과는 참고용이며, 의료적 판단의 근거로 사용해서는 안 됩니다.\n② 이용자의 귀책 사유로 발생한 서비스 이용 장애에 대해 서비스는 책임을 지지 않습니다.`,
          },
          {
            title: '제9조 (개인정보 보호)',
            body: `이용자의 개인정보는 개인정보처리방침에 따라 수집·이용·보호됩니다. 자세한 내용은 개인정보처리방침을 확인해 주세요.`,
          },
          {
            title: '제10조 (분쟁 해결)',
            body: `서비스 이용과 관련하여 분쟁이 발생한 경우, 서비스와 이용자는 상호 협의를 통해 해결을 위해 노력합니다. 합의가 이루어지지 않을 경우 관계 법령에 따라 처리됩니다.`,
          },
          {
            title: '문의',
            body: `이용약관에 대한 문의는 luckyyyj77@gmail.com으로 연락해 주세요.`,
          },
        ].map(({ title, body }) => (
          <div key={title}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'black', marginBottom: '10px' }}>{title}</p>
            <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.9, whiteSpace: 'pre-line' }}>{body}</p>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px', display: 'flex', gap: '16px' }}>
          <Link href="/privacy" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>개인정보처리방침</Link>
          <Link href="/refund" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>환불 정책</Link>
        </div>

      </div>
    </div>
  );
}
