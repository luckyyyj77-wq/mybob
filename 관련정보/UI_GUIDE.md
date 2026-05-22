# MyBob UI Customization Guide

이 문서는 MyBob 프로젝트의 구조를 이해하고 UI를 직접 수정하는 데 도움을 주기 위해 작성되었습니다.

## 1. 파일 구조 (App Router)
- `app/layout.tsx`: 앱의 뼈대. 하단 네비게이션 바와 인증 로직이 있습니다.
- `app/page.tsx`: 홈 화면. 칼로리 요약과 AI 코치 카드가 있습니다.
- `app/capture/page.tsx`: 카메라 분석 화면. 카메라 프레임 크기를 여기서 조절합니다.
- `app/history/page.tsx`: 지난 기록 리스트 화면.

## 2. 주요 디자인 수정 포인트 (Tailwind CSS)

### 홈 화면 (app/page.tsx)
- **타이틀 폰트 조절**: 135번 라인 부근 `text-3xl`을 `text-4xl` 등으로 변경.
- **카드 여백 조절**: 카드 클래스명 중 `p-6` (padding) 값을 `p-4` 등으로 변경하여 밀도 조정.
- **애니메이션 속도**: 상단 `itemVariants` 객체의 `stiffness` 값을 조절하여 튀는 느낌 조정.

### 카메라 화면 (app/capture/page.tsx)
- **카메라 프레임 크기**: 50번 라인 부근 `aspect-square max-h-[350px]` 부분에서 `350px` 수치를 변경하여 카메라 창 크기 조절.
- **분석 결과 카드**: 105번 라인 부근 `bg-white` 또는 `p-5`를 수정하여 디자인 변경.

### 하단 네비게이션 바 (app/layout.tsx)
- **메뉴 추가/변경**: 95번 라인 `nav` 섹션의 리스트 아이템을 수정하여 메뉴 순서나 아이콘 변경.
- **배경 투명도**: `bg-white` 클래스에 `bg-white/80 backdrop-blur-md`를 추가하여 반투명 효과 적용 가능.

## 3. 유용한 Tailwind 클래스 팁
- `w-full`: 너비 100%
- `flex-col`: 세로 정렬
- `items-center`: 중앙 정렬
- `gap-4`: 요소 사이 간격
- `rounded-2xl`: 모서리 둥글게
- `font-black`: 가장 굵은 글씨
- `tracking-tighter`: 자간 좁게 (세련된 느낌)

이 가이드를 참고하여 본인만의 스타일로 MyBob을 완성해 보세요!
