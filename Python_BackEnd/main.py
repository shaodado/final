from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import get_database
from pydantic import BaseModel
from typing import Optional

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
# 2. 動態聯絡簿模組 (Feed)
# -------------------------------------------------------------
@app.get("/api/student/feed")
def get_student_feed(user_id: int):
    try:
        collection_names = db.list_collection_names()
        target_col = None
        if "NOTIFY" in collection_names:
            target_col = db["NOTIFY"]
        elif "ANNOUNCEMENT" in collection_names:
            target_col = db["ANNOUNCEMENT"]

        feeds = []
        if target_col is not None:
            docs = list(target_col.find().sort("_id", -1).limit(5))
            for doc in docs:
                feeds.append({
                    "icon": "megaphone-outline",
                    "text": doc.get("title") or doc.get("content") or "課堂公告",
                    "time": str(doc.get("created_at", "最新"))
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