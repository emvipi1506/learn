import type { ActInfo, ActNumber, PlacementQuestion } from '../types';

export const ACTS: ActInfo[] = [
  {
    act: 1,
    roman: 'I',
    name: 'Thức Tỉnh Nền Tảng',
    fantasyTitle: 'Cổng Đá Khởi Nguyên',
    bandRange: '0 → 4.0',
    durationMonths: 'Tháng 1 – 3',
    goalVi: 'Xóa bỏ nỗi sợ tiếng Anh, nắm chắc phát âm IPA, 800–1.000 từ vựng cốt lõi và 12 cấu trúc ngữ pháp sống còn.',
    milestones: [
      'Đọc đúng phiên âm IPA và nghe nhận diện câu ngắn quen thuộc',
      'Thuộc ít nhất 800 từ cốt lõi bằng thẻ lặp lại ngắt quãng (SRS)',
      'Viết được câu đơn, câu ghép chuẩn thì Hiện tại đơn & Quá khứ đơn',
      'Trả lời trôi chảy 2–3 câu về bản thân, gia đình, thói quen',
    ],
    dailySplit: '25p Từ vựng SRS • 35p Nghe chép chính tả • 35p Đọc ngắn & Ngữ pháp • 25p Tập nói chậm',
  },
  {
    act: 2,
    roman: 'II',
    name: 'Rèn Luyện Kỹ Năng',
    fantasyTitle: 'Lò Rèn Cổ Ngữ',
    bandRange: '4.0 → 5.0',
    durationMonths: 'Tháng 4 – 6',
    goalVi: 'Chuyển từ tiếng Anh cơ bản sang định dạng đề thi IELTS, làm chủ kỹ năng tìm ý nhanh và viết đoạn văn mạch lạc.',
    milestones: [
      'Hoàn thành Listening Part 1 & 2 đạt trên 65% số câu đúng',
      'Áp dụng thành thạo Skimming, Scanning và True/False/Not Given',
      'Viết trọn vẹn đoạn văn học thuật theo cấu trúc PEEL (100–130 từ)',
      'Phản xạ mượt Speaking Part 1 mà không bị khựng quá lâu',
    ],
    dailySplit: '20p Từ vựng chủ đề • 40p Listening/Reading Part 1-2 • 40p Writing đoạn/Speaking Part 1 • 20p Chữa lỗi',
  },
  {
    act: 3,
    roman: 'III',
    name: 'Đột Phá Học Thuật',
    fantasyTitle: 'Tháp Ma Thuật Học Thuật',
    bandRange: '5.0 → 6.0',
    durationMonths: 'Tháng 7 – 9',
    goalVi: 'Làm chủ kỹ thuật Paraphrasing, viết đủ cấu trúc Task 1 & Task 2, tự tin trình bày bài nói 2 phút Speaking Part 2.',
    milestones: [
      'Nắm vững kỹ thuật Paraphrasing trong cả Reading và Writing',
      'Viết đủ Task 1 (150+ từ) và Task 2 (250+ từ) đúng thời gian',
      'Nói liên tục 2 phút Speaking Part 2 theo Cue Card có mở – thân – kết',
      'Đạt ổn định 23–26/40 câu đúng ở đề Listening & Reading đầy đủ',
    ],
    dailySplit: '20p Collocations SRS • 45p Luyện đề Nghe/Đọc • 40p Viết bài/Nói Part 2 • 15p AI sửa lỗi',
  },
  {
    act: 4,
    roman: 'IV',
    name: 'Chinh Phục Đỉnh Cao',
    fantasyTitle: 'Ngai Vàng Band 6.5+',
    bandRange: '6.0 → 6.5+',
    durationMonths: 'Tháng 10 – 12+',
    goalVi: 'Tối ưu chiến lược thi thực chiến: kéo Listening & Reading lên 7.0, giữ vững Writing & Speaking 6.0 để chắc chắn Overall 6.5.',
    milestones: [
      'Listening & Reading đạt ổn định 30+/40 câu (Band 7.0)',
      'Writing đạt mạch lạc cao, hạn chế lỗi ngữ pháp lặp lại (Band 6.0–6.5)',
      'Speaking Part 3 trả lời sâu, biết nêu quan điểm & ví dụ (Band 6.0–6.5)',
      'Hoàn thành ít nhất 6 bài thi thử bấm giờ sát kỳ thi thật',
    ],
    dailySplit: '15p Ôn từ khó • 50p Thi thử bấm giờ • 35p Nâng cấp Writing/Speaking với AI • 20p Phân tích lỗi sai',
  },
];

export const DAILY_QUESTS = [
  {
    id: 'quest_vocab',
    title: 'Nạp Cổ Ngữ Hàng Ngày',
    description: 'Ôn ít nhất 5 thẻ từ vựng trong Sổ Ma Pháp SRS',
    xp: 40,
    targetType: 'vocab' as const,
    targetCount: 5,
  },
  {
    id: 'quest_lesson',
    title: 'Thử Thách Điện Kỹ Năng',
    description: 'Hoàn thành 1 bài luyện Listening, Reading, Writing hoặc Speaking',
    xp: 60,
    targetType: 'lesson' as const,
    targetCount: 1,
  },
  {
    id: 'quest_streak',
    title: 'Giữ Ngọn Lửa Bất Diệt',
    description: 'Duy trì nhịp học mỗi ngày để tiến gần Band 6.5',
    xp: 25,
    targetType: 'checkin' as const,
    targetCount: 1,
  },
];

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    id: 'pq1',
    skillLabel: 'Ngữ pháp cơ bản',
    prompt: 'Every morning, she ___ a cup of coffee before studying English.',
    options: ['drink', 'drinks', 'drinking', 'drank'],
    correctIndex: 1,
    weight: 1,
  },
  {
    id: 'pq2',
    skillLabel: 'Thì quá khứ',
    prompt: 'Yesterday, I ___ my homework early so I could practice listening.',
    options: ['finish', 'finishing', 'finished', 'have finish'],
    correctIndex: 2,
    weight: 1,
  },
  {
    id: 'pq3',
    skillLabel: 'Từ vựng giao tiếp',
    prompt: 'Chọn nghĩa gần đúng nhất của từ "improve":',
    options: ['Từ bỏ một thói quen', 'Cải thiện, trở nên tốt hơn', 'Ghi nhớ nhanh chóng', 'Tranh luận gay gắt'],
    correctIndex: 1,
    weight: 1,
  },
  {
    id: 'pq4',
    skillLabel: 'Câu ghép & Liên từ',
    prompt: '___ the exam was difficult, he managed to finish all sections on time.',
    options: ['Because', 'Although', 'Despite', 'However'],
    correctIndex: 1,
    weight: 1.5,
  },
  {
    id: 'pq5',
    skillLabel: 'Đọc hiểu nhanh',
    prompt: '"Public libraries now offer free digital books, allowing commuters to read on their phones." Câu này có nghĩa gì?',
    options: [
      'Thư viện chỉ cho mượn sách giấy miễn phí.',
      'Người đi làm có thể đọc sách điện tử miễn phí từ thư viện trên điện thoại.',
      'Điện thoại bị cấm sử dụng bên trong thư viện công cộng.',
      'Sách điện tử đắt hơn sách giấy truyền thống.',
    ],
    correctIndex: 1,
    weight: 1.5,
  },
  {
    id: 'pq6',
    skillLabel: 'Từ vựng học thuật IELTS',
    prompt: 'Governments should invest in public transport to ___ traffic congestion in major cities.',
    options: ['increase', 'alleviate', 'hesitate', 'decorate'],
    correctIndex: 1,
    weight: 2,
  },
  {
    id: 'pq7',
    skillLabel: 'Paraphrasing (Band 6.0+)',
    prompt: 'Câu nào diễn đạt lại (paraphrase) sát nghĩa nhất với: "Many young people find it hard to buy a house."?',
    options: [
      'Young adults prefer living in hotels rather than houses.',
      'Purchasing a home has become increasingly challenging for younger generations.',
      'Building houses is forbidden for young workers in cities.',
      'Most teenagers already own expensive apartments.',
    ],
    correctIndex: 1,
    weight: 2,
  },
];

export function getRankTitle(level: number): { title: string; badge: string } {
  if (level >= 15) return { title: 'Đại Pháp Sư Cổ Ngữ', badge: 'Tier V • Band 6.5+' };
  if (level >= 10) return { title: 'Pháp Sư Học Thuật', badge: 'Tier IV • Band 6.0' };
  if (level >= 6) return { title: 'Kỵ Sĩ Từ Vựng', badge: 'Tier III • Band 5.0' };
  if (level >= 3) return { title: 'Học Giả Thức Tỉnh', badge: 'Tier II • Band 4.0' };
  return { title: 'Tập Sự Bóng Đêm', badge: 'Tier I • Khởi Nguyên' };
}

export function getXpForNextLevel(level: number): number {
  return level * 200;
}

export function estimateMonthsToTarget(currentBand: number, targetBand: number, dailyMinutes: number): {
  hoursNeeded: number;
  months: number;
  recommendedAct: ActNumber;
} {
  const safeDaily = Math.max(60, Math.min(240, dailyMinutes));
  let recommendedAct: ActNumber = 1;
  if (currentBand >= 6.0) recommendedAct = 4;
  else if (currentBand >= 5.0) recommendedAct = 3;
  else if (currentBand >= 4.0) recommendedAct = 2;

  if (currentBand >= targetBand) {
    return { hoursNeeded: 0, months: 0, recommendedAct };
  }

  const gap = targetBand - currentBand;
  // Trung bình cần ~180 giờ học chất lượng cho mỗi 1.0 band tăng thêm
  const hoursNeeded = Math.round(gap * 180);
  const totalDays = Math.ceil((hoursNeeded * 60) / safeDaily);
  const months = Math.max(1, Number((totalDays / 30).toFixed(1)));

  return { hoursNeeded, months, recommendedAct };
}

export function roundIeltsBand(value: number): number {
  const clamped = Math.max(2.0, Math.min(9.0, value));
  return Math.round(clamped * 2) / 2;
}
