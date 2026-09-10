import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Course = {
  id: string;
  name: string;
  code: string;
  className: string;
  students: number;
};

const courses: Course[] = [
  {
    id: "1",
    name: "資料庫系統",
    code: "IM203",
    className: "資管三乙",
    students: 48,
  },
  {
    id: "2",
    name: "系統分析與設計",
    code: "IM305",
    className: "資管三甲",
    students: 52,
  },
  {
    id: "3",
    name: "專案管理",
    code: "IM401",
    className: "資管四乙",
    students: 45,
  },
  {
    id: "4",
    name: "管理資訊系統",
    code: "IM302",
    className: "資管三乙",
    students: 50,
  },
];

export default function TeacherCoursesScreen() {
  const router = useRouter();

  const handleBack = (): void => {
    router.back();
  };

  const handleCoursePress = (course: Course): void => {
    router.push({
      pathname: "/teacher-course-detail",
      params: {
        courseId: course.id,
        courseName: course.name,
        courseCode: course.code,
        className: course.className,
      },
    } as never);
  };

  return (
    <View style={styles.page}>
      {/* 背景裝飾 */}
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* =========================
              Header
             ========================= */}
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="返回老師專區"
              onPress={handleBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
            >
              <Text style={styles.backIcon}>‹</Text>
              <Text style={styles.backText}>返回</Text>
            </Pressable>

            <View style={styles.headerTitleArea}>
              <Text style={styles.eyebrow}>TEACHER COURSES</Text>

              <Text style={styles.title}>課程專區</Text>
            </View>

            <View style={styles.headerPlaceholder} />
          </View>

          {/* =========================
              Introduction
             ========================= */}
          <View style={styles.introduction}>
            <View style={styles.badge}>
              <View style={styles.onlineDot} />

              <Text style={styles.badgeText}>
                COURSE MANAGEMENT
              </Text>
            </View>

            <Text style={styles.introductionTitle}>
              選擇要管理的課程
            </Text>

            <Text style={styles.introductionDescription}>
              查看課程資訊、管理學生與發布課程公告
            </Text>
          </View>

          {/* =========================
              Course Summary
             ========================= */}
          <View style={styles.summaryCard}>
            <LinearGradient
              colors={[
                "rgba(250,255,253,0.12)",
                "rgba(178,225,212,0.06)",
              ]}
              style={styles.summaryGradient}
            >
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>
                  {courses.length}
                </Text>

                <Text style={styles.summaryLabel}>
                  授課課程
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>
                  {courses.reduce(
                    (total, course) => total + course.students,
                    0
                  )}
                </Text>

                <Text style={styles.summaryLabel}>
                  修課學生
                </Text>
              </View>
            </LinearGradient>
          </View>

          {/* =========================
              Course List
             ========================= */}
          <View style={styles.courseSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                我的課程
              </Text>

              <Text style={styles.sectionCount}>
                {courses.length} COURSES
              </Text>
            </View>

            <View style={styles.courseList}>
              {courses.map((course, index) => (
                <Pressable
                  key={course.id}
                  accessibilityRole="button"
                  accessibilityLabel={`查看${course.name}`}
                  onPress={() => handleCoursePress(course)}
                  style={({ pressed }) => [
                    styles.courseCard,
                    pressed && styles.courseCardPressed,
                  ]}
                >
                  <LinearGradient
                    colors={[
                      "rgba(250,255,253,0.13)",
                      "rgba(178,225,212,0.06)",
                    ]}
                    locations={[0, 1]}
                    style={styles.courseGradient}
                  >
                    {/* 左側編號 */}
                    <View style={styles.courseNumberArea}>
                      <Text style={styles.courseNumber}>
                        {String(index + 1).padStart(2, "0")}
                      </Text>
                    </View>

                    {/* 課程資訊 */}
                    <View style={styles.courseInfo}>
                      <Text style={styles.courseCode}>
                        {course.code}
                      </Text>

                      <Text style={styles.courseName}>
                        {course.name}
                      </Text>

                      <View style={styles.courseMeta}>
                        <Text style={styles.courseMetaText}>
                          {course.className}
                        </Text>

                        <View style={styles.metaDot} />

                        <Text style={styles.courseMetaText}>
                          {course.students} 位學生
                        </Text>
                      </View>
                    </View>

                    {/* 右側箭頭 */}
                    <View style={styles.arrowArea}>
                      <Text style={styles.arrow}>
                        ›
                      </Text>
                    </View>
                  </LinearGradient>
                </Pressable>
              ))}
            </View>
          </View>

          {/* =========================
              Footer
             ========================= */}
          <View style={styles.footer}>
            <View style={styles.footerLine} />

            <Text style={styles.footerText}>
              SELECT A COURSE TO CONTINUE
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  /* =========================
     Page
     ========================= */

  page: {
    flex: 1,
    backgroundColor: "#16445A",
  },

  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },

  scrollContent: {
    paddingBottom: 30,
  },

  /* =========================
     Background
     ========================= */

  glow: {
    position: "absolute",
    borderRadius: 999,
  },

  glowTop: {
    width: 300,
    height: 300,
    top: -150,
    right: -110,
    backgroundColor: "#F28C8C",
    opacity: 0.32,
  },

  glowBottom: {
    width: 340,
    height: 340,
    bottom: -170,
    left: -180,
    backgroundColor: "#F2C14E",
    opacity: 0.24,
  },

  /* =========================
     Header
     ========================= */

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 20,
  },

  backButton: {
    width: 70,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  backButtonPressed: {
    opacity: 0.65,
    transform: [
      {
        scale: 0.95,
      },
    ],
  },

  backIcon: {
    color: "#F0FFF9",
    fontSize: 25,
    lineHeight: 25,
    marginRight: 3,
  },

  backText: {
    color: "#F0FFF9",
    fontSize: 11,
    fontWeight: "700",
  },

  headerTitleArea: {
    alignItems: "center",
  },

  eyebrow: {
    color: "#8FB8AE",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.7,
  },

  title: {
    color: "#F0FFF9",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 4,
  },

  headerPlaceholder: {
    width: 70,
  },

  /* =========================
     Introduction
     ========================= */

  introduction: {
    alignItems: "center",
    marginTop: 38,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#9EF2BE",
    marginRight: 7,
  },

  badgeText: {
    color: "#9EC3B8",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.2,
  },

  introductionTitle: {
    color: "#F1FFF9",
    fontSize: 23,
    fontWeight: "700",
    marginTop: 15,
  },

  introductionDescription: {
    color: "#9EC3B8",
    fontSize: 11,
    marginTop: 7,
    textAlign: "center",
  },

  /* =========================
     Summary
     ========================= */

  summaryCard: {
    marginTop: 28,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(229,255,247,0.15)",
  },

  summaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },

  summaryItem: {
    alignItems: "center",
    minWidth: 110,
  },

  summaryNumber: {
    color: "#D9FFF4",
    fontSize: 22,
    fontWeight: "800",
  },

  summaryLabel: {
    color: "#8FB8AE",
    fontSize: 10,
    marginTop: 4,
  },

  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(180,216,210,0.18)",
  },

  /* =========================
     Course Section
     ========================= */

  courseSection: {
    marginTop: 32,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
  },

  sectionTitle: {
    color: "#F0FFF9",
    fontSize: 17,
    fontWeight: "700",
  },

  sectionCount: {
    color: "#6F9E94",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.2,
  },

  courseList: {
    gap: 12,
  },

  /* =========================
     Course Card
     ========================= */

  courseCard: {
    borderRadius: 18,
    overflow: "hidden",

    shadowColor: "#020D0D",

    shadowOffset: {
      width: 4,
      height: 6,
    },

    shadowOpacity: 0.18,
    shadowRadius: 10,

    elevation: 5,
  },

  courseCardPressed: {
    opacity: 0.75,

    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  courseGradient: {
    minHeight: 92,

    flexDirection: "row",
    alignItems: "center",

    borderWidth: 1,
    borderColor: "rgba(229,255,247,0.15)",

    borderRadius: 18,
  },

  courseNumberArea: {
    width: 55,
    alignItems: "center",
  },

  courseNumber: {
    color: "#6F9E94",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },

  courseInfo: {
    flex: 1,
    paddingVertical: 16,
  },

  courseCode: {
    color: "#6F9E94",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.2,
  },

  courseName: {
    color: "#F0FFF9",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 4,
  },

  courseMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  courseMetaText: {
    color: "#9EC3B8",
    fontSize: 10,
  },

  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#6F9E94",
    marginHorizontal: 8,
  },

  arrowArea: {
    width: 45,
    alignItems: "center",
  },

  arrow: {
    color: "#B4D8D2",
    fontSize: 28,
    fontWeight: "300",
  },

  /* =========================
     Footer
     ========================= */

  footer: {
    alignItems: "center",
    marginTop: 38,
  },

  footerLine: {
    width: 38,
    height: 1,
    backgroundColor: "rgba(180,216,210,0.25)",
    marginBottom: 9,
  },

  footerText: {
    color: "#668F87",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
});
