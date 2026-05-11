const ADJECTIVES = [
  '신선한', '달달한', '아삭한', '고소한', '새콤한', '매콤한', '촉촉한',
  '향긋한', '바삭한', '쫄깃한', '부드러운', '싱그러운', '건강한', '통통한',
  '귀여운', '작은', '큰', '빛나는', '따뜻한', '시원한', '동글동글',
  '알록달록', '포실한', '탱글한', '은은한', '상큼한', '풋풋한', '반짝이는',
];

const INGREDIENTS = [
  '당근', '브로콜리', '시금치', '양파', '마늘', '감자', '고구마', '옥수수',
  '토마토', '오이', '파프리카', '버섯', '가지', '호박', '배추', '상추',
  '바나나', '사과', '딸기', '포도', '수박', '복숭아', '망고', '키위',
  '레몬', '오렌지', '블루베리', '체리', '파인애플', '멜론', '자몽', '배',
  '두부', '아보카도', '콩', '팥', '깨', '들깨', '견과', '아몬드',
  '연근', '무', '파', '생강', '미역', '다시마', '버섯', '표고버섯',
];

// 28 × 46 × 100 = 128,800 조합
export function generateNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const ing = INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)];
  const num = String(Math.floor(Math.random() * 100) + 100); // 100~199
  return `${adj}${ing}_${num}`;
}

// 조합 고갈 시 임시 발급: mb_ + 영문+숫자 8자리
export function generateFallbackNickname(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const rand = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `mb_${rand}`;
}
