# -*- coding: utf-8 -*-
"""
銘傳大學詳細課程檢索命令列工具 (MCU Course Search CLI)
支援依科系、年級、修別、教師、課程名稱關鍵字進行多條件快速檢索。
支援從 MongoDB Atlas 或本地 SQLite 高速查詢。
"""

import os
import sys
import sqlite3
import argparse
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# 讀取環境變數
env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=env_file)

try:
    from database import get_database
    HAS_MONGO = True
except Exception:
    HAS_MONGO = False

SQLITE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mcu_courses.db")


def search_from_sqlite(
    dept: Optional[str] = None,
    grade: Optional[str] = None,
    category: Optional[str] = None,
    campus: Optional[str] = None,
    keyword: Optional[str] = None,
    teacher: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """從本地 SQLite 資料庫檢索課程"""
    if not os.path.exists(SQLITE_PATH):
        return []

    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    conditions = []
    params = []

    if dept and dept != "全部":
        if dept in ["通識教育中心", "全校通識"]:
            conditions.append("(department LIKE '%通識%' OR category = '通識')")
        else:
            clean_dept = dept.replace("學系", "").replace("系", "").replace("中心", "").strip()
            conditions.append("(department LIKE ? OR department LIKE ?)")
            params.extend([f"%{dept}%", f"%{clean_dept}%"])

    if grade and grade != "全部":
        grade_map = {
            "1": ["1", "大一", "一年級"],
            "2": ["2", "大二", "二年級"],
            "3": ["3", "大三", "三年級"],
            "4": ["4", "大四", "四年級"],
            "大一": ["1", "大一", "一年級"],
            "大二": ["2", "大二", "二年級"],
            "大三": ["3", "大三", "三年級"],
            "大四": ["4", "大四", "四年級"],
        }
        candidates = grade_map.get(grade, [grade])
        placeholders = ",".join(["?"] * len(candidates))
        conditions.append(f"grade IN ({placeholders})")
        params.extend(candidates)

    if category and category != "全部":
        conditions.append("category = ?")
        params.append(category)

    if campus and campus not in ["全部", "全部校區"]:
        clean_campus = campus.replace("校區", "").strip()
        if clean_campus in ["基和", "基河"]:
            conditions.append("(campus LIKE '%基河%' OR classroom LIKE '%基河%' OR classroom LIKE '%基和%')")
        else:
            conditions.append("(campus LIKE ? OR classroom LIKE ?)")
            params.extend([f"%{clean_campus}%", f"%{clean_campus}%"])

    if teacher:
        conditions.append("teacher LIKE ?")
        params.append(f"%{teacher}%")

    if keyword:
        kw = f"%{keyword}%"
        conditions.append("(course_name LIKE ? OR teacher LIKE ? OR course_id LIKE ? OR class_name LIKE ? OR classroom LIKE ?)")
        params.extend([kw, kw, kw, kw, kw])

    where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""
    sql = f"SELECT * FROM courses{where_clause} ORDER BY grade, class_code, course_id LIMIT ?"
    params.append(limit)

    cur.execute(sql, params)
    rows = cur.fetchall()
    results = [dict(r) for r in rows]
    conn.close()
    return results


def search_from_mongo(
    dept: Optional[str] = None,
    grade: Optional[str] = None,
    category: Optional[str] = None,
    campus: Optional[str] = None,
    keyword: Optional[str] = None,
    teacher: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """從 MongoDB Atlas 檢索課程"""
    if not HAS_MONGO:
        return []

    try:
        db = get_database()
        col = db["COURSE"]
        conditions = []

        if dept and dept != "全部":
            if dept in ["通識教育中心", "全校通識"]:
                conditions.append({
                    "$or": [
                        {"department": "通識教育中心"},
                        {"department": "全校通識"},
                        {"department": {"$regex": "通識", "$options": "i"}},
                        {"category": "通識"},
                    ]
                })
            else:
                clean_dept = dept.replace("學系", "").replace("系", "").replace("中心", "").strip()
                conditions.append({
                    "$or": [
                        {"department": dept},
                        {"department": {"$regex": clean_dept, "$options": "i"}},
                        {"domain": {"$regex": clean_dept, "$options": "i"}},
                    ]
                })

        if grade and grade != "全部":
            grade_map = {
                "1": ["1", "大一", "一年級"],
                "2": ["2", "大二", "二年級"],
                "3": ["3", "大三", "三年級"],
                "4": ["4", "大四", "四年級"],
                "大一": ["1", "大一", "一年級"],
                "大二": ["2", "大二", "二年級"],
                "大三": ["3", "大三", "三年級"],
                "大四": ["4", "大四", "四年級"],
            }
            candidates = grade_map.get(grade, [grade])
            conditions.append({
                "$or": [
                    {"grade": {"$in": candidates}},
                    {"raw_grade": {"$in": candidates}},
                ]
            })

        if category and category != "全部":
            conditions.append({"category": category})

        if campus and campus not in ["全部", "全部校區"]:
            clean_campus = campus.replace("校區", "").strip()
            if clean_campus in ["基和", "基河"]:
                conditions.append({
                    "$or": [
                        {"campus": "基河"},
                        {"campus": "基和"},
                        {"classroom": {"$regex": "基[河和]", "$options": "i"}},
                    ]
                })
            else:
                conditions.append({
                    "$or": [
                        {"campus": clean_campus},
                        {"campus": {"$regex": clean_campus, "$options": "i"}},
                        {"classroom": {"$regex": clean_campus, "$options": "i"}},
                    ]
                })

        if teacher:
            conditions.append({"teacher": {"$regex": teacher, "$options": "i"}})

        if keyword:
            kw = keyword.strip()
            conditions.append({
                "$or": [
                    {"course_name": {"$regex": kw, "$options": "i"}},
                    {"teacher": {"$regex": kw, "$options": "i"}},
                    {"course_id": {"$regex": kw, "$options": "i"}},
                    {"class_name": {"$regex": kw, "$options": "i"}},
                    {"classroom": {"$regex": kw, "$options": "i"}},
                ]
            })

        query = {"$and": conditions} if conditions else {}
        courses = list(col.find(query).limit(limit))
        for c in courses:
            c["_id"] = str(c["_id"])
        return courses
    except Exception as e:
        print(f"[警告] MongoDB 查詢異常: {e}，切換為 SQLite。")
        return []


def format_print_courses(courses: List[Dict[str, Any]]):
    """漂亮表格輸出課程結果"""
    if not courses:
        print("\n🔍 查無符合條件的課程資料。")
        return

    print(f"\n🎯 共檢索到 {len(courses)} 筆課程資訊：")
    print("=" * 115)
    print(f"{'代碼':<7} {'課程名稱':<18} {'開課班級':<12} {'年級/修別':<10} {'學分':<5} {'授課教師':<10} {'上課時間':<16} {'教室/地點':<16} {'人數':<7}")
    print("-" * 115)

    for c in courses:
        cid = str(c.get("course_id", ""))[:6]
        cname = str(c.get("course_name", ""))[:14]
        cclass = str(c.get("class_name", ""))[:10]
        grade_cat = f"{c.get('grade', '')}/{c.get('category', '')}"[:8]
        cred = str(c.get("credits", 0))[:4]
        teacher = str(c.get("teacher", ""))[:8]
        sched = str(c.get("schedule", ""))[:14]
        room = str(c.get("classroom", ""))[:14]
        enrolled = f"{c.get('enrolled', 0)}/{c.get('capacity', 0)}"

        print(f"{cid:<7} {cname:<18} {cclass:<12} {grade_cat:<10} {cred:<5} {teacher:<10} {sched:<16} {room:<16} {enrolled:<7}")

    print("=" * 115 + "\n")


def interactive_menu():
    """互動式檢索介面"""
    print("==========================================")
    print("🎓 銘傳大學詳細課程檢索系統 (Interactive CLI)")
    print("==========================================")
    
    dept = input("請輸入欲查詢的科系名稱/關鍵字 (直接按 Enter 代表全部): ").strip() or None
    grade = input("請輸入年級 (1/2/3/4 或 大一~大四，Enter 代表全部): ").strip() or None
    category = input("請輸入修別 (必修/選修/通識，Enter 代表全部): ").strip() or None
    keyword = input("請輸入課程關鍵字 (課名/代號/教室，Enter 代表無): ").strip() or None
    teacher = input("請輸入授課教師名稱 (Enter 代表無): ").strip() or None

    results = search_from_sqlite(dept=dept, grade=grade, category=category, keyword=keyword, teacher=teacher, limit=50)
    if not results and HAS_MONGO:
        results = search_from_mongo(dept=dept, grade=grade, category=category, keyword=keyword, teacher=teacher, limit=50)

    format_print_courses(results)


if __name__ == "__main__":
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="銘傳大學詳細課程檢索工具")
    parser.add_argument("--dept", type=str, default=None, help="科系名稱或關鍵字 (例如 資訊工程 或 36)")
    parser.add_argument("--grade", type=str, default=None, help="年級 (1, 2, 3, 4 或 大一~大四)")
    parser.add_argument("--category", type=str, default=None, help="修別 (必修 / 選修)")
    parser.add_argument("--keyword", type=str, default=None, help="搜尋課名、代碼或教室")
    parser.add_argument("--teacher", type=str, default=None, help="教師姓名")
    parser.add_argument("--limit", type=int, default=30, help="最多回傳筆數 (預設 30)")
    parser.add_argument("--source", choices=["sqlite", "mongo", "auto"], default="auto", help="資料來源")

    args = parser.parse_args()

    # 若無任何參數則進入互動模式
    if not any([args.dept, args.grade, args.category, args.keyword, args.teacher]):
        interactive_menu()
    else:
        if args.source == "mongo":
            courses = search_from_mongo(args.dept, args.grade, args.category, args.keyword, args.teacher, args.limit)
        elif args.source == "sqlite":
            courses = search_from_sqlite(args.dept, args.grade, args.category, args.keyword, args.teacher, args.limit)
        else:
            courses = search_from_sqlite(args.dept, args.grade, args.category, args.keyword, args.teacher, args.limit)
            if not courses and HAS_MONGO:
                courses = search_from_mongo(args.dept, args.grade, args.category, args.keyword, args.teacher, args.limit)

        format_print_courses(courses)
