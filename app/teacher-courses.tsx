import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const courses = [{ id: "info-management", name: "資訊管理" }];

export default function TeacherCoursesScreen() {
  const router = useRouter();

  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.backText}>← 返回</Text>
          </Pressable>
          <Text style={styles.title}>課程專區</Text>
          <View style={{ width: 48 }} />
        </View>

        <LinearGradient
          colors={["rgba(239,255,249,0.28)", "rgba(172,224,208,0.1)"]}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>已開設課程</Text>

          {courses.map((course) => (
            <Pressable
              key={course.id}
              accessibilityRole="button"
              accessibilityLabel={`進入${course.name}課程`}
              onPress={() =>
                router.push({
                  pathname: "/teacher-course-detail",
                  params: { courseName: course.name },
                } as never)
              }
              style={styles.courseButton}
            >
              <Text style={styles.courseName}>{course.name}</Text>
            </Pressable>
          ))}
        </LinearGradient>
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
  card: {
    marginTop: 30,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    padding: 20,
  },
  cardTitle: {
    color: "#F0FFF9",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 16,
  },
  courseButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.24)",
  },
  courseName: { color: "#F0FFF9", fontSize: 17, fontWeight: "700" },
});
