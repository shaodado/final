from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import get_database
from pydantic import BaseModel

class LoginRequest(BaseModel):
    account: str
    password: str

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

# 測試讀取先前在 Compass 建立的課評資料
@app.get("/api/evaluations")
def get_evaluations():
    try:
        collection = db["COURSE_EVALUATION"]
        evaluations = []
        for doc in collection.find():
            # 將 MongoDB 專屬的 ObjectId 轉為一般字串以供 JSON 輸出
            doc["_id"] = str(doc["_id"])
            evaluations.append(doc)
        return {"success": True, "count": len(evaluations), "data": evaluations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel

class EvaluationCreate(BaseModel):
    course_id: int
    user_id: int
    sweetness: float
    easiness: float
    gains: float
    comment: str
    evaluation_status: str = "已審核"

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

@app.post("/api/login")
def login(req: LoginRequest):
    try:
        # 1. 優先比對學生（相容字串與數字型 user_id）
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

        # 2. 比對老師
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

        # 3. 比對管理員
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

@app.get("/api/student/feed")
def get_student_feed(user_id: int):
    try:
        # 1. 嘗試從 NOTIFY 或 ANNOUNCEMENT 集合查詢專屬/修課公告
        collection_names = db.list_collection_names()
        target_col = None
        if "NOTIFY" in collection_names:
            target_col = db["NOTIFY"]
        elif "ANNOUNCEMENT" in collection_names:
            target_col = db["ANNOUNCEMENT"]

        feeds = []
        if target_col is not None:
            # 撈取該學生修課相關或全體公告
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