import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Requirement = { name: string; required: number; earned: number; courses: string[]; color: string; icon: keyof typeof Ionicons.glyphMap };
const requirements: Requirement[] = [
  { name: '校定必修', required: 20, earned: 18, courses: ['國文：閱讀與書寫', '英文（一）', '體育', '全民國防教育'], color: '#9AD8ED', icon: 'school-outline' },
  { name: '通識教育', required: 12, earned: 10, courses: ['人文領域', '社會領域', '自然領域', '跨領域課程'], color: '#EAB0D3', icon: 'color-palette-outline' },
  { name: '系核心必修', required: 48, earned: 36, courses: ['使用者經驗設計', '互動媒體程式設計', '資料結構', '網頁設計基礎'], color: '#F2C14E', icon: 'book-outline' },
  { name: '專業選修', required: 28, earned: 18, courses: ['行動應用程式開發', '遊戲設計概論', '資料視覺化', '人工智慧應用'], color: '#C8B6F2', icon: 'code-slash-outline' },
  { name: '自由選修', required: 20, earned: 12, courses: ['基礎日語', '企業實習', '創業管理', '數位行銷'], color: '#F6C98A', icon: 'apps-outline' },
];

// 基本能力門檻（不計入學分）
type CompetencyThreshold = { name: string; status: 'passed' | 'pending'; requirement: string };
const competencyThresholds: CompetencyThreshold[] = [
  { name: '英文能力檢定', status: 'passed', requirement: 'TOEIC 600 分或同等級' },
  { name: '資訊能力檢定', status: 'passed', requirement: 'Python 或 Java 基礎' },
  { name: '中文能力檢定', status: 'pending', requirement: '作文及閱讀理解' },
  { name: '運動能力檢定', status: 'passed', requirement: '體適能測試達標' },
  { name: '專業能力檢定', status: 'pending', requirement: '系專業技能評鑑' },
];

export default function CoursesScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Requirement | null>(null);
  const total = useMemo(() => requirements.reduce((sum, item) => sum + item.required, 0), []);
  const earned = useMemo(() => requirements.reduce((sum, item) => sum + item.earned, 0), []);
  const percent = Math.round((earned / total) * 100);

  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />
      <SafeAreaView style={styles.safeArea}>
        <Pressable
          style={styles.back}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="返回大廳"
        >
          <Ionicons name="arrow-back" size={20} color="#E9FFF7" />
          <Text style={styles.backText}>大廳</Text>
        </Pressable>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>CREDIT PROGRESS</Text>
          <Text style={styles.title}>學分進度管理</Text>


          <View style={styles.summary}>
            <View style={styles.ring}>
              <Text style={styles.ringValue}>{percent}%</Text>
              <Text style={styles.ringLabel}>已完成</Text>
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>畢業學分進度</Text>
              <Text style={styles.summaryValue}>
                {earned} <Text style={styles.summarySmall}>/ {total} 學分</Text>
              </Text>
              <Text style={styles.summaryHint}>尚差 {total - earned} 學分，持續累積中</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>修課類別</Text>
          <View style={styles.list}>
            {requirements.map((item) => {
              const progress = Math.min(item.earned / item.required, 1);
              const isOpen = selected?.name === item.name;
              return (
                <Pressable
                  key={item.name}
                  style={styles.card}
                  onPress={() => setSelected(isOpen ? null : item)}
                  accessibilityRole="button"
                  accessibilityLabel={`查看${item.name}學分`}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.icon, { backgroundColor: `${item.color}2B` }]}>
                      <Ionicons name={item.icon} size={20} color={item.color} />
                    </View>
                    <View style={styles.cardTitleWrap}>
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      <Text style={styles.cardMeta}>
                        {item.earned} / {item.required} 學分
                      </Text>
                    </View>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={19} color="#ABCBC2" />
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: item.color }]} />
                  </View>
                  {isOpen && (
                    <View style={styles.detail}>
                      <Text style={styles.detailTitle}>已納入進度的課程</Text>
                      {item.courses.map((course) => (
                        <View style={styles.course} key={course}>
                          <Ionicons name="checkmark-circle" size={16} color={item.color} />
                          <Text style={styles.courseText}>{course}</Text>
                        </View>
                      ))}
                      <Text style={styles.detailHint}>尚差 {item.required - item.earned} 學分</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>基本能力門檻</Text>
          <View style={styles.thresholdList}>
            {competencyThresholds.map((item) => (
              <View key={item.name} style={styles.thresholdCard}>
                <View style={styles.thresholdTop}>
                  <Ionicons
                    name={item.status === 'passed' ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={item.status === 'passed' ? '#9EF2BE' : '#F2C14E'}
                  />
                  <View style={styles.thresholdCopy}>
                    <Text style={styles.thresholdTitle}>{item.name}</Text>
                    <Text style={styles.thresholdReq}>{item.requirement}</Text>
                  </View>
                </View>
                <Text style={[styles.thresholdStatus, item.status === 'passed' && styles.statusPassed]}>
                  {item.status === 'passed' ? '已通過' : '待檢定'}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#16445A' },
  safeArea: { flex: 1, paddingHorizontal: 24 },
  glow: { position: 'absolute', borderRadius: 999, opacity: 0.48 },
  glowTop: { width: 260, height: 260, top: -120, right: -80, backgroundColor: '#F28C8C' },
  glowBottom: { width: 300, height: 300, bottom: -110, left: -160, backgroundColor: '#F2C14E' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 12, paddingRight: 14 },
  backText: { color: '#E9FFF7', fontSize: 14, fontWeight: '700' },
  content: { paddingTop: 29, paddingBottom: 36 },
  kicker: { color: '#B4D8D2', fontSize: 11, letterSpacing: 1.7, fontWeight: '700' },
  title: { color: '#F0FFF9', fontSize: 32, fontWeight: '800', marginTop: 10 },
  description: { color: '#C3E0D8', fontSize: 15, lineHeight: 23, marginTop: 12 },
  summary: { marginTop: 27, borderRadius: 23, padding: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,255,249,.14)', borderWidth: 1, borderColor: 'rgba(236,255,248,.32)' },
  ring: { width: 91, height: 91, borderRadius: 46, borderWidth: 8, borderColor: '#9EF2BE', alignItems: 'center', justifyContent: 'center' },
  ringValue: { color: '#F0FFF9', fontWeight: '800', fontSize: 20 },
  ringLabel: { color: '#B9DCD2', fontSize: 10, marginTop: 1 },
  summaryCopy: { marginLeft: 18, flex: 1 },
  summaryTitle: { color: '#C3E0D8', fontSize: 12, fontWeight: '700' },
  summaryValue: { color: '#F0FFF9', fontSize: 26, fontWeight: '800', marginTop: 4 },
  summarySmall: { fontSize: 13, color: '#C3E0D8' },
  summaryHint: { color: '#9EF2BE', fontSize: 11, marginTop: 5 },
  sectionTitle: { color: '#F0FFF9', fontSize: 18, fontWeight: '800', marginTop: 31, marginBottom: 13 },
  list: { gap: 10 },
  card: { padding: 14, borderRadius: 18, backgroundColor: 'rgba(11,49,63,.58)', borderWidth: 1, borderColor: 'rgba(236,255,248,.24)' },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardTitleWrap: { flex: 1, marginHorizontal: 10 },
  cardTitle: { color: '#F0FFF9', fontSize: 14, fontWeight: '700' },
  cardMeta: { color: '#A9CEC3', fontSize: 12, marginTop: 3 },
  track: { height: 4, borderRadius: 2, marginTop: 10, backgroundColor: 'rgba(169,206,195,.25)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  detail: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(169,206,195,.25)' },
  detailTitle: { color: '#B9DCD2', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  course: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  courseText: { color: '#E5F7F0', fontSize: 13 },
  detailHint: { color: '#F2C14E', fontSize: 12, fontWeight: '700', marginTop: 8 },
  thresholdList: { gap: 10, marginBottom: 20 },
  thresholdCard: { padding: 13, borderRadius: 16, backgroundColor: 'rgba(11,49,63,.58)', borderWidth: 1, borderColor: 'rgba(236,255,248,.24)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  thresholdTop: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  thresholdCopy: { flex: 1 },
  thresholdTitle: { color: '#F0FFF9', fontSize: 13, fontWeight: '700' },
  thresholdReq: { color: '#A9CEC3', fontSize: 11, marginTop: 2 },
  thresholdStatus: { color: '#F2C14E', fontSize: 12, fontWeight: '700' },
  statusPassed: { color: '#9EF2BE' },
});
