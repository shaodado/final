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