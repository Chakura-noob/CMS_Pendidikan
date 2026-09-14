from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File, Form
from fastapi.responses import FileResponse
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
class QuizIn(BaseModel): title: str; description: str = ""; questions: List[dict] = []
class QuizSubmit(BaseModel): answers: List[str]
class GradeIn(BaseModel): score: float; feedback: str = ""

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
    if await db.notifications.count_documents({}) == 0:
        await db.notifications.insert_many([
            {"_id":"n-student-1","id":"n-student-1","user_id":"u-student","kind":"assignment","title":"New assignment","detail":"Algebra Practice Set","read":False,"created":"Today"},
            {"_id":"n-student-2","id":"n-student-2","user_id":"u-student","kind":"pjj","title":"Upcoming PJJ session","detail":"Live Mathematics Clinic · 16 Sep","read":False,"created":"Yesterday"},
            {"_id":"n-teacher-1","id":"n-teacher-1","user_id":"u-teacher","kind":"submission","title":"New submission received","detail":"Ahmad Pratama submitted an assignment","read":False,"created":"Today"},
        ])
    await db.meta.update_one({"seeded":True},{"$set":{"seeded":True}},upsert=True)

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
        return {"user":user,"period":period,"assignments":assigns,"materials":await db.materials.find({}, {"_id":0}).to_list(20),"tasks":await db.tasks.find({}, {"_id":0}).to_list(20),"pjj":await db.pjj.find({}, {"_id":0}).to_list(20),"quizzes":await db.quizzes.find({}, {"_id":0,"questions.correct":0}).to_list(20),"submissions":await db.submissions.find({}, {"_id":0}).to_list(50),"notifications":await db.notifications.find({"user_id":user["id"]},{"_id":0}).to_list(20)}
    return {"user":user,"period":period,"attendance":SEED["attendance"],"subjects":await db.subjects.find({}, {"_id":0}).to_list(10),"materials":await db.materials.find({"status":"Published"},{"_id":0}).to_list(20),"tasks":await db.tasks.find({}, {"_id":0}).to_list(20),"pjj":await db.pjj.find({}, {"_id":0}).to_list(20),"grades":await db.grades.find({}, {"_id":0}).to_list(10),"quizzes":await db.quizzes.find({}, {"_id":0,"questions.correct":0}).to_list(20),"notifications":await db.notifications.find({"user_id":user["id"]},{"_id":0}).to_list(20)}

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_FILES = {"pdf","doc","docx","ppt","pptx","xls","xlsx","jpg","jpeg","png","zip"}

async def notify(user_id, kind, title, detail):
    item={"id":str(uuid.uuid4()),"user_id":user_id,"kind":kind,"title":title,"detail":detail,"read":False,"created":"Just now"}
    await db.notifications.insert_one({**item,"_id":item["id"]})

@api.get("/materials")
async def materials(user=Depends(current_user)):
    query={} if user["role"]=="teacher" else {"status":"Published"}
    return await db.materials.find(query,{"_id":0}).to_list(100)

@api.post("/teacher/materials")
async def create_material(title: str = Form(...), description: str = Form(""), status: str = Form("Published"), file: UploadFile = File(...), user=Depends(current_user)):
    if user["role"]!="teacher": raise HTTPException(403,"Teacher access required")
    ext=file.filename.rsplit(".",1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_FILES: raise HTTPException(400,"Unsupported file extension")
    content=await file.read()
    if len(content)>10*1024*1024: raise HTTPException(400,"File must be 10 MB or smaller")
    safe_name=f"{uuid.uuid4()}.{ext}"; (UPLOAD_DIR/safe_name).write_bytes(content)
    item={"id":str(uuid.uuid4()),"title":title,"description":description,"subject":"Mathematics","type":ext.upper(),"status":status,"filename":file.filename,"stored_name":safe_name,"updated":"Just now","created_by":user["id"]}
    await db.materials.insert_one({**item,"_id":item["id"]})
    for student in await db.users.find({"role":"student"},{"_id":0,"id":1}).to_list(100): await notify(student["id"],"material","New learning material",title)
    return item

@api.get("/materials/{item_id}/download")
async def download_material(item_id: str, user=Depends(current_user)):
    item=await db.materials.find_one({"id":item_id},{"_id":0})
    if not item or (user["role"]=="student" and item.get("status")!="Published"): raise HTTPException(404,"Material not found")
    return {"filename":item.get("filename",item.get("title")),"download_url":f"/api/materials/{item_id}/file"}

@api.get("/materials/{item_id}/file")
async def material_file(item_id: str, user=Depends(current_user)):
    item=await db.materials.find_one({"id":item_id},{"_id":0})
    if not item or (user["role"]=="student" and item.get("status")!="Published"): raise HTTPException(404,"Material not found")
    stored=item.get("stored_name")
    if not stored or not (UPLOAD_DIR/stored).exists(): raise HTTPException(404,"File is not available in prototype storage")
    return FileResponse(UPLOAD_DIR/stored, filename=item.get("filename",stored))

@api.post("/teacher/quizzes")
async def create_quiz(body: QuizIn, user=Depends(current_user)):
    if user["role"]!="teacher": raise HTTPException(403,"Teacher access required")
    item={"id":str(uuid.uuid4()),"title":body.title,"description":body.description,"subject":"Mathematics","status":"Published","questions":body.questions,"created_by":user["id"]}
    await db.quizzes.insert_one({**item,"_id":item["id"]})
    for student in await db.users.find({"role":"student"},{"_id":0,"id":1}).to_list(100): await notify(student["id"],"quiz","New quiz published",body.title)
    return {k:v for k,v in item.items() if k!="questions"}

@api.post("/quizzes/{quiz_id}/submit")
async def submit_quiz(quiz_id: str, body: QuizSubmit, user=Depends(current_user)):
    if user["role"]!="student": raise HTTPException(403,"Student access required")
    quiz=await db.quizzes.find_one({"id":quiz_id},{"_id":0})
    if not quiz: raise HTTPException(404,"Quiz not found")
    correct=sum(1 for i,q in enumerate(quiz.get("questions",[])) if i<len(body.answers) and body.answers[i]==q.get("correct"))
    score=round((correct/max(len(quiz.get("questions",[])),1))*100)
    result={"id":str(uuid.uuid4()),"quiz_id":quiz_id,"student_id":user["id"],"student_name":user["name"],"answers":body.answers,"score":score,"submitted":"Just now"}
    await db.quiz_submissions.update_one({"quiz_id":quiz_id,"student_id":user["id"]},{"$set":result,"$setOnInsert":{"_id":result["id"]}},upsert=True)
    return {"score":score,"completion":"Completed","correct":correct,"total":len(quiz.get("questions",[]))}

@api.post("/teacher/assignments")
async def create_assignment(title: str = Form(...), description: str = Form(""), deadline: str = Form(...), user=Depends(current_user)):
    if user["role"]!="teacher": raise HTTPException(403,"Teacher access required")
    item={"id":str(uuid.uuid4()),"title":title,"description":description,"subject":"Mathematics","due":deadline,"status":"Open","created_by":user["id"]}
    await db.tasks.insert_one({**item,"_id":item["id"]})
    for student in await db.users.find({"role":"student"},{"_id":0,"id":1}).to_list(100): await notify(student["id"],"assignment","New assignment",title)
    return item

@api.post("/assignments/{assignment_id}/submit")
async def submit_assignment(assignment_id: str, file: UploadFile = File(...), user=Depends(current_user)):
    if user["role"]!="student": raise HTTPException(403,"Student access required")
    ext=file.filename.rsplit(".",1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_FILES: raise HTTPException(400,"Unsupported file extension")
    content=await file.read()
    if len(content)>10*1024*1024: raise HTTPException(400,"File must be 10 MB or smaller")
    safe_name=f"{uuid.uuid4()}.{ext}"; (UPLOAD_DIR/safe_name).write_bytes(content)
    item={"id":str(uuid.uuid4()),"assignment_id":assignment_id,"student_id":user["id"],"student_name":user["name"],"filename":file.filename,"stored_name":safe_name,"status":"Submitted","score":None,"feedback":"","submitted":"Just now"}
    await db.submissions.update_one({"assignment_id":assignment_id,"student_id":user["id"]},{"$set":item,"$setOnInsert":{"_id":item["id"]}},upsert=True)
    await notify("u-teacher","submission","New submission received",user["name"])
    return item

@api.get("/teacher/submissions")
async def submissions(user=Depends(current_user)):
    if user["role"]!="teacher": raise HTTPException(403,"Teacher access required")
    return await db.submissions.find({}, {"_id":0}).to_list(100)

@api.patch("/teacher/submissions/{submission_id}")
async def grade_submission(submission_id: str, body: GradeIn, user=Depends(current_user)):
    if user["role"]!="teacher": raise HTTPException(403,"Teacher access required")
    submission=await db.submissions.find_one({"id":submission_id},{"_id":0})
    quiz_score_doc=await db.quiz_submissions.find_one({"student_id":submission.get("student_id") if submission else ""},{"_id":0,"score":1})
    quiz_score=quiz_score_doc.get("score",0) if quiz_score_doc else 0
    final_score=round(quiz_score*.6+body.score*.4)
    await db.submissions.update_one({"id":submission_id},{"$set":{"score":body.score,"quiz_score":quiz_score,"final_score":final_score,"feedback":body.feedback,"status":"Graded"}})
    if submission: await notify(submission["student_id"],"grade","New grade available",f"Score {body.score}")
    return {**(submission or {}),"score":body.score,"quiz_score":quiz_score,"final_score":final_score,"feedback":body.feedback,"status":"Graded"}

@api.get("/notifications")
async def notifications(user=Depends(current_user)):
    return await db.notifications.find({"user_id":user["id"]},{"_id":0}).sort("read",1).to_list(50)

@api.post("/notifications/{notification_id}/read")
async def read_notification(notification_id: str, user=Depends(current_user)):
    await db.notifications.update_one({"id":notification_id,"user_id":user["id"]},{"$set":{"read":True}})
    return {"ok":True}

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