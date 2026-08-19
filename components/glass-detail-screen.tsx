import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type GlassDetailScreenProps = {
  title: string;
  kicker: string;
  description: string;
  icon: 'sunny-outline' | 'create-outline' | 'book-outline';
  accent: string;
  items: string[];
};

export function GlassDetailScreen({ title, kicker, description, icon, accent, items }: GlassDetailScreenProps) {
  const router = useRouter();

  return (
    <View style={styles.page}>
      <View style={[styles.glow, { backgroundColor: accent }]} />
      <SafeAreaView style={styles.safeArea}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回大廳" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#E9FFF7" />
          <Text style={styles.backText}>大廳</Text>
        </Pressable>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>{kicker}</Text>
          <View style={styles.headingRow}>
            <View style={styles.iconBubble}><Ionicons name={icon} size={28} color={accent} /></View>
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.description}>{description}</Text>
          <LinearGradient colors={['rgba(235,255,247,0.3)', 'rgba(193,237,222,0.08)']} style={styles.panel}>
            <View style={styles.panelHighlight} />
            <Text style={styles.panelTitle}>今天的空間</Text>
            {items.map((item, index) => (
              <View key={item} style={[styles.item, index < items.length - 1 && styles.itemBorder]}>
                <View style={[styles.itemDot, { backgroundColor: accent }]} />
                <Text style={styles.itemText}>{item}</Text>
                <Ionicons name="chevron-forward" size={16} color="#759E94" />
              </View>
            ))}
          </LinearGradient>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0E2929' },
  safeArea: { flex: 1, paddingHorizontal: 24 },
  glow: { position: 'absolute', width: 300, height: 300, borderRadius: 999, top: -130, right: -110, opacity: 0.38 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 12, paddingRight: 14 },
  backText: { color: '#E9FFF7', fontSize: 14, fontWeight: '700' },
  content: { paddingTop: 52, paddingBottom: 36 },
  kicker: { color: '#8FB8AE', fontSize: 11, letterSpacing: 1.7, fontWeight: '700' },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 16 },
  iconBubble: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(235,255,247,0.16)', borderWidth: 1, borderColor: 'rgba(235,255,247,0.4)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#F0FFF9', fontSize: 36, fontWeight: '800' },
  description: { color: '#B5D6CC', fontSize: 16, lineHeight: 24, marginTop: 22, maxWidth: 310 },
  panel: { borderRadius: 26, borderWidth: 1, borderColor: 'rgba(232,255,247,0.35)', padding: 22, marginTop: 42, overflow: 'hidden' },
  panelHighlight: { position: 'absolute', width: 230, height: 70, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.18)', top: -35, left: 20, transform: [{ rotate: '-18deg' }] },
  panelTitle: { color: '#EBFFF7', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 17 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(232,255,247,0.13)' },
  itemDot: { width: 9, height: 9, borderRadius: 5 },
  itemText: { color: '#C9E3DA', fontSize: 14, flex: 1 },
});
