import re
from datetime import datetime, timedelta
from typing import Optional
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
    course_id: int
    user_id: int
    sweetness: float
    easiness: float
    gains: float
    comment: str
    evaluation_status: str = "已審核"


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

        # 取得最大 user_id + 1
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
# 11. 學生已修課程
# =============================================================

@app.get("/api/student/my-courses")
def get_student_courses(
    user_id: int,
    page: int = 1,
    limit: int = 20,
):
    try:
        records = list(
            db["STUDENT_ACADEMIC_RECORD"].find({"user_id": user_id})
        )

        course_ids = [r["course_id"] for r in records if "course_id" in r]

        courses_col = db["COURSE"]

        if course_ids:
            query = {"course_id": {"$in": course_ids}}
        else:
            query = {"course_id": -999}

        total_count = (
            courses_col.count_documents(query) if course_ids else 0
        )

        total_pages = (
            max(1, (total_count + limit - 1) // limit)
            if total_count > 0
            else 1
        )

        skip = max(0, (page - 1) * limit)

        if course_ids:
            courses = list(courses_col.find(query).skip(skip).limit(limit))
        else:
            courses = []

        for course in courses:
            course["_id"] = str(course["_id"])

            course.setdefault("teacher", "專任教師")
            course.setdefault("department", course.get("domain", "資訊工程學系"))
            course.setdefault("grade", "大三")
            course.setdefault("category", "必修")

        return {
            "success": True,
            "data": courses,
            "count": len(courses),
            "total_count": total_count,
            "page": page,
            "total_pages": total_pages,
            "limit": limit,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================
# 12. 全校課程搜尋
# =============================================================

@app.get("/api/courses/search")
def search_courses(
    department: str = "全部",
    grade: str = "全部",
    category: str = "全部",
):
    try:
        query = {}

        if department != "全部":
            query["department"] = department

        if grade != "全部":
            query["grade"] = grade

        if category != "全部":
            query["category"] = category

        courses = list(db["COURSE"].find(query))

        for course in courses:
            course["_id"] = str(course["_id"])

            course.setdefault("teacher", "授課教師")
            course.setdefault("department", course.get("domain", "全校通識"))
            course.setdefault("grade", "大三")
            course.setdefault("category", "選修")

        return {
            "success": True,
            "count": len(courses),
            "data": courses,
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
def sync_student_transcript(req: TranscriptSyncRequest):
    try:
        # 1. 執行爬蟲（記憶體處理，不落地）
        summary, courses = crawl_mcu_transcript(
            student_id=req.mcu_account,
            password=req.mcu_password,
        )

        record_col = db["STUDENT_ACADEMIC_RECORD"]
        synced_count = 0
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # 2. 將 44 門課程以 Upsert 方式寫入 MongoDB
        for c in courses:
            filter_query = {
                "user_id": req.user_id,
                "course_id": c["course_id"],
                "course_name": c["course_name"],
            }
            update_doc = {
                "$set": {
                    "user_id": req.user_id,
                    "course_id": c["course_id"],
                    "course_name": c["course_name"],
                    "category": c["category"],
                    "semester_term": c["semester_term"],
                    "credits": c["credits"],
                    "earned_credits": c["earned_credits"],
                    "score": c["score"],
                    "is_passed": c["is_passed"],
                    "last_synced_at": now_str,
                }
            }
            record_col.update_one(filter_query, update_doc, upsert=True)
            synced_count += 1

        # 3. 更新 STUDENT 集合的學分快取
        if summary:
            db["STUDENT"].update_one(
                {"user_id": req.user_id},
                {
                    "$set": {
                        "total_taken_credits": summary.get("total_taken", 0),
                        "total_grad_credits": summary.get("total_grad_credit", 0),
                        "unlisted_credits": summary.get("unlisted_credit", 0),
                        "audit_updated_at": now_str,
                    }
                },
                upsert=False,
            )

        # 4. 回傳結果（密碼變數隨函式結束立即銷毀）
        return {
            "success": True,
            "message": "歷年成績與學分同步成功！",
            "synced_count": synced_count,
            "summary": summary,
        }

    except MCUAuthError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except MCUCrawlerError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"伺服器內部錯誤: {str(e)}")


# =============================================================
# 28. 學生畢業學分進度條（運算引擎）
# =============================================================
@app.get("/api/student/graduation-progress")
def get_graduation_progress(user_id: int, required_threshold: int = 128):
    try:
        # 從 STUDENT_ACADEMIC_RECORD 取出該學生的所有修課紀錄
        records = list(db["STUDENT_ACADEMIC_RECORD"].find({"user_id": user_id}))

        if not records:
            return {
                "success": True,
                "has_data": False,
                "message": "尚未同步校務成績，請先進行學分同步。",
                "progress_percentage": 0.0,
                "earned_credits": 0,
                "required_threshold": required_threshold,
                "categories": {},
            }

        # 分類統計修得學分
        categories: Dict[str, float] = {}
        total_earned = 0.0

        for r in records:
            if r.get("is_passed", False):
                credit = float(r.get("earned_credits", r.get("credits", 0.0)))
                cat = r.get("category", "其他")
                categories[cat] = categories.get(cat, 0.0) + credit
                total_earned += credit

        # 計算進度百分比（上限 100%）
        percentage = min(100.0, round((total_earned / required_threshold) * 100, 1))

        return {
            "success": True,
            "has_data": True,
            "user_id": user_id,
            "progress_percentage": percentage,
            "earned_credits": total_earned,
            "required_threshold": required_threshold,
            "remaining_credits": max(0.0, required_threshold - total_earned),
            "category_breakdown": categories,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))