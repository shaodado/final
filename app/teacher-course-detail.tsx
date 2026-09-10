import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Student = {
  studentId: string;
  name: string;
  className: string;
};

const students: Student[] = [
  {
    studentId: "12133001",
    name: "林柏邑",
    className: "資管四乙",
  },
  {
    studentId: "12133002",
    name: "陳志豪",
    className: "資管四乙",
  },
  {
    studentId: "12133003",
    name: "王雅婷",
    className: "資管四乙",
  },
  {
    studentId: "12133004",
    name: "張家豪",
    className: "資管四乙",
  },
  {
    studentId: "12133005",
    name: "李姵君",
    className: "資管四乙",
  },
  {
    studentId: "12133006",
    name: "黃建名",
    className: "資管四乙",
  },
  {
    studentId: "12133007",
    name: "吳佳蓉",
    className: "資管四乙",
  },
  {
    studentId: "12133008",
    name: "劉承恩",
    className: "資管四乙",
  },
  {
    studentId: "12133009",
    name: "蔡明翰",
    className: "資管四乙",
  },
];

type StudentRowProps = {
  student: Student;
};

function StudentRow({ student }: StudentRowProps) {
  return (
    <View style={styles.studentRow}>
      <Text style={[styles.studentCell, styles.studentIdCell]}>
        {student.studentId}
      </Text>

      <Text style={[styles.studentCell, styles.nameCell]}>
        {student.name}
      </Text>

      <Text style={[styles.studentCell, styles.classCell]}>
        {student.className}
      </Text>
    </View>
  );
}

export default function TeacherCourseDetailScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    courseName?: string;
  }>();

  const courseName = params.courseName || "資訊管理";

  const handlePublishAnnouncement = (): void => {
    router.push("/teacher-announcements" as never);
  };

  const handleAssignTA = (): void => {
    router.push({
      pathname: "/teacher-assign-ta",
      params: {
        courseName,
      },
    } as never);
  };

  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safeArea}>
        {/* 頁首 */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="返回上一頁"
          >
            <Text style={styles.backText}>← 返回</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* 課程名稱 */}
          <View style={styles.courseHeader}>
            <Text style={styles.courseTitle}>
              {courseName}
            </Text>

            <Text style={styles.courseDescription}>
              教師課程管理
            </Text>
          </View>

          {/* 功能按鈕 */}
          <View style={styles.actionRow}>
            <Pressable
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel="發布課程公告"
              onPress={handlePublishAnnouncement}
            >
              <Text style={styles.actionText}>
                發布課程公告
              </Text>
            </Pressable>

            <Pressable
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel="指派助教"
              onPress={handleAssignTA}
            >
              <Text style={styles.actionText}>
                指派助教
              </Text>
            </Pressable>
          </View>

          {/* 學生人數 */}
          <LinearGradient
            colors={[
              "rgba(239,255,249,0.28)",
              "rgba(172,224,208,0.1)",
            ]}
            style={styles.card}
          >
            <Text style={styles.sectionLabel}>
              學生人數
            </Text>

            <View style={styles.countContainer}>
              <Text style={styles.studentCount}>
                {students.length}
              </Text>

              <Text style={styles.countUnit}>
                人
              </Text>
            </View>
          </LinearGradient>

          {/* 學生名單 */}
          <LinearGradient
            colors={[
              "rgba(239,255,249,0.28)",
              "rgba(172,224,208,0.1)",
            ]}
            style={styles.card}
          >
            <View style={styles.listHeader}>
              <View>
                <Text style={styles.sectionLabel}>
                  學生名單
                </Text>

                <Text style={styles.listDescription}>
                  共 {students.length} 位學生
                </Text>
              </View>
            </View>

            {/* 表格標題 */}
            <View style={styles.tableHeader}>
              <Text
                style={[
                  styles.tableHeaderText,
                  styles.studentIdCell,
                ]}
              >
                學號
              </Text>

              <Text
                style={[
                  styles.tableHeaderText,
                  styles.nameCell,
                ]}
              >
                姓名
              </Text>

              <Text
                style={[
                  styles.tableHeaderText,
                  styles.classCell,
                ]}
              >
                班級
              </Text>
            </View>

            {/* 學生資料 */}
            {students.map((student) => (
              <StudentRow
                key={student.studentId}
                student={student}
              />
            ))}
          </LinearGradient>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#16445A",
  },

  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },

  glow: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.48,
  },

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
    paddingTop: 22,
  },

  backText: {
    color: "#F0FFF9",
    fontSize: 15,
    fontWeight: "700",
  },

  content: {
    paddingTop: 20,
    paddingBottom: 40,
  },

  courseHeader: {
    marginBottom: 22,
  },

  courseTitle: {
    color: "#F0FFF9",
    fontSize: 32,
    fontWeight: "800",
  },

  courseDescription: {
    color: "rgba(240,255,249,0.6)",
    fontSize: 14,
    marginTop: 6,
  },

  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },

  actionButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#F2C14E",
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  actionText: {
    color: "#16445A",
    fontSize: 14,
    fontWeight: "800",
  },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    padding: 18,
    marginBottom: 18,
  },

  sectionLabel: {
    color: "#F0FFF9",
    fontSize: 17,
    fontWeight: "800",
  },

  countContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 8,
  },

  studentCount: {
    color: "#F0FFF9",
    fontSize: 34,
    fontWeight: "900",
  },

  countUnit: {
    color: "rgba(240,255,249,0.7)",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 5,
  },

  listHeader: {
    marginBottom: 14,
  },

  listDescription: {
    color: "rgba(240,255,249,0.55)",
    fontSize: 12,
    marginTop: 4,
  },

  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(236,255,248,0.25)",
    paddingBottom: 10,
  },

  tableHeaderText: {
    color: "rgba(240,255,249,0.55)",
    fontSize: 12,
    fontWeight: "700",
  },

  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(236,255,248,0.12)",
    paddingVertical: 13,
  },

  studentCell: {
    color: "#F0FFF9",
    fontSize: 13,
  },

  studentIdCell: {
    flex: 1.2,
  },

  nameCell: {
    flex: 0.8,
  },

  classCell: {
    flex: 1,
  },
});
