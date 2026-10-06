import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME", "campus_app")

if not MONGODB_URI:
    print("No MONGODB_URI found.")
    exit(1)

client = MongoClient(MONGODB_URI)
db = client[DB_NAME]

print("Starting to update user_ids for @me.mcu.edu.tw students...")

students = list(db["STUDENT"].find({}))

count = 0
for student in students:
    email = student.get("email", "")
    old_id = student.get("user_id")
    if email.endswith("@me.mcu.edu.tw"):
        prefix = email.split("@")[0]
        if prefix[:8].isdigit():
            new_id = int(prefix[:8])
            if old_id != new_id:
                # Update STUDENT
                db["STUDENT"].update_one(
                    {"_id": student["_id"]},
                    {"$set": {"user_id": new_id}}
                )
                
                # Update other collections
                db["STUDENT_ACADEMIC_RECORD"].update_many(
                    {"user_id": old_id},
                    {"$set": {"user_id": new_id}}
                )
                db["COURSE_EVALUATION"].update_many(
                    {"user_id": old_id},
                    {"$set": {"user_id": new_id}}
                )
                db["NOTIFY"].update_many(
                    {"user_id": old_id},
                    {"$set": {"user_id": new_id}}
                )
                
                print(f"Updated {email}: {old_id} -> {new_id}")
                count += 1

print(f"Update completed. Total {count} users updated.")
