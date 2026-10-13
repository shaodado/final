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
  class_code?: string;
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

type QuizQuestionItem = {
  id: number;
  question: string;
  options: string[];
};

type QuizAnswerRecord = {
  id: number;
  question: string;
  selected_option: string;
};

type QuizRankedCourse = {
  rank: number;
  course_id: string;
  course_name: string;
  credits: number;
  teacher: string;
  grade: string;
  category: string;
  department: string;
  capacity: number;
  enrolled: number;
  schedule: string;
  classroom: string;
  syllabus_url: string;
  match_score: number;
  eval_sweetness?: number | null;
  eval_easiness?: number | null;
  eval_gains?: number | null;
  eval_comments?: string[];
  eval_summary?: string;
  recommend_reason: string;
};

type QuizRecommendation = {
  title: string;
  analysis: string;
  department: string;
  advice: string;
  ranked_courses: QuizRankedCourse[];
  recommended_courses?: string[];
  is_ai_generated?: boolean;
};

type Panel = "rate" | "quiz" | "details" | "reminder" | null;

// 銘傳大學官方科系代碼對照表（依科系代碼排序）
export const MCU_DEPT_CODES: Record<string, string> = {
  "通識教育中心": "00",
  "全校通識": "00",
  "外語教學中心": "01",
  "英語教學中心": "01",
  "體育室": "02",
  "數位媒體設計學系": "09",
  "數位媒體設計系": "09",
  "師資培育中心": "10",
  "企業管理學系": "11",
  "資訊管理學系": "13",
  "觀光事業學系": "14",
  "影音新聞暨社群傳播學系": "15",
  "新聞學系": "15",
  "應用統計與資料科學學系": "17",
  "休閒遊憩管理學系": "18",
  "餐旅管理學系": "19",
  "商業設計學系": "21",
  "商品設計學系": "23",
  "建築學系": "24",
  "廣告暨策略行銷學系": "26",
  "新聞與大眾傳播學士學位學程": "27",
  "強化體能健康促進學分學程": "28",
  "傳播學院全媒體大一不分系學士班": "30",
  "傳播學院全媒體學士學位學程": "30",
  "新媒體暨傳播管理學系": "31",
  "廣播電視學系": "32",
  "資訊工程學系": "36",
  "資訊傳播工程學系": "37",
  "犯罪防治學系": "38",
  "生物科技學系": "39",
  "醫療資訊與管理學系": "40",
  "法律學系": "41",
  "應用英語學系": "42",
  "應用日語學系": "44",
  "金融科技應用學士學位學程": "46",
  "旅遊與觀光學士學位學程": "48",
  "觀光學士學位學程": "48",
  "會計學系": "52",
  "資訊應用與金融保險學系": "53",
  "風險管理與保險學系": "53",
  "財務金融學系": "54",
  "國際企業學系": "57",
  "國際事務與外交學士學位學程": "59",
  "諮商臨床與工商心理學系": "60",
  "諮商臨床與工商心理學系碩士班諮商心理學組": "61",
  "諮商臨床與工商心理學系碩士班臨床心理學組": "62",
  "金融學系": "64",
  "經濟與金融學系": "64",
  "財金法律學系": "65",
  "生物醫學工程學系": "67",
  "公共事務與行政管理學系": "68",
  "高階經理碩士在職學位學程": "70",
  "金融智慧與永續未來學分學程": "72",
  "都市設計與永續發展學系": "74",
  "都市規劃與防災學系": "74",
  "人工智慧應用學系": "75",
  "半導體應用學士學位學程": "76",
  "動漫文創設計學士學位學程": "78",
  "應用中文與華語文教學系": "79",
  "應用中國文學系": "79",
  "華語文教學學系": "79",
  "工商管理學士學位學程泰國境外專班": "81",
  "電腦與通訊工程學系": "82",
  "電子工程學系": "83",
  "教育研究所": "83",
  "電機工程學系": "84",
  "金融科技應用學系": "86",
  "時尚與創新管理學士學位學程": "88",
  "資訊科技應用與管理學士學位學程": "89",
  "資訊科技應用學士學位學程": "89",
  "國際事務碩士學位學程": "90",
  "國際企業與貿易學士學位學程": "91",
  "國際企業學士學位學程": "91",
  "流行音樂與舞蹈學士學位學程": "92",
  "金融科技碩士學位學程": "96",
  "國防行政管理進修學士學位學程": "98",
  "國際班": "99",
  "金門校區(不分系所)": "KM",
};

export const getDeptCode = (deptName: string): string => {
  if (!deptName || deptName === "全部") return "";
  return MCU_DEPT_CODES[deptName] || "999";
};

export const sortDepartmentsByCode = (depts: string[]): string[] => {
  const filtered = Array.from(new Set(depts.filter((d) => Boolean(d) && d !== "全部")));
  filtered.sort((a, b) => {
    const codeA = getDeptCode(a);
    const codeB = getDeptCode(b);
    if (codeA !== codeB) {
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    }
    return a.localeCompare(b, "zh-Hant");
  });
  return ["全部", ...filtered];
};

const DEPARTMENTS = [
  "全部",
  "通識教育中心",
  "外語教學中心",
  "體育室",
  "數位媒體設計學系",
  "師資培育中心",
  "企業管理學系",
  "資訊管理學系",
  "觀光事業學系",
  "影音新聞暨社群傳播學系",
  "應用統計與資料科學學系",
  "休閒遊憩管理學系",
  "餐旅管理學系",
  "商業設計學系",
  "商品設計學系",
  "建築學系",
  "廣告暨策略行銷學系",
  "新聞與大眾傳播學士學位學程",
  "強化體能健康促進學分學程",
  "傳播學院全媒體大一不分系學士班",
  "新媒體暨傳播管理學系",
  "廣播電視學系",
  "資訊工程學系",
  "資訊傳播工程學系",
  "犯罪防治學系",
  "生物科技學系",
  "醫療資訊與管理學系",
  "法律學系",
  "應用英語學系",
  "應用日語學系",
  "金融科技應用學士學位學程",
  "旅遊與觀光學士學位學程",
  "會計學系",
  "資訊應用與金融保險學系",
  "財務金融學系",
  "國際企業學系",
  "國際事務與外交學士學位學程",
  "諮商臨床與工商心理學系",
  "諮商臨床與工商心理學系碩士班諮商心理學組",
  "諮商臨床與工商心理學系碩士班臨床心理學組",
  "金融學系",
  "財金法律學系",
  "生物醫學工程學系",
  "公共事務與行政管理學系",
  "高階經理碩士在職學位學程",
  "金融智慧與永續未來學分學程",
  "都市設計與永續發展學系",
  "人工智慧應用學系",
  "半導體應用學士學位學程",
  "動漫文創設計學士學位學程",
  "應用中文與華語文教學系",
  "工商管理學士學位學程泰國境外專班",
  "電腦與通訊工程學系",
  "電子工程學系",
  "教育研究所",
  "電機工程學系",
  "金融科技應用學系",
  "時尚與創新管理學士學位學程",
  "資訊科技應用與管理學士學位學程",
  "國際事務碩士學位學程",
  "國際企業與貿易學士學位學程",
  "流行音樂與舞蹈學士學位學程",
  "金融科技碩士學位學程",
  "國防行政管理進修學士學位學程",
  "國際班",
  "金門校區(不分系所)",
];
const GRADES = ["全部", "大一", "大二", "大三", "大四"];
const CATEGORIES = ["全部", "必修", "選修"];
const CAMPUS_OPTIONS = ["全部", "台北校區", "桃園校區", "基河校區"];

const defaultCourses = [
  {
    name: "人工智慧概論",
    teacher: "郭國隆",
    time: "週二 10:10–12:00",
    rating: 4.8,
  },
  {
    name: "離散數學",
    teacher: "林彥宇",
    time: "週四 13:10–15:00",
    rating: 4.5,
  },
  {
    name: "程式設計（二）",
    teacher: "陳柏宇",
    time: "週五 09:10–12:00",
    rating: 4.7,
  },
];

// 🌟 純化課程名稱（徹底移除班級與校區/地點資訊）
const cleanCourseName = (name?: string): string => {
  if (!name) return "";
  let n = name.replace(/【.*?】/g, "").replace(/\[.*?\]/g, "").trim();
  n = n
    .replace(
      /\s*\(?(?:資工|資管|資傳|電通|電子|電機|人工|半導|商設|品設|數媒|建築|都防|動漫|企管|國企|財金|風保|會計|經金|統資|金科|新聞|廣電|廣銷|新媒|傳播|觀光|休閒|餐旅|應中|應英|應日|華語|法律|財法|公行|心理|犯防|生技|醫管|生工)[一二三四1234][甲乙丙丁]\)?/g,
      ""
    )
    .trim();
  n = n.replace(/\s*\(?(?:[一二三四1234]年級)?[甲乙丙丁]班\)?/g, "").trim();
  n = n.replace(/\s*\(?(?:桃園|台北|基河|金門)校區?\)?/g, "").trim();
  return n || name;
};

// 🌟 格式化上下學期標示
const formatSemesterLabel = (term?: string): string => {
  if (!term) return "";
  const t = term.trim();
  if (t === "上" || t === "1") return "上學期";
  if (t === "下" || t === "2") return "下學期";
  if (t === "暑" || t === "3") return "暑期";
  if (t.includes("上")) return t.includes("學期") ? t : `${t}學期`;
  if (t.includes("下")) return t.includes("學期") ? t : `${t}學期`;
  if (t.endsWith("-1")) return `${t} 上學期`;
  if (t.endsWith("-2")) return `${t} 下學期`;
  if (/^\d{3}1$/.test(t)) return `${t.slice(0, 3)}-1 上學期`;
  if (/^\d{3}2$/.test(t)) return `${t.slice(0, 3)}-2 下學期`;
  return t;
};

// 🌟 純化系所名稱（移除系級中的年級班級如 四年級甲班，並過濾非系所標籤）
const cleanDepartment = (dept?: string): string => {
  if (!dept) return "全校";
  if (
    dept.includes("傳播學院全媒體") ||
    dept.includes("不分系") ||
    dept.includes("金門校區")
  ) {
    return "全校通識";
  }
  return (
    dept
      .replace(/[一二三四1234]年級.*$/, "")
      .replace(/[甲乙丙丁]班.*$/, "")
      .trim() || dept
  );
};

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

  // 🌟 給予課程評價：搜尋關鍵字與標籤切換（已修通過 vs 全校課程庫）
  const [rateCourseSearchQuery, setRateCourseSearchQuery] = useState<string>("");
  const [rateCourseTab, setRateCourseTab] = useState<"passed" | "all">("passed");
  const [allCoursesForRating, setAllCoursesForRating] = useState<CourseItem[]>([]);
  const [loadingAllCoursesForRating, setLoadingAllCoursesForRating] = useState<boolean>(false);

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

  // 系所清單
  const [departmentList, setDepartmentList] = useState<string[]>(DEPARTMENTS);

  // 取得後端所有系所清單（依照銘傳大學科系代號排序）
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/courses/departments`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setDepartmentList(sortDepartmentsByCode(json.data));
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
    useState<"details" | "reviews">("details");

  // 查看課程詳細資訊檢索：篩選條件與搜尋課程清單
  const [detailsFilterDept, setDetailsFilterDept] = useState<string>("全部");
  const [detailsFilterCampus, setDetailsFilterCampus] = useState<string>("全部");
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

  // 趣味心理測驗（Gemini AI）狀態與提醒
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionItem[]>([]);
  const [quizStep, setQuizStep] = useState<number>(0);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswerRecord[]>([]);
  const [loadingQuizQuestions, setLoadingQuizQuestions] = useState<boolean>(false);
  const [submittingQuiz, setSubmittingQuiz] = useState<boolean>(false);
  const [quizRecommendation, setQuizRecommendation] =
    useState<QuizRecommendation | null>(null);
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

  // 🌟 載入全校所有去重課程庫（用於給予課程評價選擇，無班級無校區）
  const fetchAllCoursesForRating = async () => {
    if (allCoursesForRating.length > 0) return;
    try {
      setLoadingAllCoursesForRating(true);
      const res = await fetch(
        `${baseUrl}/api/courses/search?distinct_by_name=true&limit=300`
      );
      const json = await res.json();
      if (json.success && json.data) {
        setAllCoursesForRating(json.data);
      }
    } catch (err) {
      console.error("載入全校評價課程庫失敗:", err);
    } finally {
      setLoadingAllCoursesForRating(false);
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

  // 查看課程詳細資訊：依條件搜尋課程清單
  const fetchDetailsCourses = async (
    dept = detailsFilterDept,
    grade = detailsFilterGrade,
    category = detailsFilterCategory,
    campus = detailsFilterCampus
  ) => {
    try {
      setLoadingDetailsCourses(true);
      let url = `${baseUrl}/api/courses/search?department=${encodeURIComponent(
        dept
      )}&grade=${encodeURIComponent(grade)}&category=${encodeURIComponent(category)}`;
      if (dept === "通識教育中心" && campus && campus !== "全部") {
        url += `&campus=${encodeURIComponent(campus)}`;
      }
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
      if (quizQuestions.length === 0 || !quizRecommendation) {
        fetchGeminiQuiz();
      }
    }

    if (nextPanel === "details") {
      fetchDetailsCourses(
        detailsFilterDept,
        detailsFilterGrade,
        detailsFilterCategory,
        detailsFilterCampus
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
        case "details":
          yOffset = 335;
          break;
        case "reminder":
          yOffset = 420;
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
      const pureCourseName = cleanCourseName(selectedCourse.course_name);
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
          course_name: pureCourseName,
          semester_term: selectedCourse.semester_term,
        }),
      });
      const json = await res.json();
      if (json.success) {
        Alert.alert(
          "送出成功",
          `你對《${pureCourseName}》的評價已成功儲存！`
        );
        setSweetness(0);
        setEasiness(0);
        setGains(0);
        setComment("");
        setPanel(null);
      } else {
        Alert.alert("送出失敗", json.message || "評價無法記錄。");
      }
    } catch {
      Alert.alert("連線失敗", "無法連接伺服器，請確認後端運行中。");
    }
  };

  // 🌟 透過 Gemini AI 生成專屬趣味心理測驗題目
  const fetchGeminiQuiz = async (uidOverride?: number | string) => {
    const rawId = uidOverride || currentUserId;
    const uid = Number(rawId) || 3001;
    setLoadingQuizQuestions(true);
    setQuizStep(0);
    setQuizAnswers([]);
    setQuizRecommendation(null);
    try {
      const res = await fetch(`${baseUrl}/api/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid }),
      });
      const json = await res.json();
      if (
        res.ok &&
        json.success &&
        Array.isArray(json.questions) &&
        json.questions.length > 0
      ) {
        setQuizQuestions(json.questions);
      } else {
        throw new Error(json.message || "載入失敗");
      }
    } catch (e) {
      console.warn("Gemini 測驗題目載入失敗，使用預設備用題目:", e);
      setQuizQuestions([
        {
          id: 1,
          question: "身為大專學生，這學期你更偏好哪種專業修課主軸？",
          options: ["聚焦核心專題與實作技能", "深耕學術理論與跨界應用"],
        },
        {
          id: 2,
          question: "面對選課的學分與課業節奏，你目前的策略傾向？",
          options: ["高收穫高挑戰，衝刺學科深度", "甜涼平衡，保留更多自主專案時間"],
        },
        {
          id: 3,
          question: "展望未來的畢業與職涯接軌，你希望這學期的選課能帶給你？",
          options: ["具體可展示的作品與就業實力", "多元開闊的跨領域視野與證照"],
        },
      ]);
    } finally {
      setLoadingQuizQuestions(false);
    }
  };

  // 🌟 使用者二選一作答
  const handleAnswerQuiz = (optionText: string): void => {
    if (!quizQuestions[quizStep]) return;
    const currentQ = quizQuestions[quizStep];
    const updatedAnswers = [
      ...quizAnswers,
      {
        id: currentQ.id,
        question: currentQ.question,
        selected_option: optionText,
      },
    ];
    setQuizAnswers(updatedAnswers);

    if (quizStep < quizQuestions.length - 1) {
      setQuizStep(quizStep + 1);
    } else {
      // 3 題皆完成作答，呼叫 Gemini AI 產生選課建議！
      submitQuizToGemini(updatedAnswers);
    }
  };

  // 🌟 將作答送交 Gemini AI 進行分析並回傳選課建議
  const submitQuizToGemini = async (answers: QuizAnswerRecord[]) => {
    setSubmittingQuiz(true);
    const uid = Number(currentUserId) || 3001;
    try {
      const res = await fetch(`${baseUrl}/api/quiz/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: uid,
          answers: answers,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setQuizRecommendation(json.data);
      } else {
        throw new Error(json.message || "產生建議失敗");
      }
    } catch (e) {
      console.warn("產生 Gemini 選課建議例外:", e);
      Alert.alert(
        "分析完成",
        "已根據你的作答結果與學長姐修課評價為你排定專屬推薦選修課程！"
      );
    } finally {
      setSubmittingQuiz(false);
    }
  };

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

                    <Text style={styles.inputLabel}>選擇課程評價</Text>
                    <Pressable
                      style={styles.dropdownBtn}
                      onPress={() => {
                        setRateCourseSearchQuery("");
                        setCourseModalVisible(true);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dropdownCourseTitle}>
                          {selectedCourse
                            ? cleanCourseName(selectedCourse.course_name)
                            : "請選擇課程"}
                        </Text>
                        <Text style={styles.dropdownCourseSub}>
                          {selectedCourse
                            ? `${selectedCourse.semester_term ? `${formatSemesterLabel(selectedCourse.semester_term)}` : ""}${selectedCourse.semester_term && selectedCourse.credits !== undefined ? " · " : ""}${selectedCourse.credits !== undefined ? `${selectedCourse.credits} 學分` : ""}` || "已選擇課程"
                            : "點擊載入並選擇欲評價之課程"}
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
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.panelTitle}>趣味心理測驗</Text>
                        <View style={styles.aiTag}>
                          <Ionicons name="sparkles" size={11} color="#F2C14E" />
                          <Text style={styles.aiTagText}>Gemini AI</Text>
                        </View>
                      </View>
                    </View>

                    {loadingQuizQuestions ? (
                      <View style={{ alignItems: "center", paddingVertical: 24, gap: 10 }}>
                        <ActivityIndicator size="large" color="#F28C8C" />
                        <Text style={styles.panelCopy}>
                          Gemini AI 正在依據你的科系隨機生成 3 道專屬測驗問題...
                        </Text>
                      </View>
                    ) : submittingQuiz ? (
                      <View style={{ alignItems: "center", paddingVertical: 24, gap: 10 }}>
                        <ActivityIndicator size="large" color="#F2C14E" />
                        <Text style={styles.panelCopy}>
                          Gemini AI 正在深入分析你的作答，並參照學長姐課程評價，生成前三選修推薦...
                        </Text>
                      </View>
                    ) : quizRecommendation ? (
                      <>
                        <View style={styles.aiBadgeRow}>
                          <Ionicons name="sparkles" size={14} color="#F2C14E" />
                          <Text style={styles.recommendKicker}>
                            {quizRecommendation.is_ai_generated !== false
                              ? "GEMINI AI 專屬選課分析報告"
                              : "你的測驗報告"}
                          </Text>
                        </View>
                        <Text style={styles.recommendTitle}>
                          {quizRecommendation.title}
                        </Text>
                        <Text style={styles.panelCopy}>
                          {quizRecommendation.analysis}
                        </Text>

                        {/* 🌟 依推薦順序條列該系所開設之選修課程前三名 */}
                        {quizRecommendation.ranked_courses &&
                          quizRecommendation.ranked_courses.length > 0 && (
                            <View style={{ marginTop: 14 }}>
                              <Text style={styles.quizSectionLabel}>
                                🎯 依測驗結果為你推薦【
                                {quizRecommendation.department || "該系所"}
                                】選修課程前三名：
                              </Text>

                              {quizRecommendation.ranked_courses.slice(0, 3).map(
                                (course, idx) => {
                                  const rank = course.rank || idx + 1;
                                  const isTop1 = rank === 1;
                                  const isTop2 = rank === 2;
                                  const isTop3 = rank === 3;

                                  return (
                                    <Pressable
                                      key={`${course.course_id}_${idx}`}
                                      style={[
                                        styles.rankedCourseCard,
                                        isTop1 && styles.rankedCourseCardTop1,
                                      ]}
                                      onPress={() => {
                                        handleOpenCourseDetails({
                                          course_id: course.course_id,
                                          course_name: course.course_name,
                                          teacher: course.teacher,
                                          department:
                                            course.department ||
                                            quizRecommendation.department,
                                          grade: course.grade,
                                          credits: course.credits,
                                          category: "選修",
                                          classroom: course.classroom,
                                          schedule: course.schedule,
                                        } as CourseItem);
                                      }}
                                    >
                                      {/* 頂部：排序徽章與契合度 */}
                                      <View
                                        style={{
                                          flexDirection: "row",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          marginBottom: 6,
                                        }}
                                      >
                                        <View
                                          style={[
                                            styles.rankBadge,
                                            isTop1
                                              ? styles.rankBadge1
                                              : isTop2
                                              ? styles.rankBadge2
                                              : isTop3
                                              ? styles.rankBadge3
                                              : styles.rankBadgeOther,
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.rankBadgeText,
                                              (isTop1 || isTop2 || isTop3) && {
                                                color: "#16445A",
                                              },
                                            ]}
                                          >
                                            {isTop1
                                              ? "🥇 首選推薦 #1"
                                              : isTop2
                                              ? "🥈 次選推薦 #2"
                                              : isTop3
                                              ? "🥉 優先推薦 #3"
                                              : `推薦 #${rank}`}
                                          </Text>
                                        </View>

                                        {course.match_score ? (
                                          <View style={styles.matchScoreTag}>
                                            <Ionicons
                                              name="flame"
                                              size={12}
                                              color="#F2C14E"
                                            />
                                            <Text
                                              style={styles.matchScoreText}
                                            >
                                              契合度 {course.match_score}%
                                            </Text>
                                          </View>
                                        ) : null}
                                      </View>

                                      {/* 課程名稱與箭頭 */}
                                      <View
                                        style={{
                                          flexDirection: "row",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                        }}
                                      >
                                        <Text style={styles.rankedCourseName}>
                                          {cleanCourseName(course.course_name)}
                                        </Text>
                                        <Ionicons
                                          name="chevron-forward"
                                          size={15}
                                          color="#9AD8ED"
                                        />
                                      </View>

                                      {/* 課程詳細資訊：教師、學分、人數、時間、地點 */}
                                      <View
                                        style={{
                                          marginTop: 6,
                                          marginBottom: 8,
                                          gap: 5,
                                        }}
                                      >
                                        <View
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            flexWrap: "wrap",
                                            gap: 6,
                                          }}
                                        >
                                          <Text style={styles.rankedCourseMeta}>
                                            👨‍🏫 老師姓名：
                                            <Text
                                              style={{
                                                color: "#F0FFF9",
                                                fontWeight: "800",
                                              }}
                                            >
                                              {course.teacher || "授課教師"}
                                            </Text>
                                          </Text>
                                          <Text style={styles.rankedCourseMeta}>
                                            · {course.credits} 學分 · 選修
                                          </Text>
                                        </View>

                                        <View
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 6,
                                          }}
                                        >
                                          <Text style={styles.rankedCourseMeta}>
                                            👥 開課人數：
                                            <Text
                                              style={{
                                                color: "#F0FFF9",
                                                fontWeight: "700",
                                              }}
                                            >
                                              {course.enrolled ?? 0} /{" "}
                                              {course.capacity ?? 60} 人 (已選/名額)
                                            </Text>
                                          </Text>
                                        </View>

                                        <View
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            flexWrap: "wrap",
                                            gap: 8,
                                          }}
                                        >
                                          <Text
                                            style={[
                                              styles.rankedCourseMeta,
                                              { color: "#F2C14E" },
                                            ]}
                                          >
                                            🕒 時間：{course.schedule || "未公佈"}
                                          </Text>
                                          <Text
                                            style={[
                                              styles.rankedCourseMeta,
                                              { color: "#9AD8ED" },
                                            ]}
                                          >
                                            📍 上課地點：
                                            {course.classroom || "未公佈"}
                                          </Text>
                                        </View>

                                        {/* 🌟 課程評價訊息展示 */}
                                        <View style={styles.evalCardBox}>
                                          <Text style={styles.evalCardText}>
                                            {course.eval_sweetness != null || course.eval_gains != null
                                              ? `⭐ 參考課程評價：甜度 ${course.eval_sweetness ?? "-"}★ · 涼度 ${course.eval_easiness ?? "-"}★ · 收穫度 ${course.eval_gains ?? "-"}★${
                                                  course.eval_comments && course.eval_comments.length > 0
                                                    ? `\n💬 學長姐短評：『${course.eval_comments[0]}』`
                                                    : ""
                                                }`
                                              : "⭐ 參考課程評價：系上推薦優質開課選修，教學大綱豐富"}
                                          </Text>
                                        </View>

                                        {/* 該位老師的教學大綱 */}
                                        <Pressable
                                          style={styles.syllabusButton}
                                          onPress={(e) => {
                                            e.stopPropagation?.();
                                            const url =
                                              course.syllabus_url ||
                                              "https://tch.mcu.edu.tw/sylwebqry/pro10_01.aspx";
                                            Linking.openURL(url).catch(() => {
                                              Alert.alert(
                                                "開啟失敗",
                                                `無法開啟教學大綱連結：\n${url}`
                                              );
                                            });
                                          }}
                                        >
                                          <Ionicons
                                            name="document-text-outline"
                                            size={14}
                                            color="#16445A"
                                          />
                                          <Text style={styles.syllabusButtonText}>
                                            📄 查看【{course.teacher || "授課老師"}
                                            】教學大綱 ↗
                                          </Text>
                                        </Pressable>
                                      </View>

                                      {/* 專屬推薦理由（融入課程評價訊息與作答原因） */}
                                      {course.recommend_reason ? (
                                        <View style={styles.recommendReasonBox}>
                                          <Text
                                            style={styles.recommendReasonText}
                                          >
                                            💡 推薦原因：
                                            {course.recommend_reason}
                                          </Text>
                                        </View>
                                      ) : null}
                                    </Pressable>
                                  );
                                }
                              )}
                            </View>
                          )}

                        {quizRecommendation.advice && (
                          <View style={{ marginTop: 12 }}>
                            <Text style={styles.quizSectionLabel}>
                              💡 專屬選課策略建議：
                            </Text>
                            <Text style={styles.quizAdviceText}>
                              {quizRecommendation.advice}
                            </Text>
                          </View>
                        )}

                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => fetchGeminiQuiz()}
                        >
                          <Ionicons name="refresh" size={14} color="#0B2635" />
                          <Text style={styles.secondaryText}>
                            重新測驗（AI 隨機重新出題）
                          </Text>
                        </Pressable>
                      </>
                    ) : quizQuestions.length > 0 && quizQuestions[quizStep] ? (
                      <>
                        <Text style={styles.progress}>
                          第 {quizStep + 1} / {quizQuestions.length} 題（2 選 1 作答）
                        </Text>
                        <Text style={styles.question}>
                          {quizQuestions[quizStep].question}
                        </Text>
                        <Pressable
                          style={styles.option}
                          onPress={() =>
                            handleAnswerQuiz(quizQuestions[quizStep].options[0])
                          }
                        >
                          <Text style={styles.optionText}>
                            A. {quizQuestions[quizStep].options[0]}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.option}
                          onPress={() =>
                            handleAnswerQuiz(quizQuestions[quizStep].options[1])
                          }
                        >
                          <Text style={styles.optionText}>
                            B. {quizQuestions[quizStep].options[1]}
                          </Text>
                        </Pressable>
                      </>
                    ) : (
                      <View style={{ alignItems: "center", paddingVertical: 18 }}>
                        <Text style={styles.panelCopy}>尚未載入測驗題目</Text>
                        <Pressable
                          style={[styles.secondaryButton, { marginTop: 10 }]}
                          onPress={() => fetchGeminiQuiz()}
                        >
                          <Text style={styles.secondaryText}>載入測驗</Text>
                        </Pressable>
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
                            : getDeptCode(detailsFilterDept)
                            ? `${getDeptCode(detailsFilterDept)} - ${detailsFilterDept}`
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
                            placeholder="快速搜尋系所（例如：00、資管、通識...）"
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

                        {/* 可滾動所有系所項目清單（依銘傳大學科系代號排序） */}
                        <ScrollView
                          style={{ maxHeight: 220 }}
                          nestedScrollEnabled={true}
                          showsVerticalScrollIndicator={true}
                          keyboardShouldPersistTaps="handled"
                        >
                          {departmentList
                            .filter((d) => {
                              if (detailsDeptSearchQuery.trim() === "") return true;
                              const q = detailsDeptSearchQuery.trim().toLowerCase();
                              return (
                                d.toLowerCase().includes(q) ||
                                getDeptCode(d).toLowerCase().includes(q)
                              );
                            })
                            .map((dept) => {
                              const isSelected = detailsFilterDept === dept;
                              const code = getDeptCode(dept);
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
                                    const nextCampus =
                                      dept === "通識教育中心"
                                        ? detailsFilterCampus
                                        : "全部";
                                    if (dept !== "通識教育中心") {
                                      setDetailsFilterCampus("全部");
                                    } else {
                                      setDetailsFilterGrade("全部");
                                      setDetailsFilterCategory("全部");
                                    }
                                    fetchDetailsCourses(
                                      dept,
                                      dept === "通識教育中心" ? "全部" : detailsFilterGrade,
                                      dept === "通識教育中心" ? "全部" : detailsFilterCategory,
                                      nextCampus
                                    );
                                  }}
                                >
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 6,
                                      flex: 1,
                                    }}
                                  >
                                    {code ? (
                                      <View
                                        style={[
                                          styles.deptCodeBadge,
                                          isSelected && styles.deptCodeBadgeActive,
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.deptCodeBadgeText,
                                            isSelected && styles.deptCodeBadgeTextActive,
                                          ]}
                                        >
                                          {code}
                                        </Text>
                                      </View>
                                    ) : null}
                                    <Text
                                      style={[
                                        styles.deptDropdownItemText,
                                        isSelected &&
                                          styles.deptDropdownItemTextActive,
                                      ]}
                                    >
                                      {dept === "全部" ? "全部系所" : dept}
                                    </Text>
                                  </View>
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

                    {/* 🌟 若系所別選擇「通識教育中心」，增加校區分類選項 */}
                    {detailsFilterDept === "通識教育中心" && (
                      <View style={{ marginTop: 14 }}>
                        <Text style={styles.filterTitle}>校區</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.pillRow}
                        >
                          {CAMPUS_OPTIONS.map((c) => (
                            <Pressable
                              key={c}
                              style={[
                                styles.pill,
                                detailsFilterCampus === c && styles.pillActive,
                              ]}
                              onPress={() => {
                                setDetailsFilterCampus(c);
                                fetchDetailsCourses(
                                  detailsFilterDept,
                                  detailsFilterGrade,
                                  detailsFilterCategory,
                                  c
                                );
                              }}
                            >
                              <Text
                                style={[
                                  styles.pillText,
                                  detailsFilterCampus === c && styles.pillTextActive,
                                ]}
                              >
                                {c}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {/* 🌟 非通識教育中心才顯示年級與修別 */}
                    {detailsFilterDept !== "通識教育中心" && (
                      <>
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
                                  detailsFilterCategory,
                                  detailsFilterCampus
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

                        {/* 修別（通識不顯示） */}
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
                                  cat,
                                  detailsFilterCampus
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
                      </>
                    )}

                    <View style={styles.divider} />

                    {(() => {
                      const displayedDetailsCourses = detailsCourses.filter((course) => {
                        if (detailsFilterDept !== "通識教育中心") return true;
                        if (!detailsFilterCampus || detailsFilterCampus === "全部") return true;
                        const target = detailsFilterCampus.replace("校區", "").trim();
                        const info = `${course.classroom || ""} ${(course as any).campus || ""}`;
                        if (target === "基和" || target === "基河") {
                          return info.includes("基河") || info.includes("基和");
                        }
                        return info.includes(target);
                      });

                      if (loadingDetailsCourses) {
                        return (
                          <Text
                            style={[
                              styles.panelCopy,
                              { textAlign: "center", paddingVertical: 18 },
                            ]}
                          >
                            正在篩選符合的課程...
                          </Text>
                        );
                      }

                      if (displayedDetailsCourses.length === 0) {
                        return (
                          <Text
                            style={[
                              styles.panelCopy,
                              { textAlign: "center", paddingVertical: 18 },
                            ]}
                          >
                            沒有符合此條件的課程。
                          </Text>
                        );
                      }

                      return (
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
                            {displayedDetailsCourses.map((course, index) => (
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
                      );
                    })()}
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
                  <Text style={styles.modalTitle}>選擇課程評價</Text>
                  <Text style={styles.modalSubtitle}>
                    僅顯示純課程名稱（無班級與校區）
                  </Text>
                </View>
                <Pressable onPress={() => setCourseModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#F0FFF9" />
                </Pressable>
              </View>

              {/* 🌟 課程搜尋框 */}
              <View style={[styles.deptSearchRow, { marginHorizontal: 0, marginBottom: 10 }]}>
                <Ionicons name="search" size={15} color="#9AD8ED" />
                <TextInput
                  style={styles.deptSearchInput}
                  placeholder="搜尋課程名稱（例如：微積分、體育...）"
                  placeholderTextColor="rgba(240,255,249,0.4)"
                  value={rateCourseSearchQuery}
                  onChangeText={setRateCourseSearchQuery}
                  autoCapitalize="none"
                />
                {rateCourseSearchQuery.length > 0 && (
                  <Pressable onPress={() => setRateCourseSearchQuery("")}>
                    <Ionicons name="close-circle" size={16} color="#9AD8ED" />
                  </Pressable>
                )}
              </View>

              {/* 🌟 類別分頁切換列（已修通過 vs 全校課程庫） */}
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <Pressable
                  style={[
                    styles.pill,
                    rateCourseTab === "passed" && styles.pillActive,
                    { flex: 1, alignItems: "center", justifyContent: "center" },
                  ]}
                  onPress={() => setRateCourseTab("passed")}
                >
                  <Text
                    style={[
                      styles.pillText,
                      rateCourseTab === "passed" && styles.pillTextActive,
                    ]}
                  >
                    已修通過課程 ({myCourses.length})
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.pill,
                    rateCourseTab === "all" && styles.pillActive,
                    { flex: 1, alignItems: "center", justifyContent: "center" },
                  ]}
                  onPress={() => {
                    setRateCourseTab("all");
                    fetchAllCoursesForRating();
                  }}
                >
                  <Text
                    style={[
                      styles.pillText,
                      rateCourseTab === "all" && styles.pillTextActive,
                    ]}
                  >
                    全校所有課程
                  </Text>
                </Pressable>
              </View>

              {/* 頂部操作與統計列 */}
              <View style={styles.modalToolRow}>
                <Text style={styles.modalToolCount}>
                  {rateCourseTab === "passed"
                    ? `共 ${myCourses.length} 門已修課程`
                    : `全校開課庫（純課程名稱去重）`}
                </Text>
                {rateCourseTab === "passed" && (
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
                )}
              </View>

              {/* 列表內容展示 */}
              {rateCourseTab === "passed" ? (
                loadingMyCourses || syncing ? (
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
                      尚未同步已通過課程
                    </Text>
                    <Text style={styles.emptyCoursesSubtitle}>
                      你可以同步校務成績，或直接切換至「全校所有課程」標籤為任何課程評分。
                    </Text>
                    <Pressable
                      style={styles.emptySyncBtn}
                      onPress={() => {
                        setRateCourseTab("all");
                        fetchAllCoursesForRating();
                      }}
                    >
                      <Ionicons name="list" size={16} color="#16445A" />
                      <Text style={styles.emptySyncBtnText}>
                        查看全校課程進行評價
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {myCourses
                      .filter((c) =>
                        rateCourseSearchQuery.trim() === ""
                          ? true
                          : cleanCourseName(c.course_name)
                              .toLowerCase()
                              .includes(rateCourseSearchQuery.trim().toLowerCase())
                      )
                      .map((c, index) => {
                        const pureName = cleanCourseName(c.course_name);

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
                              setSelectedCourse({
                                ...c,
                                course_name: pureName,
                                class_name: undefined,
                                classroom: undefined,
                              });
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
                              <Text
                                style={[
                                  styles.courseSelectName,
                                  { flex: 1, marginRight: 8 },
                                ]}
                              >
                                {pureName}
                              </Text>
                              {c.semester_term ? (
                                <View style={styles.semesterBadge}>
                                  <Text style={styles.semesterBadgeText}>
                                    {formatSemesterLabel(c.semester_term)}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                            {c.credits !== undefined ? (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                }}
                              >
                                <Text style={styles.courseSelectDetail}>
                                  {c.credits} 學分
                                </Text>
                              </View>
                            ) : null}
                          </Pressable>
                        );
                      })}
                  </ScrollView>
                )
              ) : (
                /* 全校所有課程分頁（完全純課名，絕無班級與校區） */
                loadingAllCoursesForRating ? (
                  <View
                    style={{
                      flex: 1,
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <ActivityIndicator size="large" color="#F2C14E" />
                    <Text style={styles.panelCopy}>載入全校評價課程中...</Text>
                  </View>
                ) : (
                  <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {allCoursesForRating
                      .filter((c) =>
                        rateCourseSearchQuery.trim() === ""
                          ? true
                          : cleanCourseName(c.course_name)
                              .toLowerCase()
                              .includes(rateCourseSearchQuery.trim().toLowerCase())
                      )
                      .map((c, index) => {
                        const pureName = cleanCourseName(c.course_name);
                        const teacherName =
                          c.teacher &&
                          c.teacher !== "專任教師" &&
                          c.teacher !== "授課教師"
                            ? c.teacher
                            : "---";

                        return (
                          <Pressable
                            key={`${c.course_id}_${index}`}
                            style={[
                              styles.courseSelectItem,
                              selectedCourse?.course_id === c.course_id &&
                                styles.courseSelectItemActive,
                            ]}
                            onPress={() => {
                              setSelectedCourse({
                                ...c,
                                course_name: pureName,
                                class_name: undefined,
                                classroom: undefined,
                              });
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
                                {pureName}
                              </Text>
                              <View style={styles.semesterBadge}>
                                <Text style={styles.semesterBadgeText}>
                                  {c.category || "全校"}
                                </Text>
                              </View>
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
                                {cleanDepartment(c.department)} ·{" "}
                                {c.grade || "大學部"}
                              </Text>
                              {c.credits !== undefined ? (
                                <Text style={styles.courseSelectDetail}>
                                  · {c.credits} 學分
                                </Text>
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      })}
                  </ScrollView>
                )
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
                    {cleanCourseName(selectedReviewCourse?.course_name)}
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
                  {/* 🌟 只有「查看課程詳細資訊」才顯示開課班級；「課程評價」不顯示班級 */}
                  {detailModalMode === "details" && (
                    <View style={styles.courseDetailItem}>
                      <Text style={styles.courseDetailLabel}>開課班級</Text>
                      <Text style={styles.courseDetailVal}>
                        {selectedReviewCourse?.class_name || "---"}
                      </Text>
                    </View>
                  )}
                  <View style={styles.courseDetailItem}>
                    <Text style={styles.courseDetailLabel}>開課系所</Text>
                    <Text style={styles.courseDetailVal}>
                      {cleanDepartment(selectedReviewCourse?.department) || "全校"}
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
                  {detailModalMode === "details" && (
                    <View style={styles.courseDetailItem}>
                      <Text style={styles.courseDetailLabel}>選課/開班人數</Text>
                      <Text style={styles.courseDetailVal}>
                        {selectedReviewCourse?.enrolled !== undefined &&
                        selectedReviewCourse?.capacity !== undefined
                          ? `${selectedReviewCourse.enrolled} / ${selectedReviewCourse.capacity}`
                          : "---"}
                      </Text>
                    </View>
                  )}
                  {detailModalMode === "details" && Boolean(selectedReviewCourse?.schedule) && (
                    <View style={[styles.courseDetailItem, { width: "100%" }]}>
                      <Text style={styles.courseDetailLabel}>上課時間 / 節次</Text>
                      <Text style={styles.courseDetailVal}>
                        🕒 {selectedReviewCourse?.schedule}
                      </Text>
                    </View>
                  )}
                  {/* 🌟 只有「查看課程詳細資訊」才顯示教室/校區地點；「課程評價」不顯示校區 */}
                  {detailModalMode === "details" && Boolean(selectedReviewCourse?.classroom) && (
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
  deptCodeBadge: {
    backgroundColor: "rgba(182, 227, 194, 0.18)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(182, 227, 194, 0.35)",
  },
  deptCodeBadgeActive: {
    backgroundColor: "rgba(22, 68, 90, 0.25)",
    borderColor: "rgba(22, 68, 90, 0.4)",
  },
  deptCodeBadgeText: {
    color: "#B6E3C2",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  deptCodeBadgeTextActive: {
    color: "#16445A",
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

  /* 趣味心理測驗（Gemini AI）樣式 */
  aiTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(242,193,78,0.15)",
    borderWidth: 1,
    borderColor: "rgba(242,193,78,0.3)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiTagText: {
    color: "#F2C14E",
    fontSize: 11,
    fontWeight: "700",
  },
  aiBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 14,
  },
  quizSectionLabel: {
    color: "#9AD8ED",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  quizAdviceText: {
    color: "rgba(240,255,249,0.92)",
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: "rgba(239,255,249,0.06)",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.15)",
  },
  rankedCourseCard: {
    backgroundColor: "rgba(239,255,249,0.08)",
    borderWidth: 1,
    borderColor: "rgba(236,255,248,0.22)",
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
  },
  rankedCourseCardTop1: {
    borderColor: "rgba(242,193,78,0.55)",
    backgroundColor: "rgba(242,193,78,0.08)",
  },
  rankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rankBadge1: {
    backgroundColor: "#F2C14E",
  },
  rankBadge2: {
    backgroundColor: "#C3E0D8",
  },
  rankBadge3: {
    backgroundColor: "#EAB0D3",
  },
  rankBadgeOther: {
    backgroundColor: "rgba(154,216,237,0.18)",
    borderWidth: 1,
    borderColor: "rgba(154,216,237,0.3)",
  },
  rankBadgeText: {
    color: "#16445A",
    fontSize: 11,
    fontWeight: "800",
  },
  matchScoreTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(242,193,78,0.15)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  matchScoreText: {
    color: "#F2C14E",
    fontSize: 11,
    fontWeight: "700",
  },
  rankedCourseName: {
    color: "#F0FFF9",
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
    paddingRight: 6,
  },
  rankedCourseMeta: {
    color: "#9AD8ED",
    fontSize: 12,
  },
  evalCardBox: {
    backgroundColor: "rgba(242,193,78,0.12)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(242,193,78,0.3)",
    marginTop: 5,
  },
  evalCardText: {
    color: "#F2C14E",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  recommendReasonBox: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#F2C14E",
    marginTop: 6,
  },
  recommendReasonText: {
    color: "rgba(240,255,249,0.92)",
    fontSize: 12,
    lineHeight: 18,
  },
  syllabusButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F2C14E",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  syllabusButtonText: {
    color: "#16445A",
    fontSize: 12,
    fontWeight: "800",
  },
});

