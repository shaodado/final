import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

type Requirement = {
  name: string;
  required: number;
  earned: number;
  courses: string[];
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const requirements: Requirement[] = [
  {
    name: "校定必修",
    required: 20,
    earned: 18,
    courses: [
      "國文：閱讀與書寫",
      "英文（一）",
      "體育",
      "全民國防教育",
    ],
    color: "#9AD8ED",
    icon: "school-outline",
  },
  {
    name: "通識教育",
    required: 12,
    earned: 10,
    courses: [
      "人文領域",
      "社會領域",
      "自然領域",
      "跨領域課程",
    ],
    color: "#EAB0D3",
    icon: "color-palette-outline",
  },
  {
    name: "系核心必修",
    required: 48,
    earned: 36,
    courses: [
      "使用者經驗設計",
      "互動媒體程式設計",
      "資料結構",
      "網頁設計基礎",
    ],
    color: "#F2C14E",
    icon: "book-outline",
  },
  {
    name: "專業選修",
    required: 28,
    earned: 18,
    courses: [
      "行動應用程式開發",
      "遊戲設計概論",
      "資料視覺化",
      "人工智慧應用",
    ],
    color: "#C8B6F2",
    icon: "code-slash-outline",
  },
  {
    name: "自由選修",
    required: 20,
    earned: 12,
    courses: [
      "基礎日語",
      "企業實習",
      "創業管理",
      "數位行銷",
    ],
    color: "#F6C98A",
    icon: "apps-outline",
  },
];

type CompetencyThreshold = {
  name: string;
  status: "passed" | "pending";
  requirement: string;
};

const competencyThresholds: CompetencyThreshold[] = [
  {
    name: "英文能力檢定",
    status: "passed",
    requirement: "TOEIC 600 分或同等級",
  },
  {
    name: "資訊能力檢定",
    status: "passed",
    requirement: "Python 或 Java 基礎",
  },
  {
    name: "中文能力檢定",
    status: "pending",
    requirement: "作文及閱讀理解",
  },
  {
    name: "運動能力檢定",
    status: "passed",
    requirement: "體適能測試達標",
  },
  {
    name: "專業能力檢定",
    status: "pending",
    requirement: "系專業技能評鑑",
  },
];

type CreditProgressChartProps = {
  percent: number;
};

function CreditProgressChart({
  percent,
}: CreditProgressChartProps) {
  const size = 220;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = Math.min(Math.max(percent, 0), 100);

  const strokeDashoffset =
    circumference - (progress / 100) * circumference;

  return (
    <View style={styles.chartContainer}>
      <Svg width={size} height={size}>
        {/* 缺口 */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* 已完成 */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F2C14E"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      <View style={styles.chartCenter}>
        <Text style={styles.chartPercent}>{progress}%</Text>
        <Text style={styles.chartLabel}>完成度</Text>
      </View>
    </View>
  );
}

type RequirementCardProps = {
  requirement: Requirement;
  selected: boolean;
  onPress: () => void;
};

function RequirementCard({
  requirement,
  selected,
  onPress,
}: RequirementCardProps) {
  const progress =
    requirement.required > 0
      ? Math.min(
          Math.round(
            (requirement.earned / requirement.required) * 100
          ),
          100
        )
      : 0;

  const remaining = Math.max(
    requirement.required - requirement.earned,
    0
  );

  return (
    <Pressable
      style={[
        styles.requirementCard,
        selected && styles.requirementCardSelected,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`查看${requirement.name}學分`}
    >
      <View style={styles.requirementHeader}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: requirement.color },
          ]}
        >
          <Ionicons
            name={requirement.icon}
            size={22}
            color="#16445A"
          />
        </View>

        <View style={styles.requirementTitleContainer}>
          <Text style={styles.requirementName}>
            {requirement.name}
          </Text>

          <Text style={styles.requirementCredits}>
            {requirement.earned} / {requirement.required} 學分
          </Text>
        </View>

        <Text style={styles.requirementPercent}>
          {progress}%
        </Text>
      </View>

      <View style={styles.progressBackground}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${progress}%`,
              backgroundColor: requirement.color,
            },
          ]}
        />
      </View>

      <Text style={styles.remainingText}>
        {remaining > 0
          ? `還需要 ${remaining} 學分`
          : "已完成"}
      </Text>

      {selected && (
        <View style={styles.courseList}>
          <Text style={styles.courseListTitle}>
            課程內容
          </Text>

          {requirement.courses.map((course) => (
            <View
              key={course}
              style={styles.courseItem}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={17}
                color={requirement.color}
              />

              <Text style={styles.courseText}>
                {course}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

type CompetencyCardProps = {
  item: CompetencyThreshold;
};

function CompetencyCard({
  item,
}: CompetencyCardProps) {
  const isPassed = item.status === "passed";

  return (
    <View style={styles.competencyCard}>
      <View style={styles.competencyIcon}>
        <Ionicons
          name={
            isPassed
              ? "checkmark-circle"
              : "time-outline"
          }
          size={24}
          color={isPassed ? "#9AD8ED" : "#F6C98A"}
        />
      </View>

      <View style={styles.competencyContent}>
        <View style={styles.competencyTitleRow}>
          <Text style={styles.competencyName}>
            {item.name}
          </Text>

          <Text
            style={[
              styles.competencyStatus,
              {
                color: isPassed
                  ? "#9AD8ED"
                  : "#F6C98A",
              },
            ]}
          >
            {isPassed ? "已通過" : "待完成"}
          </Text>
        </View>

        <Text style={styles.competencyRequirement}>
          {item.requirement}
        </Text>
      </View>
    </View>
  );
}

export default function CoursesScreen() {
  const router = useRouter();

  const [selectedName, setSelectedName] =
    useState<string | null>(null);

  const totalRequiredCredits = requirements.reduce(
    (sum, item) => sum + item.required,
    0
  );

  const totalEarnedCredits = requirements.reduce(
    (sum, item) => sum + item.earned,
    0
  );

  const remainingCredits = Math.max(
    totalRequiredCredits - totalEarnedCredits,
    0
  );

  const completionPercent =
    totalRequiredCredits > 0
      ? Math.min(
          Math.round(
            (totalEarnedCredits /
              totalRequiredCredits) *
              100
          ),
          100
        )
      : 0;

  const handleSelectRequirement = (
    name: string
  ): void => {
    setSelectedName((currentName) =>
      currentName === name ? null : name
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
            accessibilityLabel="返回"
          >
            <Text style={styles.backText}>
              ← 返回
            </Text>
          </Pressable>

          <Text style={styles.title}>
            學分進度
          </Text>

          <View style={styles.headerPlaceholder} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* 畢業學分進度 */}
          <View style={styles.progressCard}>
            <Text style={styles.sectionTitle}>
              畢業學分進度
            </Text>

            <Text style={styles.sectionDescription}>
              追蹤目前畢業學分完成狀況
            </Text>

            <CreditProgressChart
              percent={completionPercent}
            />

            <View style={styles.creditSummary}>
              <View style={styles.creditSummaryItem}>
                <View style={styles.summaryDotCompleted} />

                <Text style={styles.summaryLabel}>
                  已修學分
                </Text>

                <Text style={styles.summaryValue}>
                  {totalEarnedCredits}
                </Text>
              </View>

              <View style={styles.creditSummaryDivider} />

              <View style={styles.creditSummaryItem}>
                <View style={styles.summaryDotRemaining} />

                <Text style={styles.summaryLabel}>
                  缺口學分
                </Text>

                <Text style={styles.summaryValue}>
                  {remainingCredits}
                </Text>
              </View>

              <View style={styles.creditSummaryDivider} />

              <View style={styles.creditSummaryItem}>
                <Text style={styles.summaryLabel}>
                  畢業要求
                </Text>

                <Text style={styles.summaryValue}>
                  {totalRequiredCredits}
                </Text>
              </View>
            </View>

            <View style={styles.progressMessage}>
              <Ionicons
                name="school-outline"
                size={20}
                color="#F2C14E"
              />

              <Text style={styles.progressMessageText}>
                還需要完成 {remainingCredits} 學分即可達到畢業學分要求
              </Text>
            </View>
          </View>

          {/* 各類學分 */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              各類學分進度
            </Text>

            <Text style={styles.sectionDescription}>
              點擊類別查看相關課程
            </Text>
          </View>

          {requirements.map((requirement) => (
            <RequirementCard
              key={requirement.name}
              requirement={requirement}
              selected={
                selectedName === requirement.name
              }
              onPress={() =>
                handleSelectRequirement(
                  requirement.name
                )
              }
            />
          ))}

          {/* 能力門檻 */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              能力門檻
            </Text>

            <Text style={styles.sectionDescription}>
              畢業前需要完成的能力要求
            </Text>
          </View>

          {competencyThresholds.map((item) => (
            <CompetencyCard
              key={item.name}
              item={item}
            />
          ))}
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
    paddingBottom: 10,
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
    paddingTop: 18,
    paddingBottom: 40,
  },

  progressCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    backgroundColor: "rgba(239,255,249,0.12)",
    padding: 20,
    marginBottom: 30,
  },

  sectionHeader: {
    marginBottom: 16,
  },

  sectionTitle: {
    color: "#F0FFF9",
    fontSize: 21,
    fontWeight: "800",
  },

  sectionDescription: {
    color: "rgba(240,255,249,0.65)",
    fontSize: 13,
    marginTop: 5,
  },

  chartContainer: {
    width: 220,
    height: 220,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 20,
  },

  chartCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },

  chartPercent: {
    color: "#F0FFF9",
    fontSize: 38,
    fontWeight: "900",
  },

  chartLabel: {
    color: "rgba(240,255,249,0.65)",
    fontSize: 14,
    marginTop: 2,
  },

  creditSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },

  creditSummaryItem: {
    flex: 1,
    alignItems: "center",
  },

  creditSummaryDivider: {
    width: 1,
    height: 38,
    backgroundColor: "rgba(240,255,249,0.15)",
  },

  summaryDotCompleted: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#F2C14E",
    marginBottom: 5,
  },

  summaryDotRemaining: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginBottom: 5,
  },

  summaryLabel: {
    color: "rgba(240,255,249,0.6)",
    fontSize: 12,
    marginBottom: 3,
  },

  summaryValue: {
    color: "#F0FFF9",
    fontSize: 18,
    fontWeight: "800",
  },

  progressMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(242,193,78,0.1)",
  },

  progressMessageText: {
    flex: 1,
    color: "rgba(240,255,249,0.8)",
    fontSize: 13,
    lineHeight: 19,
  },

  requirementCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.25)",
    backgroundColor: "rgba(239,255,249,0.10)",
    padding: 17,
    marginBottom: 14,
  },

  requirementCardSelected: {
    borderColor: "rgba(242,193,78,0.6)",
    backgroundColor: "rgba(239,255,249,0.15)",
  },

  requirementHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  requirementTitleContainer: {
    flex: 1,
  },

  requirementName: {
    color: "#F0FFF9",
    fontSize: 16,
    fontWeight: "800",
  },

  requirementCredits: {
    color: "rgba(240,255,249,0.6)",
    fontSize: 13,
    marginTop: 4,
  },

  requirementPercent: {
    color: "#F0FFF9",
    fontSize: 17,
    fontWeight: "800",
  },

  progressBackground: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
    marginTop: 15,
  },

  progressBar: {
    height: "100%",
    borderRadius: 999,
  },

  remainingText: {
    color: "rgba(240,255,249,0.6)",
    fontSize: 12,
    marginTop: 8,
  },

  courseList: {
    borderTopWidth: 1,
    borderTopColor: "rgba(236,255,248,0.15)",
    marginTop: 14,
    paddingTop: 14,
  },

  courseListTitle: {
    color: "#F0FFF9",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 9,
  },

  courseItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 7,
  },

  courseText: {
    flex: 1,
    color: "rgba(240,255,249,0.75)",
    fontSize: 13,
  },

  competencyCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.22)",
    backgroundColor: "rgba(239,255,249,0.08)",
    padding: 15,
    marginBottom: 12,
  },

  competencyIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  competencyContent: {
    flex: 1,
  },

  competencyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  competencyName: {
    flex: 1,
    color: "#F0FFF9",
    fontSize: 15,
    fontWeight: "800",
  },

  competencyStatus: {
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 8,
  },

  competencyRequirement: {
    color: "rgba(240,255,249,0.58)",
    fontSize: 12,
    lineHeight: 17,
  },
});