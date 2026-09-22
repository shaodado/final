from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import get_database

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