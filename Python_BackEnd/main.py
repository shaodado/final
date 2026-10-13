import re
import os
import json
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Union, Any
import random

from bson import ObjectId
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import get_database
from mcu_crawler import MCUAuthError, MCUCrawlerError, crawl_mcu_transcript


# =============================================================
# 1. Pydantic 資料格式
# =============================================================

# -------------------------
# 登入請求
# -------------------------
class LoginRequest(BaseModel):
    account: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


# -------------------------
# 課程評價
# -------------------------
class EvaluationCreate(BaseModel):
    course_id: Union[int, str]
    user_id: int
    sweetness: float
    easiness: float
    gains: float
    comment: str
    evaluation_status: str = "已審核"
    course_name: Optional[str] = None
    semester_term: Optional[str] = None


class AutoSyncCoursesRequest(BaseModel):
    user_id: int
    mcu_password: Optional[str] = None


# -------------------------
# 老師發布公告
# -------------------------
class AnnouncementCreate(BaseModel):
    title: str
    content: str
    expires_at: str
    course_id: Optional[int] = 101
    teacher_id: Optional[int] = 1001
    type: str = "課堂公告"


# -------------------------
# 學生歷年成績同步請求
# -------------------------
class TranscriptSyncRequest(BaseModel):
    user_id: int
    mcu_account: str
    mcu_password: str


# -------------------------
# 趣味心理測驗（Gemini AI）
# -------------------------
class QuizGenerateRequest(BaseModel):
    user_id: Optional[Union[int, str]] = 3001
    department: Optional[str] = None
    grade: Optional[str] = None


class QuizAnswerItem(BaseModel):
    id: int
    question: str
    selected_option: str


class QuizRecommendRequest(BaseModel):
    user_id: Optional[Union[int, str]] = 3001
    department: Optional[str] = None
    grade: Optional[str] = None
    answers: List[QuizAnswerItem]


# =============================================================
# 管理員資料格式
# =============================================================

# -------------------------
# 管理員發布公告
# due_date 改成字串，後端統一轉成「2026年11月30日」
# -------------------------
class ManagerAnnouncementCreate(BaseModel):
    title: str
    content: str
    due_date: Optional[str] = None
    type: str = "校級公告"


# -------------------------
# 管理員修改公告
# -------------------------
class ManagerAnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    due_date: Optional[str] = None
    type: Optional[str] = None


# -------------------------
# 管理員修改帳號
# -------------------------
class ManagerAccountUpdate(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None


# -------------------------
# 管理員修改課程評價
# -------------------------
class ManagerEvaluationUpdate(BaseModel):
    evaluation_status: Optional[str] = None
    manager_update_id: Optional[int] = None
    manager_update: Optional[str] = None

# -------------------------
# 同步學生歷年成績請求
# -------------------------
class SyncTranscriptRequest(BaseModel):
    user_id: int
    mcu_account: str
    mcu_password: str


# =============================================================
# 2. 小工具
# =============================================================

def normalize_due_date(value: Optional[str]) -> Optional[str]:
    """
    把各種日期字串統一成「2026年11月30日」。
    支援 2026-11-30、2026-11-30T15:59:59Z、2026年11月30日；空值回傳 None。
    """
    if not value:
        return None

    value = value.strip()

    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", value)
    if m:
        return f"{m.group(1)}年{int(m.group(2))}月{int(m.group(3))}日"

    m = re.match(r"^(\d{4})年(\d{1,2})月(\d{1,2})日", value)
    if m:
        return f"{m.group(1)}年{int(m.group(2))}月{int(m.group(3))}日"

    return value


def to_object_id(value: str) -> ObjectId:
    """檢查公告 ID 格式，不正確就回 400（要放在 try 外面呼叫）"""
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail="公告 ID 格式不正確")
    return ObjectId(value)


def evaluation_filter(key: str) -> dict:
    """
    管理員用的評價 ID：
    - 24 位 hex 字串 → 用 MongoDB _id 查
    - 純數字 → 用 eval_id 查（相容舊寫法）
    要放在 try 外面呼叫，否則 400 會被 except 包成 500
    """
    if re.fullmatch(r"[0-9a-fA-F]{24}", key):
        return {"_id": ObjectId(key)}
    if key.isdigit():
        return {"eval_id": int(key)}
    raise HTTPException(status_code=400, detail="評價 ID 格式不正確")


def parse_semester_sort_key(term: Any) -> tuple:
    """
    解析學期字串以利時間排序（例如 113-1, 112-2, 1131, 112學年度第1學期）。
    回傳 (學年, 學期) 元組，方便比較大小。
    """
    if not term:
        return (0, 0)
    s = str(term).strip()
    digits = re.findall(r"\d+", s)
    if len(digits) >= 2:
        try:
            return (int(digits[0]), int(digits[1]))
        except ValueError:
            pass
    elif len(digits) == 1:
        d = digits[0]
        if len(d) == 4:
            try:
                return (int(d[:3]), int(d[3]))
            except ValueError:
                pass
        elif len(d) >= 1:
            try:
                return (int(d), 0)
            except ValueError:
                pass
    return (0, 0)


# =============================================================
# 3. FastAPI
# =============================================================

app = FastAPI(
    title="Campus Smart Assistant API",
    description="校園智慧助手後端 API 伺服器",
    version="1.0.0",
)


# =============================================================
# 4. CORS
# =============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================
# 5. MongoDB
# =============================================================

db = get_database()


# =============================================================
# 6. 首頁測試
# =============================================================

@app.get("/")
def root():
    return {
        "status": "online",
        "message": "FastAPI 後端運作正常",
    }


# =============================================================
# 7. 身分驗證模組
# =============================================================

@app.post("/api/login")
def login(req: LoginRequest):
    try:
        # ---------------------------------------------------------
        # 學生登入
        # ---------------------------------------------------------
        student_query = {
            "$or": [
                {"user_id": req.account},
                {"student_name": req.account},
                {"email": req.account},
            ]
        }

        if req.account.isdigit():
            student_query["$or"].append({"user_id": int(req.account)})

        student = db["STUDENT"].find_one(student_query)

        if student and str(student.get("password")) == str(req.password):
            return {
                "success": True,
                "role": "student",
                "userId": student.get("user_id"),
                "name": student.get("student_name", "同學"),
            }

        # ---------------------------------------------------------
        # 老師登入
        # ---------------------------------------------------------
        teacher_query = {
            "$or": [
                {"user_id": req.account},
                {"teacher_name": req.account},
            ]
        }

        if req.account.isdigit():
            teacher_query["$or"].append({"user_id": int(req.account)})

        teacher = db["TEACHER"].find_one(teacher_query)

        if teacher and str(teacher.get("password")) == str(req.password):
            return {
                "success": True,
                "role": "teacher",
                "userId": teacher.get("user_id"),
                "name": teacher.get("teacher_name", "老師"),
            }

        # ---------------------------------------------------------
        # 管理員登入
        # ---------------------------------------------------------
        manager_query = {
            "$or": [
                {"user_id": req.account},
                {"manager_name": req.account},
            ]
        }

        if req.account.isdigit():
            manager_query["$or"].append({"user_id": int(req.account)})

        manager = db["MANAGER"].find_one(manager_query)

        if manager and str(manager.get("password")) == str(req.password):
            return {
                "success": True,
                "role": "Manager",
                "userId": manager.get("user_id"),
                "name": manager.get("manager_name", "管理員"),
            }

        return {
            "success": False,
            "message": "帳號或密碼不正確，請再試一次。",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/register")
def register(req: LoginRequest):
    try:
        collection = db["STUDENT"]

        # 檢查是否已註冊
        exists = collection.find_one({"email": req.account})
        if exists:
            return {
                "success": False,
                "message": "此信箱已經註冊過，請直接登入。",
            }

        email_prefix = req.account.split("@")[0]

        # 嘗試從信箱前綴擷取前 8 碼數字作為學號 (user_id)
        if req.account.endswith("@me.mcu.edu.tw") and email_prefix[:8].isdigit():
            new_id = int(email_prefix[:8])
        else:
            # 取得最大 user_id + 1 作為備案
            last_student = collection.find_one(
                {"user_id": {"$type": "number"}},
                sort=[("user_id", -1)]
            )
            new_id = (last_student["user_id"] if last_student else 3000) + 1

        new_student = {
            "user_id": new_id,
            "student_name": req.account.split("@")[0],
            "email": req.account,
            "password": req.password,
            "department_id": "D001",
            "grade": "大一",
        }

        collection.insert_one(new_student)

        return {
            "success": True,
            "message": "註冊成功",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    try:
        # 確認該信箱是否存在於學生資料庫
        student = db["STUDENT"].find_one({"email": req.email})
        if not student:
            return {"success": False, "message": "找不到此信箱對應的帳號"}

        # 產生 6 位數驗證碼
        code = str(random.randint(100000, 999999))

        # 儲存到 VERIFICATION_CODE 集合 (設定 10 分鐘後過期)
        db["VERIFICATION_CODE"].delete_many({"email": req.email}) # 刪除舊的驗證碼
        db["VERIFICATION_CODE"].insert_one({
            "email": req.email,
            "code": code,
            "expires_at": datetime.now() + timedelta(minutes=10)
        })

        # 這裡由於環境沒有設定 SMTP，先將驗證碼印在後端 Console，並提示使用者。
        # 實務上請使用 smtplib 將 code 寄出
        print(f"\n=============================================")
        print(f" [模擬發送信件] 收件人: {req.email}")
        print(f" [驗證碼]: {code}")
        print(f"=============================================\n")

        return {"success": True, "message": "驗證碼已寄出（請查看後端終端機模擬的信件）"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reset-password")
def reset_password(req: ResetPasswordRequest):
    try:
        # 尋找驗證碼記錄
        record = db["VERIFICATION_CODE"].find_one({
            "email": req.email,
            "code": req.code
        })

        if not record:
            return {"success": False, "message": "驗證碼錯誤或不存在"}

        # 檢查是否過期
        if datetime.now() > record["expires_at"]:
            return {"success": False, "message": "驗證碼已過期，請重新獲取"}

        # 更新密碼
        db["STUDENT"].update_one(
            {"email": req.email},
            {"$set": {"password": req.new_password}}
        )

        # 刪除已使用的驗證碼
        db["VERIFICATION_CODE"].delete_many({"email": req.email})

        return {"success": True, "message": "密碼修改成功，請使用新密碼登入！"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 8. 學生聯絡簿
# =============================================================

@app.get("/api/student/feed")
def get_student_feed(user_id: int = 3001):
    try:
        # 查詢學生修課紀錄
        records = list(
            db["STUDENT_ACADEMIC_RECORD"].find({"user_id": user_id})
        )

        raw_ids = [r["course_id"] for r in records if "course_id" in r]

        # 建立課程 ID 清單
        my_course_ids = []

        for cid in raw_ids:
            my_course_ids.append(cid)

            try:
                my_course_ids.append(int(cid))
            except (ValueError, TypeError):
                pass

            my_course_ids.append(str(cid))

        my_course_ids = list(set(my_course_ids))

        # 建立課程名稱對照
        courses = list(db["COURSE"].find({}))

        course_map = {}

        for course in courses:
            cid = str(course.get("id") or course.get("course_id"))
            cname = course.get("course_name") or course.get("name") or "課堂公告"
            course_map[cid] = cname

        # 查詢公告
        col = db["NOTIFY"]

        if my_course_ids:
            query = {"course_id": {"$in": my_course_ids}}
        else:
            query = {"course_id": -999}

        docs = list(col.find(query).sort("_id", -1).limit(10))

        feeds = []

        for doc in docs:
            icon_map = {
                "作業提醒": "document-text-outline",
                "小考時程": "alert-circle-outline",
                "課堂公告": "megaphone-outline",
            }

            icon = icon_map.get(doc.get("type"), "megaphone-outline")

            raw_cid = doc.get("course_id")

            if raw_cid is not None:
                cid_str = str(raw_cid)
                cname = course_map.get(cid_str, f"課程 {cid_str}")
            else:
                cname = "全校公告"

            raw_title = doc.get("title", "課堂公告")
            formatted_title = f"【{cname}】{raw_title}"

            feeds.append({
                "id": str(doc["_id"]),
                "icon": icon,
                "course_name": cname,
                "course_id": raw_cid,
                "title": formatted_title,
                "raw_title": raw_title,
                "content": doc.get("content", ""),
                "time": str(
                    doc.get("published_at") or doc.get("update_time") or "最新"
                ),
                "due_date": doc.get("due_date"),
            })

        return {
            "success": True,
            "user_id": user_id,
            "data": feeds,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 9. 課程評價
# =============================================================

@app.get("/api/evaluations")
def get_evaluations(
    course_id: Optional[int] = None,
    page: int = 1,
    limit: int = 20,
):
    try:
        collection = db["COURSE_EVALUATION"]

        query = {}

        if course_id is not None:
            query["course_id"] = course_id

        total_count = collection.count_documents(query)

        total_pages = (
            max(1, (total_count + limit - 1) // limit)
            if total_count > 0
            else 1
        )

        skip = max(0, (page - 1) * limit)

        docs = list(
            collection.find(query).sort("_id", -1).skip(skip).limit(limit)
        )

        for doc in docs:
            doc["_id"] = str(doc["_id"])

        return {
            "success": True,
            "data": docs,
            "count": len(docs),
            "total_count": total_count,
            "page": page,
            "total_pages": total_pages,
            "limit": limit,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 10. 新增課程評價（自動產生 eval_id）
# =============================================================

@app.post("/api/evaluations")
def create_evaluation(eval_data: EvaluationCreate):
    try:
        collection = db["COURSE_EVALUATION"]

        # 取目前最大的 eval_id + 1
        last = collection.find_one(
            {"eval_id": {"$type": "number"}},
            sort=[("eval_id", -1)],
        )
        next_id = (last["eval_id"] if last else 0) + 1

        new_eval = eval_data.dict()
        new_eval["eval_id"] = next_id

        result = collection.insert_one(new_eval)

        new_eval["_id"] = str(result.inserted_id)

        return {
            "success": True,
            "message": "評價儲存成功",
            "data": new_eval,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 11. 學生已修課程（支援僅篩選已通過課程，並依照時間由新到舊排序）
# =============================================================

@app.get("/api/student/my-courses")
def get_student_courses(
    user_id: int,
    page: int = 1,
    limit: int = 100,
    passed_only: bool = True,
    sort_order: str = "asc",
):
    try:
        query = {"user_id": user_id}
        if passed_only:
            query["is_passed"] = True

        records = list(db["STUDENT_ACADEMIC_RECORD"].find(query))

        # 依照學期時間排序（asc: 從大一到大四由上到下; desc: 從大四到大一）
        records.sort(
            key=lambda r: parse_semester_sort_key(r.get("semester_term", "")),
            reverse=(sort_order == "desc"),
        )

        total_count = len(records)
        total_pages = (
            max(1, (total_count + limit - 1) // limit) if total_count > 0 else 1
        )
        skip = max(0, (page - 1) * limit)
        paged_records = records[skip : skip + limit]

        # 嘗試從 COURSE collection 尋找教師或系所資訊做補充
        course_ids = [r.get("course_id") for r in paged_records if r.get("course_id")]
        course_name_list = [
            r.get("course_name") for r in paged_records if r.get("course_name")
        ]

        course_meta_map = {}
        if course_ids or course_name_list:
            or_conditions = []
            if course_ids:
                cid_candidates = []
                for cid in course_ids:
                    cid_candidates.append(cid)
                    if isinstance(cid, str) and cid.isdigit():
                        cid_candidates.append(int(cid))
                    elif isinstance(cid, int):
                        cid_candidates.append(str(cid))
                or_conditions.append({"course_id": {"$in": cid_candidates}})
            if course_name_list:
                or_conditions.append({"course_name": {"$in": course_name_list}})

            if or_conditions:
                matched_courses = list(
                    db["COURSE"].find({"$or": or_conditions})
                )
                for mc in matched_courses:
                    if "course_id" in mc:
                        course_meta_map[str(mc["course_id"])] = mc
                    if "course_name" in mc:
                        course_meta_map[mc["course_name"]] = mc

        result_courses = []
        for r in paged_records:
            cid = r.get("course_id")
            cname = r.get("course_name", "未知課程")
            meta = (
                course_meta_map.get(str(cid))
                or course_meta_map.get(cname)
                or {}
            )

            raw_teacher = r.get("teacher") or meta.get("teacher")
            teacher = (
                raw_teacher
                if raw_teacher and raw_teacher not in ["專任教師", "授課教師"]
                else "---"
            )

            # 🌟 去除任何班級或校區字樣，僅保留純粹課程名稱與系所名稱
            clean_cname = re.sub(r"【.*?】|\[.*?\]", "", cname).strip()
            clean_cname = re.sub(
                r"\s*\(?(?:資工|資管|資傳|電通|電子|電機|人工|半導|商設|品設|數媒|建築|都防|動漫|企管|國企|財金|風保|會計|經金|統資|金科|新聞|廣電|廣銷|新媒|傳播|觀光|休閒|餐旅|應中|應英|應日|華語|法律|財法|公行|心理|犯防|生技|醫管|生工)[一二三四1234][甲乙丙丁]\)?",
                "",
                clean_cname,
            ).strip()
            clean_cname = re.sub(r"\s*\(?(?:[一二三四1234]年級)?[甲乙丙丁]班\)?", "", clean_cname).strip()
            clean_cname = re.sub(r"\s*\(?(?:桃園|台北|基河|金門)校區?\)?", "", clean_cname).strip() or cname

            raw_dept = r.get("department") or meta.get("department") or meta.get("domain") or "全校"
            clean_dept = re.sub(r"[一二三四1234]年級.*$", "", raw_dept).strip()
            clean_dept = re.sub(r"[甲乙丙丁]班.*$", "", clean_dept).strip() or raw_dept

            item = {
                "_id": str(r["_id"]),
                "course_id": cid if cid is not None else str(r["_id"]),
                "course_name": clean_cname,
                "teacher": teacher,
                "department": clean_dept,
                "grade": r.get("grade") or meta.get("grade") or "大學部",
                "category": r.get("category") or meta.get("category") or "必修",
                "semester_term": r.get("semester_term", ""),
                "credits": float(
                    r.get("earned_credits", r.get("credits", 0.0))
                ),
                "score": r.get("score"),
                "is_passed": bool(r.get("is_passed", True)),
            }
            result_courses.append(item)

        return {
            "success": True,
            "data": result_courses,
            "count": len(result_courses),
            "total_count": total_count,
            "page": page,
            "total_pages": total_pages,
            "limit": limit,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 11.1 學生已修課程同步與取得（爬蟲一鍵完成）
# =============================================================

@app.post("/api/student/sync-and-get-courses")
def sync_and_get_courses(req: AutoSyncCoursesRequest):
    try:
        # 1. 尋找學生密碼
        password = req.mcu_password
        if not password:
            student = db["STUDENT"].find_one({"user_id": req.user_id})
            if not student and str(req.user_id).isdigit():
                student = db["STUDENT"].find_one({"user_id": int(req.user_id)})

            if student and student.get("password"):
                password = str(student["password"])

        if not password:
            return {
                "success": False,
                "require_password": True,
                "message": "尚未儲存校務系統密碼，請輸入學生資訊系統密碼以進行同步。",
            }

        # 2. 執行爬蟲
        student_id_str = str(req.user_id)
        summary, courses, student_info, competencies = crawl_mcu_transcript(
            student_id_str, password
        )

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 3. 儲存至 STUDENT_ACADEMIC_RECORD
        for c in courses:
            db["STUDENT_ACADEMIC_RECORD"].update_one(
                {
                    "user_id": req.user_id,
                    "course_name": c["course_name"],
                    "semester_term": c["semester_term"],
                },
                {
                    "$set": {
                        **c,
                        "user_id": req.user_id,
                        "updated_at": now_str,
                    }
                },
                upsert=True,
            )

        # 4. 更新 STUDENT 集合
        update_fields = {
            "total_taken_credits": summary.get("total_taken", 0),
            "total_grad_credits": summary.get("total_grad_credit", 0),
            "unlisted_credits": summary.get("unlisted_credit", 0),
            "audit_updated_at": now_str,
            "competencies": competencies,
        }
        if student_info.get("grade"):
            update_fields["grade"] = student_info["grade"]
        if student_info.get("student_name"):
            update_fields["student_name"] = student_info["student_name"]

        db["STUDENT"].update_one(
            {"user_id": req.user_id},
            {"$set": update_fields},
            upsert=True,
        )

        # 5. 回傳已通過且排序之課程（由大一到大四 asc 排序）
        passed_courses = [c for c in courses if c.get("is_passed")]
        passed_courses.sort(
            key=lambda r: parse_semester_sort_key(r.get("semester_term", "")),
            reverse=False,
        )

        formatted_courses = []
        for c in passed_courses:
            raw_teacher = c.get("teacher")
            teacher = (
                raw_teacher
                if raw_teacher and raw_teacher not in ["專任教師", "授課教師"]
                else "---"
            )
            formatted_courses.append({
                "course_id": c.get("course_id", ""),
                "course_name": c.get("course_name", "未知課程"),
                "teacher": teacher,
                "department": c.get("department", "全校"),
                "grade": c.get("grade", "大學部"),
                "category": c.get("category", "必修"),
                "semester_term": c.get("semester_term", ""),
                "credits": float(c.get("earned_credits", c.get("credits", 0.0))),
                "score": c.get("score"),
                "is_passed": True,
            })

        return {
            "success": True,
            "message": f"成功同步 {len(courses)} 門課程（共 {len(passed_courses)} 門通過）！",
            "synced_count": len(courses),
            "passed_count": len(passed_courses),
            "data": formatted_courses,
        }

    except MCUAuthError as e:
        return {
            "success": False,
            "require_password": True,
            "message": f"校務系統登入失敗: {str(e)}，請重新輸入密碼。",
        }
    except MCUCrawlerError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"伺服器內部錯誤: {str(e)}")


# =============================================================
# 12. 全校課程搜尋
# =============================================================

# 銘傳大學官方科系代碼對照表
MCU_DEPT_CODES = {
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
}


def get_dept_code(dept_name: str) -> str:
    if not dept_name or dept_name == "全部":
        return ""
    return MCU_DEPT_CODES.get(dept_name, "999")


@app.get("/api/courses/departments")
def get_all_departments():
    """取得銘傳大學現有所有系所清單（依照銘傳大學科系代號排序）"""
    official_depts = [
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
    ]
    try:
        db_depts = db["COURSE"].distinct("department")
        merged = set(d for d in db_depts if d and d != "全部")
        for d in official_depts:
            if d and d != "全部":
                merged.add(d)
        sorted_depts = sorted(list(merged), key=lambda x: (get_dept_code(x), x))
        return {"success": True, "data": ["全部"] + sorted_depts}
    except Exception:
        sorted_depts = sorted([d for d in official_depts if d != "全部"], key=lambda x: (get_dept_code(x), x))
        return {"success": True, "data": ["全部"] + sorted_depts}


@app.get("/api/courses/search")
def search_courses(
    department: str = "全部",
    grade: str = "全部",
    category: str = "全部",
    campus: Optional[str] = None,
    keyword: Optional[str] = None,
    limit: int = 200,
    skip: int = 0,
    distinct_by_name: bool = False,
):
    """
    詳細課程檢索：支援依科系、年級（大一~大四/1~4）、修別、校區、關鍵字進行全校課程檢索
    若 distinct_by_name=True，則對課程名稱去重，僅保留純粹課程名稱，並移除班級與校區資訊
    """
    try:
        conditions = []

        if department != "全部":
            if department in ["通識教育中心", "全校通識"]:
                conditions.append({
                    "$or": [
                        {"department": "通識教育中心"},
                        {"department": "全校通識"},
                        {"department": {"$regex": "通識", "$options": "i"}},
                        {"domain": {"$regex": "通識", "$options": "i"}},
                        {"category": "通識"},
                    ]
                })
            else:
                clean_dept = department.replace("學系", "").replace("系", "").replace("中心", "").strip()
                conditions.append({
                    "$or": [
                        {"department": department},
                        {"department": {"$regex": clean_dept, "$options": "i"}},
                        {"domain": {"$regex": clean_dept, "$options": "i"}},
                    ]
                })

        if grade != "全部":
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

        if category != "全部":
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

        if keyword and keyword.strip():
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

        # 若需要去重（純課程名稱模式，排除班級與校區），取足量資料後以純課程名稱聚合
        fetch_limit = limit if not distinct_by_name else max(limit * 3, 500)
        courses = list(db["COURSE"].find(query).skip(skip).limit(fetch_limit))

        for course in courses:
            course["_id"] = str(course["_id"])
            course.setdefault("teacher", "授課教師")
            course.setdefault("department", course.get("domain", "全校通識"))
            course.setdefault("grade", "大三")
            course.setdefault("category", "選修")

        if distinct_by_name:
            seen_names = set()
            distinct_courses = []
            for c in courses:
                raw_name = c.get("course_name", "").strip()
                # 去除任何班級或校區標籤
                clean_name = re.sub(r"【.*?】|\[.*?\]", "", raw_name).strip()
                clean_name = re.sub(
                    r"\s*\(?(?:資工|資管|資傳|電通|電子|電機|人工|半導|商設|品設|數媒|建築|都防|動漫|企管|國企|財金|風保|會計|經金|統資|金科|新聞|廣電|廣銷|新媒|傳播|觀光|休閒|餐旅|應中|應英|應日|華語|法律|財法|公行|心理|犯防|生技|醫管|生工)[一二三四1234][甲乙丙丁]\)?",
                    "",
                    clean_name,
                ).strip()
                clean_name = re.sub(r"\s*\(?(?:[一二三四1234]年級)?[甲乙丙丁]班\)?", "", clean_name).strip()
                clean_name = re.sub(r"\s*\(?(?:桃園|台北|基河|金門)校區?\)?", "", clean_name).strip() or raw_name

                # 以 (課名, 教師) 唯一識別
                dedup_key = (clean_name, c.get("teacher", ""))
                if dedup_key not in seen_names:
                    seen_names.add(dedup_key)
                    item = dict(c)
                    item["course_name"] = clean_name
                    # 徹底移除班級與校區/教室欄位
                    item.pop("class_name", None)
                    item.pop("class_code", None)
                    item.pop("classroom", None)
                    item.pop("campus", None)
                    item.pop("schedule", None)
                    distinct_courses.append(item)
                    if len(distinct_courses) >= limit:
                        break

            return {
                "success": True,
                "count": len(distinct_courses),
                "total": len(distinct_courses),
                "data": distinct_courses,
            }

        total_count = db["COURSE"].count_documents(query)
        return {
            "success": True,
            "count": len(courses),
            "total": total_count,
            "data": courses,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/courses/crawl")
def trigger_crawl_courses(dept: Optional[str] = None, by_grade: bool = True):
    """手動觸發爬取銘傳大學最新開課資料並更新至資料庫"""
    try:
        from crawl_all_courses import run_crawler
        courses = run_crawler(dept_filter=dept, by_grade=by_grade)
        return {
            "success": True,
            "count": len(courses) if courses else 0,
            "message": "全校開課課程爬取並更新完成！"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 13. 老師發布公告
# =============================================================

@app.post("/api/announcements")
def create_announcement(data: AnnouncementCreate):
    try:
        col = db["NOTIFY"]

        doc = {
            "title": data.title,
            "content": data.content,
            "course_id": data.course_id,
            "teacher_id": data.teacher_id,
            "due_date": data.expires_at,
            "type": data.type,
            "update_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "published_at": datetime.now().strftime("%Y年%m月%d日"),
        }

        result = col.insert_one(doc)

        doc["_id"] = str(result.inserted_id)

        return {
            "success": True,
            "message": "公告已發布至雲端",
            "data": doc,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 14. 老師歷史公告
# =============================================================

@app.get("/api/teacher/announcements")
def get_teacher_announcements(
    teacher_id: int = 1001,
    course_id: Optional[int] = None,
):
    try:
        col = db["NOTIFY"]

        query = {}

        if course_id is not None:
            query["course_id"] = course_id
        elif teacher_id is not None:
            query["teacher_id"] = teacher_id

        docs = list(col.find(query).sort("_id", -1))

        announcements = []

        for doc in docs:
            announcements.append({
                "id": str(doc["_id"]),
                "title": doc.get("title", ""),
                "content": doc.get("content", ""),
                "expiresAt": str(doc.get("due_date", "未設定")),
                "publishedAt": str(
                    doc.get("published_at", doc.get("update_time", "最新"))
                ),
                "course_id": doc.get("course_id"),
            })

        return {
            "success": True,
            "data": announcements,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 15. 老師刪除公告
# =============================================================

@app.delete("/api/announcements/{announcement_id}")
def delete_announcement(announcement_id: str):
    try:
        col = db["NOTIFY"]

        result = col.delete_one({"_id": ObjectId(announcement_id)})

        if result.deleted_count > 0:
            return {
                "success": True,
                "message": "公告已成功刪除",
            }

        return {
            "success": False,
            "message": "找不到該公告",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 16. 校級公告
# =============================================================

@app.get("/api/announcements/school")
def get_school_announcements():
    try:
        col = db["NOTIFY"]

        query = {
            "$or": [
                {"course_id": None},
                {"type": "校級公告"},
            ]
        }

        docs = list(col.find(query).sort("_id", -1).limit(10))

        results = []

        for doc in docs:
            results.append({
                "id": str(doc["_id"]),
                "title": doc.get("title", "校級公告"),
                "content": doc.get("content", ""),
                "publishedAt": str(
                    doc.get("published_at") or doc.get("update_time") or "最新"
                ),
            })

        return {
            "success": True,
            "data": results,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# =============================================================
# 管理員 API
# =============================================================
# =============================================================


# =============================================================
# 17. 管理員：取得所有公告
# =============================================================

@app.get("/api/manager/announcements")
def get_manager_announcements():
    try:
        col = db["NOTIFY"]

        docs = list(col.find({}).sort("_id", -1))

        announcements = []

        for doc in docs:
            announcements.append({
                "id": str(doc["_id"]),
                "title": doc.get("title", ""),
                "content": doc.get("content", ""),
                "course_id": doc.get("course_id"),
                "type": doc.get("type", ""),
                "due_date": doc.get("due_date"),
                "update_ta_id": doc.get("update_ta_id"),
                "update_time": doc.get("update_time", ""),
            })

        return {
            "success": True,
            "count": len(announcements),
            "data": announcements,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 18. 管理員：發布校級公告
# =============================================================

@app.post("/api/manager/announcements")
def create_manager_announcement(data: ManagerAnnouncementCreate):
    try:
        col = db["NOTIFY"]

        now = datetime.now()

        doc = {
            "notify_id": None,
            "course_id": None,
            "title": data.title,
            "content": data.content,
            "due_date": normalize_due_date(data.due_date),
            "type": data.type,
            "published_at": now.strftime("%Y年%m月%d日"),
            "last_synced_at": now,
            "update_ta_id": None,
            "update_time": now.strftime("%Y-%m-%d %H:%M"),
        }

        result = col.insert_one(doc)

        doc["_id"] = str(result.inserted_id)

        return {
            "success": True,
            "message": "校級公告發布成功",
            "data": doc,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 19. 管理員：修改公告
# =============================================================

@app.put("/api/manager/announcements/{announcement_id}")
def update_manager_announcement(
    announcement_id: str,
    data: ManagerAnnouncementUpdate,
):
    object_id = to_object_id(announcement_id)

    try:
        col = db["NOTIFY"]

        update_data = {}

        if data.title is not None:
            update_data["title"] = data.title

        if data.content is not None:
            update_data["content"] = data.content

        if data.due_date is not None:
            update_data["due_date"] = normalize_due_date(data.due_date)

        if data.type is not None:
            update_data["type"] = data.type

        update_data["update_time"] = datetime.now().strftime("%Y-%m-%d %H:%M")

        result = col.update_one(
            {"_id": object_id},
            {"$set": update_data},
        )

        if result.matched_count == 0:
            return {
                "success": False,
                "message": "找不到該公告",
            }

        return {
            "success": True,
            "message": "公告修改成功",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 20. 管理員：刪除公告
# =============================================================

@app.delete("/api/manager/announcements/{announcement_id}")
def delete_manager_announcement(announcement_id: str):
    object_id = to_object_id(announcement_id)

    try:
        col = db["NOTIFY"]

        result = col.delete_one({"_id": object_id})

        if result.deleted_count == 0:
            return {
                "success": False,
                "message": "找不到該公告",
            }

        return {
            "success": True,
            "message": "公告刪除成功",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 21. 管理員：取得所有帳號
# =============================================================

@app.get("/api/manager/accounts")
def get_manager_accounts():
    try:
        accounts = []

        # ---------------------------------------------------------
        # 學生
        # ---------------------------------------------------------
        for student in db["STUDENT"].find({}):
            accounts.append({
                "user_id": student.get("user_id"),
                "name": student.get("student_name", ""),
                "role": "student",
                "department_id": student.get("department_id"),
                "grade": student.get("grade"),
            })

        # ---------------------------------------------------------
        # 老師
        # ---------------------------------------------------------
        for teacher in db["TEACHER"].find({}):
            accounts.append({
                "user_id": teacher.get("user_id"),
                "name": teacher.get("teacher_name", ""),
                "role": "teacher",
                "department_id": teacher.get("department_id"),
                "department_name": teacher.get("department_name", ""),
            })

        # ---------------------------------------------------------
        # 管理員
        # ---------------------------------------------------------
        for manager in db["MANAGER"].find({}):
            accounts.append({
                "user_id": manager.get("user_id"),
                "name": manager.get("manager_name", ""),
                "role": "Manager",
            })

        return {
            "success": True,
            "count": len(accounts),
            "data": accounts,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 22. 管理員：修改帳號
# =============================================================

@app.put("/api/manager/accounts/{user_id}")
def update_manager_account(
    user_id: int,
    data: ManagerAccountUpdate,
):
    try:
        updated = False

        # ---------------------------------------------------------
        # 學生
        # ---------------------------------------------------------
        student_update = {}

        if data.name is not None:
            student_update["student_name"] = data.name

        if data.password is not None:
            student_update["password"] = data.password

        if student_update:
            result = db["STUDENT"].update_one(
                {"user_id": user_id},
                {"$set": student_update},
            )

            if result.matched_count > 0:
                updated = True

        # ---------------------------------------------------------
        # 老師
        # ---------------------------------------------------------
        teacher_update = {}

        if data.name is not None:
            teacher_update["teacher_name"] = data.name

        if data.password is not None:
            teacher_update["password"] = data.password

        if teacher_update:
            result = db["TEACHER"].update_one(
                {"user_id": user_id},
                {"$set": teacher_update},
            )

            if result.matched_count > 0:
                updated = True

        # ---------------------------------------------------------
        # 管理員
        # ---------------------------------------------------------
        manager_update = {}

        if data.name is not None:
            manager_update["manager_name"] = data.name

        if data.password is not None:
            manager_update["password"] = data.password

        if manager_update:
            result = db["MANAGER"].update_one(
                {"user_id": user_id},
                {"$set": manager_update},
            )

            if result.matched_count > 0:
                updated = True

        if not updated:
            return {
                "success": False,
                "message": "找不到該帳號",
            }

        return {
            "success": True,
            "message": "帳號修改成功",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 23. 管理員：刪除帳號
# =============================================================

@app.delete("/api/manager/accounts/{user_id}")
def delete_manager_account(user_id: int):
    try:
        deleted = False

        # 刪除學生
        result = db["STUDENT"].delete_one({"user_id": user_id})
        if result.deleted_count > 0:
            deleted = True

        # 刪除老師
        result = db["TEACHER"].delete_one({"user_id": user_id})
        if result.deleted_count > 0:
            deleted = True

        # 刪除管理員
        result = db["MANAGER"].delete_one({"user_id": user_id})
        if result.deleted_count > 0:
            deleted = True

        # 刪除 USER
        result = db["USER"].delete_one({"user_id": user_id})
        if result.deleted_count > 0:
            deleted = True

        if not deleted:
            return {
                "success": False,
                "message": "找不到該帳號",
            }

        return {
            "success": True,
            "message": "帳號刪除成功",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 24. 管理員：取得所有課程評價
# =============================================================

@app.get("/api/manager/evaluations")
def get_manager_evaluations():
    try:
        col = db["COURSE_EVALUATION"]

        docs = list(col.find({}).sort("_id", -1))

        evaluations = []

        for doc in docs:
            evaluations.append({
                "id": str(doc["_id"]),
                "eval_id": doc.get("eval_id"),
                "user_id": doc.get("user_id"),
                "course_id": doc.get("course_id"),
                "sweetness": doc.get("sweetness"),
                "easiness": doc.get("easiness"),
                "gains": doc.get("gains"),
                "comment": doc.get("comment", ""),
                "evaluation_status": doc.get("evaluation_status", ""),
                "manager_update_id": doc.get("manager_update_id"),
                "manager_update": doc.get("manager_update"),
            })

        return {
            "success": True,
            "count": len(evaluations),
            "data": evaluations,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 25. 管理員：修改課程評價
# eval_key 可以是 MongoDB _id（24 位 hex）或數字 eval_id
# =============================================================

@app.put("/api/manager/evaluations/{eval_key}")
def update_manager_evaluation(
    eval_key: str,
    data: ManagerEvaluationUpdate,
):
    flt = evaluation_filter(eval_key)

    try:
        col = db["COURSE_EVALUATION"]

        update_data = {}

        if data.evaluation_status is not None:
            update_data["evaluation_status"] = data.evaluation_status

        if data.manager_update_id is not None:
            update_data["manager_update_id"] = data.manager_update_id

        if data.manager_update is not None:
            update_data["manager_update"] = data.manager_update

        if not update_data:
            return {
                "success": False,
                "message": "沒有要修改的內容",
            }

        result = col.update_one(flt, {"$set": update_data})

        if result.matched_count == 0:
            return {
                "success": False,
                "message": "找不到該課程評價",
            }

        return {
            "success": True,
            "message": "課程評價更新成功",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 26. 管理員：刪除課程評價
# =============================================================

@app.delete("/api/manager/evaluations/{eval_key}")
def delete_manager_evaluation(eval_key: str):
    flt = evaluation_filter(eval_key)

    try:
        col = db["COURSE_EVALUATION"]

        result = col.delete_one(flt)

        if result.deleted_count == 0:
            return {
                "success": False,
                "message": "找不到該課程評價",
            }

        return {
            "success": True,
            "message": "課程評價刪除成功",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================
# 27. 學生歷年成績爬蟲同步（數據不落地原則）
# =============================================================
@app.post("/api/student/sync-transcript")
def sync_transcript(req: SyncTranscriptRequest):
    try:
        # 1. 呼叫爬蟲（改為解構 3 個回傳值）
        summary, courses, student_info, competencies = crawl_mcu_transcript(
            req.mcu_account, req.mcu_password
        )

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 2. 更新修課紀錄 (STUDENT_ACADEMIC_RECORD)
        for c in courses:
            db["STUDENT_ACADEMIC_RECORD"].update_one(
                {
                    "user_id": req.user_id,
                    "course_name": c["course_name"],
                    "semester_term": c["semester_term"],
                },
                {"$set": {**c, "user_id": req.user_id, "updated_at": now_str}},
                upsert=True,
            )

        # 3. 更新 STUDENT 集合
        update_fields = {
            "total_taken_credits": summary.get("total_taken", 0),
            "total_grad_credits": summary.get("total_grad_credit", 0),
            "unlisted_credits": summary.get("unlisted_credit", 0),
            "audit_updated_at": now_str,
            "competencies": competencies,  # 🌟 將抓到的檢定表存入資料庫
        }

        if student_info.get("grade"):
            update_fields["grade"] = student_info["grade"]
        if student_info.get("student_name"):
            update_fields["student_name"] = student_info["student_name"]

        db["STUDENT"].update_one(
            {"user_id": req.user_id},
            {"$set": update_fields},
            upsert=True,
        )

        return {
            "success": True,
            "message": "歷年成績與學分同步成功！",
            "synced_count": len(courses),
            "student_info": student_info,
            "competencies": competencies,
            "summary": summary,
        }

    except MCUAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except MCUCrawlerError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"伺服器內部錯誤: {str(e)}")


# =============================================================
# 28. 學生畢業學分進度條（運算引擎）
# =============================================================
# Python_BackEnd/main.py 端點 28
@app.get("/api/student/graduation-progress")
def get_graduation_progress(user_id: int, required_threshold: int = 128):
    try:
        student_info = db["STUDENT"].find_one({"user_id": user_id})
        records = list(db["STUDENT_ACADEMIC_RECORD"].find({"user_id": user_id}))
        stored_competencies = (
            student_info.get("competencies", []) if student_info else []
        )

        # 🌟 精準判定：只要 student_info 含有 audit_updated_at，或資料庫有修課紀錄，就代表「已同步過」
        has_synced = bool(
            student_info and student_info.get("audit_updated_at")
        ) or bool(records)

        # 1. 尚未同步過的使用者：回傳 has_data: False
        if not has_synced:
            return {
                "success": True,
                "has_data": False,
                "message": "尚未同步校務成績，請先進行學分同步。",
                "progress_percentage": 0.0,
                "earned_credits": 0.0,
                "required_threshold": required_threshold,
                "remaining_credits": required_threshold,
                "category_breakdown": {},
                "courses_by_category": {},
                "competencies": [],
            }

        # 2. 已同步過的使用者：統計各向度學分
        categories: dict[str, float] = {}
        courses_by_category: dict[str, list] = {}
        calc_total = 0.0

        for r in records:
            cat = r.get("category", "其他")
            credit = float(r.get("earned_credits", r.get("credits", 0.0)))
            is_passed = r.get("is_passed", False)

            if is_passed:
                categories[cat] = round(categories.get(cat, 0.0) + credit, 1)
                calc_total += credit

            if cat not in courses_by_category:
                courses_by_category[cat] = []
            courses_by_category[cat].append({
                "course_name": r.get("course_name", "未知課程"),
                "credits": float(r.get("credits", 0.0)),
                "score": r.get("score"),
                "is_passed": is_passed,
            })

        official_credits = (
            student_info.get("total_grad_credits") if student_info else None
        )
        final_earned = (
            float(official_credits)
            if official_credits is not None and official_credits > 0
            else calc_total
        )
        percentage = min(
            100.0, round((final_earned / required_threshold) * 100, 1)
        )

        # 3. 🌟 關鍵修復：在最終回傳時補上 "competencies": stored_competencies
        return {
            "success": True,
            "has_data": True,
            "user_id": user_id,
            "progress_percentage": percentage,
            "earned_credits": final_earned,
            "required_threshold": required_threshold,
            "remaining_credits": max(
                0.0, round(required_threshold - final_earned, 1)
            ),
            "category_breakdown": categories,
            "courses_by_category": courses_by_category,
            "competencies": stored_competencies,  # 🌟 補回此行傳給手機
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 30. Gemini AI 核心輔助工具
# =============================================================

def call_gemini_api(prompt: str) -> Optional[str]:
    """呼叫 Google Gemini AI API（依序嘗試 gemini-2.0-flash 與 gemini-1.5-flash）"""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    models = ["gemini-2.0-flash", "gemini-1.5-flash"]
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 1500,
        }
    }

    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            resp = requests.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=12,
                verify=False,
            )
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "")
            else:
                print(f"[Gemini] {model} status {resp.status_code}: {resp.text[:180]}")
                if resp.status_code in [400, 401, 403]:
                    break
        except Exception as e:
            print(f"[Gemini] 呼叫 {model} 發生例外: {e}")

    return None


def extract_json_from_text(text: str) -> Optional[dict]:
    """從 AI 回傳文字中解析 JSON 格式"""
    if not text:
        return None
    try:
        return json.loads(text.strip())
    except Exception:
        pass

    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except Exception:
            pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            pass

    return None


def resolve_student_department(student: Optional[dict], req_dept: Optional[str] = None) -> str:
    """
    智能解析學生所屬系所名稱：
    1. 優先使用請求指定系所 (req.department)
    2. 使用 STUDENT 文件中的 department 欄位
    3. 解析 class_name (例如 觀三甲 -> 觀光事業學系；資管三乙 -> 資訊管理學系)
    4. 查 COURSE 反查 dept_code 符合 student.department_id 的系所
    5. 查 TEACHER 反查 department_id
    6. 預設銘傳常用「觀光事業學系」或「資訊工程學系」
    """
    if req_dept and req_dept.strip() and req_dept != "全部":
        return req_dept.strip()
    if not student:
        return "觀光事業學系"

    dept = student.get("department")
    if dept and str(dept).strip() and str(dept).strip() != "全部":
        return str(dept).strip()

    class_name = student.get("class_name") or ""
    if class_name:
        prefix = re.sub(r"[一二三四1234].*$", "", class_name).strip()
        if prefix:
            match = db["COURSE"].find_one({"class_name": {"$regex": f"^{re.escape(prefix)}"}})
            if match and match.get("department"):
                return match["department"]
            match_dept = db["COURSE"].find_one({"department": {"$regex": re.escape(prefix)}})
            if match_dept and match_dept.get("department"):
                return match_dept["department"]

    dept_id = student.get("department_id")
    if dept_id is not None:
        match = db["COURSE"].find_one({"dept_code": str(dept_id)})
        if not match and str(dept_id).isdigit():
            match = db["COURSE"].find_one({"dept_code": int(dept_id)})
        if match and match.get("department"):
            return match["department"]

        teacher_doc = db["TEACHER"].find_one({"department_id": dept_id})
        if not teacher_doc and str(dept_id).isdigit():
            teacher_doc = db["TEACHER"].find_one({"department_id": int(dept_id)})
        if teacher_doc and teacher_doc.get("department_name"):
            return teacher_doc["department_name"]

    return "觀光事業學系"


# =============================================================
# 31. 趣味心理測驗（依使用者科系由 Gemini AI 隨機生成 3 題）
# =============================================================

@app.post("/api/quiz/generate")
def generate_quiz_questions(req: QuizGenerateRequest):
    """
    依據使用者的科系、年級與修課歷程，由 Gemini AI 隨機生成 3 道 2 選 1 趣味選課探索題目
    """
    try:
        raw_uid = req.user_id
        user_id = 3001
        if raw_uid is not None:
            try:
                user_id = int(raw_uid)
            except Exception:
                user_id = 3001

        student = db["STUDENT"].find_one({"user_id": user_id})
        if not student:
            student = db["STUDENT"].find_one({"user_id": str(user_id)})

        # 解析精準所屬科系
        department = resolve_student_department(student, req.department)

        # 解析年級
        grade_val = req.grade or (student.get("grade") if student else None) or "大三"
        if isinstance(grade_val, int) or (isinstance(grade_val, str) and str(grade_val).isdigit()):
            g_num = int(grade_val)
            grade = {1: "大一", 2: "大二", 3: "大三", 4: "大四"}.get(g_num, f"大{g_num}")
        else:
            grade = str(grade_val) if "大" in str(grade_val) else f"大{grade_val}"

        student_name = (
            (student.get("student_name") if student else "同學") or "同學"
        )

        records = list(
            db["STUDENT_ACADEMIC_RECORD"].find({"user_id": user_id})
        )
        if not records:
            records = list(
                db["STUDENT_ACADEMIC_RECORD"].find({"user_id": str(user_id)})
            )

        # 若歷年成績記錄中缺少 course_name，自 COURSE 集合反查補充
        for r in records:
            if not r.get("course_name") and r.get("course_id"):
                cid = str(r.get("course_id"))
                c_info = db["COURSE"].find_one({"course_id": cid})
                if not c_info and cid.isdigit():
                    c_info = db["COURSE"].find_one({"course_id": int(cid)})
                if c_info:
                    r["course_name"] = c_info.get("course_name")

        passed_records = [
            r for r in records
            if r.get("is_passed") or (r.get("score") is not None and float(r.get("score")) >= 60)
        ]
        total_credits = sum(
            float(r.get("earned_credits", r.get("credits", 0)))
            for r in passed_records
        )
        scored_records = [
            r
            for r in records
            if r.get("score") is not None
            and isinstance(r.get("score"), (int, float))
        ]
        avg_score = (
            round(sum(r["score"] for r in scored_records) / len(scored_records), 1)
            if scored_records
            else None
        )

        top_courses = sorted(
            scored_records, key=lambda x: x["score"], reverse=True
        )[:3]
        top_course_names = [
            f"{c.get('course_name')} ({c.get('score')}分)"
            for c in top_courses
            if c.get("course_name")
        ]
        recent_courses = [
            c.get("course_name")
            for c in passed_records[-5:]
            if c.get("course_name")
        ]

        prompt = f"""
你是一位專門為銘傳大學等大專院校學生規劃學業的溫暖選課導師與心理測驗專家。
請根據以下學生的個人學業資料與科系專業，隨機設計【恰好 3 道】「選課探索趣味心理測驗題目」：

學生資訊：
- 姓名：{student_name}
- 科系：{department}
- 年級：{grade}
- 已修學分：{total_credits} 學分
- 平均成績：{f"{avg_score}分" if avg_score else "良好"}
- 表現優勢科目：{', '.join(top_course_names) if top_course_names else '專業基礎科目'}
- 近期修課：{', '.join(recent_courses) if recent_courses else '各類必選修'}

出題規範：
1. 嚴格生成「恰好 3 道」測驗題目，題目要有隨機性與趣味性。
2. 每道題目必須是「2 選 1」（二選一）形式，選項字數簡潔鮮明（約 4~14 字）。
3. 題目必須緊密結合學生的科系專業（{department}）與年級階段（{grade}）。
   例如探討：實務專案作品 vs 理論深究、產業就業導向 vs 跨領域創新、高難度挑戰衝刺 vs 均衡扎實步調等抉擇。
4. 必須嚴格輸出 JSON 格式，切勿輸出任何非 JSON 的文字說明，格式如下：
{{
  "questions": [
    {{
      "id": 1,
      "question": "問題內容？",
      "options": ["選項 A", "選項 B"]
    }},
    {{
      "id": 2,
      "question": "問題內容？",
      "options": ["選項 A", "選項 B"]
    }},
    {{
      "id": 3,
      "question": "問題內容？",
      "options": ["選項 A", "選項 B"]
    }}
  ]
}}
"""
        ai_resp = call_gemini_api(prompt)
        parsed = extract_json_from_text(ai_resp) if ai_resp else None

        questions = None
        if (
            parsed
            and isinstance(parsed.get("questions"), list)
            and len(parsed["questions"]) == 3
        ):
            valid = True
            for q in parsed["questions"]:
                if not (
                    isinstance(q, dict)
                    and q.get("question")
                    and isinstance(q.get("options"), list)
                    and len(q["options"]) == 2
                ):
                    valid = False
                    break
            if valid:
                questions = parsed["questions"]

        if not questions:
            # 依據學生具體科系與年級動態生成之高品質情境化測驗題目（包含隨機種子變化）
            dept_topic_a = f"聚焦【{department}】核心實務與實戰應用"
            dept_topic_b = f"深耕【{department}】理論基礎與跨領域視野"

            if "觀光" in department:
                dept_topic_a = "國際禮儀與旅運觀光實務操作"
                dept_topic_b = "觀光產業行銷與規劃管理"
            elif "資管" in department or "資訊管理" in department:
                dept_topic_a = "聚焦企業資訊系統與程式開發"
                dept_topic_b = "數據分析與商業科技管理"
            elif "資工" in department or "資訊工程" in department:
                dept_topic_a = "核心演算法與實戰軟硬體專案"
                dept_topic_b = "新興科技探索與跨域系統整合"
            elif "數媒" in department or "設計" in department:
                dept_topic_a = "原創視覺概念與數位多媒體創作"
                dept_topic_b = "人機互動介面與專案實作"

            pool_q1 = [
                (f"身為【{department}】{grade}學生，這學期你更偏好哪種專業修課主軸？", [dept_topic_a, dept_topic_b]),
                (f"面對【{department}】未來的職涯接軌，你希望這學期優先強化？", ["業界實務操作與代表作產出", "專業證照與策略分析視野"]),
            ]
            pool_q2 = [
                ("面對選課的學分與課業節奏，你目前的策略傾向？", ["高收穫高挑戰，衝刺學科深度與GPA", "甜涼平衡，保留更多自主專案與實習時間"]),
                ("在課程評分與課堂型態上，你更喜歡哪種模式？", ["重視課堂互動與實作小組專題", "著重個人平時作業與期末測驗報告"]),
            ]
            pool_q3 = [
                ("展望畢業發展，你希望選修課程帶給你最大的助益是？", ["具體可展示的作品集與技術實力", "多元開闊的跨領域人脈與視野"]),
                ("如果本學期有一門熱門選修，你的選課抉擇依據是？", ["學長姐高分收穫評價與實用性", "課程內容創新且具探索挑戰性"]),
            ]

            p1 = random.choice(pool_q1)
            p2 = random.choice(pool_q2)
            p3 = random.choice(pool_q3)

            questions = [
                {"id": 1, "question": p1[0], "options": p1[1]},
                {"id": 2, "question": p2[0], "options": p2[1]},
                {"id": 3, "question": p3[0], "options": p3[1]},
            ]

        return {
            "success": True,
            "student": {
                "name": student_name,
                "department": department,
                "grade": grade,
                "avg_score": avg_score,
                "total_credits": total_credits,
            },
            "questions": questions,
            "is_ai_generated": bool(ai_resp and parsed),
        }

    except Exception as e:
        print(f"generate_quiz_questions 處理例外: {e}")
        return {
            "success": True,
            "student": {
                "name": "同學",
                "department": "觀光事業學系",
                "grade": "大三",
                "avg_score": 85.0,
                "total_credits": 72.0,
            },
            "questions": [
                {
                    "id": 1,
                    "question": "身為大專學生，這學期你更偏好哪種專業修課主軸？",
                    "options": ["聚焦專業實務與技能實作", "深耕學術理論與跨領域視野"],
                },
                {
                    "id": 2,
                    "question": "面對選課的學分與課業節奏，你目前的策略傾向？",
                    "options": ["高收穫高挑戰，衝刺專業深度", "甜涼平衡，保留更多自主時間"],
                },
                {
                    "id": 3,
                    "question": "展望未來的畢業與職涯接軌，你希望這學期的選課能帶給你？",
                    "options": ["具體可展示的作品與就業實力", "多元開闊的跨領域視野與證照"],
                },
            ],
            "is_ai_generated": False,
        }


# =============================================================
# 32. 心理測驗推薦課程（參考課程評價，排列出前三個選修課程並寫出原因）
# =============================================================

@app.post("/api/quiz/recommend")
def recommend_courses_by_quiz(req: QuizRecommendRequest):
    """
    根據學生科系、年級與 3 道測驗作答結果，
    從現有開授的選修課程中，嚴格參考 COURSE_EVALUATION 課程評價訊息，
    排列出推薦前三個選修課程，並詳細寫出包含課程評價依據的推薦原因。
    """
    try:
        raw_uid = req.user_id
        user_id = 3001
        if raw_uid is not None:
            try:
                user_id = int(raw_uid)
            except Exception:
                user_id = 3001

        student = db["STUDENT"].find_one({"user_id": user_id})
        if not student:
            student = db["STUDENT"].find_one({"user_id": str(user_id)})

        # 解析精準所屬科系
        department = resolve_student_department(student, req.department)

        # 解析年級
        grade_val = req.grade or (student.get("grade") if student else None) or "大三"
        if isinstance(grade_val, int) or (isinstance(grade_val, str) and str(grade_val).isdigit()):
            g_num = int(grade_val)
            grade = {1: "大一", 2: "大二", 3: "大三", 4: "大四"}.get(g_num, f"大{g_num}")
        else:
            grade = str(grade_val) if "大" in str(grade_val) else f"大{grade_val}"

        student_name = (
            (student.get("student_name") if student else "同學") or "同學"
        )

        records = list(
            db["STUDENT_ACADEMIC_RECORD"].find({"user_id": user_id})
        )
        if not records:
            records = list(
                db["STUDENT_ACADEMIC_RECORD"].find({"user_id": str(user_id)})
            )

        passed_records = [
            r for r in records
            if r.get("is_passed") or (r.get("score") is not None and float(r.get("score")) >= 60)
        ]
        total_credits = sum(
            float(r.get("earned_credits", r.get("credits", 0)))
            for r in passed_records
        )
        scored_records = [
            r
            for r in records
            if r.get("score") is not None
            and isinstance(r.get("score"), (int, float))
        ]
        avg_score = (
            round(sum(r["score"] for r in scored_records) / len(scored_records), 1)
            if scored_records
            else None
        )

        top_courses = sorted(
            scored_records, key=lambda x: x["score"], reverse=True
        )[:3]
        top_course_names = [
            f"{c.get('course_name')} ({c.get('score')}分)"
            for c in top_courses
            if c.get("course_name")
        ]

        answers_text = "\n".join([
            f"- 第 {a.id} 題：{a.question} -> 選擇了：【{a.selected_option}】"
            for a in req.answers
        ])

        # ---------------------------------------------------------
        # 1. 查詢該系所現有開授的選修課程候選清單（排除學生已通過的課程）
        # ---------------------------------------------------------
        clean_dept = (
            department.replace("學系", "")
            .replace("系", "")
            .replace("學士學位學程", "")
            .replace("中心", "")
            .strip()
        )

        # 從 COURSE 查詢該系所開授的課程
        dept_raw_courses = list(
            db["COURSE"].find({
                "$or": [
                    {"department": department},
                    {"department": {"$regex": re.escape(clean_dept), "$options": "i"}},
                    {"class_name": {"$regex": f"^{re.escape(clean_dept)}", "$options": "i"}},
                ]
            }).limit(200)
        )

        # 學生已通過課程名稱集合（避免重複推薦）
        passed_cnames = set()
        for r in passed_records:
            c_raw = r.get("course_name", "")
            if c_raw:
                c_clean = re.sub(r"【.*?】|\[.*?\]", "", c_raw).strip()
                passed_cnames.add(c_clean)

        dept_electives = []
        seen_names = set()
        for c in dept_raw_courses:
            raw_cname = c.get("course_name", "")
            clean_cname = re.sub(r"【.*?】|\[.*?\]", "", raw_cname).strip()
            clean_cname = re.sub(
                r"\s*\(?(?:資工|資管|資傳|電通|電子|電機|人工|半導|商設|品設|數媒|建築|都防|動漫|企管|國企|財金|風保|會計|經金|統資|金科|新聞|廣電|廣銷|新媒|傳播|觀光|休閒|餐旅|應中|應英|應日|華語|法律|財法|公行|心理|犯防|生技|醫管|生工)[一二三四1234][甲乙丙丁]\)?",
                "",
                clean_cname,
            ).strip()
            clean_cname = re.sub(r"\s*\(?(?:[一二三四1234]年級)?[甲乙丙丁]班\)?", "", clean_cname).strip()
            clean_cname = re.sub(r"\s*\(?(?:桃園|台北|基河|金門)校區?\)?", "", clean_cname).strip() or raw_cname

            # 排除已通過的課程
            if clean_cname in passed_cnames:
                continue

            category_val = str(c.get("category", "選修"))
            # 排除標註為「必」的課程，只保留選修或通識
            if "必" in category_val:
                continue

            teacher_name = c.get("teacher") or "授課教師"
            if teacher_name in ["專任教師", "None", None, ""]:
                teacher_name = "授課教師"

            capacity = c.get("capacity") or 60
            try:
                capacity = int(capacity)
            except Exception:
                capacity = 60

            enrolled = c.get("enrolled") or 0
            try:
                enrolled = int(enrolled)
            except Exception:
                enrolled = 0

            schedule = c.get("schedule") or "未公佈"
            classroom = c.get("classroom") or "未公佈"
            syllabus_url = c.get("syllabus_url") or "https://tch.mcu.edu.tw/sylwebqry/pro10_01.aspx"
            cid = str(c.get("course_id", "")).strip()

            if clean_cname not in seen_names:
                seen_names.add(clean_cname)

                # 🌟 查詢 COURSE_EVALUATION 課程評價數據
                eval_query = {
                    "$or": [
                        {"course_id": cid},
                        {"course_name": clean_cname},
                        {"course_name": raw_cname},
                    ]
                }
                if cid.isdigit():
                    eval_query["$or"].append({"course_id": int(cid)})

                eval_docs = list(db["COURSE_EVALUATION"].find(eval_query))
                sweet_list = [float(e["sweetness"]) for e in eval_docs if e.get("sweetness") is not None]
                easy_list = [float(e["easiness"]) for e in eval_docs if e.get("easiness") is not None]
                gain_list = [float(e["gains"]) for e in eval_docs if e.get("gains") is not None]
                eval_comments = [str(e["comment"]).strip() for e in eval_docs if e.get("comment") and str(e["comment"]).strip()]

                avg_sweetness = round(sum(sweet_list) / len(sweet_list), 1) if sweet_list else None
                avg_easiness = round(sum(easy_list) / len(easy_list), 1) if easy_list else None
                avg_gains = round(sum(gain_list) / len(gain_list), 1) if gain_list else None

                if eval_docs:
                    comments_summary = f"；學長姐短評：『{'、'.join(eval_comments[:2])}』" if eval_comments else ""
                    eval_summary_str = f"甜度 {avg_sweetness}★、涼度 {avg_easiness}★、收穫度 {avg_gains}★{comments_summary}"
                else:
                    eval_summary_str = "暫無學長姐評分短評，為本學期優質開課新亮點"

                dept_electives.append({
                    "course_id": cid,
                    "course_name": clean_cname,
                    "credits": float(c.get("credits") or 2.0 or 3.0),
                    "teacher": teacher_name,
                    "department": c.get("department", department),
                    "grade": c.get("grade") or "選修",
                    "category": "選修",
                    "capacity": capacity,
                    "enrolled": enrolled,
                    "schedule": schedule,
                    "classroom": classroom,
                    "syllabus_url": syllabus_url,
                    "eval_sweetness": avg_sweetness,
                    "eval_easiness": avg_easiness,
                    "eval_gains": avg_gains,
                    "eval_comments": eval_comments,
                    "eval_summary": eval_summary_str,
                })

        # 若該系篩出的選修課程不足 3 門，放寬補足全校其他選修
        if len(dept_electives) < 3:
            more_courses = list(
                db["COURSE"].find({"category": {"$regex": "選"}}).limit(60)
            )
            for c in more_courses:
                raw_cname = c.get("course_name", "")
                clean_cname = re.sub(r"【.*?】|\[.*?\]", "", raw_cname).strip()
                clean_cname = re.sub(
                    r"\s*\(?(?:資工|資管|資傳|電通|電子|電機|人工|半導|商設|品設|數媒|建築|都防|動漫|企管|國企|財金|風保|會計|經金|統資|金科|新聞|廣電|廣銷|新媒|傳播|觀光|休閒|餐旅|應中|應英|應日|華語|法律|財法|公行|心理|犯防|生技|醫管|生工)[一二三四1234][甲乙丙丁]\)?",
                    "",
                    clean_cname,
                ).strip()
                if clean_cname not in seen_names and clean_cname not in passed_cnames:
                    seen_names.add(clean_cname)
                    teacher_name = c.get("teacher") or "授課教師"
                    if teacher_name in ["專任教師", "None", None, ""]:
                        teacher_name = "授課教師"
                    capacity = c.get("capacity") or 60
                    try:
                        capacity = int(capacity)
                    except Exception:
                        capacity = 60
                    enrolled = c.get("enrolled") or 0
                    try:
                        enrolled = int(enrolled)
                    except Exception:
                        enrolled = 0

                    cid = str(c.get("course_id", "")).strip()
                    dept_electives.append({
                        "course_id": cid,
                        "course_name": clean_cname,
                        "credits": float(c.get("credits") or 2.0 or 3.0),
                        "teacher": teacher_name,
                        "department": c.get("department", department),
                        "grade": c.get("grade") or "選修",
                        "category": "選修",
                        "capacity": capacity,
                        "enrolled": enrolled,
                        "schedule": c.get("schedule") or "未公佈",
                        "classroom": c.get("classroom") or "未公佈",
                        "syllabus_url": c.get("syllabus_url") or "https://tch.mcu.edu.tw/sylwebqry/pro10_01.aspx",
                        "eval_sweetness": None,
                        "eval_easiness": None,
                        "eval_gains": None,
                        "eval_comments": [],
                        "eval_summary": "跨領域熱門選修，具備開闊視野",
                    })

        electives_for_prompt = [
            {
                "course_name": e["course_name"],
                "credits": e["credits"],
                "teacher": e["teacher"],
                "capacity": e["capacity"],
                "enrolled": e["enrolled"],
                "schedule": e["schedule"],
                "classroom": e["classroom"],
                "grade": e["grade"],
                "course_evaluation_info": e["eval_summary"],
            }
            for e in dept_electives[:30]
        ]

        # ---------------------------------------------------------
        # 2. 構建 Gemini Prompt 要求參考課程評價，排列出推薦前三個選修課程並寫出原因
        # ---------------------------------------------------------
        prompt = f"""
你是一位專業且熱忱的大學校園選課諮詢顧問與職涯規劃專家。
學生剛剛完成了專屬的 3 題「選課趣味心理測驗（二選一）」，請根據其個人背景、3 題作答選擇、該系所開設之選修課程候選清單，以及【學長姐給予之課程評價訊息（甜度、涼度、收穫度與心得短評）】：
為他【排列出推薦前三個選修課程】並詳細寫出包含課程評價依據的推薦原因！

【學生檔案】
- 姓名：{student_name}
- 科系：{department}
- 年級：{grade}
- 已修學分：{total_credits} 學分
- 平均成績：{f"{avg_score}分" if avg_score else "良好"}
- 優勢科目：{', '.join(top_course_names) if top_course_names else '專業核心科目'}

【測驗題目與學生二選一作答】
{answers_text}

【該系所（{department}）目前開授之選修課程與課程評價清單】：
{json.dumps(electives_for_prompt, ensure_ascii=False, indent=2)}

【產出規範】
1. 請從上述【候選清單】中，嚴選並排列出最契合該學生心理測驗結果的【前三個選修課程】（嚴格推薦 rank 1, rank 2, rank 3 三門課程，依推薦優先順序排列）！
2. 為每一門推薦課程提供：
   - rank: 推薦順序數字 (1, 2, 3)
   - course_name: 課程名稱（必須完全取自候選清單）
   - match_score: 匹配契合度百分比整數（例如 96, 92, 88）
   - recommend_reason: 專屬推薦理由。⚠️ 必須明確參考並融入該課程的【課程評價訊息（例如學長姐給予之甜度、涼度、收穫度評價或心得短評）】作為回覆內容，並說明為何此課符合其作答風格與學習目標（約 35~65 字）！
3. 請嚴格以 JSON 格式回傳，切勿輸出任何非 JSON 的文字或 Markdown 註解，格式如下：
{{
  "title": "測驗結果稱號（例如：『【{department}】實戰專案型架構師』）",
  "analysis": "2~3 句話，分析學生的學習風格、思維特質與目前最適合的學習節奏。",
  "advice": "條理分明的選課策略建議（包含本學期學分安排心法、難易度搭配組合、以及未來升學/就業接軌叮嚀）。",
  "ranked_courses": [
    {{
      "rank": 1,
      "course_name": "選修課程名稱",
      "match_score": 96,
      "recommend_reason": "推薦理由說明（必須融入學長姐課程評價訊息與作答契合度）..."
    }},
    {{
      "rank": 2,
      "course_name": "選修課程名稱",
      "match_score": 92,
      "recommend_reason": "推薦理由說明（必須融入學長姐課程評價訊息與作答契合度）..."
    }},
    {{
      "rank": 3,
      "course_name": "選修課程名稱",
      "match_score": 88,
      "recommend_reason": "推薦理由說明（必須融入學長姐課程評價訊息與作答契合度）..."
    }}
  ]
}}
"""
        ai_resp = call_gemini_api(prompt)
        parsed = extract_json_from_text(ai_resp) if ai_resp else None

        # ---------------------------------------------------------
        # 3. 整合 AI 推薦結果與資料庫實體課程屬性（確保前三個課程欄位齊全）
        # ---------------------------------------------------------
        final_ranked_courses = []
        c_map = {e["course_name"]: e for e in dept_electives}

        if parsed and isinstance(parsed.get("ranked_courses"), list):
            for idx, rc in enumerate(parsed["ranked_courses"][:3]):
                rc_name = rc.get("course_name", "").strip()
                matched_course = c_map.get(rc_name)
                if not matched_course:
                    for k, v in c_map.items():
                        if rc_name in k or k in rc_name:
                            matched_course = v
                            break
                if matched_course:
                    final_ranked_courses.append({
                        "rank": rc.get("rank", idx + 1),
                        "course_id": matched_course["course_id"],
                        "course_name": matched_course["course_name"],
                        "credits": matched_course["credits"],
                        "teacher": matched_course["teacher"],
                        "grade": matched_course["grade"],
                        "category": "選修",
                        "department": matched_course["department"],
                        "capacity": matched_course.get("capacity", 60),
                        "enrolled": matched_course.get("enrolled", 0),
                        "schedule": matched_course.get("schedule", "未公佈"),
                        "classroom": matched_course.get("classroom", "未公佈"),
                        "syllabus_url": matched_course.get("syllabus_url", "https://tch.mcu.edu.tw/sylwebqry/pro10_01.aspx"),
                        "match_score": rc.get("match_score", 96 - idx * 4),
                        "eval_sweetness": matched_course.get("eval_sweetness"),
                        "eval_easiness": matched_course.get("eval_easiness"),
                        "eval_gains": matched_course.get("eval_gains"),
                        "eval_comments": matched_course.get("eval_comments", []),
                        "eval_summary": matched_course.get("eval_summary", ""),
                        "recommend_reason": rc.get(
                            "recommend_reason",
                            f"契合你在測驗中展現的學習偏好。參考學長姐評價：{matched_course.get('eval_summary', '好評推薦')}，由【{matched_course['teacher']}】老師授課，課程安排於{matched_course.get('schedule', '校內課堂')}，有助於專業深度擴展與實力養成。",
                        ),
                    })

        # 若 AI 未產出足夠 3 門排序或無 API 金鑰，使用智慧加權與評價匹配推薦前三個選修
        if len(final_ranked_courses) < 3 and dept_electives:
            chosen_texts = [a.selected_option for a in req.answers]
            full_chosen = " ".join(chosen_texts)

            scored_candidates = []
            for c_item in dept_electives:
                score = 50
                cname = c_item["course_name"]

                # 實作/專題/技術/實務導向加權
                if any(w in full_chosen for w in ["實作", "專案", "專題", "技術", "作品", "實務"]):
                    if any(w in cname for w in ["專題", "實務", "程式", "設計", "系統", "應用", "客運", "禮儀", "實習"]):
                        score += 30

                # 理論/管理/規劃/跨域導向加權
                if any(w in full_chosen for w in ["理論", "跨領域", "視野", "規劃", "管理", "證照"]):
                    if any(w in cname for w in ["管理", "規劃", "分析", "心理", "法規", "日語", "行銷", "研究"]):
                        score += 30

                # 參考課程評價加權：高收穫度與甜度顯著加分
                if c_item.get("eval_gains"):
                    score += int(float(c_item["eval_gains"]) * 5)
                if c_item.get("eval_sweetness"):
                    score += int(float(c_item["eval_sweetness"]) * 3)

                # 深度與學分加權
                if "深度" in full_chosen or "挑戰" in full_chosen:
                    if c_item.get("credits", 0) >= 3:
                        score += 15

                scored_candidates.append((score, c_item))

            scored_candidates.sort(key=lambda x: x[0], reverse=True)
            top_picks = [c[1] for c in scored_candidates[:3]]

            final_ranked_courses = []
            for idx, c_item in enumerate(top_picks):
                teacher_desc = f"由【{c_item['teacher']}】老師指導" if c_item['teacher'] != '授課教師' else "由專業師資群授課"
                
                # 專屬且融入課程評價之推薦原因
                if c_item.get("eval_gains") or c_item.get("eval_sweetness"):
                    eval_clause = f"參考學長姐高評價（收穫度 {c_item.get('eval_gains', 4.5)}★、甜度 {c_item.get('eval_sweetness', 4.0)}★）"
                    if c_item.get("eval_comments"):
                        eval_clause += f"，學長姐心得提及『{c_item['eval_comments'][0]}』"
                else:
                    eval_clause = "此課程為系上推薦選修，教學評價優良且內容實用"

                answer_ref = req.answers[idx % len(req.answers)].selected_option if req.answers else "核心學習主軸"
                reason = f"契合你在測驗中選擇【{answer_ref}】的發展導向。{teacher_desc}，{eval_clause}，課堂安排於{c_item.get('schedule', '校內時間')}，適合列為本學期前三選修亮點！"

                final_ranked_courses.append({
                    "rank": idx + 1,
                    "course_id": c_item["course_id"],
                    "course_name": c_item["course_name"],
                    "credits": c_item["credits"],
                    "teacher": c_item["teacher"],
                    "grade": c_item["grade"],
                    "category": "選修",
                    "department": c_item["department"],
                    "capacity": c_item.get("capacity", 60),
                    "enrolled": c_item.get("enrolled", 0),
                    "schedule": c_item.get("schedule", "未公佈"),
                    "classroom": c_item.get("classroom", "未公佈"),
                    "syllabus_url": c_item.get("syllabus_url", "https://tch.mcu.edu.tw/sylwebqry/pro10_01.aspx"),
                    "match_score": 96 - idx * 4,
                    "eval_sweetness": c_item.get("eval_sweetness"),
                    "eval_easiness": c_item.get("eval_easiness"),
                    "eval_gains": c_item.get("eval_gains"),
                    "eval_comments": c_item.get("eval_comments", []),
                    "eval_summary": c_item.get("eval_summary", ""),
                    "recommend_reason": reason,
                })

        title = (
            parsed.get("title")
            if (parsed and parsed.get("title"))
            else f"【{department}】實戰探索開拓者"
        )
        analysis = (
            parsed.get("analysis")
            if (parsed and parsed.get("analysis"))
            else f"依據你在測驗中的二選一抉擇，結合你在{department}（{grade}）的學業階段與修課表現，顯示你具備明確的目標導向與主動實踐思維。"
        )
        advice = (
            parsed.get("advice")
            if (parsed and parsed.get("advice"))
            else f"建議本學期安排 18~22 學分，以「1 門重型專業核心課」搭配推薦的前 3 門實用選修課程，並搭配通識課程調劑身心，以兼顧學業 GPA 與實務作品產出。"
        )

        return {
            "success": True,
            "data": {
                "title": title,
                "analysis": analysis,
                "department": department,
                "ranked_courses": final_ranked_courses[:3],
                "advice": advice,
                "is_ai_generated": bool(ai_resp and parsed),
            },
        }

    except Exception as e:
        print(f"recommend_courses_by_quiz 處理例外: {e}")
        return {
            "success": True,
            "data": {
                "title": "實戰探索開拓者",
                "analysis": "依據你在測驗中的二選一抉擇，顯示你具備明確的目標導向與實踐思維。",
                "department": "觀光事業學系",
                "ranked_courses": [],
                "advice": "建議本學期安排 18~22 學分，以核心專長搭配應用選修進行修習。",
                "is_ai_generated": False,
            },
        }