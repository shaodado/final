import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const courses = [
  { name: '使用者經驗設計', teacher: '林怡君', time: '週二 10:10–12:00', rating: 4.7 },
  { name: '資料視覺化', teacher: '陳柏宇', time: '週四 13:10–15:00', rating: 4.5 },
  { name: '互動媒體程式設計', teacher: '張雅雯', time: '週五 09:10–12:00', rating: 4.8 },
];
type Panel = 'rate' | 'quiz' | 'reviews' | 'details' | 'reminder' | null;

export default function MoodScreen() {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [rating, setRating] = useState(0);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);
  const [reminderOn, setReminderOn] = useState(false);
  const open = (next: Panel) => { setPanel(next); if (next === 'quiz') { setQuizStep(0); setQuizAnswers([]); } };
  const answer = (value: string) => { setQuizAnswers((old) => [...old, value]); if (quizStep < 2) setQuizStep((old) => old + 1); };

  return <View style={styles.page}>
    <View style={[styles.glow, styles.glowTop]} /><View style={[styles.glow, styles.glowBottom]} />
    <SafeAreaView style={styles.safeArea}>
      <Pressable accessibilityRole="button" accessibilityLabel="返回大廳" onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={20} color="#E9FFF7" /><Text style={styles.backText}>大廳</Text></Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>COURSE SELECTION HUB</Text><Text style={styles.title}>選課模組</Text><Text style={styles.description}>探索適合自己的課程，也讓每一份修課經驗成為下一位同學的參考。</Text>
        <Text style={styles.sectionTitle}>選課工具</Text>
        <View style={styles.actionList}>
          <Action title="給予課程評價" detail="分享修課後的真實感受" icon="star-outline" color="#F2C14E" onPress={() => open('rate')} />
          <Action title="進行趣味心理測驗" detail="完成測驗，取得適配課程推薦" icon="sparkles-outline" color="#F28C8C" onPress={() => open('quiz')} />
          <Action title="查看結構化課程評價" detail="快速比較課程特色與回饋" icon="bar-chart-outline" color="#9AD8ED" onPress={() => open('reviews')} />
          <Action title="查看課程詳細資訊" detail="了解教師、時間與課程內容" icon="information-circle-outline" color="#B6E3C2" onPress={() => open('details')} />
          <Action title="接收選課時程提醒" detail={reminderOn ? '提醒已開啟' : '重要日期不再錯過'} icon="notifications-outline" color="#EAB0D3" active={reminderOn} onPress={() => open('reminder')} />
        </View>
        {panel && <PanelContent panel={panel} close={() => setPanel(null)} rating={rating} setRating={setRating} quizStep={quizStep} answers={quizAnswers} answer={answer} reminderOn={reminderOn} setReminderOn={setReminderOn} />}
      </ScrollView>
    </SafeAreaView>
  </View>;
}

function Action({ title, detail, icon, color, active, onPress }: { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; color: string; active?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.actionButton}><LinearGradient colors={['rgba(239,255,249,0.34)', 'rgba(172,224,208,0.09)']} style={styles.actionGradient}><View style={[styles.actionIcon, { backgroundColor: `${color}35`, borderColor: `${color}75` }]}><Ionicons name={icon} size={21} color={color} /></View><View style={styles.actionCopy}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionDetail}>{detail}</Text></View><Ionicons name={active ? 'checkmark-circle' : 'chevron-forward'} size={21} color={active ? color : '#8EB5AA'} /></LinearGradient></Pressable>;
}

function PanelContent({ panel, close, rating, setRating, quizStep, answers, answer, reminderOn, setReminderOn }: { panel: Exclude<Panel, null>; close: () => void; rating: number; setRating: (n: number) => void; quizStep: number; answers: string[]; answer: (value: string) => void; reminderOn: boolean; setReminderOn: (n: boolean) => void }) {
  const questions = [['你最享受哪種學習方式？', '動手做作品', '分析與研究'], ['你希望課程帶來什麼？', '實用技能', '新鮮觀點'], ['你偏好的課堂節奏？', '明確、有規劃', '自由、可探索']];
  const done = answers.length === 3;
  const heading = panel === 'rate' ? '給予課程評價' : panel === 'quiz' ? '趣味心理測驗' : panel === 'reviews' ? '結構化課程評價' : panel === 'details' ? '課程詳細資訊' : '選課時程提醒';
  return <View style={styles.panel}><View style={styles.panelHeader}><Text style={styles.panelTitle}>{heading}</Text><Pressable accessibilityLabel="關閉" onPress={close} hitSlop={10}><Ionicons name="close" size={22} color="#D7F0E8" /></Pressable></View>
    {panel === 'rate' && <><Text style={styles.panelCopy}>使用者經驗設計 · 林怡君</Text><View style={styles.stars}>{[1, 2, 3, 4, 5].map((n) => <Pressable key={n} onPress={() => setRating(n)}><Ionicons name={n <= rating ? 'star' : 'star-outline'} size={31} color="#F2C14E" /></Pressable>)}</View><Pressable style={styles.primaryButton} onPress={() => rating ? Alert.alert('已送出評價', '謝謝你的回饋！') : Alert.alert('請先評分', '請選擇 1 到 5 顆星。')}><Text style={styles.primaryText}>送出評價</Text></Pressable></>}
    {panel === 'quiz' && (done ? <><Text style={styles.recommendKicker}>你的測驗報告</Text><Text style={styles.recommendTitle}>適合從「動手探索」開始</Text><Text style={styles.panelCopy}>依你的回答，推薦你優先查看互動媒體程式設計與使用者經驗設計。</Text><CourseRows /></> : <><Text style={styles.progress}>第 {quizStep + 1} / 3 題</Text><Text style={styles.question}>{questions[quizStep][0]}</Text><Pressable style={styles.option} onPress={() => answer(questions[quizStep][1])}><Text style={styles.optionText}>{questions[quizStep][1]}</Text></Pressable><Pressable style={styles.option} onPress={() => answer(questions[quizStep][2])}><Text style={styles.optionText}>{questions[quizStep][2]}</Text></Pressable></>)}
    {panel === 'reviews' && <><CourseRows review /><Text style={styles.caption}>發現不當內容嗎？</Text><Pressable style={styles.reportButton} onPress={() => Alert.alert('檢舉已送出', '我們會盡快審核這則課程評價。')}><Ionicons name="flag-outline" size={18} color="#FFBBB6" /><Text style={styles.reportText}>檢舉不當課程評價</Text></Pressable></>}
    {panel === 'details' && <CourseRows details />}
    {panel === 'reminder' && <><Text style={styles.panelCopy}>開啟後，系統會在選課加退選與截止日前提醒你。</Text><Pressable style={[styles.reminderToggle, reminderOn && styles.reminderToggleOn]} onPress={() => setReminderOn(!reminderOn)}><View><Text style={styles.optionText}>選課時程提醒</Text><Text style={styles.caption}>{reminderOn ? '已開啟提醒' : '點擊開啟'}</Text></View><Ionicons name={reminderOn ? 'notifications' : 'notifications-outline'} size={23} color={reminderOn ? '#F2C14E' : '#C3E0D8'} /></Pressable></>}
  </View>;
}

function CourseRows({ review, details }: { review?: boolean; details?: boolean }) {
  return <View style={styles.courseList}>{courses.map((course) => <View key={course.name} style={styles.courseRow}><View style={styles.courseIcon}><Ionicons name={review ? 'star' : 'book-outline'} size={17} color={review ? '#F2C14E' : '#B6E3C2'} /></View><View style={styles.courseCopy}><Text style={styles.courseName}>{course.name}</Text><Text style={styles.courseMeta}>{details ? `${course.teacher} · ${course.time}` : `整體評分 ${course.rating} · ${course.teacher}`}</Text></View></View>)}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#16445A' }, safeArea: { flex: 1, paddingHorizontal: 24 }, glow: { position: 'absolute', borderRadius: 999, opacity: 0.48 }, glowTop: { width: 260, height: 260, top: -120, right: -80, backgroundColor: '#F28C8C' }, glowBottom: { width: 300, height: 300, bottom: -110, left: -160, backgroundColor: '#F2C14E' }, backButton: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 12, paddingRight: 14 }, backText: { color: '#E9FFF7', fontSize: 14, fontWeight: '700' }, content: { paddingTop: 30, paddingBottom: 38 }, kicker: { color: '#B4D8D2', fontSize: 11, letterSpacing: 1.7, fontWeight: '700' }, title: { color: '#F0FFF9', fontSize: 36, fontWeight: '800', marginTop: 10 }, description: { color: '#C3E0D8', fontSize: 15, lineHeight: 23, marginTop: 12, maxWidth: 330 }, sectionTitle: { color: '#F0FFF9', fontSize: 18, fontWeight: '800', marginTop: 32, marginBottom: 13 }, actionList: { gap: 11 }, actionButton: { borderRadius: 20, overflow: 'hidden' }, actionGradient: { minHeight: 76, flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: 'rgba(236,255,248,0.3)', borderRadius: 20 }, actionIcon: { width: 43, height: 43, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, actionCopy: { flex: 1, marginHorizontal: 13 }, actionTitle: { color: '#F0FFF9', fontSize: 15, fontWeight: '800' }, actionDetail: { color: '#A9CEC3', fontSize: 12, marginTop: 4 }, panel: { marginTop: 28, padding: 18, borderRadius: 22, backgroundColor: 'rgba(11,49,63,0.75)', borderWidth: 1, borderColor: 'rgba(236,255,248,0.3)' }, panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, panelTitle: { color: '#F0FFF9', fontSize: 18, fontWeight: '800' }, panelCopy: { color: '#B8D8D0', fontSize: 13, lineHeight: 20, marginTop: 13 }, stars: { flexDirection: 'row', gap: 10, marginTop: 22, marginBottom: 20 }, primaryButton: { alignItems: 'center', backgroundColor: '#F2C14E', borderRadius: 13, paddingVertical: 13 }, primaryText: { color: '#16445A', fontWeight: '800' }, progress: { color: '#8FD5C4', fontSize: 12, fontWeight: '700', marginTop: 18 }, question: { color: '#F0FFF9', fontSize: 16, fontWeight: '700', lineHeight: 24, marginTop: 8, marginBottom: 12 }, option: { borderWidth: 1, borderColor: 'rgba(236,255,248,0.3)', borderRadius: 13, padding: 14, marginTop: 9, backgroundColor: 'rgba(239,255,249,0.08)' }, optionText: { color: '#F0FFF9', fontSize: 14, fontWeight: '700' }, recommendKicker: { color: '#F2C14E', fontSize: 12, fontWeight: '800', marginTop: 17 }, recommendTitle: { color: '#F0FFF9', fontSize: 19, fontWeight: '800', marginTop: 6 }, courseList: { gap: 9, marginTop: 16 }, courseRow: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 13, backgroundColor: 'rgba(239,255,249,0.08)' }, courseIcon: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: 'rgba(239,255,249,0.1)' }, courseCopy: { flex: 1, marginLeft: 10 }, courseName: { color: '#F0FFF9', fontSize: 13, fontWeight: '700' }, courseMeta: { color: '#A9CEC3', fontSize: 11, marginTop: 3 }, caption: { color: '#A9CEC3', fontSize: 12, marginTop: 17, marginBottom: 8 }, reportButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,187,182,0.55)', paddingVertical: 12 }, reportText: { color: '#FFBBB6', fontSize: 13, fontWeight: '800' }, reminderToggle: { marginTop: 19, padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(239,255,249,0.08)', borderWidth: 1, borderColor: 'rgba(236,255,248,0.2)' }, reminderToggleOn: { borderColor: 'rgba(242,193,78,0.75)', backgroundColor: 'rgba(242,193,78,0.13)' },
});
