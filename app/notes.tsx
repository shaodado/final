import { GlassDetailScreen } from '@/components/glass-detail-screen';

export default function NotesScreen() {
  return (
    <GlassDetailScreen
      title="筆記"
      kicker="A PLACE FOR THOUGHTS"
      description="把腦海裡飄過的念頭輕輕放下來，讓它們有一個可以被看見的地方。"
      icon="create-outline"
      accent="#A8D8F0"
      items={['寫下今天最想記住的事', '整理一個還沒完成的想法', '回看最近收藏的片段']}
    />
  );
}
