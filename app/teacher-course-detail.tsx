import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TeacherCourseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ courseName?: string }>();
  const courseName = params.courseName || "資訊管理";

  const students = [
    { studentId: "12133001", name: "林柏邑", className: "資管四乙" },
    { studentId: "12133002", name: "陳志豪", className: "資管四乙" },
    { studentId: "12133003", name: "王雅婷", className: "資管四乙" },
    { studentId: "12133004", name: "張家豪", className: "資管四乙" },
    { studentId: "12133005", name: "李姵君", className: "資管四乙" },
    { studentId: "12133006", name: "黃建名", className: "資管四乙" },
    { studentId: "12133007", name: "吳佳蓉", className: "資管四乙" },
    { studentId: "12133008", name: "劉承恩", className: "資管四乙" },
    { studentId: "12133009", name: "蔡明翰", className: "資管四乙" },
  ];

  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.backText}>← 返回</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.courseTitle}>{courseName}</Text>

          <View style={styles.actionRow}>
            <Pressable
              style={styles.actionButton}
              accessibilityRole="button"
              onPress={() => router.push("/teacher-announcements" as never)}
            >
              <Text style={styles.actionText}>發布課程公告</Text>
            </Pressable>
            <Pressable style={styles.actionButton} accessibilityRole="button">
              <Text style={styles.actionText}>指派助教</Text>
            </Pressable>
          </View>

          <LinearGradient
            colors={["rgba(239,255,249,0.28)", "rgba(172,224,208,0.1)"]}
            style={styles.card}
          >
            <Text style={styles.sectionLabel}>學生人數</Text>
            <Text style={styles.studentCount}>{students.length} 人</Text>
          </LinearGradient>

          <LinearGradient
            colors={["rgba(239,255,249,0.28)", "rgba(172,224,208,0.1)"]}
            style={styles.card}
          >
            <Text style={styles.sectionLabel}>學生名單</Text>
            {students.map((student) => (
              <View key={student.studentId} style={styles.studentRow}>
                <Text style={styles.studentCell}>{student.studentId}</Text>
                <Text style={styles.studentCell}>{student.name}</Text>
                <Text style={styles.studentCell}>{student.className}</Text>
              </View>
            ))}
          </LinearGradient>
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
  content: { paddingTop: 10, paddingBottom: 32 },
  courseTitle: {
    color: "#F0FFF9",
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 22,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#F2C14E",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { color: "#16445A", fontSize: 14, fontWeight: "800" },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    padding: 18,
    marginBottom: 18,
  },
  sectionLabel: {
    color: "#F0FFF9",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  studentCount: { color: "#F0FFF9", fontSize: 18, fontWeight: "700" },
  studentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(236,255,248,0.2)",
    paddingTop: 10,
    marginTop: 10,
  },
  studentCell: { color: "#F0FFF9", fontSize: 14, flex: 1 },
});
