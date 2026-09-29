from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import get_database
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from bson import ObjectId

# 登入請求規格
class LoginRequest(BaseModel):
    account: str
    password: str

# 課評提交規格
class EvaluationCreate(BaseModel):
    course_id: int
    user_id: int
    sweetness: float
    easiness: float
    gains: float
    comment: str
    evaluation_status: str = "已審核"

    # 老師發布公告請求規格
class AnnouncementCreate(BaseModel):
    title: str
    content: str
    expires_at: str
    course_id: Optional[int] = 101       # 預設為老師教授的 101 資料庫管理
    teacher_id: Optional[int] = 1001
    type: str = "課堂公告"

app = FastAPI(
    title="Campus Smart Assistant API",
    description="校園智慧助手後端 API 伺服器",
    version="1.0.0"
)

# 跨域存取設定（允許前端 Expo / React Native App 存取）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = get_database()

@app.get("/")
def root():
    return {"status": "online", "message": "FastAPI 後端運作正常"}

# -------------------------------------------------------------
# 1. 身分驗證模組 (Login)
# -------------------------------------------------------------
@app.post("/api/login")
def login(req: LoginRequest):
    try:
        # 比對學生（相容字串與數字型 user_id）
        student_query = {"$or": [{"user_id": req.account}, {"student_name": req.account}]}
        if req.account.isdigit():
            student_query["$or"].append({"user_id": int(req.account)})

        student = db["STUDENT"].find_one(student_query)
        if student and str(student.get("password")) == str(req.password):
            return {
                "success": True,
                "role": "student",
                "userId": student.get("user_id"),
                "name": student.get("student_name", "同學")
            }

        # 比對老師
        teacher_query = {"$or": [{"user_id": req.account}, {"teacher_name": req.account}]}
        if req.account.isdigit():
            teacher_query["$or"].append({"user_id": int(req.account)})

        teacher = db["TEACHER"].find_one(teacher_query)
        if teacher and str(teacher.get("password")) == str(req.password):
            return {
                "success": True,
                "role": "teacher",
                "userId": teacher.get("user_id"),
                "name": teacher.get("teacher_name", "老師")
            }

        # 比對管理員
        manager = db["MANAGER"].find_one({"$or": [{"user_id": req.account}, {"manager_name": req.account}]})
        if manager and str(manager.get("password")) == str(req.password):
            return {
                "success": True,
                "role": "admin",
                "userId": manager.get("user_id"),
                "name": manager.get("manager_name", "管理員")
            }

        return {"success": False, "message": "帳號或密碼不正確，請再試一次。"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------------------
# 2. 動態聯絡簿模組 (Feed) - 正式單一版本
# -------------------------------------------------------------
@app.get("/api/student/feed")
def get_student_feed(user_id: int = 3001):
    try:
        # 1. 查詢該學生已修習/正在修習的課程代碼 (如 [101])
        records = list(db["STUDENT_ACADEMIC_RECORD"].find({"user_id": user_id}))
        raw_ids = [r["course_id"] for r in records if "course_id" in r]

        # 兼顧 int 與 str 型別防呆 (例如 101 與 "101" 都能比對)
        my_course_ids = []
        for cid in raw_ids:
            my_course_ids.append(cid)
            try:
                my_course_ids.append(int(cid))
            except (ValueError, TypeError):
                pass
            my_course_ids.append(str(cid))
        my_course_ids = list(set(my_course_ids))

        # 2. 建立課程名稱對照表 (course_id -> course_name)
        courses = list(db["COURSE"].find({}))
        course_map = {}
        for c in courses:
            cid = str(c.get("id") or c.get("course_id"))
            cname = c.get("course_name") or c.get("name") or "課堂公告"
            course_map[cid] = cname

        # 3. 嚴格篩選：只有 course_id 在學生修課清單內的公告才會被撈出
        col = db["NOTIFY"]
        query = {"course_id": {"$in": my_course_ids}} if my_course_ids else {"course_id": -999}
        docs = list(col.find(query).sort("_id", -1).limit(10))

        feeds = []
        for doc in docs:
            icon_map = {
                "作業提醒": "document-text-outline",
                "小考時程": "alert-circle-outline",
                "課堂公告": "megaphone-outline",
            }
            icon = icon_map.get(doc.get("type"), "megaphone-outline")

            # 透過 course_id 查出真實課程名稱
            raw_cid = doc.get("course_id")
            cid_str = str(raw_cid) if raw_cid is not None else ""
            cname = course_map.get(cid_str, f"課程 {cid_str}" if raw_cid else "全校公告")

            # 主題前面加上【課程名稱】
            raw_title = doc.get("title") or "課堂公告"
            formatted_title = f"【{cname}】{raw_title}"

            feeds.append({
                "id": str(doc["_id"]),
                "icon": icon,
                "course_name": cname,
                "course_id": raw_cid,
                "title": formatted_title,  # 已在主題前加上【課程名稱】
                "raw_title": raw_title,
                "content": doc.get("content", ""),
                "time": str(doc.get("published_at") or doc.get("update_time") or "最新"),
                "due_date": doc.get("due_date")
            })

        return {"success": True, "user_id": user_id, "data": feeds}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------------------
# 3. 課程評價模組 (Evaluations)
# -------------------------------------------------------------
# 3. 課程評價模組：支援特定課程篩選與分頁 (預設每頁 20 筆)
@app.get("/api/evaluations")
def get_evaluations(
    course_id: Optional[int] = None,
    page: int = 1,
    limit: int = 20
):
    try:
        collection = db["COURSE_EVALUATION"]
        query = {}
        if course_id is not None:
            query["course_id"] = course_id

        # 計算該課程在資料庫中的總評價數
        total_count = collection.count_documents(query)
        # 計算總頁數
        total_pages = max(1, (total_count + limit - 1) // limit) if total_count > 0 else 1
        skip = max(0, (page - 1) * limit)

        # 依最新時間倒序排列，並精準跳過 (skip) 與限制 (limit) 20 筆
        docs = list(collection.find(query).sort("_id", -1).skip(skip).limit(limit))
        for doc in docs:
            doc["_id"] = str(doc["_id"])

        return {
            "success": True,
            "data": docs,
            "count": len(docs),
            "total_count": total_count,
            "page": page,
            "total_pages": total_pages,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/evaluations")
def create_evaluation(eval_data: EvaluationCreate):
    try:
        collection = db["COURSE_EVALUATION"]
        new_eval = eval_data.dict()
        result = collection.insert_one(new_eval)
        new_eval["_id"] = str(result.inserted_id)
        return {"success": True, "message": "評價儲存成功", "data": new_eval}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------------------
# 4. 選課模組核心：已修課程下拉選單 + 全校多維度檢索
# -------------------------------------------------------------

# (A) 取得學生已修課程（供評分下拉選單選擇）
# (A) 取得學生已修課程（支援每頁 20 筆分頁查詢）
@app.get("/api/student/my-courses")
def get_student_courses(
    user_id: int,
    page: int = 1,
    limit: int = 20
):
    try:
        # 1. 查詢學生歷年修課紀錄 (STUDENT_ACADEMIC_RECORD)
        records = list(db["STUDENT_ACADEMIC_RECORD"].find({"user_id": user_id}))
        course_ids = [r["course_id"] for r in records if "course_id" in r]

        courses_col = db["COURSE"]
        query = {"course_id": {"$in": course_ids}} if course_ids else {"course_id": -999}

        # 2. 計算總筆數、總頁數與 skip 偏移量
        total_count = courses_col.count_documents(query) if course_ids else 0
        total_pages = max(1, (total_count + limit - 1) // limit) if total_count > 0 else 1
        skip = max(0, (page - 1) * limit)

        # 3. 取得該頁課程資料
        courses = list(courses_col.find(query).skip(skip).limit(limit)) if course_ids else []

        for c in courses:
            c["_id"] = str(c["_id"])
            c.setdefault("teacher", "專任教師")
            c.setdefault("department", c.get("domain", "資訊工程學系"))
            c.setdefault("grade", "大三")
            c.setdefault("category", "必修")

        return {
            "success": True,
            "data": courses,
            "count": len(courses),
            "total_count": total_count,
            "page": page,
            "total_pages": total_pages,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# (B) 全校課程多維度檢索（系所、年級、必選修公開過濾）
@app.get("/api/courses/search")
def search_courses(
    department: str = "全部",
    grade: str = "全部",
    category: str = "全部"
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
        for c in courses:
            c["_id"] = str(c["_id"])
            c.setdefault("teacher", "授課教師")
            c.setdefault("department", c.get("domain", "全校通識"))
            c.setdefault("grade", "大三")
            c.setdefault("category", "選修")

        return {"success": True, "count": len(courses), "data": courses}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 1. 老師端：發布公告並寫入 NOTIFY 集合
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
            "published_at": datetime.now().strftime("%Y年%m月%d日")
        }
        result = col.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return {"success": True, "message": "公告已發布至雲端", "data": doc}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 2. 老師端：讀取歷史公告清單
# 1. 老師端：讀取指定課程的歷史公告清單
@app.get("/api/teacher/announcements")
def get_teacher_announcements(
    teacher_id: int = 1001,
    course_id: Optional[int] = None
):
    try:
        col = db["NOTIFY"]
        query = {}
        # 若有指定課程，精準只撈該課程的公告；若無才依老師 ID 撈取
        if course_id is not None:
            query["course_id"] = course_id
        elif teacher_id is not None:
            query["teacher_id"] = teacher_id

        docs = list(col.find(query).sort("_id", -1))
        announcements = []
        for d in docs:
            announcements.append({
                "id": str(d["_id"]),
                "title": d.get("title", ""),
                "content": d.get("content", ""),
                "expiresAt": str(d.get("due_date", "未設定")),
                "publishedAt": str(d.get("published_at", d.get("update_time", "最新"))),
                "course_id": d.get("course_id")
            })
        return {"success": True, "data": announcements}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 3. 老師端：刪除公告
@app.delete("/api/announcements/{announcement_id}")
def delete_announcement(announcement_id: str):
    try:
        col = db["NOTIFY"]
        result = col.delete_one({"_id": ObjectId(announcement_id)})
        if result.deleted_count > 0:
            return {"success": True, "message": "公告已成功刪除"}
        return {"success": False, "message": "找不到該公告"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 取得全校校級公告（供鈴鐺按鈕讀取與比對紅點）
@app.get("/api/announcements/school")
def get_school_announcements():
    try:
        col = db["NOTIFY"]
        # 篩選條件：course_id 為 None 或 類型為校級公告
        query = {"$or": [{"course_id": None}, {"type": "校級公告"}]}
        docs = list(col.find(query).sort("_id", -1).limit(10))

        results = []
        for doc in docs:
            results.append({
                "id": str(doc["_id"]),
                "title": doc.get("title", "校級公告"),
                "content": doc.get("content", ""),
                "publishedAt": str(doc.get("published_at") or doc.get("update_time") or "最新")
            })

        return {"success": True, "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
