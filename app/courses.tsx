import { GlassDetailScreen } from '@/components/glass-detail-screen';

export default function CoursesScreen() {
  return (
    <GlassDetailScreen
      title="課程"
      kicker="LEARN AT YOUR PACE"
      description="挑一堂適合現在的課，留一點時間給好奇心，也留一點空間給新的可能。"
      icon="book-outline"
      accent="#EAB0D3"
      items={['正念入門：從五分鐘開始', '寫作練習：找到自己的聲音', '睡前伸展：讓身體慢下來']}
    />
  );
}
