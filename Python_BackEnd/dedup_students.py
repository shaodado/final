import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
db = MongoClient(os.getenv('MONGODB_URI'))[os.getenv('DB_NAME', 'campus_app')]
student_col = db['STUDENT']

# Find all ghost students (no email)
ghosts = list(student_col.find({"email": {"$exists": False}}))

for ghost in ghosts:
    uid = ghost.get("user_id")
    if not uid:
        continue
    
    # Find the real student with this user_id
    real_student = student_col.find_one({"user_id": uid, "email": {"$exists": True}})
    
    if real_student:
        print(f"Merging ghost {uid} into real student...")
        # Update real student with ghost fields
        update_fields = {}
        for key in ["total_taken_credits", "total_grad_credits", "unlisted_credits", "audit_updated_at"]:
            if key in ghost:
                update_fields[key] = ghost[key]
        
        if update_fields:
            student_col.update_one(
                {"_id": real_student["_id"]},
                {"$set": update_fields}
            )
        
        # Delete the ghost
        student_col.delete_one({"_id": ghost["_id"]})
        print(f"Deleted ghost {uid}")
    else:
        print(f"Ghost {uid} has no real student match! Keeping it.")

print("Deduplication complete.")
