from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from pathlib import Path
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os, jwt, bcrypt, uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="Nusantara SMP LMS")
api = APIRouter(prefix="/api")
SECRET = os.environ["JWT_SECRET"]

class LoginIn(BaseModel): username: str; password: str
class ItemIn(BaseModel): name: str; detail: Optional[str] = ""
class PeriodIn(BaseModel): year: str; semester: str; active: bool = False
class AssignmentIn(BaseModel): teacher: str; class_name: str; subject: str

SEED = {
 "users": [
  {"id":"u-admin","username":"admin","password":"admin123","role":"admin","name":"Drs. Budi Santoso, M.Pd","status":"Active"},
  {"id":"u-teacher","username":"guru.budi","password":"password","role":"teacher","name":"Siti Rahma, S.Pd","status":"Active"},
  {"id":"u-student","username":"siswa.budi","password":"password","role":"student","name":"Ahmad Pratama","status":"Active","class_name":"VIII-A","nis":"202801","nisn":"0092837461"}
 ],
 "periods":[{"id":"p1","year":"2026/2027","semester":"Ganjil","active":True},{"id":"p2","year":"2026/2027","semester":"Genap","active":False}],
 "classes":[{"id":"c1","name":"VII-A","detail":"Grade 7 • 28 students"},{"id":"c2","name":"VII-B","detail":"Grade 7 • 27 students"},{"id":"c3","name":"VIII-A","detail":"Grade 8 • 30 students"},{"id":"c4","name":"VIII-B","detail":"Grade 8 • 29 students"},{"id":"c5","name":"IX-A","detail":"Grade 9 • 31 students"}],
 "subjects":[{"id":"s1","name":"Mathematics","detail":"Core subject"},{"id":"s2","name":"Science","detail":"Core subject"},{"id":"s3","name":"English","detail":"Language"},{"id":"s4","name":"Informatics","detail":"Digital skills"},{"id":"s5","name":"Indonesian Language","detail":"Language"},{"id":"s6","name":"Civics","detail":"Character education"}],
 "assignments":[{"id":"a1","teacher":"Siti Rahma, S.Pd","class_name":"VIII-A","subject":"Mathematics"},{"id":"a2","teacher":"Siti Rahma, S.Pd","class_name":"VIII-B","subject":"Mathematics"}],
 "materials":[{"id":"m1","title":"Algebraic Expressions","subject":"Mathematics","type":"PDF","status":"Published","updated":"Today"},{"id":"m2","title":"Linear Equations","subject":"Mathematics","type":"DOCX","status":"Published","updated":"Yesterday"}],
 "tasks":[{"id":"t1","title":"Algebra Practice Set","subject":"Mathematics","due":"18 Sep 2026","status":"Open"},{"id":"t2","title":"Science Lab Reflection","subject":"Science","due":"22 Sep 2026","status":"Open"}],
 "pjj":[{"id":"j1","title":"Live Mathematics Clinic","subject":"Mathematics","date":"16 Sep 2026","time":"08:00 – 09:30","platform":"Google Meet","url":"https://meet.google.com/","status":"Scheduled"}],
 "attendance":[{"label":"Hadir","count":18},{"label":"Izin","count":1},{"label":"Sakit","count":1},{"label":"Alpa","count":0}],
 "grades":[{"subject":"Mathematics","quiz":88,"assignment":92,"final":90},{"subject":"Science","quiz":82,"assignment":86,"final":84}]
}

async def seed():
    if await db.meta.find_one({"seeded":True}): return
    for collection, rows in SEED.items():
        documents=[]
        for row in rows:
            item={**row}
            item.setdefault("id", str(uuid.uuid4()))
            item["_id"]=item["id"]
            documents.append(item)
        for document in documents:
            await db[collection].update_one(
                {"id": document["id"]},
                {"$setOnInsert": document},
                upsert=True,
            )
    await db.meta.insert_one({"seeded":True})

@app.on_event("startup")
async def startup(): await seed()

def token_for(user):
    return jwt.encode({"sub":user["id"],"exp":datetime.now(timezone.utc)+timedelta(hours=8)}, SECRET, algorithm="HS256")

async def current_user(authorization: str = Header(default="")):
    if not authorization.startswith("Bearer "): raise HTTPException(401,"Please sign in")
    try: payload=jwt.decode(authorization[7:], SECRET, algorithms=["HS256"])
    except Exception: raise HTTPException(401,"Session expired")
    user=await db.users.find_one({"id":payload["sub"]},{"_id":0,"password":0})
    if not user: raise HTTPException(401,"User not found")
    return user

@api.post("/auth/login")
async def login(body: LoginIn):
    user=await db.users.find_one({"username":body.username},{"_id":0})
    if not user or user["password"] != body.password: raise HTTPException(401,"Username or password is incorrect")
    return {"token":token_for(user),"user":{k:v for k,v in user.items() if k not in ["password","_id"]}}

@api.get("/auth/me")
async def me(user=Depends(current_user)): return user

@api.get("/dashboard")
async def dashboard(user=Depends(current_user)):
    period=await db.periods.find_one({"active":True},{"_id":0})
    role=user["role"]
    if role=="admin":
        counts={c:await db[c].count_documents({}) for c in ["users","classes","subjects","assignments"]}
        return {"user":user,"period":period,"counts":{"teachers":await db.users.count_documents({"role":"teacher"}),"students":await db.users.count_documents({"role":"student"}),"classes":counts["classes"],"subjects":counts["subjects"]}}
    if role=="teacher":
        assigns=await db.assignments.find({"teacher":user["name"]},{"_id":0}).to_list(100)
        return {"user":user,"period":period,"assignments":assigns,"materials":await db.materials.find({}, {"_id":0}).to_list(10),"tasks":await db.tasks.find({}, {"_id":0}).to_list(10),"pjj":await db.pjj.find({}, {"_id":0}).to_list(10)}
    return {"user":user,"period":period,"attendance":SEED["attendance"],"subjects":await db.subjects.find({}, {"_id":0}).to_list(10),"materials":await db.materials.find({"status":"Published"},{"_id":0}).to_list(10),"tasks":await db.tasks.find({}, {"_id":0}).to_list(10),"pjj":await db.pjj.find({}, {"_id":0}).to_list(10),"grades":await db.grades.find({}, {"_id":0}).to_list(10)}

@api.get("/admin/{collection}")
async def list_items(collection: str, role: Optional[str] = None, user=Depends(current_user)):
    if user["role"]!="admin" or collection not in ["periods","classes","subjects","assignments","users"]: raise HTTPException(403,"Admin access required")
    query={"role":role} if collection=="users" and role else ({"role":{"$in":["teacher","student"]}} if collection=="users" else {})
    return await db[collection].find(query,{"_id":0,"password":0}).to_list(200)

@api.post("/admin/{collection}")
async def create_item(collection: str, body: dict, user=Depends(current_user)):
    if user["role"]!="admin": raise HTTPException(403,"Admin access required")
    allowed={"periods","classes","subjects","assignments","users"}
    if collection not in allowed: raise HTTPException(404,"Unknown collection")
    item={"id":str(uuid.uuid4()),**body}
    if collection=="users": item["role"]=body.get("role","student"); item["status"]="Active"
    if collection=="periods" and item.get("active"): await db.periods.update_many({}, {"$set":{"active":False}})
    await db[collection].insert_one({**item,"_id":item["id"]})
    item.pop("_id",None); item.pop("password",None)
    return item

@api.post("/admin/periods/{item_id}/activate")
async def activate(item_id: str, user=Depends(current_user)):
    if user["role"]!="admin": raise HTTPException(403,"Admin access required")
    await db.periods.update_many({}, {"$set":{"active":False}}); await db.periods.update_one({"id":item_id},{"$set":{"active":True}})
    return {"ok":True}

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get("CORS_ORIGINS","*").split(","), allow_methods=["*"], allow_headers=["*"])
@app.on_event("shutdown")
async def shutdown(): client.close()