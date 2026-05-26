import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white' }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 0', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>LEGAL</p>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>개인정보처리방침</h1>
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
            title: '1. 수집하는 개인정보',
            body: `MyBob은 서비스 제공을 위해 다음의 개인정보를 수집합니다.\n\n· 이메일 주소 (Google 소셜 로그인)\n· 닉네임 (자동 생성 또는 PRO 회원 직접 입력)\n· 프로필 사진 (PRO 회원, 선택)\n· 식단 사진 및 분석 데이터 (클라우드 저장 선택 시)\n· 신체 정보 (키, 몸무게, 나이, 성별 — 기기 내 암호화 저장)\n· 결제 정보 (Paddle이 처리, MyBob은 저장하지 않음)`,
          },
          {
            title: '2. 수집 목적',
            body: `· 회원 인증 및 계정 관리\n· AI 음식 분석 및 식단 기록 서비스 제공\n· 영양 리포트 및 코치 코멘트 생성\n· 구독 플랜 관리 및 기능 제한 적용\n· 서비스 개선 및 통계 분석`,
          },
          {
            title: '3. 저장 방식',
            body: `MyBob은 두 가지 저장 방식을 제공합니다.\n\n[로컬 저장]\n사진 및 식단 데이터가 기기 내(IndexedDB)에만 저장됩니다. 서버에는 인증 정보 외 데이터가 전송되지 않습니다.\n\n[클라우드 저장]\n사진 및 식단 데이터가 Supabase(미국 소재) 서버에 암호화 전송 및 저장됩니다. 다기기 동기화가 가능합니다.\n\n신체 정보(키, 몸무게 등)는 저장 방식과 무관하게 기기 내 AES-256-GCM으로 암호화 저장됩니다.`,
          },
          {
            title: '4. 제3자 제공',
            body: `MyBob은 다음의 외부 서비스를 이용하며, 서비스 운영에 필요한 최소한의 데이터만 전달됩니다.\n\n· Google (인증): 이메일\n· Google Gemini API (AI 분석): 식단 사진 (분석 후 저장하지 않음)\n· Supabase (데이터베이스·스토리지): 식단 데이터, 사진 (클라우드 저장 선택 시)\n· Paddle (결제): 이메일, 구독 정보 (카드 정보는 MyBob이 저장하지 않음)\n\n위 목적 외 제3자에게 개인정보를 제공하지 않습니다.`,
          },
          {
            title: '5. 보유 및 파기',
            body: `· 회원 탈퇴 시 서버에 저장된 모든 개인정보 및 식단 데이터를 즉시 삭제합니다.\n· 클라우드→로컬 전환 시, 서버 데이터는 15일 후 자동 삭제 예약됩니다.\n· 로컬 데이터는 이용자가 직접 설정 > 위험구역에서 삭제할 수 있습니다.\n· 결제 관련 기록은 관계 법령에 따라 일정 기간 보관될 수 있습니다.`,
          },
          {
            title: '6. 이용자 권리',
            body: `이용자는 언제든지 다음의 권리를 행사할 수 있습니다.\n\n· 본인 데이터 열람 및 내보내기 (설정 > 내보내기)\n· 개인정보 수정 (설정 > 프로필)\n· 서비스 탈퇴 및 전체 삭제 (설정 > 위험구역 > 회원탈퇴)\n· 개인정보 처리에 대한 문의 (luckyyyj77@gmail.com)`,
          },
          {
            title: '7. 쿠키 및 추적',
            body: `MyBob은 별도의 마케팅 쿠키나 서드파티 추적 도구를 사용하지 않습니다. 세션 유지를 위한 인증 토큰만 로컬스토리지에 저장됩니다.`,
          },
          {
            title: '8. 개인정보 보호책임자',
            body: `개인정보 처리에 관한 문의는 아래로 연락주세요.\n\n이메일: luckyyyj77@gmail.com\n처리 기간: 영업일 기준 3일 이내`,
          },
          {
            title: '9. 방침 변경',
            body: `개인정보처리방침이 변경되는 경우 앱 내 공지를 통해 사전 안내합니다. 변경된 방침은 공지 후 7일이 경과한 날부터 효력이 발생합니다.`,
          },
        ].map(({ title, body }) => (
          <div key={title}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'black', marginBottom: '10px' }}>{title}</p>
            <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.9, whiteSpace: 'pre-line' }}>{body}</p>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px', display: 'flex', gap: '16px' }}>
          <Link href="/terms" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>이용약관</Link>
          <Link href="/refund" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>환불 정책</Link>
        </div>

      </div>
    </div>
  );
}
