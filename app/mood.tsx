import { GlassDetailScreen } from '@/components/glass-detail-screen';

export default function MoodScreen() {
  return (
    <GlassDetailScreen
      title="心情"
      kicker="A GENTLE CHECK-IN"
      description="不需要急著定義自己。先感受一下，今天的你正站在哪一片天氣裡。"
      icon="sunny-outline"
      accent="#F7D58A"
      items={['用三個詞描述現在的心情', '做一次 60 秒的呼吸練習', '留下給明天自己的話']}
    />
  );
}
