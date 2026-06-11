'use client';

import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

const SECTIONS = [
  {
    title: '제1조 (목적)',
    body: `본 약관은 MyBob(이하 "서비스")이 제공하는 식단 기록 및 AI 분석 서비스의 이용 조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.`,
  },
  {
    title: '제2조 (정의)',
    body: `① "서비스"란 MyBob이 제공하는 식단 기록, AI 영양 분석, 리포트, 커뮤니티 등 일체의 기능을 말합니다.\n② "이용자"란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.\n③ "PRO 회원"이란 유료 구독 플랜을 결제하여 프리미엄 기능을 이용하는 이용자를 말합니다.`,
  },
  {
    title: '제3조 (약관의 효력 및 변경)',
    body: `① 본 약관은 서비스 화면에 게시하거나 이용자에게 공지함으로써 효력이 발생합니다.\n② 서비스는 합리적인 사유가 있을 경우 약관을 변경할 수 있으며, 변경 시 7일 전 공지합니다. 변경된 약관에 동의하지 않는 이용자는 서비스 이용을 중단하고 탈퇴할 수 있습니다.`,
  },
  {
    title: '제4조 (서비스 이용)',
    body: `① 서비스는 연중무휴 24시간 제공을 원칙으로 하나, 시스템 점검·장애·천재지변 등의 사유로 서비스가 일시 중단될 수 있습니다.\n② 무료(FREE) 이용자는 하루 AI 분석 10회, PRO 이용자는 하루 25회의 제한이 적용됩니다.\n③ 서비스는 AI 분석 결과의 정확성을 보장하지 않으며, 분석 결과는 참고용으로만 활용하시기 바랍니다.`,
  },
  {
    title: '제5조 (유료 서비스 및 결제)',
    body: `① 유료 플랜(PRO)은 Lemon Squeezy를 통해 결제되며, 결제 시점부터 PRO 기능이 활성화됩니다.\n② 구독 플랜은 해지하지 않는 한 각 주기(월간/6개월/연간) 종료 시 자동 갱신됩니다.\n③ 결제 후 7일 이내 미사용 시 전액 환불이 가능하며, 이후에는 환불이 제공되지 않습니다.\n④ 자동 해지 옵션을 선택한 경우 해당 구독 기간 종료 후 자동으로 해지되며 추가 결제가 발생하지 않습니다.`,
  },
  {
    title: '제6조 (이용자의 의무)',
    body: `이용자는 다음 행위를 해서는 안 됩니다.\n① 타인의 정보를 도용하거나 허위 정보를 등록하는 행위\n② 서비스의 정상적인 운영을 방해하는 행위\n③ 서비스를 통해 얻은 정보를 무단으로 복제·배포하는 행위\n④ 관련 법령에 위반되는 행위`,
  },
  {
    title: '제7조 (서비스의 제공 및 변경)',
    body: `서비스는 서비스의 내용을 변경할 수 있으며, 변경 시 공지합니다. 서비스는 무료로 제공되는 기능의 범위 및 내용을 변경하거나 유료화할 수 있습니다.`,
  },
  {
    title: '제8조 (책임의 제한)',
    body: `① 서비스는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력적인 사유로 서비스를 제공할 수 없는 경우 책임이 면제됩니다.\n② AI 분석 결과는 참고용이며, 의학적 진단이나 처방을 대체하지 않습니다. 건강 관련 결정은 반드시 전문의와 상담하시기 바랍니다.\n③ 이용자가 서비스 이용과 관련하여 기대하는 수익을 얻지 못하거나 자료의 취사선택으로 발생하는 손해에 대해 서비스는 책임지지 않습니다.`,
  },
  {
    title: '제9조 (회원탈퇴 및 자격 상실)',
    body: `① 이용자는 언제든지 앱 내 설정 > 계정 > 회원탈퇴를 통해 탈퇴할 수 있습니다.\n② 탈퇴 시 모든 데이터(식단 기록, 사진, 분석 결과)가 즉시 삭제되며 복구할 수 없습니다.\n③ 유료 구독 중 탈퇴 시 구독은 즉시 해지되며, 환불 정책에 따라 처리됩니다.`,
  },
  {
    title: '제10조 (분쟁 해결)',
    body: `본 약관과 관련하여 분쟁이 발생한 경우, 서비스와 이용자는 성실한 협의를 통해 해결합니다. 협의가 이루어지지 않을 경우 관련 법령에 따른 법원을 관할 법원으로 합니다.`,
  },
  {
    title: '부칙',
    body: `본 약관은 2026년 6월 11일부터 시행됩니다.`,
  },
];

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px 60px' }}>

        <div style={{ padding: '24px 0 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>LEGAL</p>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>이용약관</h1>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'black', marginBottom: '10px' }}>{s.title}</h2>
              <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{s.body}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <Link href="/legal/privacy" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>개인정보처리방침</Link>
          <Link href="/legal/refund" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>환불정책</Link>
        </div>
      </div>
    </div>
  );
}
