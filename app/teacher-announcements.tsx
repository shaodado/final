import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const initialAnnouncements = [
  {
    id: 1,
    title: "期中考提醒",
    content: "期中考將於 2026/09/15 舉行，請同學準時到場並攜帶證件。",
    expiresAt: "2026年08月30日",
    publishedAt: "2026年08月20日",
  },
  {
    id: 2,
    title: "作業繳交注意事項",
    content: "請將報告繳交至 LMS，並確認檔名格式正確，逾期將扣分。",
    expiresAt: "2026年09月02日",
    publishedAt: "2026年08月18日",
  },
];

export default function TeacherAnnouncementsScreen() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [expiresAt, setExpiresAt] = useState("2026年08月30日");

  const totalAnnouncements = useMemo(
    () => announcements.length,
    [announcements]
  );

  const handlePublish = () => {
    if (!title.trim() || !content.trim()) {
      return;
    }

    const newAnnouncement = {
      id: Date.now(),
      title: title.trim(),
      content: content.trim(),
      expiresAt,
      publishedAt: "2026年08月29日",
    };

    setAnnouncements((current) => [newAnnouncement, ...current]);
    setTitle("");
    setContent("");
    setExpiresAt("2026年08月30日");
    setShowForm(false);
  };

  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.backText}>← 返回</Text>
          </Pressable>
          <Text style={styles.title}>歷史公告</Text>
          <Pressable
            style={styles.addButton}
            onPress={() => setShowForm((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel="新增公告"
          >
            <Text style={styles.addButtonText}>＋</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>公告總數</Text>
          <Text style={styles.summaryValue}>{totalAnnouncements}</Text>
        </View>

        {showForm && (
          <LinearGradient
            colors={["rgba(239,255,249,0.28)", "rgba(172,224,208,0.1)"]}
            style={styles.formCard}
          >
            <Text style={styles.formTitle}>發布公告</Text>

            <Text style={styles.fieldLabel}>主題</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="請輸入公告主題"
              placeholderTextColor="#7BA79C"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>內文</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="請輸入公告內容"
              placeholderTextColor="#7BA79C"
              multiline
              numberOfLines={5}
              style={[styles.input, styles.textArea]}
            />

            <Text style={styles.fieldLabel}>公告失效期限</Text>
            <TextInput
              value={expiresAt}
              onChangeText={setExpiresAt}
              placeholder="例如：2026年08月30日"
              placeholderTextColor="#7BA79C"
              style={styles.input}
            />

            <Pressable
              style={styles.publishButton}
              onPress={handlePublish}
              accessibilityRole="button"
            >
              <Text style={styles.publishButtonText}>發布公告</Text>
            </Pressable>
          </LinearGradient>
        )}

        <ScrollView contentContainerStyle={styles.listContainer}>
          {announcements.map((announcement) => (
            <LinearGradient
              key={announcement.id}
              colors={["rgba(239,255,249,0.28)", "rgba(172,224,208,0.1)"]}
              style={styles.announcementCard}
            >
              <Text style={styles.announcementTitle}>{announcement.title}</Text>
              <Text style={styles.announcementContent}>
                {announcement.content}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  發佈：{announcement.publishedAt}
                </Text>
                <Text style={styles.metaText}>
                  到期：{announcement.expiresAt}
                </Text>
              </View>
            </LinearGradient>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#16445A" },
  safeArea: { flex: 1, paddingHorizontal: 24 },
  glow: { position: "absolute", borderRadius: 999, opacity: 0.48 },
  glowTop: {
    width: 260,
    height: 260,
    top: -120,
    right: -80,
    backgroundColor: "#F28C8C",
  },
  glowBottom: {
    width: 300,
    height: 300,
    bottom: -110,
    left: -160,
    backgroundColor: "#F2C14E",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 22,
  },
  backText: { color: "#F0FFF9", fontSize: 15, fontWeight: "700" },
  title: { color: "#F0FFF9", fontSize: 24, fontWeight: "800" },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2C14E",
  },
  addButtonText: {
    color: "#16445A",
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 28,
  },
  summaryCard: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.25)",
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: { color: "#C3E0D8", fontSize: 13, fontWeight: "700" },
  summaryValue: { color: "#F0FFF9", fontSize: 20, fontWeight: "800" },
  formCard: {
    marginTop: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    padding: 18,
  },
  formTitle: {
    color: "#F0FFF9",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
  },
  fieldLabel: {
    color: "#C3E0D8",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: "rgba(8,47,61,0.38)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#F0FFF9",
    fontSize: 15,
  },
  textArea: { minHeight: 120, textAlignVertical: "top" },
  publishButton: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: "#F2C14E",
    paddingVertical: 12,
    alignItems: "center",
  },
  publishButtonText: { color: "#16445A", fontSize: 15, fontWeight: "800" },
  listContainer: { paddingTop: 18, paddingBottom: 32 },
  announcementCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    padding: 16,
    marginBottom: 14,
  },
  announcementTitle: {
    color: "#F0FFF9",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  announcementContent: { color: "#DDEFE7", fontSize: 14, lineHeight: 20 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 12,
  },
  metaText: { flex: 1, color: "#A9CEC3", fontSize: 11 },
});
