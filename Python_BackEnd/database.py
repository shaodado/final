import os
from pymongo import MongoClient
from dotenv import load_dotenv

# 讀取同目錄下的 .env 環境變數
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME", "campus_app")

if not MONGODB_URI:
    raise ValueError("找不到 MONGODB_URI，請檢查 .env 檔案內容是否填妥")

# 建立 MongoDB Atlas 連線
client = MongoClient(MONGODB_URI)
db = client[DB_NAME]

def get_database():
    return db