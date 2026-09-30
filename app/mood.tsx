import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "./_layout";

type CourseItem = {
  course_id: number;
  course_name: string;
  teacher?: string;
  department?: string;
  grade?: string;
  category?: string;
};

type Evaluation = {
  _id: string | { $oid: string };
  eval_id?: number;
  course_id: number;
  user_id?: number;
  sweetness: number;
  easiness: number;
  gains: number;
  comment: string;
  evaluation_status: string;
};

type Panel = "rate" | "quiz" | "reviews" | "details" | "reminder" | null;

const DEPARTMENTS = ["全部", "資訊工程學系", "數位媒體設計系", "全校通識"];
const GRADES = ["全部", "大一", "大二", "大三", "大四"];
const CATEGORIES = ["全部", "必修", "選修", "通識"];

const defaultCourses = [
  {
    name: "使用者經驗設計",
    teacher: "林怡君",
    time: "週二 10:10–12:00",
    rating: 4.7,
  },
  {
    name: "資料視覺化",
    teacher: "陳柏宇",
    time: "週四 13:10–15:00",
    rating: 4.5,
  },
  {
    name: "互動媒體程式設計",
    teacher: "張雅雯",
    time: "週五 09:10–12:00",
    rating: 4.8,
  },
];

const quizQuestions: string[][] = [
  ["你最享受哪種學習方式？", "動手做作品", "分析與研究"],
  ["你希望課程帶來什麼？", "實用技能", "新鮮觀點"],
  ["你偏好的課堂節奏？", "明確、有規劃", "自由、可探索"],
];

export default function MoodScreen() {
  const router = useRouter();
  const { userId, userName } = useAuth();
  const currentUserId = userId || 3001;

  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  const [panel, setPanel] = useState<Panel>(null);

  // 評分指標
  const [sweetness, setSweetness] = useState<number>(0);
  const [easiness, setEasiness] = useState<number>(0);
  const [gains, setGains] = useState<number>(0);
  const [comment, setComment] = useState<string>("");

  // 給評：已修課程選單狀態與分頁控制（20 筆/頁）
  const [myCourses, setMyCourses] = useState<CourseItem[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseItem | null>(null);
  const [courseModalVisible, setCourseModalVisible] = useState<boolean>(false);
  const [myCoursePage, setMyCoursePage] = useState<number>(1);
  const [myCourseTotalPages, setMyCourseTotalPages] = useState<number>(1);
  const [myCourseTotalCount, setMyCourseTotalCount] = useState<number>(0);
  const [loadingMyCourses, setLoadingMyCourses] = useState<boolean>(false);

  // 檢索：篩選條件與搜尋出的全校課程清單
  const [filterDept, setFilterDept] = useState<string>("全部");
  const [filterGrade, setFilterGrade] = useState<string>("全部");
  const [filterCategory, setFilterCategory] = useState<string>("全部");
  const [searchedCourses, setSearchedCourses] = useState<CourseItem[]>([]);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(false);

  // 檢索：特定課程評價彈窗（20 筆/頁）
  const [selectedReviewCourse, setSelectedReviewCourse] =
    useState<CourseItem | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState<boolean>(false);
  const [courseReviews, setCourseReviews] = useState<Evaluation[]>([]);
  const [reviewPage, setReviewPage] = useState<number>(1);
  const [reviewTotalPages, setReviewTotalPages] = useState<number>(1);
  const [reviewTotalCount, setReviewTotalCount] = useState<number>(0);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(false);

  // 心理測驗與提醒
  const [quizStep, setQuizStep] = useState<number>(0);
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);
  const [reminderOn, setReminderOn] = useState<boolean>(false);

  // @ts-ignore
  const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

  // 鍵盤彈起監聽
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(
        () => scrollViewRef.current?.scrollToEnd({ animated: true }),
        100
      );
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // 載入學生已修課程（支援每頁 20 筆分頁查詢）
  const fetchMyCourses = async (page = 1) => {
    try {
      setLoadingMyCourses(true);
      const res = await fetch(
        `${baseUrl}/api/student/my-courses?user_id=${currentUserId}&page=${page}&limit=20`
      );
      const json = await res.json();
      if (json.success) {
        setMyCourses(json.data);
        setMyCoursePage(json.page);
        setMyCourseTotalPages(json.total_pages);
        setMyCourseTotalCount(json.total_count);

        if (!selectedCourse && json.data.length > 0) {
          setSelectedCourse(json.data[0]);
        }
      }
    } catch (err) {
      console.error("載入已修課程失敗:", err);
    } finally {
      setLoadingMyCourses(false);
    }
  };

  // 依條件搜尋課程清單（純課程卡片）
  const fetchFilteredCourses = async (
    dept = filterDept,
    grade = filterGrade,
    category = filterCategory
  ) => {
    try {
      setLoadingCourses(true);
      const url = `${baseUrl}/api/courses/search?department=${encodeURIComponent(
        dept
      )}&grade=${encodeURIComponent(grade)}&category=${encodeURIComponent(category)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setSearchedCourses(json.data);
      }
    } catch (err) {
      console.error("篩選課程失敗:", err);
    } finally {
      setLoadingCourses(false);
    }
  };

  // 抓取特定課程評價（每頁 20 筆分頁）
  const fetchCourseReviewsPage = async (courseId: number, page: number) => {
    try {
      setLoadingReviews(true);
      const url = `${baseUrl}/api/evaluations?course_id=${courseId}&page=${page}&limit=20`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setCourseReviews(json.data);
        setReviewPage(json.page);
        setReviewTotalPages(json.total_pages);
        setReviewTotalCount(json.total_count);
      }
    } catch (err) {
      console.error("載入課程評價失敗:", err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleOpenCourseReviews = (course: CourseItem) => {
    setSelectedReviewCourse(course);
    setReviewPage(1);
    setCourseReviews([]);
    setReviewModalVisible(true);
    fetchCourseReviewsPage(course.course_id, 1);
  };

  const openPanel = (nextPanel: Panel): void => {
    if (panel === nextPanel) {
      setPanel(null);
      return;
    }
    setPanel(nextPanel);

    if (nextPanel === "rate") {
      setSweetness(0);
      setEasiness(0);
      setGains(0);
      setComment("");
      setMyCoursePage(1);
      fetchMyCourses(1);
      setTimeout(
        () => scrollViewRef.current?.scrollToEnd({ animated: true }),
        150
      );
    }

    if (nextPanel === "quiz") {
      setQuizStep(0);
      setQuizAnswers([]);
    }

    if (nextPanel === "reviews") {
      fetchFilteredCourses(filterDept, filterGrade, filterCategory);
    }
  };

  const handleSubmitRating = async (): Promise<void> => {
    Keyboard.dismiss();

    if (!selectedCourse) {
      Alert.alert("請先選擇課程", "請點擊上方下拉選單選擇欲評價的課程。");
      return;
    }
    if (sweetness === 0 || easiness === 0 || gains === 0) {
      Alert.alert("請完成評分", "請為甜度、涼度與收穫度皆選擇 1 到 5 顆星。");
      return;
    }
    const trimmed = comment.trim();
    if (!trimmed) {
      Alert.alert("請填寫心得", "請輸入 30 字以內的修課回饋。");
      return;
    }

    try {
      const res = await fetch(`${baseUrl}/api/evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: selectedCourse.course_id,
          user_id: currentUserId,
          sweetness,
          easiness,
          gains,
          comment: trimmed,
          evaluation_status: "已審核",
        }),
      });
      const json = await res.json();
      if (json.success) {
        Alert.alert(
          "送出成功",
          `你對《${selectedCourse.course_name}》的評價已成功儲存！`
        );
        setSweetness(0);
        setEasiness(0);
        setGains(0);
        setComment("");
        setPanel("reviews");
        fetchFilteredCourses(filterDept, filterGrade, filterCategory);
      } else {
        Alert.alert("送出失敗", json.message || "評價無法記錄。");
      }
    } catch {
      Alert.alert("連線失敗", "無法連接伺服器，請確認後端運行中。");
    }
  };

  const handleAnswer = (value: string): void => {
    setQuizAnswers((curr) => [...curr, value]);
    if (quizStep < quizQuestions.length - 1) setQuizStep((s) => s + 1);
  };

  const isQuizFinished = quizAnswers.length === quizQuestions.length;

  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safeArea}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#E9FFF7" />
          <Text style={styles.backText}>大廳</Text>
        </Pressable>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={[
              styles.content,
              {
                paddingBottom:
                  keyboardHeight > 0
                    ? Platform.OS === "ios"
                      ? 40
                      : keyboardHeight + 20
                    : 40,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View>
                <Text style={styles.kicker}>COURSE SELECTION HUB</Text>
                <Text style={styles.title}>選課模組</Text>
                <Text style={styles.description}>
                  探索適合自己的課程，透過精準課評數據打造最客觀的選課指南。
                </Text>

                <Text style={styles.sectionTitle}>選課工具</Text>

                <View style={styles.actionList}>
                  <View>
                    <Action
                      title="給予課程評價"
                      detail="僅限為已修課程分享真實感受"
                      icon="star-outline"
                      color="#F2C14E"
                      expanded={panel === "rate"}
                      onPress={() => openPanel("rate")}
                    />
                    {/* 1. 給予課程評價面板 */}
                {panel === "rate" && (
                  <View style={styles.panel}>
                    <View style={styles.panelHeader}>
                      <Text style={styles.panelTitle}>給予課程評價</Text>
                      
                    </View>

                    <Text style={styles.inputLabel}>選擇要評價的已修課程</Text>
                    <Pressable
                      style={styles.dropdownBtn}
                      onPress={() => setCourseModalVisible(true)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dropdownCourseTitle}>
                          {selectedCourse
                            ? selectedCourse.course_name
                            : "請選擇課程"}
                        </Text>
                        <Text style={styles.dropdownCourseSub}>
                          {selectedCourse
                            ? `${selectedCourse.teacher || "授課教師"} · ${selectedCourse.category || "必修"} · ${selectedCourse.department || "系所"}`
                            : "點擊載入已修課程"}
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={18} color="#9AD8ED" />
                    </Pressable>

                    <View style={styles.ratingSection}>
                      <StarRatingRow
                        label="甜度"
                        value={sweetness}
                        onChange={setSweetness}
                      />
                      <StarRatingRow
                        label="涼度"
                        value={easiness}
                        onChange={setEasiness}
                      />
                      <StarRatingRow
                        label="收穫"
                        value={gains}
                        onChange={setGains}
                      />
                    </View>

                    <Text style={styles.inputLabel}>
                      心得與回饋（限 30 字）
                    </Text>
                    <TextInput
                      style={styles.commentInput}
                      value={comment}
                      onChangeText={setComment}
                      placeholder="例如：給分扎實、專案實作很有成就感！"
                      placeholderTextColor="#7BA79C"
                      maxLength={30}
                      multiline
                    />
                    <Text style={styles.charCount}>
                      {comment.length} / 30 字
                    </Text>

                    <Pressable
                      style={styles.primaryButton}
                      onPress={handleSubmitRating}
                    >
                      <Text style={styles.primaryText}>送出評價</Text>
                    </Pressable>
                  </View>
                )}

                
                  </View>
                  <View>
                    <Action
                      title="進行趣味心理測驗"
                      detail="完成測驗，取得適配課程推薦"
                      icon="sparkles-outline"
                      color="#F28C8C"
                      expanded={panel === "quiz"}
                      onPress={() => openPanel("quiz")}
                    />
                    {/* 3. 心理測驗 */}
                {panel === "quiz" && (
                  <View style={styles.panel}>
                    <View style={styles.panelHeader}>
                      <Text style={styles.panelTitle}>趣味心理測驗</Text>
                      
                    </View>
                    {isQuizFinished ? (
                      <>
                        <Text style={styles.recommendKicker}>你的測驗報告</Text>
                        <Text style={styles.recommendTitle}>
                          適合從「動手探索」開始
                        </Text>
                        <Text style={styles.panelCopy}>
                          依你的回答，推薦你優先查看互動媒體程式設計與使用者經驗設計。
                        </Text>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => {
                            setQuizStep(0);
                            setQuizAnswers([]);
                          }}
                        >
                          <Text style={styles.secondaryText}>重新測驗</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Text style={styles.progress}>
                          第 {quizStep + 1} / {quizQuestions.length} 題
                        </Text>
                        <Text style={styles.question}>
                          {quizQuestions[quizStep][0]}
                        </Text>
                        <Pressable
                          style={styles.option}
                          onPress={() =>
                            handleAnswer(quizQuestions[quizStep][1])
                          }
                        >
                          <Text style={styles.optionText}>
                            {quizQuestions[quizStep][1]}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.option}
                          onPress={() =>
                            handleAnswer(quizQuestions[quizStep][2])
                          }
                        >
                          <Text style={styles.optionText}>
                            {quizQuestions[quizStep][2]}
                          </Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}

                
                  </View>
                  <View>
                    <Action
                      title="查看結構化課程評價"
                      detail="依系所、年級、必選修精準搜尋"
                      icon="bar-chart-outline"
                      color="#9AD8ED"
                      expanded={panel === "reviews"}
                      onPress={() => openPanel("reviews")}
                    />
                    {/* 2. 結構化課程評價面板 */}
                {panel === "reviews" && (
                  <View style={styles.panel}>
                    <View style={styles.panelHeader}>
                      <Text style={styles.panelTitle}>結構化課程評價檢索</Text>
                      
                    </View>

                    <Text style={styles.filterTitle}>系所別</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.pillRow}
                    >
                      {DEPARTMENTS.map((dept) => (
                        <Pressable
                          key={dept}
                          style={[
                            styles.pill,
                            filterDept === dept && styles.pillActive,
                          ]}
                          onPress={() => {
                            setFilterDept(dept);
                            fetchFilteredCourses(
                              dept,
                              filterGrade,
                              filterCategory
                            );
                          }}
                        >
                          <Text
                            style={[
                              styles.pillText,
                              filterDept === dept && styles.pillTextActive,
                            ]}
                          >
                            {dept}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    <Text style={styles.filterTitle}>年級</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.pillRow}
                    >
                      {GRADES.map((g) => (
                        <Pressable
                          key={g}
                          style={[
                            styles.pill,
                            filterGrade === g && styles.pillActive,
                          ]}
                          onPress={() => {
                            setFilterGrade(g);
                            fetchFilteredCourses(filterDept, g, filterCategory);
                          }}
                        >
                          <Text
                            style={[
                              styles.pillText,
                              filterGrade === g && styles.pillTextActive,
                            ]}
                          >
                            {g}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    <Text style={styles.filterTitle}>修別</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.pillRow}
                    >
                      {CATEGORIES.map((cat) => (
                        <Pressable
                          key={cat}
                          style={[
                            styles.pill,
                            filterCategory === cat && styles.pillActive,
                          ]}
                          onPress={() => {
                            setFilterCategory(cat);
                            fetchFilteredCourses(filterDept, filterGrade, cat);
                          }}
                        >
                          <Text
                            style={[
                              styles.pillText,
                              filterCategory === cat && styles.pillTextActive,
                            ]}
                          >
                            {cat}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    <View style={styles.divider} />

                    {loadingCourses ? (
                      <Text
                        style={[
                          styles.panelCopy,
                          { textAlign: "center", paddingVertical: 18 },
                        ]}
                      >
                        正在篩選符合的課程...
                      </Text>
                    ) : searchedCourses.length === 0 ? (
                      <Text
                        style={[
                          styles.panelCopy,
                          { textAlign: "center", paddingVertical: 18 },
                        ]}
                      >
                        沒有符合此條件的課程。
                      </Text>
                    ) : (
                      <View style={{ gap: 10 }}>
                        <Text style={styles.courseListHint}>
                          點擊課程即可查看詳細評價：
                        </Text>
                        {searchedCourses.map((course) => (
                          <Pressable
                            key={course.course_id}
                            style={styles.courseSelectCard}
                            onPress={() => handleOpenCourseReviews(course)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.courseCardName}>
                                {course.course_name}
                              </Text>
                              <Text style={styles.courseCardMeta}>
                                {course.teacher || "授課教師"} ·{" "}
                                {course.department || "系所"} ·{" "}
                                {course.grade || "年級"} ·{" "}
                                {course.category || "修別"}
                              </Text>
                            </View>
                            <View style={styles.viewBadge}>
                              <Ionicons
                                name="chevron-forward"
                                size={15}
                                color="#ffffff"
                              />
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                
                  </View>
                  <View>
                    <Action
                      title="查看課程詳細資訊"
                      detail="了解教師、時間與課程內容"
                      icon="information-circle-outline"
                      color="#B6E3C2"
                      expanded={panel === "details"}
                      onPress={() => openPanel("details")}
                    />
                    {/* 4. 課程詳細資訊 */}
                {panel === "details" && (
                  <View style={styles.panel}>
                    <View style={styles.panelHeader}>
                      <Text style={styles.panelTitle}>課程詳細資訊</Text>
                      
                    </View>
                    <View style={{ gap: 10, marginTop: 14 }}>
                      {defaultCourses.map((c) => (
                        <View key={c.name} style={styles.courseSelectItem}>
                          <Text style={styles.courseSelectName}>{c.name}</Text>
                          <Text style={styles.courseSelectDetail}>
                            {c.teacher} · {c.time}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                
                  </View>
                  <View>
                    <Action
                      title="接收選課時程提醒"
                      detail={reminderOn ? "提醒已開啟" : "重要日期不再錯過"}
                      icon="notifications-outline"
                      color="#EAB0D3"
                      active={reminderOn}
                      expanded={panel === "reminder"}
                      onPress={() => openPanel("reminder")}
                    />
                    {/* 5. 選課提醒 */}
                {panel === "reminder" && (
                  <View style={styles.panel}>
                    <View style={styles.panelHeader}>
                      <Text style={styles.panelTitle}>選課時程提醒</Text>
                      
                    </View>
                    <Text style={styles.panelCopy}>
                      開啟後，系統會在選課加退選與截止日前主動提醒你。
                    </Text>
                    <Pressable
                      style={[
                        styles.dropdownBtn,
                        { marginTop: 14 },
                        reminderOn && { borderColor: "#F2C14E" },
                      ]}
                      onPress={() => setReminderOn(!reminderOn)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dropdownCourseTitle}>
                          選課時程通知
                        </Text>
                        <Text style={styles.dropdownCourseSub}>
                          {reminderOn ? "已開啟推播" : "點擊開啟"}
                        </Text>
                      </View>
                      <Ionicons
                        name={
                          reminderOn ? "notifications" : "notifications-outline"
                        }
                        size={22}
                        color={reminderOn ? "#F2C14E" : "#C3E0D8"}
                      />
                    </Pressable>
                  </View>
                )}
              
                  </View>
                </View>

                </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* 彈出視窗 1：選擇已修課程 Modal（升級 75% 高度與每頁 20 筆分頁列） */}
        <Modal visible={courseModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { height: "75%" }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.modalTitle}>選擇已修課程</Text>
                  <Text style={styles.modalSubtitle}>
                    僅顯示個人成績紀錄中已修過之課程
                  </Text>
                </View>
                <Pressable onPress={() => setCourseModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#F0FFF9" />
                </Pressable>
              </View>

              {loadingMyCourses ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={styles.panelCopy}>載入已修課程中...</Text>
                </View>
              ) : myCourses.length === 0 ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={styles.panelCopy}>查無已修課程紀錄。</Text>
                </View>
              ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                >
                  {myCourses.map((c) => (
                    <Pressable
                      key={c.course_id}
                      style={[
                        styles.courseSelectItem,
                        selectedCourse?.course_id === c.course_id &&
                          styles.courseSelectItemActive,
                      ]}
                      onPress={() => {
                        setSelectedCourse(c);
                        setCourseModalVisible(false);
                      }}
                    >
                      <Text style={styles.courseSelectName}>
                        {c.course_name}
                      </Text>
                      <Text style={styles.courseSelectDetail}>
                        {c.teacher || "授課教師"} · {c.department || "系所"} (
                        {c.category || "必修"})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {/* 已修課程分頁切換列 */}
              {myCourseTotalCount > 0 && (
                <View style={styles.paginationBar}>
                  <Pressable
                    style={[
                      styles.pageBtn,
                      myCoursePage <= 1 && styles.pageBtnDisabled,
                    ]}
                    disabled={myCoursePage <= 1 || loadingMyCourses}
                    onPress={() => fetchMyCourses(myCoursePage - 1)}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={16}
                      color={myCoursePage <= 1 ? "#5C7E77" : "#16445A"}
                    />
                    <Text
                      style={[
                        styles.pageBtnText,
                        myCoursePage <= 1 && styles.pageBtnTextDisabled,
                      ]}
                    >
                      上一頁
                    </Text>
                  </Pressable>

                  <Text style={styles.pageInfoText}>
                    第 {myCoursePage} / {myCourseTotalPages} 頁（共{" "}
                    {myCourseTotalCount} 門）
                  </Text>

                  <Pressable
                    style={[
                      styles.pageBtn,
                      myCoursePage >= myCourseTotalPages &&
                        styles.pageBtnDisabled,
                    ]}
                    disabled={
                      myCoursePage >= myCourseTotalPages || loadingMyCourses
                    }
                    onPress={() => fetchMyCourses(myCoursePage + 1)}
                  >
                    <Text
                      style={[
                        styles.pageBtnText,
                        myCoursePage >= myCourseTotalPages &&
                          styles.pageBtnTextDisabled,
                      ]}
                    >
                      下一頁
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={
                        myCoursePage >= myCourseTotalPages
                          ? "#5C7E77"
                          : "#16445A"
                      }
                    />
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* 彈出視窗 2：特定課程評價獨立頁面（每頁 20 筆分頁列） */}
        <Modal visible={reviewModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { height: "75%" }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {selectedReviewCourse?.course_name}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedReviewCourse?.teacher} ·{" "}
                    {selectedReviewCourse?.department} (
                    {selectedReviewCourse?.category})
                  </Text>
                </View>
                <Pressable onPress={() => setReviewModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#F0FFF9" />
                </Pressable>
              </View>

              {loadingReviews ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={styles.panelCopy}>載入評價中...</Text>
                </View>
              ) : courseReviews.length === 0 ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={styles.panelCopy}>
                    此課程目前尚無學長姐的詳細評分心得。
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                >
                  {courseReviews.map((ev, idx) => (
                    <View
                      key={String(typeof ev._id === "object" ? ev._id : idx)}
                      style={styles.singleEvalCard}
                    >
                      <View style={styles.evalScoreRow}>
                        <Text style={styles.scoreText}>
                          甜度 {ev.sweetness}★
                        </Text>
                        <Text style={styles.metricDivider}>·</Text>
                        <Text style={styles.scoreText}>
                          涼度 {ev.easiness}★
                        </Text>
                        <Text style={styles.metricDivider}>·</Text>
                        <Text style={styles.scoreText}>收穫 {ev.gains}★</Text>
                      </View>
                      <Text style={styles.evalCommentText}>{ev.comment}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}

              {reviewTotalCount > 0 && (
                <View style={styles.paginationBar}>
                  <Pressable
                    style={[
                      styles.pageBtn,
                      reviewPage <= 1 && styles.pageBtnDisabled,
                    ]}
                    disabled={reviewPage <= 1 || loadingReviews}
                    onPress={() =>
                      fetchCourseReviewsPage(
                        selectedReviewCourse!.course_id,
                        reviewPage - 1
                      )
                    }
                  >
                    <Ionicons
                      name="chevron-back"
                      size={16}
                      color={reviewPage <= 1 ? "#5C7E77" : "#16445A"}
                    />
                    <Text
                      style={[
                        styles.pageBtnText,
                        reviewPage <= 1 && styles.pageBtnTextDisabled,
                      ]}
                    >
                      上一頁
                    </Text>
                  </Pressable>

                  <Text style={styles.pageInfoText}>
                    第 {reviewPage} / {reviewTotalPages} 頁（共{" "}
                    {reviewTotalCount} 則）
                  </Text>

                  <Pressable
                    style={[
                      styles.pageBtn,
                      reviewPage >= reviewTotalPages && styles.pageBtnDisabled,
                    ]}
                    disabled={reviewPage >= reviewTotalPages || loadingReviews}
                    onPress={() =>
                      fetchCourseReviewsPage(
                        selectedReviewCourse!.course_id,
                        reviewPage + 1
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.pageBtnText,
                        reviewPage >= reviewTotalPages &&
                          styles.pageBtnTextDisabled,
                      ]}
                    >
                      下一頁
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={
                        reviewPage >= reviewTotalPages ? "#5C7E77" : "#16445A"
                      }
                    />
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

function StarRatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      <Text style={styles.starRowLabel}>{label}</Text>
      <View style={styles.starsGroup}>
        {[1, 2, 3, 4, 5].map((num) => (
          <Pressable key={num} onPress={() => onChange(num)} hitSlop={6}>
            <Ionicons
              name={num <= value ? "star" : "star-outline"}
              size={22}
              color="#F2C14E"
            />
          </Pressable>
        ))}
      </View>
      <Text style={styles.starRowValue}>{value > 0 ? `${value} ★` : "-"}</Text>
    </View>
  );
}

function Action({
  title,
  detail,
  icon,
  color,
  active,
  expanded,
  onPress,
}: {
  title: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  active?: boolean;
  expanded?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionButton} onPress={onPress}>
      <LinearGradient
        colors={["rgba(239,255,249,0.34)", "rgba(172,224,208,0.09)"]}
        style={styles.actionGradient}
      >
        <View
          style={[
            styles.actionIcon,
            { backgroundColor: `${color}35`, borderColor: `${color}75` },
          ]}
        >
          <Ionicons name={icon} size={21} color={color} />
        </View>
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionDetail}>{detail}</Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-down" : active ? "checkmark-circle" : "chevron-forward"}
          size={21}
          color={expanded || active ? color : "#8EB5AA"}
        />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#16445A" },
  safeArea: { flex: 1, paddingHorizontal: 20 },
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
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
  },
  backText: { color: "#E9FFF7", fontSize: 14, fontWeight: "700" },
  content: { paddingTop: 10 },
  kicker: {
    color: "#B4D8D2",
    fontSize: 11,
    letterSpacing: 1.7,
    fontWeight: "700",
  },
  title: { color: "#F0FFF9", fontSize: 34, fontWeight: "800", marginTop: 8 },
  description: {
    color: "#C3E0D8",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  sectionTitle: {
    color: "#F0FFF9",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 26,
    marginBottom: 12,
  },
  actionList: { gap: 11 },
  actionButton: { borderRadius: 20, overflow: "hidden" },
  actionGradient: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    borderRadius: 20,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCopy: { flex: 1, marginHorizontal: 13 },
  actionTitle: { color: "#F0FFF9", fontSize: 15, fontWeight: "800" },
  actionDetail: { color: "#A9CEC3", fontSize: 12, marginTop: 4 },
  panel: {
    marginTop: 8,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "rgba(239,255,249,0.12)",
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  panelTitle: { color: "#F0FFF9", fontSize: 18, fontWeight: "800" },
  panelCopy: { color: "#B8D8D0", fontSize: 13, lineHeight: 20 },
  inputLabel: {
    color: "#C3E0D8",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 10,
  },

  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,255,249,0.12)",
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    borderRadius: 14,
    padding: 12,
  },
  dropdownCourseTitle: { color: "#F0FFF9", fontSize: 15, fontWeight: "800" },
  dropdownCourseSub: { color: "#9AD8ED", fontSize: 11, marginTop: 3 },

  ratingSection: {
    backgroundColor: "rgba(239,255,249,0.12)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    padding: 12,
    marginVertical: 12,
    gap: 8,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  starRowLabel: {
    color: "#E9FFF7",
    fontSize: 13,
    fontWeight: "700",
    width: 40,
  },
  starsGroup: { flexDirection: "row", gap: 6 },
  starRowValue: {
    color: "#F2C14E",
    fontSize: 12,
    fontWeight: "700",
    width: 28,
    textAlign: "right",
  },

  commentInput: {
    backgroundColor: "rgba(239,255,249,0.12)",
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    borderRadius: 14,
    padding: 12,
    color: "#F0FFF9",
    fontSize: 14,
    minHeight: 65,
    textAlignVertical: "top",
  },
  charCount: {
    color: "#A9CEC3",
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
    marginBottom: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#F2C14E",
    borderRadius: 13,
    paddingVertical: 12,
  },
  primaryText: { color: "#16445A", fontWeight: "800" },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    paddingVertical: 12,
    marginTop: 16,
  },
  secondaryText: { color: "#C3E0D8", fontSize: 13, fontWeight: "800" },

  filterTitle: {
    color: "#B4D8D2",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 6,
  },
  pillRow: { flexDirection: "row", marginBottom: 6 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(239,255,249,0.08)",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.2)",
  },
  pillActive: { backgroundColor: "#F2C14E", borderColor: "#F2C14E" },
  pillText: { color: "#C3E0D8", fontSize: 12, fontWeight: "600" },
  pillTextActive: { color: "#16445A", fontWeight: "800" },
  divider: {
    height: 1,
    backgroundColor: "rgba(236,255,248,0.15)",
    marginVertical: 12,
  },

  courseListHint: {
    color: "#9AD8ED",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  courseSelectCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,255,249,0.12)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
  },
  courseCardName: { color: "#F0FFF9", fontSize: 15, fontWeight: "800" },
  courseCardMeta: { color: "#9AD8ED", fontSize: 11, marginTop: 3 },
  viewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  viewBadgeText: { color: "#F2C14E", fontSize: 12, fontWeight: "700" },

  progress: {
    color: "#8FD5C4",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
  },
  question: {
    color: "#F0FFF9",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
    marginTop: 8,
    marginBottom: 12,
  },
  option: {
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
    borderRadius: 13,
    padding: 14,
    marginTop: 9,
    backgroundColor: "rgba(239,255,249,0.08)",
  },
  optionText: { color: "#F0FFF9", fontSize: 14, fontWeight: "700" },
  recommendKicker: {
    color: "#F2C14E",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 14,
  },
  recommendTitle: {
    color: "#F0FFF9",
    fontSize: 18,
    fontWeight: "800",
    marginVertical: 6,
  },

  /* Modal 彈出視窗共用樣式 */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  modalContent: {
    backgroundColor: "#123A4E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  modalTitle: { color: "#F0FFF9", fontSize: 17, fontWeight: "800" },
  modalSubtitle: { color: "#9AD8ED", fontSize: 12, marginTop: 3 },
  courseSelectItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
  },
  courseSelectItemActive: {
    backgroundColor: "rgba(242,193,78,0.15)",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  courseSelectName: { color: "#F0FFF9", fontSize: 15, fontWeight: "700" },
  courseSelectDetail: { color: "#9AD8ED", fontSize: 12, marginTop: 3 },

  singleEvalCard: {
    backgroundColor: "rgba(239,255,249,0.12)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.35)",
  },
  evalScoreRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  scoreText: { color: "#F2C14E", fontSize: 12, fontWeight: "700" },
  metricDivider: { color: "rgba(240,255,249,0.4)", marginHorizontal: 6 },
  evalCommentText: {
    color: "rgba(240,255,249,0.88)",
    fontSize: 13,
    lineHeight: 18,
  },

  /* 共用分頁導航列樣式 */
  paginationBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "rgba(236,255,248,0.15)",
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2C14E",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 3,
  },
  pageBtnDisabled: {
    backgroundColor: "rgba(239,255,249,0.1)",
  },
  pageBtnText: { color: "#16445A", fontSize: 12, fontWeight: "800" },
  pageBtnTextDisabled: { color: "#5C7E77" },
  pageInfoText: { color: "#A9CEC3", fontSize: 11, fontWeight: "700" },
});

