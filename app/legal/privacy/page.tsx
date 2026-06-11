'use client';

import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

const SECTIONS = [
  {
    title: '제1조 (수집하는 개인정보)',
    body: `MyBob은 서비스 제공을 위해 다음의 개인정보를 수집합니다.\n\n[필수]\n· 이메일 주소 (회원가입 및 본인 확인)\n· 식단 사진 (AI 분석 및 기록)\n· 신체 정보 (키, 몸무게 — 목표 칼로리 계산용, 로컬 저장)\n\n[선택 — 클라우드 모드 선택 시]\n· 식단 기록 (음식명, 칼로리, 영양소, 촬영 시간)\n· 프로필 사진 (PRO 회원, 직접 업로드 시)\n· 닉네임\n\n[자동 수집]\n· 서비스 이용 기록 (분석 횟수, 접속 시간)\n· 기기 정보 (브라우저 종류, OS — 오류 추적용)`,
  },
  {
    title: '제2조 (개인정보의 이용 목적)',
    body: `수집한 개인정보는 다음 목적에 한하여 이용됩니다.\n\n① 회원 인증 및 서비스 제공\n② AI 식단 분석 (Google Gemini API 활용)\n③ 맞춤형 영양 리포트 및 코치 코멘트 생성\n④ 커뮤니티 기능 (이웃 피드, 공개 식단)\n⑤ 유료 구독 결제 및 관리\n⑥ 서비스 개선 및 오류 분석`,
  },
  {
    title: '제3조 (개인정보의 보관 및 파기)',
    body: `① 회원 탈퇴 시 모든 개인정보(식단 기록, 사진, 분석 결과)를 즉시 삭제합니다.\n② 클라우드→로컬 전환 시 서버 데이터는 전환일로부터 15일 후 자동 삭제됩니다.\n③ 로컬 모드 이용자의 데이터는 기기 내에만 저장되며, 서버에 전송되지 않습니다.\n④ 관련 법령에 따라 보관이 필요한 경우 해당 기간 동안 별도 보관 후 파기합니다.\n   - 전자상거래 결제 기록: 5년 (전자상거래법)`,
  },
  {
    title: '제4조 (제3자 제공)',
    body: `MyBob은 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 서비스 운영을 위해 다음 외부 서비스에 최소한의 정보를 제공합니다.\n\n· Supabase (미국): 회원 인증, 클라우드 데이터 저장\n· Google Gemini API (미국): AI 식단 분석 (사진 데이터 전송, 분석 후 저장하지 않음)\n· Lemon Squeezy (미국): 결제 처리 (이메일, 결제 정보)\n· Vercel (미국): 서비스 호스팅\n\n위 서비스들은 각각의 개인정보 처리방침에 따라 데이터를 처리합니다.`,
  },
  {
    title: '제5조 (이용자의 권리)',
    body: `이용자는 다음의 권리를 행사할 수 있습니다.\n\n① 개인정보 열람 요청\n② 개인정보 수정 요청\n③ 개인정보 삭제 요청 (회원탈퇴)\n④ 개인정보 처리 정지 요청\n\n위 권리 행사는 앱 내 설정 또는 luckyyyj77@gmail.com으로 요청하실 수 있습니다.`,
  },
  {
    title: '제6조 (개인정보 보호 조치)',
    body: `MyBob은 개인정보 보호를 위해 다음의 조치를 취합니다.\n\n① 모든 통신은 HTTPS로 암호화\n② Supabase Row Level Security(RLS)로 타인의 데이터 접근 차단\n③ 관리자 전용 API는 이메일 인증으로 접근 제한\n④ 사진 데이터는 AI 분석 후 서버에 보관하지 않음 (Google Gemini API 정책)`,
  },
  {
    title: '제7조 (개인정보 보호 책임자)',
    body: `개인정보 보호 관련 문의, 불만 처리는 아래 연락처로 문의해 주세요.\n\n이메일: luckyyyj77@gmail.com\n처리 기간: 접수 후 5 영업일 이내`,
  },
  {
    title: '부칙',
    body: `본 방침은 2026년 6월 11일부터 시행됩니다.`,
  },
];

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100svh', backgroundColor: 'white' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px 60px' }}>

        <div style={{ padding: '24px 0 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <p style={{ fontSize: '10px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>LEGAL</p>
            <h1 style={{ fontSize: '22px', fontWeight: 400, color: 'black', lineHeight: 1 }}>개인정보처리방침</h1>
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
          <Link href="/legal/terms" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>이용약관</Link>
          <Link href="/legal/refund" style={{ fontSize: '12px', color: '#6B21A8', textDecoration: 'none' }}>환불정책</Link>
        </div>
      </div>
    </div>
  );
}
