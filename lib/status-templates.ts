export type StatusTemplate = {
  id: number;
  text: string;
  category: '기본' | '계절' | '이슈';
  tags?: string[];
};

export const STATUS_TEMPLATES: StatusTemplate[] = [
  { id: 1,  text: '오늘도 기록하면 내일이 달라진다 💪',              category: '기본' },
  { id: 2,  text: '먹은 만큼 기록, 기록한 만큼 변화',               category: '기본' },
  { id: 3,  text: '다이어트의 적은 망각이다',                        category: '기본' },
  { id: 4,  text: '살은 입으로 들어오고 의지로 나간다',              category: '기본' },
  { id: 5,  text: '오늘 참은 치킨, 내일의 근육이 된다',              category: '기본' },
  { id: 6,  text: '칼로리는 거짓말하지 않는다',                      category: '기본' },
  { id: 7,  text: '위는 작게, 꿈은 크게',                            category: '기본' },
  { id: 8,  text: '한 입의 기록이 열 끼의 후회를 막는다',            category: '기본' },
  { id: 9,  text: '식단 관리 = 미래의 나에게 보내는 선물',           category: '기본' },
  { id: 10, text: '배고픔과 식욕은 다르다. 오늘도 구분 성공',        category: '기본' },
  { id: 11, text: '몸은 내가 먹은 것의 총합이다',                    category: '기본' },
  { id: 12, text: '완벽한 식단보다 꾸준한 기록이 낫다',              category: '기본' },
  { id: 13, text: '오늘 폭식했어도 내일 기록을 잘하면 된다',         category: '기본' },
  { id: 14, text: '천천히 씹으면 덜 먹게 되고, 덜 먹으면 덜 후회한다', category: '기본' },
  { id: 15, text: '다이어트는 마라톤이다. 오늘은 몇 킬로 달렸나요?', category: '기본' },
  { id: 16, text: '근육은 밥상에서 만들어진다',                      category: '기본' },
  { id: 17, text: '물 한 잔이 식욕을 잠재운다, 가끔은',              category: '기본' },
  { id: 18, text: '잘 먹는 것이 잘 사는 것이다',                     category: '기본' },
  { id: 19, text: '오늘의 선택이 내일의 몸을 만든다',                category: '기본' },
  { id: 20, text: '기록하지 않으면 먹은 것도 없었던 일이 된다',      category: '기본' },
];

export function pickRandom3(exclude?: string): StatusTemplate[] {
  const pool = STATUS_TEMPLATES.filter(t => t.text !== exclude);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}
