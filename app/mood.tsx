import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
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
  course_id: number | string;
  course_name: string;
  teacher?: string;
  department?: string;
  grade?: string;
  category?: string;
  semester_term?: string;
  credits?: number;
  score?: number | null;
  is_passed?: boolean;
  classroom?: string;
  schedule?: string;
  class_name?: string;
  syllabus_url?: string;
  capacity?: number;
  enrolled?: number;
};

type Evaluation = {
  _id: string | { $oid: string };
  eval_id?: number;
  course_id: number | string;
  user_id?: number;
  sweetness: number;
  easiness: number;
  gains: number;
  comment: string;
  evaluation_status: string;
};

type Panel = "rate" | "quiz" | "reviews" | "details" | "reminder" | null;

const DEPARTMENTS = [
  "全部",
  "全校通識",
  "體育室",
  "英語教學中心",
  "資訊工程學系",
  "資訊管理學系",
  "資訊傳播工程學系",
  "電腦與通訊工程學系",
  "電子工程學系",
  "電機工程學系",
  "人工智慧應用學系",
  "半導體應用學士學位學程",
  "商業設計學系",
  "商品設計學系",
  "數位媒體設計系",
  "建築學系",
  "都市規劃與防災學系",
  "動漫文創設計學士學位學程",
  "企業管理學系",
  "國際企業學系",
  "財務金融學系",
  "風險管理與保險學系",
  "會計學系",
  "經濟與金融學系",
  "應用統計與資料科學學系",
  "金融科技應用學士學位學程",
  "新聞學系",
  "廣播電視學系",
  "廣告暨策略行銷學系",
  "新媒體暨傳播管理學系",
  "傳播學院全媒體學士學位學程",
  "觀光事業學系",
  "休閒遊憩管理學系",
  "餐旅管理學系",
  "應用中國文學系",
  "應用英語學系",
  "應用日語學系",
  "華語文教學學系",
  "法律學系",
  "財金法律學系",
  "公共事務與行政管理學系",
  "諮商臨床與工商心理學系",
  "犯罪防治學系",
  "生物科技學系",
  "醫療資訊與管理學系",
  "生物醫學工程學系",
  "國際企業學士學位學程",
  "新聞與大眾傳播學士學位學程",
  "觀光學士學位學程",
  "資訊科技應用學士學位學程",
  "流行音樂與舞蹈學士學位學程",
];
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
  const [currentUserId, setCurrentUserId] = useState<number | string>(
    userId || 3001
  );

  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  const [panel, setPanel] = useState<Panel>(null);

  // 評分指標
  const [sweetness, setSweetness] = useState<number>(0);
  const [easiness, setEasiness] = useState<number>(0);
  const [gains, setGains] = useState<number>(0);
  const [comment, setComment] = useState<string>("");

  // 給評：已修課程選單狀態與分類
  const [myCourses, setMyCourses] = useState<CourseItem[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseItem | null>(null);
  const [courseModalVisible, setCourseModalVisible] = useState<boolean>(false);
  const [loadingMyCourses, setLoadingMyCourses] = useState<boolean>(false);

  // 校務爬蟲同步狀態（同 courses.tsx 學生進度管理）
  const [syncModalVisible, setSyncModalVisible] = useState<boolean>(false);
  const [mcuAccount, setMcuAccount] = useState<string>(
    String(userId || process.env.EXPO_PUBLIC_DEFAULT_USER_ID || "")
  );
  const [mcuPassword, setMcuPassword] = useState<string>("");
  const [syncing, setSyncing] = useState<boolean>(false);

  // 初始化讀取登入者學號（比照 courses.tsx 讀取 AsyncStorage 快取）
  useEffect(() => {
    const initUserId = async () => {
      try {
        const stored = await AsyncStorage.getItem("current_user_id");
        if (stored) {
          setCurrentUserId(Number(stored));
          setMcuAccount(stored);
        }
      } catch (e) {
        console.warn("無法讀取本機學號:", e);
      }
    };
    initUserId();
  }, []);

  // 檢索：篩選條件與搜尋出的全校課程清單
  const [filterDept, setFilterDept] = useState<string>("全部");
  const [filterGrade, setFilterGrade] = useState<string>("全部");
  const [filterCategory, setFilterCategory] = useState<string>("全部");
  const [departmentList, setDepartmentList] = useState<string[]>(DEPARTMENTS);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState<boolean>(false);
  const [deptSearchQuery, setDeptSearchQuery] = useState<string>("");
  const [searchedCourses, setSearchedCourses] = useState<CourseItem[]>([]);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(false);

  // 取得後端所有系所清單（若後端有其他系所則自動合併）
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/courses/departments`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setDepartmentList(json.data);
        }
      } catch {}
    };
    fetchDepts();
  }, []);

  // 檢索：特定課程評價彈窗（20 筆/頁）
  const [selectedReviewCourse, setSelectedReviewCourse] =
    useState<CourseItem | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState<boolean>(false);
  const [courseReviews, setCourseReviews] = useState<Evaluation[]>([]);
  const [reviewPage, setReviewPage] = useState<number>(1);
  const [reviewTotalPages, setReviewTotalPages] = useState<number>(1);
  const [reviewTotalCount, setReviewTotalCount] = useState<number>(0);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(false);
  const [detailModalMode, setDetailModalMode] =
    useState<"details" | "reviews">("reviews");

  // 查看課程詳細資訊檢索：篩選條件與搜尋課程清單
  const [detailsFilterDept, setDetailsFilterDept] = useState<string>("全部");
  const [detailsFilterGrade, setDetailsFilterGrade] = useState<string>("全部");
  const [detailsFilterCategory, setDetailsFilterCategory] =
    useState<string>("全部");
  const [detailsDeptDropdownOpen, setDetailsDeptDropdownOpen] =
    useState<boolean>(false);
  const [detailsDeptSearchQuery, setDetailsDeptSearchQuery] =
    useState<string>("");
  const [detailsCourses, setDetailsCourses] = useState<CourseItem[]>([]);
  const [loadingDetailsCourses, setLoadingDetailsCourses] =
    useState<boolean>(false);

  // 心理測驗與提醒
  const [quizStep, setQuizStep] = useState<number>(0);
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);
  const [reminderOn, setReminderOn] = useState<boolean>(false);

  // @ts-ignore
  const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

  // 鍵盤彈起監聽（僅更新高度，不強制跳到底部，避免遮蔽輸入框）
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // 載入學生已修通過課程（預設抓取 100 筆以完整涵蓋大一至大四，asc 排序）
  const fetchMyCourses = async (overrideUserId?: number | string) => {
    const uid = overrideUserId || currentUserId;
    try {
      setLoadingMyCourses(true);
      const res = await fetch(
        `${baseUrl}/api/student/my-courses?user_id=${uid}&page=1&limit=100&passed_only=true&sort_order=asc`
      );
      const json = await res.json();
      if (json.success && json.data) {
        setMyCourses(json.data);
        if (!selectedCourse && json.data.length > 0) {
          setSelectedCourse(json.data[0]);
        }
        return json.data as CourseItem[];
      }
      return [] as CourseItem[];
    } catch (err) {
      console.error("載入已修課程失敗:", err);
      return [] as CourseItem[];
    } finally {
      setLoadingMyCourses(false);
    }
  };

  // 同步校務成績單（同 courses.tsx 學生進度管理相同邏輯）
  const handleSyncTranscript = async () => {
    if (!mcuAccount.trim() || !mcuPassword) {
      Alert.alert("請填寫完整", "請輸入學生資訊系統帳號與密碼。");
      return;
    }

    const targetUserId = Number(mcuAccount.trim());
    if (isNaN(targetUserId) || targetUserId <= 0) {
      Alert.alert("格式錯誤", "學號必須為有效的數字。");
      return;
    }

    Keyboard.dismiss();
    setSyncing(true);

    try {
      const res = await fetch(`${baseUrl}/api/student/sync-transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: targetUserId,
          mcu_account: mcuAccount.trim(),
          mcu_password: mcuPassword,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        Alert.alert("同步成功", `已成功同步 ${json.synced_count} 筆課程紀錄！`);
        setCurrentUserId(targetUserId);
        try {
          await AsyncStorage.setItem("current_user_id", String(targetUserId));
        } catch {}
        setSyncModalVisible(false);
        setMcuPassword("");
        fetchMyCourses(targetUserId);
      } else {
        let errorMsg = "學校帳號密碼錯誤或伺服器連線異常。";
        if (typeof json.detail === "string") {
          errorMsg = json.detail;
        } else if (Array.isArray(json.detail)) {
          errorMsg = json.detail
            .map((e: any) => `${e.loc?.slice(-1)[0]}: ${e.msg}`)
            .join("\n");
        }
        Alert.alert("同步失敗", errorMsg);
      }
    } catch {
      Alert.alert(
        "連線異常",
        "無法連線至後端伺服器，請確認電腦 IP 與連線狀態。"
      );
    } finally {
      setSyncing(false);
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
  const fetchCourseReviewsPage = async (courseId: number | string, page: number) => {
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
    setDetailModalMode("reviews");
    setReviewPage(1);
    setCourseReviews([]);
    setReviewModalVisible(true);
    fetchCourseReviewsPage(course.course_id, 1);
  };

  // 查看課程詳細資訊：依條件搜尋課程清單
  const fetchDetailsCourses = async (
    dept = detailsFilterDept,
    grade = detailsFilterGrade,
    category = detailsFilterCategory
  ) => {
    try {
      setLoadingDetailsCourses(true);
      const url = `${baseUrl}/api/courses/search?department=${encodeURIComponent(
        dept
      )}&grade=${encodeURIComponent(grade)}&category=${encodeURIComponent(category)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setDetailsCourses(json.data);
      }
    } catch (err) {
      console.error("篩選詳細課程失敗:", err);
    } finally {
      setLoadingDetailsCourses(false);
    }
  };

  const handleOpenCourseDetails = (course: CourseItem) => {
    setSelectedReviewCourse(course);
    setDetailModalMode("details");
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
      fetchMyCourses();
    }

    if (nextPanel === "quiz") {
      setQuizStep(0);
      setQuizAnswers([]);
    }

    if (nextPanel === "reviews") {
      fetchFilteredCourses(filterDept, filterGrade, filterCategory);
    }

    if (nextPanel === "details") {
      fetchDetailsCourses(
        detailsFilterDept,
        detailsFilterGrade,
        detailsFilterCategory
      );
    }

    // 自動捲動到展開的面板，避免資訊被截斷
    setTimeout(() => {
      let yOffset = 0;
      switch (nextPanel) {
        case "rate":
          yOffset = 165;
          break;
        case "quiz":
          yOffset = 250;
          break;
        case "reviews":
          yOffset = 335;
          break;
        case "details":
          yOffset = 420;
          break;
        case "reminder":
          yOffset = 505;
          break;
      }
      scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 150);
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
          course_name: selectedCourse.course_name,
          semester_term: selectedCourse.semester_term,
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
                      ? 120
                      : keyboardHeight + 80
                    : 120,
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
                      <Pressable
                        style={styles.syncBtnSmall}
                        onPress={async () => {
                          const stored = await AsyncStorage.getItem("current_user_id");
                          setMcuAccount(stored || String(currentUserId));
                          setSyncModalVisible(true);
                        }}
                        disabled={syncing}
                      >
                        {syncing ? (
                          <ActivityIndicator size="small" color="#F2C14E" />
                        ) : (
                          <>
                            <Ionicons name="sync" size={13} color="#F2C14E" />
                            <Text style={styles.syncBtnTextSmall}>同步</Text>
                          </>
                        )}
                      </Pressable>
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
                            ? `${selectedCourse.semester_term ? `[${selectedCourse.semester_term}] ` : ""}${selectedCourse.teacher && selectedCourse.teacher !== "專任教師" && selectedCourse.teacher !== "授課教師" ? selectedCourse.teacher : "---"} · ${selectedCourse.category || "必修"} · ${selectedCourse.credits !== undefined ? `${selectedCourse.credits}學分` : ""}`
                            : "點擊載入並選擇已修通過之課程"}
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
                      onFocus={() => {
                        // 聚焦時將視圖平滑定位在心得輸入區，防止跳到底部
                        setTimeout(() => {
                          scrollViewRef.current?.scrollTo({ y: 280, animated: true });
                        }, 100);
                      }}
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
                    {/* 下拉式選單觸發按鈕 */}
                    <Pressable
                      style={styles.deptDropdownTrigger}
                      onPress={() => setDeptDropdownOpen(!deptDropdownOpen)}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          flex: 1,
                        }}
                      >
                        <Ionicons
                          name="school-outline"
                          size={16}
                          color="#F2C14E"
                        />
                        <Text style={styles.deptDropdownSelectedText}>
                          {filterDept === "全部" ? "全部系所" : filterDept}
                        </Text>
                      </View>
                      <Ionicons
                        name={deptDropdownOpen ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#9AD8ED"
                      />
                    </Pressable>

                    {/* 下拉式選單內容列表（展開時顯示） */}
                    {deptDropdownOpen && (
                      <View style={styles.deptDropdownMenu}>
                        {/* 快速搜尋過濾框 */}
                        <View style={styles.deptSearchRow}>
                          <Ionicons name="search" size={15} color="#9AD8ED" />
                          <TextInput
                            style={styles.deptSearchInput}
                            placeholder="快速搜尋系所（例如：資管、設計...）"
                            placeholderTextColor="rgba(240,255,249,0.4)"
                            value={deptSearchQuery}
                            onChangeText={setDeptSearchQuery}
                            autoCapitalize="none"
                          />
                          {deptSearchQuery.length > 0 && (
                            <Pressable onPress={() => setDeptSearchQuery("")}>
                              <Ionicons
                                name="close-circle"
                                size={16}
                                color="#9AD8ED"
                              />
                            </Pressable>
                          )}
                        </View>

                        {/* 可滾動所有系所項目清單 */}
                        <ScrollView
                          style={{ maxHeight: 220 }}
                          nestedScrollEnabled={true}
                          showsVerticalScrollIndicator={true}
                          keyboardShouldPersistTaps="handled"
                        >
                          {departmentList
                            .filter((d) =>
                              deptSearchQuery.trim() === ""
                                ? true
                                : d
                                    .toLowerCase()
                                    .includes(
                                      deptSearchQuery.trim().toLowerCase()
                                    )
                            )
                            .map((dept) => {
                              const isSelected = filterDept === dept;
                              return (
                                <Pressable
                                  key={dept}
                                  style={[
                                    styles.deptDropdownItem,
                                    isSelected && styles.deptDropdownItemActive,
                                  ]}
                                  onPress={() => {
                                    setFilterDept(dept);
                                    setDeptDropdownOpen(false);
                                    setDeptSearchQuery("");
                                    fetchFilteredCourses(
                                      dept,
                                      filterGrade,
                                      filterCategory
                                    );
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.deptDropdownItemText,
                                      isSelected &&
                                        styles.deptDropdownItemTextActive,
                                    ]}
                                  >
                                    {dept}
                                  </Text>
                                  {isSelected && (
                                    <Ionicons
                                      name="checkmark-circle"
                                      size={16}
                                      color="#16445A"
                                    />
                                  )}
                                </Pressable>
                              );
                            })}
                        </ScrollView>
                      </View>
                    )}

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
                      <View style={{ flex: 1 }}>
                        <Text style={styles.courseListHint}>
                          點擊課程即可查看詳細評價：
                        </Text>
                        <ScrollView
                          style={{ maxHeight: 280 }}
                          contentContainerStyle={{ gap: 10, paddingBottom: 10 }}
                          nestedScrollEnabled={true}
                          showsVerticalScrollIndicator={true}
                        >
                          {searchedCourses.map((course, index) => (
                            <Pressable
                              key={`${course.course_id}_${course.class_code || index}`}
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
                        </ScrollView>
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
                    {/* 4. 課程詳細資訊面板 */}
                {panel === "details" && (
                  <View style={styles.panel}>
                    <View style={styles.panelHeader}>
                      <Text style={styles.panelTitle}>課程詳細資訊檢索</Text>
                    </View>

                    <Text style={styles.filterTitle}>系所別</Text>
                    {/* 下拉式選單觸發按鈕 */}
                    <Pressable
                      style={styles.deptDropdownTrigger}
                      onPress={() =>
                        setDetailsDeptDropdownOpen(!detailsDeptDropdownOpen)
                      }
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          flex: 1,
                        }}
                      >
                        <Ionicons
                          name="school-outline"
                          size={16}
                          color="#B6E3C2"
                        />
                        <Text style={styles.deptDropdownSelectedText}>
                          {detailsFilterDept === "全部"
                            ? "全部系所"
                            : detailsFilterDept}
                        </Text>
                      </View>
                      <Ionicons
                        name={
                          detailsDeptDropdownOpen
                            ? "chevron-up"
                            : "chevron-down"
                        }
                        size={18}
                        color="#B6E3C2"
                      />
                    </Pressable>

                    {/* 下拉式選單內容列表（展開時顯示） */}
                    {detailsDeptDropdownOpen && (
                      <View style={styles.deptDropdownMenu}>
                        {/* 快速搜尋過濾框 */}
                        <View style={styles.deptSearchRow}>
                          <Ionicons name="search" size={15} color="#9AD8ED" />
                          <TextInput
                            style={styles.deptSearchInput}
                            placeholder="快速搜尋系所（例如：資管、設計...）"
                            placeholderTextColor="rgba(240,255,249,0.4)"
                            value={detailsDeptSearchQuery}
                            onChangeText={setDetailsDeptSearchQuery}
                            autoCapitalize="none"
                          />
                          {detailsDeptSearchQuery.length > 0 && (
                            <Pressable
                              onPress={() => setDetailsDeptSearchQuery("")}
                            >
                              <Ionicons
                                name="close-circle"
                                size={16}
                                color="#9AD8ED"
                              />
                            </Pressable>
                          )}
                        </View>

                        {/* 可滾動所有系所項目清單 */}
                        <ScrollView
                          style={{ maxHeight: 220 }}
                          nestedScrollEnabled={true}
                          showsVerticalScrollIndicator={true}
                          keyboardShouldPersistTaps="handled"
                        >
                          {departmentList
                            .filter((d) =>
                              detailsDeptSearchQuery.trim() === ""
                                ? true
                                : d
                                    .toLowerCase()
                                    .includes(
                                      detailsDeptSearchQuery
                                        .trim()
                                        .toLowerCase()
                                    )
                            )
                            .map((dept) => {
                              const isSelected = detailsFilterDept === dept;
                              return (
                                <Pressable
                                  key={dept}
                                  style={[
                                    styles.deptDropdownItem,
                                    isSelected && styles.deptDropdownItemActive,
                                  ]}
                                  onPress={() => {
                                    setDetailsFilterDept(dept);
                                    setDetailsDeptDropdownOpen(false);
                                    setDetailsDeptSearchQuery("");
                                    fetchDetailsCourses(
                                      dept,
                                      detailsFilterGrade,
                                      detailsFilterCategory
                                    );
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.deptDropdownItemText,
                                      isSelected &&
                                        styles.deptDropdownItemTextActive,
                                    ]}
                                  >
                                    {dept}
                                  </Text>
                                  {isSelected && (
                                    <Ionicons
                                      name="checkmark-circle"
                                      size={16}
                                      color="#16445A"
                                    />
                                  )}
                                </Pressable>
                              );
                            })}
                        </ScrollView>
                      </View>
                    )}

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
                            detailsFilterGrade === g && styles.pillActive,
                          ]}
                          onPress={() => {
                            setDetailsFilterGrade(g);
                            fetchDetailsCourses(
                              detailsFilterDept,
                              g,
                              detailsFilterCategory
                            );
                          }}
                        >
                          <Text
                            style={[
                              styles.pillText,
                              detailsFilterGrade === g && styles.pillTextActive,
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
                            detailsFilterCategory === cat && styles.pillActive,
                          ]}
                          onPress={() => {
                            setDetailsFilterCategory(cat);
                            fetchDetailsCourses(
                              detailsFilterDept,
                              detailsFilterGrade,
                              cat
                            );
                          }}
                        >
                          <Text
                            style={[
                              styles.pillText,
                              detailsFilterCategory === cat &&
                                styles.pillTextActive,
                            ]}
                          >
                            {cat}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    <View style={styles.divider} />

                    {loadingDetailsCourses ? (
                      <Text
                        style={[
                          styles.panelCopy,
                          { textAlign: "center", paddingVertical: 18 },
                        ]}
                      >
                        正在篩選符合的課程...
                      </Text>
                    ) : detailsCourses.length === 0 ? (
                      <Text
                        style={[
                          styles.panelCopy,
                          { textAlign: "center", paddingVertical: 18 },
                        ]}
                      >
                        沒有符合此條件的課程。
                      </Text>
                    ) : (
                      <View style={{ flex: 1 }}>
                        <Text style={styles.courseListHint}>
                          點擊課程即可查看詳細資訊：
                        </Text>
                        <ScrollView
                          style={{ maxHeight: 280 }}
                          contentContainerStyle={{
                            gap: 10,
                            paddingBottom: 10,
                          }}
                          nestedScrollEnabled={true}
                          showsVerticalScrollIndicator={true}
                        >
                          {detailsCourses.map((course, index) => (
                            <Pressable
                              key={`${course.course_id}_${course.class_code || index}`}
                              style={styles.courseSelectCard}
                              onPress={() => handleOpenCourseDetails(course)}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.courseCardName}>
                                  {course.course_name}
                                  {course.class_name ? ` (${course.class_name})` : ""}
                                </Text>
                                <Text style={styles.courseCardMeta}>
                                  {course.teacher || "授課教師"} ·{" "}
                                  {course.department || "系所"} ·{" "}
                                  {course.grade || "年級"} ·{" "}
                                  {course.category || "修別"}
                                  {course.credits !== undefined
                                    ? ` · ${course.credits}學分`
                                    : ""}
                                </Text>
                                {(Boolean(course.schedule) || Boolean(course.classroom)) && (
                                  <Text
                                    style={[
                                      styles.courseCardMeta,
                                      { color: "#F2C14E", marginTop: 2 },
                                    ]}
                                  >
                                    {course.schedule ? `🕒 ${course.schedule}` : ""}
                                    {course.schedule && course.classroom ? "  |  " : ""}
                                    {course.classroom ? `📍 ${course.classroom}` : ""}
                                  </Text>
                                )}
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
                        </ScrollView>
                      </View>
                    )}
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

        {/* 彈出視窗 1：選擇已修課程 Modal */}
        <Modal visible={courseModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { height: "85%" }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.modalTitle}>選擇已修課程</Text>
                  <Text style={styles.modalSubtitle}>
                    僅顯示學生資訊系統已通過之課程
                  </Text>
                </View>
                <Pressable onPress={() => setCourseModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#F0FFF9" />
                </Pressable>
              </View>

              {/* 頂部操作與統計列 */}
              <View style={styles.modalToolRow}>
                <Text style={styles.modalToolCount}>
                  共 {myCourses.length} 門已通過課程
                </Text>
                <Pressable
                  style={styles.syncBtnSmall}
                  onPress={async () => {
                    const stored = await AsyncStorage.getItem("current_user_id");
                    setMcuAccount(stored || String(currentUserId));
                    setSyncModalVisible(true);
                  }}
                  disabled={syncing}
                >
                  {syncing ? (
                    <ActivityIndicator size="small" color="#F2C14E" />
                  ) : (
                    <>
                      <Ionicons name="sync" size={13} color="#F2C14E" />
                      <Text style={styles.syncBtnTextSmall}>同步</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {loadingMyCourses || syncing ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <ActivityIndicator size="large" color="#F2C14E" />
                  <Text style={styles.panelCopy}>
                    {syncing
                      ? "正在爬取學生資訊系統已通過課程..."
                      : "載入已修通過課程中..."}
                  </Text>
                </View>
              ) : myCourses.length === 0 ? (
                <View style={styles.emptyCoursesContainer}>
                  <Ionicons
                    name="school-outline"
                    size={48}
                    color="#9AD8ED"
                  />
                  <Text style={styles.emptyCoursesTitle}>
                    沒有可評價課程
                  </Text>
                  <Text style={styles.emptyCoursesSubtitle}>
                    尚未取得已通過之修課資料，請先同步校務成績。
                  </Text>
                  <Pressable
                    style={styles.emptySyncBtn}
                    onPress={async () => {
                      const stored = await AsyncStorage.getItem("current_user_id");
                      setMcuAccount(stored || String(currentUserId));
                      setSyncModalVisible(true);
                    }}
                  >
                    <Ionicons name="sync" size={16} color="#16445A" />
                    <Text style={styles.emptySyncBtnText}>
                      同步
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                >
                  {myCourses.map((c, index) => {
                    const teacherName =
                      c.teacher &&
                      c.teacher !== "專任教師" &&
                      c.teacher !== "授課教師"
                        ? c.teacher
                        : "---";

                    return (
                      <Pressable
                        key={`${c.course_id}_${c.semester_term}_${index}`}
                        style={[
                          styles.courseSelectItem,
                          selectedCourse?.course_id === c.course_id &&
                            selectedCourse?.semester_term ===
                              c.semester_term &&
                            styles.courseSelectItemActive,
                        ]}
                        onPress={() => {
                          setSelectedCourse(c);
                          setCourseModalVisible(false);
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 4,
                          }}
                        >
                          <Text style={styles.courseSelectName}>
                            {c.course_name}
                          </Text>
                          {c.semester_term ? (
                            <View style={styles.semesterBadge}>
                              <Text style={styles.semesterBadgeText}>
                                {c.semester_term}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 6,
                          }}
                        >
                          <Text style={styles.courseSelectDetail}>
                            教師：{teacherName} ·{" "}
                            {c.department || "系所"} (
                            {c.category || "必修"})
                          </Text>
                          {c.credits !== undefined ? (
                            <Text style={styles.courseSelectDetail}>
                              · {c.credits} 學分
                            </Text>
                          ) : null}
                          <View style={styles.passedBadge}>
                            <Text style={styles.passedBadgeText}>
                              通過
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              {/* 🌟 內嵌同步覆蓋層（避免 iOS/Android 雙重原生 Modal 衝突導致點擊無反應） */}
              {syncModalVisible && (
                <View style={styles.inlineSyncOverlay}>
                  <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={styles.keyboardAvoidContainer}
                  >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                      <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>同步校務成績單</Text>
                        <Text style={styles.modalSubtitle}>
                          輸入學校資訊系統帳密以更新最新學分。密碼僅在記憶體中處理，遵循數據不落地原則。
                        </Text>

                        <TextInput
                          style={styles.modalInput}
                          placeholder="學生學號"
                          placeholderTextColor="rgba(240,255,249,0.4)"
                          value={mcuAccount}
                          onChangeText={setMcuAccount}
                          autoCapitalize="none"
                          keyboardType="number-pad"
                        />

                        <TextInput
                          style={styles.modalInput}
                          placeholder="學生資訊系統密碼"
                          placeholderTextColor="rgba(240,255,249,0.4)"
                          value={mcuPassword}
                          onChangeText={setMcuPassword}
                          secureTextEntry
                        />

                        <View style={styles.modalBtnRow}>
                          <Pressable
                            style={[styles.modalBtn, styles.modalCancelBtn]}
                            onPress={() => setSyncModalVisible(false)}
                            disabled={syncing}
                          >
                            <Text style={styles.modalCancelText}>取消</Text>
                          </Pressable>

                          <Pressable
                            style={[styles.modalBtn, styles.modalConfirmBtn]}
                            onPress={handleSyncTranscript}
                            disabled={syncing}
                          >
                            {syncing ? (
                              <ActivityIndicator color="#16445A" />
                            ) : (
                              <Text style={styles.modalConfirmText}>開始同步</Text>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    </TouchableWithoutFeedback>
                  </KeyboardAvoidingView>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* 彈出視窗 3：同步校務成績單（當選課視窗未開啟時由主畫面調用） */}
        <Modal
          visible={syncModalVisible && !courseModalVisible}
          transparent
          animationType="fade"
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalCenteredOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.keyboardAvoidContainer}
              >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                  <View style={styles.modalCard}>
                    <Text style={styles.modalTitle}>同步校務成績單</Text>
                    <Text style={styles.modalSubtitle}>
                      輸入學校資訊系統帳密以更新最新學分。密碼僅在記憶體中處理，遵循數據不落地原則。
                    </Text>

                    <TextInput
                      style={styles.modalInput}
                      placeholder="學生學號"
                      placeholderTextColor="rgba(240,255,249,0.4)"
                      value={mcuAccount}
                      onChangeText={setMcuAccount}
                      autoCapitalize="none"
                      keyboardType="number-pad"
                    />

                    <TextInput
                      style={styles.modalInput}
                      placeholder="學生資訊系統密碼"
                      placeholderTextColor="rgba(240,255,249,0.4)"
                      value={mcuPassword}
                      onChangeText={setMcuPassword}
                      secureTextEntry
                    />

                    <View style={styles.modalBtnRow}>
                      <Pressable
                        style={[styles.modalBtn, styles.modalCancelBtn]}
                        onPress={() => setSyncModalVisible(false)}
                        disabled={syncing}
                      >
                        <Text style={styles.modalCancelText}>取消</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.modalBtn, styles.modalConfirmBtn]}
                        onPress={handleSyncTranscript}
                        disabled={syncing}
                      >
                        {syncing ? (
                          <ActivityIndicator color="#16445A" />
                        ) : (
                          <Text style={styles.modalConfirmText}>開始同步</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
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
                    {detailModalMode === "details"
                      ? "課程詳細資訊"
                      : "課程評價與檢索"}
                  </Text>
                </View>
                <Pressable onPress={() => setReviewModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#F0FFF9" />
                </Pressable>
              </View>

              {/* 課程詳細資料卡片 (包含教師、班級、系所、年級、修別、學分、上課時間、教室與大綱) */}
              <View style={styles.courseDetailCard}>
                <View style={styles.courseDetailGrid}>
                  <View style={styles.courseDetailItem}>
                    <Text style={styles.courseDetailLabel}>授課教師</Text>
                    <Text style={styles.courseDetailVal}>
                      {selectedReviewCourse?.teacher || "---"}
                    </Text>
                  </View>
                  <View style={styles.courseDetailItem}>
                    <Text style={styles.courseDetailLabel}>開課班級</Text>
                    <Text style={styles.courseDetailVal}>
                      {selectedReviewCourse?.class_name || "---"}
                    </Text>
                  </View>
                  <View style={styles.courseDetailItem}>
                    <Text style={styles.courseDetailLabel}>開課系所</Text>
                    <Text style={styles.courseDetailVal}>
                      {selectedReviewCourse?.department || "全校"}
                    </Text>
                  </View>
                  <View style={styles.courseDetailItem}>
                    <Text style={styles.courseDetailLabel}>年級 / 修別</Text>
                    <Text style={styles.courseDetailVal}>
                      {selectedReviewCourse?.grade || "大學部"} ·{" "}
                      {selectedReviewCourse?.category || "必修"}
                    </Text>
                  </View>
                  <View style={styles.courseDetailItem}>
                    <Text style={styles.courseDetailLabel}>學分數</Text>
                    <Text style={styles.courseDetailVal}>
                      {selectedReviewCourse?.credits !== undefined
                        ? `${selectedReviewCourse.credits} 學分`
                        : "3 學分"}
                    </Text>
                  </View>
                  <View style={styles.courseDetailItem}>
                    <Text style={styles.courseDetailLabel}>選課/開班人數</Text>
                    <Text style={styles.courseDetailVal}>
                      {selectedReviewCourse?.enrolled !== undefined &&
                      selectedReviewCourse?.capacity !== undefined
                        ? `${selectedReviewCourse.enrolled} / ${selectedReviewCourse.capacity}`
                        : "---"}
                    </Text>
                  </View>
                  {Boolean(selectedReviewCourse?.schedule) && (
                    <View style={[styles.courseDetailItem, { width: "100%" }]}>
                      <Text style={styles.courseDetailLabel}>上課時間 / 節次</Text>
                      <Text style={styles.courseDetailVal}>
                        🕒 {selectedReviewCourse?.schedule}
                      </Text>
                    </View>
                  )}
                  {Boolean(selectedReviewCourse?.classroom) && (
                    <View style={[styles.courseDetailItem, { width: "100%" }]}>
                      <Text style={styles.courseDetailLabel}>教室 / 地點</Text>
                      <Text style={styles.courseDetailVal}>
                        📍 {selectedReviewCourse?.classroom}
                      </Text>
                    </View>
                  )}
                  {Boolean(selectedReviewCourse?.syllabus_url) && (
                    <View style={[styles.courseDetailItem, { width: "100%", marginTop: 4 }]}>
                      <Pressable
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: "rgba(182,227,194,0.15)",
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          alignSelf: "flex-start",
                        }}
                        onPress={() => {
                          if (selectedReviewCourse?.syllabus_url) {
                            Linking.openURL(selectedReviewCourse.syllabus_url);
                          }
                        }}
                      >
                        <Ionicons name="document-text-outline" size={15} color="#B6E3C2" />
                        <Text style={{ color: "#B6E3C2", fontSize: 13, fontWeight: "600" }}>
                          查看學校官方教學大綱 ↗
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>

              <Text style={styles.reviewSectionTitle}>
                學長姐評價與心得 ({reviewTotalCount} 則)
              </Text>

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

  /* 課程彈窗同步工具列與標籤樣式 */
  modalToolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderColor: "rgba(236,255,248,0.15)",
  },
  modalToolCount: {
    color: "#9AD8ED",
    fontSize: 12,
    fontWeight: "600",
  },
  syncBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(242, 193, 78, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(242, 193, 78, 0.4)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  syncBtnTextSmall: {
    color: "#F2C14E",
    fontSize: 12,
    fontWeight: "700",
  },
  semesterBadge: {
    backgroundColor: "rgba(154, 216, 237, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(154, 216, 237, 0.35)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  semesterBadgeText: {
    color: "#9AD8ED",
    fontSize: 11,
    fontWeight: "700",
  },
  passedBadge: {
    backgroundColor: "rgba(167, 243, 208, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(167, 243, 208, 0.35)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  passedBadgeText: {
    color: "#A7F3D0",
    fontSize: 11,
    fontWeight: "700",
  },

  /* 年級分類切換標籤樣式 */
  gradeFilterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  gradeFilterPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(239, 255, 249, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(236, 255, 248, 0.2)",
  },
  gradeFilterPillActive: {
    backgroundColor: "#F2C14E",
    borderColor: "#F2C14E",
  },
  gradeFilterPillText: {
    color: "#C3E0D8",
    fontSize: 12,
    fontWeight: "700",
  },
  gradeFilterPillTextActive: {
    color: "#16445A",
    fontWeight: "800",
  },

  /* 學期分組與標題樣式 */
  semesterHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(239, 255, 249, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#F2C14E",
  },
  semesterHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  semesterHeaderTitle: {
    color: "#F0FFF9",
    fontSize: 14,
    fontWeight: "800",
  },
  semesterCountPill: {
    backgroundColor: "rgba(242, 193, 78, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  semesterCountText: {
    color: "#F2C14E",
    fontSize: 11,
    fontWeight: "700",
  },
  semesterEmptyText: {
    color: "rgba(240, 255, 249, 0.4)",
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  /* 空課程狀態樣式 */
  emptyCoursesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyCoursesTitle: {
    color: "#F0FFF9",
    fontSize: 18,
    fontWeight: "800",
  },
  emptyCoursesSubtitle: {
    color: "rgba(240, 255, 249, 0.65)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  emptySyncBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F2C14E",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  emptySyncBtnText: {
    color: "#16445A",
    fontSize: 13,
    fontWeight: "800",
  },

  /* 校務同步對話框樣式（與 courses.tsx 一致） */
  inlineSyncOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 9999,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalCenteredOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  keyboardAvoidContainer: { width: "100%", alignItems: "center" },
  modalCard: {
    width: "100%",
    backgroundColor: "#16445A",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.3)",
    padding: 24,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.25)",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    color: "#F0FFF9",
    fontSize: 15,
    marginBottom: 12,
  },
  modalBtnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCancelBtn: { backgroundColor: "rgba(255,255,255,0.12)" },
  modalCancelText: { color: "#F0FFF9", fontWeight: "700" },
  modalConfirmBtn: { backgroundColor: "#F2C14E" },
  modalConfirmText: { color: "#16445A", fontWeight: "800" },
  deptDropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(239,255,249,0.08)",
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.25)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 8,
  },
  deptDropdownSelectedText: {
    color: "#F0FFF9",
    fontSize: 14,
    fontWeight: "700",
  },
  deptDropdownMenu: {
    backgroundColor: "rgba(18, 52, 70, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(242, 193, 78, 0.5)",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  deptSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(236, 255, 248, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  deptSearchInput: {
    flex: 1,
    color: "#F0FFF9",
    fontSize: 13,
    paddingVertical: 2,
  },
  deptDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 1,
  },
  deptDropdownItemActive: {
    backgroundColor: "#F2C14E",
  },
  deptDropdownItemText: {
    color: "#C3E0D8",
    fontSize: 13,
    fontWeight: "600",
  },
  deptDropdownItemTextActive: {
    color: "#16445A",
    fontWeight: "800",
  },
  courseDetailCard: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(236, 255, 248, 0.2)",
  },
  courseDetailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
  },
  courseDetailItem: {
    width: "50%",
  },
  courseDetailLabel: {
    color: "#9AD8ED",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  courseDetailVal: {
    color: "#F0FFF9",
    fontSize: 13,
    fontWeight: "600",
  },
  reviewSectionTitle: {
    color: "#F2C14E",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
});

