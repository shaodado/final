import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
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

export default function TeacherAssignTAScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{ courseName?: string }>();

  const courseName = params.courseName || "資訊管理";

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

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );

  const [assignedStudentId, setAssignedStudentId] = useState<string | null>(
    null
  );

  const selectedStudent = students.find(
    (student) => student.studentId === selectedStudentId
  );

  const assignedStudent = students.find(
    (student) => student.studentId === assignedStudentId
  );

  const handleSelectStudent = (studentId: string): void => {
    setSelectedStudentId(studentId);
  };

  const handleAssignTA = (): void => {
    if (!selectedStudent) {
      Alert.alert("尚未選擇助教", "請先選擇一位學生作為助教。");
      return;
    }

    Alert.alert(
      "確認指派",
      `確定要將 ${selectedStudent.name} 指派為「${courseName}」的助教嗎？`,
      [
        {
          text: "取消",
          style: "cancel",
        },
        {
          text: "確認指派",
          onPress: () => {
            setAssignedStudentId(selectedStudent.studentId);

            Alert.alert(
              "指派成功",
              `${selectedStudent.name} 已成為「${courseName}」的助教。`
            );
          },
        },
      ]
    );
  };

  const handleRemoveTA = (): void => {
    if (!assignedStudent) {
      return;
    }

    Alert.alert(
      "取消助教",
      `確定要取消 ${assignedStudent.name} 的助教資格嗎？`,
      [
        {
          text: "取消",
          style: "cancel",
        },
        {
          text: "確認取消",
          style: "destructive",
          onPress: () => {
            setAssignedStudentId(null);
            setSelectedStudentId(null);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="返回課程"
          >
            <Text style={styles.backText}>← 返回</Text>
          </Pressable>

          <Text style={styles.title}>指派助教</Text>

          <View style={styles.headerPlaceholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.courseTitle}>{courseName}</Text>

          <LinearGradient
            colors={["rgba(239,255,249,0.28)", "rgba(172,224,208,0.1)"]}
            style={styles.card}
          >
            <Text style={styles.sectionTitle}>目前助教</Text>

            {assignedStudent ? (
              <View style={styles.assignedContainer}>
                <View style={styles.assignedInfo}>
                  <Text style={styles.assignedName}>
                    {assignedStudent.name}
                  </Text>

                  <Text style={styles.assignedDetail}>
                    {assignedStudent.studentId}
                  </Text>

                  <Text style={styles.assignedDetail}>
                    {assignedStudent.className}
                  </Text>
                </View>

                <Pressable
                  style={styles.removeButton}
                  onPress={handleRemoveTA}
                  accessibilityRole="button"
                  accessibilityLabel="取消助教"
                >
                  <Text style={styles.removeButtonText}>取消助教</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.emptyText}>目前尚未指派助教</Text>
            )}
          </LinearGradient>

          <LinearGradient
            colors={["rgba(239,255,249,0.28)", "rgba(172,224,208,0.1)"]}
            style={styles.card}
          >
            <Text style={styles.sectionTitle}>選擇助教</Text>

            <Text style={styles.description}>
              請從修課學生中選擇一位學生擔任本課程助教。
            </Text>

            {students.map((student) => {
              const isSelected =
                selectedStudentId === student.studentId;

              const isAssigned =
                assignedStudentId === student.studentId;

              return (
                <Pressable
                  key={student.studentId}
                  onPress={() =>
                    handleSelectStudent(student.studentId)
                  }
                  disabled={isAssigned}
                  accessibilityRole="button"
                  accessibilityLabel={`選擇${student.name}擔任助教`}
                  style={[
                    styles.studentCard,
                    isSelected && styles.studentCardSelected,
                    isAssigned && styles.studentCardAssigned,
                  ]}
                >
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>
                      {student.name}
                    </Text>

                    <Text style={styles.studentDetail}>
                      學號：{student.studentId}
                    </Text>

                    <Text style={styles.studentDetail}>
                      班級：{student.className}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.radio,
                      isSelected && styles.radioSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              );
            })}

            <Pressable
              style={[
                styles.assignButton,
                !selectedStudent && styles.assignButtonDisabled,
              ]}
              onPress={handleAssignTA}
              disabled={!selectedStudent}
              accessibilityRole="button"
              accessibilityLabel="確認指派助教"
            >
              <Text
                style={[
                  styles.assignButtonText,
                  !selectedStudent &&
                    styles.assignButtonTextDisabled,
                ]}
              >
                確認指派助教
              </Text>
            </Pressable>
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
    justifyContent: "space-between",
    paddingTop: 22,
  },

  backText: {
    color: "#F0FFF9",
    fontSize: 15,
    fontWeight: "700",
  },

  title: {
    color: "#F0FFF9",
    fontSize: 24,
    fontWeight: "800",
  },

  headerPlaceholder: {
    width: 48,
  },

  content: {
    paddingTop: 10,
    paddingBottom: 40,
  },

  courseTitle: {
    color: "#F0FFF9",
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 22,
  },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    padding: 18,
    marginBottom: 18,
  },

  sectionTitle: {
    color: "#F0FFF9",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 12,
  },

  description: {
    color: "rgba(240,255,249,0.75)",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },

  emptyText: {
    color: "rgba(240,255,249,0.65)",
    fontSize: 15,
  },

  assignedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  assignedInfo: {
    flex: 1,
  },

  assignedName: {
    color: "#F2C14E",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 5,
  },

  assignedDetail: {
    color: "#F0FFF9",
    fontSize: 14,
    marginBottom: 2,
  },

  removeButton: {
    backgroundColor: "rgba(242,140,140,0.2)",
    borderWidth: 1,
    borderColor: "rgba(242,140,140,0.5)",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginLeft: 12,
  },

  removeButtonText: {
    color: "#F28C8C",
    fontSize: 13,
    fontWeight: "800",
  },

  studentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.24)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 15,
    marginBottom: 10,
  },

  studentCardSelected: {
    backgroundColor: "rgba(242,193,78,0.2)",
    borderColor: "#F2C14E",
  },

  studentCardAssigned: {
    opacity: 0.45,
  },

  studentInfo: {
    flex: 1,
  },

  studentName: {
    color: "#F0FFF9",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 5,
  },

  studentDetail: {
    color: "rgba(240,255,249,0.7)",
    fontSize: 13,
    marginBottom: 2,
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(240,255,249,0.6)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  radioSelected: {
    borderColor: "#F2C14E",
  },

  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#F2C14E",
  },

  assignButton: {
    backgroundColor: "#F2C14E",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  assignButtonDisabled: {
    backgroundColor: "rgba(242,193,78,0.3)",
  },

  assignButtonText: {
    color: "#16445A",
    fontSize: 15,
    fontWeight: "800",
  },

  assignButtonTextDisabled: {
    color: "rgba(240,255,249,0.5)",
  },
});