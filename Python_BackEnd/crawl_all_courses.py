# -*- coding: utf-8 -*-
"""
銘傳大學全校課程爬蟲模組 (MCU Course System Crawler)
支援分科系、分年級爬取全校開課資料，並匯入 MongoDB 與本地 SQLite/JSON。
目標系統：銘傳大學學生資訊系統 - 課程查詢 (https://stu.mcu.edu.tw/appx/qry/)
"""

import os
import sys
import re
import time
import json
import sqlite3
import argparse
from typing import Dict, List, Any, Optional, Tuple
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# 讀取環境變數
env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=env_file)

try:
    from database import get_database
    HAS_DB = True
except Exception as e:
    HAS_DB = False
    print(f"[警告] 無法連線 MongoDB 資料庫: {e}，將僅儲存於本地 SQLite / JSON。")

BASE_URL = "https://stu.mcu.edu.tw/appx/qry/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
}


def clean_text(text: Optional[str]) -> str:
    """清理文字中的前後空白與特殊換行字元"""
    if not text:
        return ""
    # 替換全形空白與連續空格
    t = re.sub(r"[\r\n\t]+", " ", text)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def grade_to_display(grade_str: str) -> str:
    """將年級代號轉成統一的顯示格式（大一、大二、大三、大四）"""
    g = str(grade_str).strip()
    mapping = {
        "1": "大一",
        "2": "大二",
        "3": "大三",
        "4": "大四",
        "5": "大五",
        "6": "大六",
        "一年級": "大一",
        "二年級": "大二",
        "三年級": "大三",
        "四年級": "大四",
    }
    return mapping.get(g, g or "全部")


class MCUCourseCrawler:
    def __init__(self, delay: float = 0.5):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.delay = delay
        self.semester_info: Dict[str, str] = {}
        self.departments: List[Dict[str, str]] = []
        self.current_state: Dict[str, str] = {}

    def _extract_state(self, html: str) -> Dict[str, str]:
        """提取 ASP.NET 的 ViewState 相關 Hidden 欄位"""
        soup = BeautifulSoup(html, "html.parser")
        vs = soup.find("input", {"id": "__VIEWSTATE"})
        gen = soup.find("input", {"id": "__VIEWSTATEGENERATOR"})
        ev = soup.find("input", {"id": "__EVENTVALIDATION"})
        return {
            "__VIEWSTATE": vs.get("value", "") if vs else "",
            "__VIEWSTATEGENERATOR": gen.get("value", "") if gen else "",
            "__EVENTVALIDATION": ev.get("value", "") if ev else "",
        }

    def init_session(self, target_semester: str = "114-2") -> bool:
        """
        初始化連線，選擇目標學期並進入特定條件查詢頁面 (Qs13.aspx)
        """
        print("[1/3] 初始化爬蟲連線至銘傳課程查詢系統 (Qs01.aspx)...")
        res1 = self.session.get(urljoin(BASE_URL, "Qs01.aspx"), timeout=15)
        res1.encoding = "utf-8"
        state = self._extract_state(res1.text)

        soup1 = BeautifulSoup(res1.text, "html.parser")
        
        # 尋找學期連結按鈕
        sem_links = soup1.find_all("a", id=re.compile(r"linkbys1[0-9]"))
        post_target = "ctl00$tableConten$linkbys12"  # 預設 114學年度第2學期
        sem_label = "114學年度第2學期"

        for a in sem_links:
            text = clean_text(a.get_text())
            href = a.get("href", "")
            target_match = re.search(r"__doPostBack\('([^']+)'", href)
            if target_match:
                btn_target = target_match.group(1)
                if "114" in text and "2" in text:
                    post_target = btn_target
                    sem_label = text
                elif target_semester in text:
                    post_target = btn_target
                    sem_label = text

        print(f"[2/3] 選定學期: {sem_label} (Target: {post_target})")
        post_data = {
            "__EVENTTARGET": post_target,
            "__EVENTARGUMENT": "",
            "__VIEWSTATE": state["__VIEWSTATE"],
            "__VIEWSTATEGENERATOR": state["__VIEWSTATEGENERATOR"],
            "__EVENTVALIDATION": state["__EVENTVALIDATION"],
        }
        res2 = self.session.post(urljoin(BASE_URL, "Qs01.aspx"), data=post_data, timeout=15)
        res2.encoding = "utf-8"

        # 請求 Qs13.aspx (特定條件查詢)
        print("[3/3] 進入詳細課程檢索頁面 (Qs13.aspx)...")
        res3 = self.session.get(urljoin(BASE_URL, "Qs13.aspx"), timeout=15)
        res3.encoding = "utf-8"
        self.current_state = self._extract_state(res3.text)

        # 解析科系選單
        soup3 = BeautifulSoup(res3.text, "html.parser")
        dept_select = soup3.find("select", {"name": "ctl00$MainContent$drpDepartment1"})
        if dept_select:
            self.departments = []
            for opt in dept_select.find_all("option"):
                val = opt.get("value", "").strip()
                text = clean_text(opt.get_text())
                if val:
                    parts = text.split("-", 1)
                    dept_name = parts[1] if len(parts) > 1 else text
                    self.departments.append({"code": val, "name": dept_name, "raw": text})
            print(f"成功取得 {len(self.departments)} 個開課系所/教學單位。")
            return True
        else:
            print("[錯誤] 無法取得系所下拉選單！")
            return False

    def reset_query_page(self):
        """重新獲取 Qs13.aspx 查詢表單以重置 ViewState"""
        try:
            res = self.session.get(urljoin(BASE_URL, "Qs13.aspx"), timeout=15)
            res.encoding = "utf-8"
            self.current_state = self._extract_state(res.text)
        except Exception as e:
            print(f"  [重置查詢表單失敗]: {e}")

    def query_courses_by_dept(
        self, dept_code: str, dept_name: str, grade: str = ""
    ) -> List[Dict[str, Any]]:
        """
        依照科系代碼與年級查詢課程列表
        grade: "1", "2", "3", "4" 或 "" (全部年級)
        """
        # 每次查詢前重置為乾淨的查詢表單頁面
        self.reset_query_page()

        post_data = {
            "__EVENTTARGET": "",
            "__EVENTARGUMENT": "",
            "__VIEWSTATE": self.current_state["__VIEWSTATE"],
            "__VIEWSTATEGENERATOR": self.current_state["__VIEWSTATEGENERATOR"],
            "__EVENTVALIDATION": self.current_state["__EVENTVALIDATION"],
            "ctl00$MainContent$drpCampus": "",
            "ctl00$MainContent$drpDepartment1": dept_code,
            "ctl00$MainContent$drpGrade1": grade,
            "ctl00$MainContent$drpDepartment2": "",
            "ctl00$MainContent$drpGrade2": "",
            "ctl00$MainContent$drpDepartment3": "",
            "ctl00$MainContent$drpGrade3": "",
            "ctl00$MainContent$drpyrnm": "",
            "ctl00$MainContent$drpSorting": "",
            "ctl00$MainContent$drpweek1": "",
            "ctl00$MainContent$drpssec1": "",
            "ctl00$MainContent$drpesec1": "",
            "ctl00$MainContent$drpweek2": "",
            "ctl00$MainContent$drpssec2": "",
            "ctl00$MainContent$drpesec2": "",
            "ctl00$MainContent$drpweek3": "",
            "ctl00$MainContent$drpssec3": "",
            "ctl00$MainContent$drpesec3": "",
            "ctl00$MainContent$drpweek4": "",
            "ctl00$MainContent$drpssec4": "",
            "ctl00$MainContent$drpesec4": "",
            "ctl00$MainContent$txtcour": "",
            "ctl00$MainContent$txttea": "",
            "ctl00$MainContent$btnSend": "  查 詢  ",
        }

        try:
            res = self.session.post(urljoin(BASE_URL, "Qs13.aspx"), data=post_data, timeout=20)
            res.encoding = "utf-8"
        except Exception as e:
            print(f"  [連線異常] 科系 {dept_name} (代號 {dept_code}) 年級 {grade}: {e}")
            return []

        courses = self._parse_result_html(res.text, dept_code, dept_name)
        return courses

    def _parse_result_html(self, html: str, dept_code: str, dept_name: str) -> List[Dict[str, Any]]:
        """解析搜尋結果頁面中的課程表格"""
        soup = BeautifulSoup(html, "html.parser")
        print_div = soup.find("div", {"id": "printlist"})
        if not print_div:
            return []

        table = print_div.find("table")
        if not table:
            return []

        rows = table.find_all("tr")
        if len(rows) <= 1:
            return []

        # 標題欄檢驗: 制別、科目、班級、開班/選課人數、任課教師、上課日期/節次、年級、教室【地點】、選別、學分、類別、畢業班、學期數、說明
        courses = []
        for tr in rows[1:]:
            cells = tr.find_all(["td", "th"])
            if len(cells) < 10:
                continue

            row_texts = [clean_text(td.get_text()) for td in cells]
            system_type = row_texts[0] if len(row_texts) > 0 else "大學部"
            raw_course = row_texts[1] if len(row_texts) > 1 else ""
            raw_class = row_texts[2] if len(row_texts) > 2 else ""
            raw_capacity = row_texts[3] if len(row_texts) > 3 else "0/0"
            raw_teacher = row_texts[4] if len(row_texts) > 4 else ""
            raw_schedule = row_texts[5] if len(row_texts) > 5 else ""
            raw_grade = row_texts[6] if len(row_texts) > 6 else ""
            raw_classroom = row_texts[7] if len(row_texts) > 7 else ""
            raw_category = row_texts[8] if len(row_texts) > 8 else "選修"
            raw_credits = row_texts[9] if len(row_texts) > 9 else "0"
            raw_dept_category = row_texts[10] if len(row_texts) > 10 else ""
            raw_grad = row_texts[11] if len(row_texts) > 11 else "N"
            raw_term = row_texts[12] if len(row_texts) > 12 else ""
            raw_remark = row_texts[13] if len(row_texts) > 13 else ""

            # 解析科目代號與名稱: "36103 離散數學" -> ("36103", "離散數學")
            course_id_m = re.match(r"^([A-Za-z0-9]+)\s*(.*)$", raw_course)
            if course_id_m:
                course_id = course_id_m.group(1).strip()
                course_name = course_id_m.group(2).strip() or raw_course
            else:
                course_id = raw_course
                course_name = raw_course

            # 解析班級代號與名稱: "36101 資工一甲"
            class_code_m = re.match(r"^([A-Za-z0-9]+)\s*(.*)$", raw_class)
            if class_code_m:
                class_code = class_code_m.group(1).strip()
                class_name = class_code_m.group(2).strip() or raw_class
            else:
                class_code = raw_class
                class_name = raw_class

            # 人數: "75/57"
            cap_m = re.match(r"^(\d+)\s*/\s*(\d+)$", raw_capacity)
            capacity = int(cap_m.group(1)) if cap_m else 0
            enrolled = int(cap_m.group(2)) if cap_m else 0

            # 教師姓名與大綱連結: "正課：郭國隆"
            teacher_a = cells[4].find("a")
            syllabus_url = ""
            if teacher_a and teacher_a.get("href"):
                syllabus_url = teacher_a["href"].strip()

            clean_teacher = re.sub(r"^(?:正課|實習|導生|專任|兼任)[：:]\s*", "", raw_teacher).strip()
            if not clean_teacher:
                clean_teacher = "授課教師"

            # 學分
            try:
                credits_val = float(raw_credits)
            except ValueError:
                credits_val = 0.0

            # 校區 (教室【桃園】)
            campus = "桃園"
            campus_m = re.search(r"【(.*?)】|\[(.*?)\]", raw_classroom)
            if campus_m:
                campus = (campus_m.group(1) or campus_m.group(2)).strip()
            elif "台北" in raw_classroom or "基河" in raw_classroom:
                campus = "台北"

            # 年級規格化
            display_grade = grade_to_display(raw_grade)

            # 修別規格化 (必修 / 選修)
            if "必" in raw_category:
                category = "必修"
            elif "通" in raw_category:
                category = "通識"
            else:
                category = "選修"

            course_item = {
                "course_id": course_id,
                "course_name": course_name,
                "class_code": class_code,
                "class_name": class_name,
                "department": dept_name,
                "dept_code": dept_code,
                "grade": display_grade,
                "raw_grade": raw_grade,
                "teacher": clean_teacher,
                "syllabus_url": syllabus_url,
                "schedule": raw_schedule,
                "classroom": raw_classroom,
                "campus": campus,
                "category": category,
                "credits": credits_val,
                "capacity": capacity,
                "enrolled": enrolled,
                "semester_term": "114-2",
                "system_type": system_type,
                "is_graduating_class": raw_grad,
                "term_type": raw_term,
                "remark": raw_remark,
                "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
            courses.append(course_item)

        return courses


def save_to_sqlite(courses: List[Dict[str, Any]], db_path: str = "mcu_courses.db"):
    """儲存至本地 SQLite 資料庫並建立索引"""
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id TEXT,
        course_name TEXT,
        class_code TEXT,
        class_name TEXT,
        department TEXT,
        dept_code TEXT,
        grade TEXT,
        teacher TEXT,
        syllabus_url TEXT,
        schedule TEXT,
        classroom TEXT,
        campus TEXT,
        category TEXT,
        credits REAL,
        capacity INTEGER,
        enrolled INTEGER,
        semester_term TEXT,
        system_type TEXT,
        remark TEXT,
        updated_at TEXT,
        UNIQUE(semester_term, class_code, course_id)
    )
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_dept ON courses(department)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_grade ON courses(grade)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_name ON courses(course_name)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_teacher ON courses(teacher)")

    inserted = 0
    updated = 0

    for c in courses:
        try:
            cur.execute("""
            INSERT INTO courses (
                course_id, course_name, class_code, class_name, department, dept_code,
                grade, teacher, syllabus_url, schedule, classroom, campus, category,
                credits, capacity, enrolled, semester_term, system_type, remark, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(semester_term, class_code, course_id) DO UPDATE SET
                course_name=excluded.course_name,
                class_name=excluded.class_name,
                department=excluded.department,
                dept_code=excluded.dept_code,
                grade=excluded.grade,
                teacher=excluded.teacher,
                syllabus_url=excluded.syllabus_url,
                schedule=excluded.schedule,
                classroom=excluded.classroom,
                campus=excluded.campus,
                category=excluded.category,
                credits=excluded.credits,
                capacity=excluded.capacity,
                enrolled=excluded.enrolled,
                remark=excluded.remark,
                updated_at=excluded.updated_at
            """, (
                c["course_id"], c["course_name"], c["class_code"], c["class_name"],
                c["department"], c["dept_code"], c["grade"], c["teacher"],
                c["syllabus_url"], c["schedule"], c["classroom"], c["campus"],
                c["category"], c["credits"], c["capacity"], c["enrolled"],
                c["semester_term"], c["system_type"], c["remark"], c["updated_at"]
            ))
            if cur.rowcount == 1:
                inserted += 1
            else:
                updated += 1
        except Exception as e:
            pass

    conn.commit()
    conn.close()
    return inserted, updated


def save_to_mongodb(courses: List[Dict[str, Any]]) -> Tuple[int, int]:
    """更新或插入 MongoDB COURSE 集合 (Upsert by class_code + course_id + semester_term)"""
    if not HAS_DB:
        return 0, 0

    db = get_database()
    col = db["COURSE"]

    inserted = 0
    updated = 0

    for c in courses:
        filter_doc = {
            "semester_term": c["semester_term"],
            "class_code": c["class_code"],
            "course_id": c["course_id"],
        }
        res = col.update_one(filter_doc, {"$set": c}, upsert=True)
        if res.upserted_id:
            inserted += 1
        else:
            updated += 1

    return inserted, updated


def run_crawler(
    dept_filter: Optional[str] = None,
    grade_filter: Optional[str] = None,
    iterate_grades: bool = False,
    max_depts: Optional[int] = None
):
    """
    執行主爬取流程
    dept_filter: 可指定科系代號 (如 '36') 或名稱關鍵字 (如 '資訊工程')
    grade_filter: 指定單一年級 (如 '1', '2', '3', '4')
    iterate_grades: 是否逐年級個別送出請求 (預設 False: 單次請求獲取全系各年級，速度最快且年級欄位完整)
    max_depts: 限制科系數量 (測試用)
    """
    crawler = MCUCourseCrawler(delay=0.4)
    if not crawler.init_session():
        print("初始化連線失敗，請檢查網路連線。")
        return []

    depts_to_crawl = crawler.departments
    if dept_filter:
        depts_to_crawl = [
            d for d in depts_to_crawl
            if dept_filter in d["code"] or dept_filter in d["name"]
        ]
        print(f"篩選符合條件的科系: {[d['name'] for d in depts_to_crawl]}")

    if max_depts and max_depts > 0:
        depts_to_crawl = depts_to_crawl[:max_depts]

    total_courses: List[Dict[str, Any]] = []
    seen_keys = set()

    if grade_filter:
        grades = [grade_filter]
    elif iterate_grades:
        grades = ["1", "2", "3", "4"]
    else:
        grades = [""]  # 單次請求獲取該系所有年級

    total_dept_count = len(depts_to_crawl)
    mode_desc = f"指定年級 {grade_filter}" if grade_filter else ("逐年級個別爬取" if iterate_grades else "全系一次性爬取 (高效模式)")
    print(f"\n🚀 開始爬取 {total_dept_count} 個科系之開課資料 (模式: {mode_desc})...\n")

    for idx, dept in enumerate(depts_to_crawl, start=1):
        dept_code = dept["code"]
        dept_name = dept["name"]
        print(f"[{idx}/{total_dept_count}] 正在爬取: {dept_name} (代號: {dept_code})")

        dept_courses_count = 0
        for g in grades:
            courses = crawler.query_courses_by_dept(dept_code, dept_name, grade=g)
            for c in courses:
                # 複合去重 key: (semester, class_code, course_id)
                k = (c["semester_term"], c["class_code"], c["course_id"])
                if k not in seen_keys:
                    seen_keys.add(k)
                    total_courses.append(c)
                    dept_courses_count += 1
            time.sleep(crawler.delay)

        print(f"  -> 完成 {dept_name}，新增 {dept_courses_count} 門課程。本次累計: {len(total_courses)} 門\n")

    print("==========================================")
    print(f"🎉 爬取完成！本次共取得 {len(total_courses)} 門開課資料。")
    print("==========================================")

    sqlite_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mcu_courses.db")
    s_ins, s_upd = save_to_sqlite(total_courses, sqlite_path)
    print(f"✅ 已存入本地 SQLite [{sqlite_path}]: 新增 {s_ins} 筆, 更新 {s_upd} 筆。")

    # 匯出完整 SQLite 資料庫至 JSON 備份
    try:
        conn = sqlite3.connect(sqlite_path)
        conn.row_factory = sqlite3.Row
        all_cur = conn.cursor()
        all_cur.execute("SELECT * FROM courses ORDER BY dept_code, grade, class_code, course_id")
        all_courses = [dict(r) for r in all_cur.fetchall()]
        conn.close()

        json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mcu_courses.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(all_courses, f, ensure_ascii=False, indent=2)
        print(f"✅ 已匯出完整 {len(all_courses)} 門歷史開課至本地 JSON [{json_path}]。")
    except Exception as e:
        print(f"[警告] 匯出 JSON 失敗: {e}")

    # 儲存至 MongoDB Atlas
    if HAS_DB:
        m_ins, m_upd = save_to_mongodb(total_courses)
        print(f"✅ 已同步至 MongoDB Atlas [COURSE]: 新增 {m_ins} 筆, 更新 {m_upd} 筆。")

    return total_courses


if __name__ == "__main__":
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="銘傳大學全校開課課程爬蟲")
    parser.add_argument("--dept", type=str, default=None, help="指定科系代號或名稱 (例如 36 或 資訊工程)")
    parser.add_argument("--grade", type=str, default=None, help="指定單一年級 (例如 1, 2, 3, 4)")
    parser.add_argument("--all-grades", action="store_true", default=False, help="是否細分 1~4 年級個別送出請求")
    parser.add_argument("--limit", type=int, default=None, help="限制爬取的科系數量 (測試用)")
    args = parser.parse_args()

    run_crawler(
        dept_filter=args.dept,
        grade_filter=args.grade,
        iterate_grades=args.all_grades,
        max_depts=args.limit
    )
