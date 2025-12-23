from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import pandas as pd
from io import BytesIO
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'procto13-secret-key-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

app = FastAPI(title="PROCTO 13 Brand Management System")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== ENUMS ==============
class UserRole:
    ADMIN = "admin"
    SEARCHER = "searcher"

class BrandStatus:
    IN_POOL = "IN_POOL"
    ASSIGNED = "ASSIGNED"
    IN_WORK = "IN_WORK"
    WAITING = "WAITING"
    ON_HOLD = "ON_HOLD"
    OUTCOME_APPROVED = "OUTCOME_APPROVED"
    OUTCOME_DECLINED = "OUTCOME_DECLINED"
    OUTCOME_REPLIED = "OUTCOME_REPLIED"
    PROBLEMATIC = "PROBLEMATIC"

class PipelineStage:
    REVIEW = "REVIEW"
    EMAIL_1_DONE = "EMAIL_1_DONE"
    EMAIL_2_DONE = "EMAIL_2_DONE"
    MULTI_CHANNEL_DONE = "MULTI_CHANNEL_DONE"
    CALL_OR_PUSH_RECOMMENDED = "CALL_OR_PUSH_RECOMMENDED"
    CLOSED = "CLOSED"

class NoteType:
    STAGE_DONE = "stage_done"
    RETURN_TO_POOL = "return_to_pool"
    PROBLEMATIC = "problematic"
    GENERAL = "general"
    ADMIN_NOTE = "admin_note"
    ON_HOLD = "on_hold"

class EventType:
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    BRANDS_ASSIGNED = "brands_assigned"
    STATUS_CHANGED = "status_changed"
    STAGE_COMPLETED = "stage_completed"
    RETURNED_TO_POOL = "returned_to_pool"
    MARKED_PROBLEMATIC = "marked_problematic"
    MARKED_ON_HOLD = "marked_on_hold"
    REASSIGNED = "reassigned"
    ADMIN_RELEASED = "admin_released"
    HEARTBEAT = "heartbeat"
    IMPORT_COMPLETED = "import_completed"

# ============== PYDANTIC MODELS ==============
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    secret_code: str
    nickname: str
    role: str = UserRole.SEARCHER
    work_hours_start: Optional[str] = "09:00"
    work_hours_end: Optional[str] = "18:00"

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    secret_code: Optional[str] = None
    nickname: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    work_hours_start: Optional[str] = None
    work_hours_end: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    password: str  # показываем в админке
    secret_code: str
    nickname: str
    role: str
    status: str
    work_hours_start: str
    work_hours_end: str
    last_seen_at: Optional[str] = None
    created_at: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    secret_code: str

class LoginResponse(BaseModel):
    token: str
    user: UserResponse

class BrandNoteCreate(BaseModel):
    note_text: str
    note_type: str = NoteType.GENERAL

class BrandResponse(BaseModel):
    id: str
    name_original: str
    name_normalized: str
    priority_score: int
    status: str
    pipeline_stage: str
    assigned_to_user_id: Optional[str] = None
    assigned_to_nickname: Optional[str] = None
    assigned_at: Optional[str] = None
    funnel_started_at: Optional[str] = None
    last_action_at: Optional[str] = None
    next_action_at: Optional[str] = None
    website_url: Optional[str] = None
    website_found: bool = False
    contacts_found: bool = False
    on_hold_reason: Optional[str] = None
    on_hold_review_date: Optional[str] = None
    items_count: int = 0
    created_at: str

class BrandItemResponse(BaseModel):
    id: str
    brand_id: str
    asin: Optional[str] = None
    title: Optional[str] = None
    image_url: Optional[str] = None
    created_at: str

class BrandDetailResponse(BaseModel):
    brand: BrandResponse
    items: List[BrandItemResponse]
    notes: List[Dict[str, Any]]
    events: List[Dict[str, Any]]

class StageCompleteRequest(BaseModel):
    stage: str
    note_text: str

class OutcomeRequest(BaseModel):
    outcome: str  # OUTCOME_APPROVED, OUTCOME_DECLINED, OUTCOME_REPLIED
    note_text: str

class ReturnToPoolRequest(BaseModel):
    reason: str
    note_text: str

class MarkProblematicRequest(BaseModel):
    reason: str
    note_text: str

class MarkOnHoldRequest(BaseModel):
    reason: str
    review_date: str
    note_text: str

class UpdateBrandInfoRequest(BaseModel):
    website_url: Optional[str] = None
    website_found: Optional[bool] = None
    contacts_found: Optional[bool] = None

class ReassignBrandRequest(BaseModel):
    new_user_id: str
    reason: str

class SettingsUpdate(BaseModel):
    delay_email2_days: Optional[int] = None
    delay_multichannel_days: Optional[int] = None
    delay_call_days: Optional[int] = None
    brand_inactivity_days: Optional[int] = None

class DashboardResponse(BaseModel):
    total_brands: int
    brands_in_pool: int
    brands_assigned: int
    brands_overdue: int
    brands_by_status: Dict[str, int]
    brands_by_stage: Dict[str, int]
    searchers_activity: List[Dict[str, Any]]

# ============== AUTH HELPERS ==============
def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user["status"] != "active":
        raise HTTPException(status_code=403, detail="User is disabled")
    return user

async def require_admin(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============== HELPERS ==============
def normalize_brand_name(name: str) -> str:
    if not name:
        return ""
    return " ".join(name.lower().strip().split())

async def log_event(event_type: str, user_id: str, brand_id: Optional[str] = None, metadata: Optional[dict] = None):
    event = {
        "id": str(uuid.uuid4()),
        "event_type": event_type,
        "user_id": user_id,
        "brand_id": brand_id,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.brand_events.insert_one(event)

async def get_settings() -> dict:
    settings = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not settings:
        settings = {
            "id": "global",
            "delay_email2_days": 2,
            "delay_multichannel_days": 2,
            "delay_call_days": 2,
            "brand_inactivity_days": 7
        }
        await db.settings.insert_one(settings)
    return settings

def calculate_next_action(current_stage: str, settings: dict) -> Optional[datetime]:
    now = datetime.now(timezone.utc)
    if current_stage == PipelineStage.EMAIL_1_DONE:
        return now + timedelta(days=settings["delay_email2_days"])
    elif current_stage == PipelineStage.EMAIL_2_DONE:
        return now + timedelta(days=settings["delay_multichannel_days"])
    elif current_stage == PipelineStage.MULTI_CHANNEL_DONE:
        return now + timedelta(days=settings["delay_call_days"])
    return None

# ============== AUTH ROUTES ==============
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    if user["password"] != req.password:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    if user["secret_code"] != req.secret_code:
        raise HTTPException(status_code=401, detail="Неверный секретный код")
    if user["status"] != "active":
        raise HTTPException(status_code=403, detail="Аккаунт отключён")
    
    token = create_token(user["id"], user["role"])
    await log_event(EventType.USER_LOGIN, user["id"])
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_seen_at": datetime.now(timezone.utc).isoformat()}})
    
    return LoginResponse(token=token, user=UserResponse(**user))

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(**user)

@api_router.post("/auth/heartbeat")
async def heartbeat(user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_seen_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "ok"}

# ============== USER ROUTES (ADMIN ONLY) ==============
@api_router.get("/users", response_model=List[UserResponse])
async def get_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, admin: dict = Depends(require_admin)):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email уже используется")
    
    user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "password": user_data.password,
        "secret_code": user_data.secret_code,
        "nickname": user_data.nickname,
        "role": user_data.role,
        "status": "active",
        "work_hours_start": user_data.work_hours_start,
        "work_hours_end": user_data.work_hours_end,
        "last_seen_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    return UserResponse(**user)

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, admin: dict = Depends(require_admin)):
    update_dict = {k: v for k, v in user_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    return UserResponse(**user)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return {"status": "deleted"}

# ============== IMPORT ROUTES ==============
@api_router.post("/import/excel")
async def import_excel(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Только Excel файлы (.xlsx, .xls)")
    
    content = await file.read()
    df = pd.read_excel(BytesIO(content))
    
    # Check required columns
    required_cols = ['Brand']
    optional_cols = ['ASIN', 'Title', 'Image']
    missing_required = [c for c in required_cols if c not in df.columns]
    missing_optional = [c for c in optional_cols if c not in df.columns]
    
    if missing_required:
        raise HTTPException(status_code=400, detail=f"Отсутствуют обязательные колонки: {missing_required}")
    
    # Process brands
    df = df.dropna(subset=['Brand'])
    brand_counts = df['Brand'].value_counts().to_dict()
    
    stats = {
        "total_rows": len(df),
        "unique_brands": len(brand_counts),
        "new_brands": 0,
        "duplicate_brands": 0,
        "items_added": 0,
        "missing_columns": missing_optional
    }
    
    for brand_name, count in brand_counts.items():
        brand_normalized = normalize_brand_name(str(brand_name))
        if not brand_normalized:
            continue
        
        existing = await db.brands.find_one({"name_normalized": brand_normalized})
        
        if existing:
            # Update priority score if higher
            if count > existing.get("priority_score", 0):
                await db.brands.update_one(
                    {"id": existing["id"]},
                    {"$set": {"priority_score": count, "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
            stats["duplicate_brands"] += 1
        else:
            # Create new brand
            brand_id = str(uuid.uuid4())
            brand = {
                "id": brand_id,
                "name_original": str(brand_name),
                "name_normalized": brand_normalized,
                "priority_score": count,
                "status": BrandStatus.IN_POOL,
                "pipeline_stage": PipelineStage.REVIEW,
                "assigned_to_user_id": None,
                "assigned_at": None,
                "funnel_started_at": None,
                "last_action_at": None,
                "next_action_at": None,
                "website_url": None,
                "website_found": False,
                "contacts_found": False,
                "on_hold_reason": None,
                "on_hold_review_date": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.brands.insert_one(brand)
            stats["new_brands"] += 1
            
            # Add items (up to 10)
            brand_items = df[df['Brand'] == brand_name].head(10)
            for _, row in brand_items.iterrows():
                image_url = str(row.get('Image', '')) if pd.notna(row.get('Image')) else None
                if image_url and ';' in image_url:
                    image_url = image_url.split(';')[0]  # Take first image
                
                item = {
                    "id": str(uuid.uuid4()),
                    "brand_id": brand_id,
                    "asin": str(row.get('ASIN', '')) if pd.notna(row.get('ASIN')) else None,
                    "title": str(row.get('Title', '')) if pd.notna(row.get('Title')) else None,
                    "image_url": image_url,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.brand_items.insert_one(item)
                stats["items_added"] += 1
    
    # Save import record
    import_record = {
        "id": str(uuid.uuid4()),
        "file_name": file.filename,
        "imported_by_user_id": admin["id"],
        "imported_by_nickname": admin["nickname"],
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "stats": stats
    }
    await db.batch_imports.insert_one(import_record)
    
    await log_event(EventType.IMPORT_COMPLETED, admin["id"], metadata=stats)
    
    return {"status": "success", "stats": stats}

@api_router.get("/import/history")
async def get_import_history(admin: dict = Depends(require_admin)):
    imports = await db.batch_imports.find({}, {"_id": 0}).sort("imported_at", -1).to_list(100)
    return imports

# ============== BRAND ROUTES ==============
@api_router.get("/brands")
async def get_brands(
    status: Optional[str] = None,
    pipeline_stage: Optional[str] = None,
    assigned_to: Optional[str] = None,
    overdue: Optional[bool] = None,
    inactive_hours: Optional[int] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user)
):
    query = {}
    
    # Searchers only see their own brands
    if user["role"] == UserRole.SEARCHER:
        query["assigned_to_user_id"] = user["id"]
    elif assigned_to:
        query["assigned_to_user_id"] = assigned_to
    
    if status:
        query["status"] = status
    if pipeline_stage:
        query["pipeline_stage"] = pipeline_stage
    if search:
        query["name_normalized"] = {"$regex": search.lower(), "$options": "i"}
    
    if overdue:
        now = datetime.now(timezone.utc).isoformat()
        query["next_action_at"] = {"$lt": now, "$ne": None}
        query["status"] = {"$nin": [BrandStatus.IN_POOL, BrandStatus.ON_HOLD, 
                                    BrandStatus.OUTCOME_APPROVED, BrandStatus.OUTCOME_DECLINED, 
                                    BrandStatus.OUTCOME_REPLIED]}
    
    if inactive_hours:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=inactive_hours)).isoformat()
        query["$or"] = [
            {"last_action_at": {"$lt": cutoff}},
            {"last_action_at": None}
        ]
        query["status"] = {"$nin": [BrandStatus.IN_POOL, BrandStatus.ON_HOLD]}
    
    total = await db.brands.count_documents(query)
    skip = (page - 1) * limit
    
    brands = await db.brands.find(query, {"_id": 0}).sort([
        ("priority_score", -1),
        ("created_at", 1)
    ]).skip(skip).limit(limit).to_list(limit)
    
    # Add nickname and items count
    for brand in brands:
        if brand.get("assigned_to_user_id"):
            assigned_user = await db.users.find_one({"id": brand["assigned_to_user_id"]}, {"nickname": 1})
            brand["assigned_to_nickname"] = assigned_user["nickname"] if assigned_user else None
        else:
            brand["assigned_to_nickname"] = None
        
        brand["items_count"] = await db.brand_items.count_documents({"brand_id": brand["id"]})
    
    return {
        "brands": brands,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

@api_router.get("/brands/{brand_id}", response_model=BrandDetailResponse)
async def get_brand_detail(brand_id: str, user: dict = Depends(get_current_user)):
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    # Searchers can only view their own brands
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    
    # Get assigned user nickname
    if brand.get("assigned_to_user_id"):
        assigned_user = await db.users.find_one({"id": brand["assigned_to_user_id"]}, {"nickname": 1})
        brand["assigned_to_nickname"] = assigned_user["nickname"] if assigned_user else None
    else:
        brand["assigned_to_nickname"] = None
    
    brand["items_count"] = await db.brand_items.count_documents({"brand_id": brand_id})
    
    items = await db.brand_items.find({"brand_id": brand_id}, {"_id": 0}).to_list(10)
    notes = await db.brand_notes.find({"brand_id": brand_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    events = await db.brand_events.find({"brand_id": brand_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Add user nicknames to notes and events
    for note in notes:
        note_user = await db.users.find_one({"id": note["user_id"]}, {"nickname": 1})
        note["user_nickname"] = note_user["nickname"] if note_user else "Unknown"
    
    for event in events:
        event_user = await db.users.find_one({"id": event["user_id"]}, {"nickname": 1})
        event["user_nickname"] = event_user["nickname"] if event_user else "Unknown"
    
    return BrandDetailResponse(
        brand=BrandResponse(**brand),
        items=[BrandItemResponse(**i) for i in items],
        notes=notes,
        events=events
    )

@api_router.post("/brands/claim")
async def claim_brands(user: dict = Depends(get_current_user)):
    """Получить пакет брендов (до 100)"""
    if user["role"] != UserRole.SEARCHER:
        raise HTTPException(status_code=403, detail="Только сёрчеры могут получать бренды")
    
    # Atomic assignment using findAndModify equivalent
    assigned_brands = []
    now = datetime.now(timezone.utc).isoformat()
    
    for _ in range(100):
        brand = await db.brands.find_one_and_update(
            {"status": BrandStatus.IN_POOL, "assigned_to_user_id": None},
            {"$set": {
                "status": BrandStatus.ASSIGNED,
                "assigned_to_user_id": user["id"],
                "assigned_at": now,
                "pipeline_stage": PipelineStage.REVIEW,
                "updated_at": now
            }},
            sort=[("priority_score", -1), ("created_at", 1)],
            return_document=True
        )
        if not brand:
            break
        assigned_brands.append(brand["id"])
    
    if assigned_brands:
        await log_event(EventType.BRANDS_ASSIGNED, user["id"], metadata={"count": len(assigned_brands)})
    
    return {"status": "success", "count": len(assigned_brands)}

@api_router.post("/brands/{brand_id}/stage")
async def complete_stage(brand_id: str, req: StageCompleteRequest, user: dict = Depends(get_current_user)):
    """Завершить этап воронки"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    valid_stages = [PipelineStage.EMAIL_1_DONE, PipelineStage.EMAIL_2_DONE, 
                    PipelineStage.MULTI_CHANNEL_DONE, PipelineStage.CALL_OR_PUSH_RECOMMENDED]
    if req.stage not in valid_stages:
        raise HTTPException(status_code=400, detail="Неверный этап")
    
    settings = await get_settings()
    now = datetime.now(timezone.utc)
    next_action = calculate_next_action(req.stage, settings)
    
    update_data = {
        "pipeline_stage": req.stage,
        "status": BrandStatus.IN_WORK,
        "last_action_at": now.isoformat(),
        "next_action_at": next_action.isoformat() if next_action else None,
        "updated_at": now.isoformat()
    }
    
    # Start funnel if not started
    if not brand.get("funnel_started_at") and req.stage != PipelineStage.REVIEW:
        update_data["funnel_started_at"] = now.isoformat()
    
    await db.brands.update_one({"id": brand_id}, {"$set": update_data})
    
    # Add note
    note = {
        "id": str(uuid.uuid4()),
        "brand_id": brand_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": NoteType.STAGE_DONE,
        "stage": req.stage,
        "created_at": now.isoformat()
    }
    await db.brand_notes.insert_one(note)
    
    await log_event(EventType.STAGE_COMPLETED, user["id"], brand_id, {"stage": req.stage})
    
    return {"status": "success"}

@api_router.post("/brands/{brand_id}/outcome")
async def set_outcome(brand_id: str, req: OutcomeRequest, user: dict = Depends(get_current_user)):
    """Установить исход"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    valid_outcomes = [BrandStatus.OUTCOME_APPROVED, BrandStatus.OUTCOME_DECLINED, BrandStatus.OUTCOME_REPLIED]
    if req.outcome not in valid_outcomes:
        raise HTTPException(status_code=400, detail="Неверный исход")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.brands.update_one({"id": brand_id}, {"$set": {
        "status": req.outcome,
        "pipeline_stage": PipelineStage.CLOSED,
        "next_action_at": None,
        "last_action_at": now,
        "updated_at": now
    }})
    
    note = {
        "id": str(uuid.uuid4()),
        "brand_id": brand_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": NoteType.GENERAL,
        "outcome": req.outcome,
        "created_at": now
    }
    await db.brand_notes.insert_one(note)
    
    await log_event(EventType.STATUS_CHANGED, user["id"], brand_id, {"outcome": req.outcome})
    
    return {"status": "success"}

@api_router.post("/brands/{brand_id}/return")
async def return_to_pool(brand_id: str, req: ReturnToPoolRequest, user: dict = Depends(get_current_user)):
    """Вернуть бренд в пул"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.brands.update_one({"id": brand_id}, {"$set": {
        "status": BrandStatus.IN_POOL,
        "pipeline_stage": PipelineStage.REVIEW,
        "assigned_to_user_id": None,
        "assigned_at": None,
        "next_action_at": None,
        "updated_at": now
    }})
    
    note = {
        "id": str(uuid.uuid4()),
        "brand_id": brand_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": NoteType.RETURN_TO_POOL,
        "reason": req.reason,
        "created_at": now
    }
    await db.brand_notes.insert_one(note)
    
    await log_event(EventType.RETURNED_TO_POOL, user["id"], brand_id, {"reason": req.reason})
    
    return {"status": "success"}

@api_router.post("/brands/{brand_id}/problematic")
async def mark_problematic(brand_id: str, req: MarkProblematicRequest, user: dict = Depends(get_current_user)):
    """Пометить как проблемный"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.brands.update_one({"id": brand_id}, {"$set": {
        "status": BrandStatus.PROBLEMATIC,
        "last_action_at": now,
        "updated_at": now
    }})
    
    note = {
        "id": str(uuid.uuid4()),
        "brand_id": brand_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": NoteType.PROBLEMATIC,
        "reason": req.reason,
        "created_at": now
    }
    await db.brand_notes.insert_one(note)
    
    await log_event(EventType.MARKED_PROBLEMATIC, user["id"], brand_id, {"reason": req.reason})
    
    return {"status": "success"}

@api_router.post("/brands/{brand_id}/on-hold")
async def mark_on_hold(brand_id: str, req: MarkOnHoldRequest, user: dict = Depends(get_current_user)):
    """Пометить как ON_HOLD"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.brands.update_one({"id": brand_id}, {"$set": {
        "status": BrandStatus.ON_HOLD,
        "on_hold_reason": req.reason,
        "on_hold_review_date": req.review_date,
        "last_action_at": now,
        "updated_at": now
    }})
    
    note = {
        "id": str(uuid.uuid4()),
        "brand_id": brand_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": NoteType.ON_HOLD,
        "reason": req.reason,
        "review_date": req.review_date,
        "created_at": now
    }
    await db.brand_notes.insert_one(note)
    
    await log_event(EventType.MARKED_ON_HOLD, user["id"], brand_id, {"reason": req.reason, "review_date": req.review_date})
    
    return {"status": "success"}

@api_router.put("/brands/{brand_id}/info")
async def update_brand_info(brand_id: str, req: UpdateBrandInfoRequest, user: dict = Depends(get_current_user)):
    """Обновить информацию о бренде"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    update_data = {k: v for k, v in req.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.brands.update_one({"id": brand_id}, {"$set": update_data})
    
    return {"status": "success"}

@api_router.post("/brands/{brand_id}/note")
async def add_note(brand_id: str, req: BrandNoteCreate, user: dict = Depends(get_current_user)):
    """Добавить заметку"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    # Admins can add notes to any brand, searchers only to their own
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    note_type = NoteType.ADMIN_NOTE if user["role"] == UserRole.ADMIN else req.note_type
    
    note = {
        "id": str(uuid.uuid4()),
        "brand_id": brand_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": note_type,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.brand_notes.insert_one(note)
    
    return {"status": "success"}

# ============== ADMIN BRAND ACTIONS ==============
@api_router.post("/admin/brands/{brand_id}/release")
async def admin_release_brand(brand_id: str, reason: str = Body(..., embed=True), admin: dict = Depends(require_admin)):
    """Админ: освободить бренд"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    old_user_id = brand.get("assigned_to_user_id")
    now = datetime.now(timezone.utc).isoformat()
    
    await db.brands.update_one({"id": brand_id}, {"$set": {
        "status": BrandStatus.IN_POOL,
        "pipeline_stage": PipelineStage.REVIEW,
        "assigned_to_user_id": None,
        "assigned_at": None,
        "next_action_at": None,
        "updated_at": now
    }})
    
    await log_event(EventType.ADMIN_RELEASED, admin["id"], brand_id, {
        "reason": reason,
        "previous_user_id": old_user_id
    })
    
    return {"status": "success"}

@api_router.post("/admin/brands/{brand_id}/reassign")
async def admin_reassign_brand(brand_id: str, req: ReassignBrandRequest, admin: dict = Depends(require_admin)):
    """Админ: переназначить бренд"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    new_user = await db.users.find_one({"id": req.new_user_id}, {"_id": 0})
    if not new_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    old_user_id = brand.get("assigned_to_user_id")
    now = datetime.now(timezone.utc).isoformat()
    
    await db.brands.update_one({"id": brand_id}, {"$set": {
        "assigned_to_user_id": req.new_user_id,
        "assigned_at": now,
        "status": BrandStatus.ASSIGNED if brand["status"] == BrandStatus.IN_POOL else brand["status"],
        "updated_at": now
    }})
    
    await log_event(EventType.REASSIGNED, admin["id"], brand_id, {
        "reason": req.reason,
        "previous_user_id": old_user_id,
        "new_user_id": req.new_user_id
    })
    
    return {"status": "success"}

@api_router.post("/admin/brands/bulk-release")
async def admin_bulk_release(brand_ids: List[str] = Body(...), reason: str = Body(...), admin: dict = Depends(require_admin)):
    """Админ: массовое освобождение"""
    now = datetime.now(timezone.utc).isoformat()
    result = await db.brands.update_many(
        {"id": {"$in": brand_ids}},
        {"$set": {
            "status": BrandStatus.IN_POOL,
            "pipeline_stage": PipelineStage.REVIEW,
            "assigned_to_user_id": None,
            "assigned_at": None,
            "next_action_at": None,
            "updated_at": now
        }}
    )
    
    await log_event(EventType.ADMIN_RELEASED, admin["id"], metadata={
        "reason": reason,
        "count": result.modified_count
    })
    
    return {"status": "success", "count": result.modified_count}

# ============== DASHBOARD ==============
@api_router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(admin: dict = Depends(require_admin)):
    total = await db.brands.count_documents({})
    in_pool = await db.brands.count_documents({"status": BrandStatus.IN_POOL})
    assigned = await db.brands.count_documents({"status": {"$ne": BrandStatus.IN_POOL}})
    
    now = datetime.now(timezone.utc).isoformat()
    overdue = await db.brands.count_documents({
        "next_action_at": {"$lt": now, "$ne": None},
        "status": {"$nin": [BrandStatus.IN_POOL, BrandStatus.ON_HOLD, 
                           BrandStatus.OUTCOME_APPROVED, BrandStatus.OUTCOME_DECLINED, 
                           BrandStatus.OUTCOME_REPLIED]}
    })
    
    # Brands by status
    pipeline_status = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.brands.aggregate(pipeline_status).to_list(100)
    brands_by_status = {s["_id"]: s["count"] for s in status_counts}
    
    # Brands by stage
    pipeline_stage = [
        {"$group": {"_id": "$pipeline_stage", "count": {"$sum": 1}}}
    ]
    stage_counts = await db.brands.aggregate(pipeline_stage).to_list(100)
    brands_by_stage = {s["_id"]: s["count"] for s in stage_counts}
    
    # Searchers activity
    searchers = await db.users.find({"role": UserRole.SEARCHER}, {"_id": 0}).to_list(100)
    searchers_activity = []
    
    for s in searchers:
        assigned_count = await db.brands.count_documents({"assigned_to_user_id": s["id"]})
        overdue_count = await db.brands.count_documents({
            "assigned_to_user_id": s["id"],
            "next_action_at": {"$lt": now, "$ne": None},
            "status": {"$nin": [BrandStatus.ON_HOLD, BrandStatus.OUTCOME_APPROVED, 
                               BrandStatus.OUTCOME_DECLINED, BrandStatus.OUTCOME_REPLIED]}
        })
        
        # Calculate activity status
        last_seen = s.get("last_seen_at")
        if last_seen:
            last_seen_dt = datetime.fromisoformat(last_seen.replace('Z', '+00:00'))
            minutes_ago = (datetime.now(timezone.utc) - last_seen_dt).total_seconds() / 60
            if minutes_ago < 15:
                activity_status = "online"
            elif minutes_ago < 60:
                activity_status = "idle"
            else:
                activity_status = "offline"
        else:
            activity_status = "offline"
        
        # Count cleared brands (anti-abuse)
        cleared_count = await db.brand_events.count_documents({
            "user_id": s["id"],
            "event_type": EventType.RETURNED_TO_POOL
        })
        
        searchers_activity.append({
            "id": s["id"],
            "nickname": s["nickname"],
            "assigned_count": assigned_count,
            "overdue_count": overdue_count,
            "cleared_count": cleared_count,
            "activity_status": activity_status,
            "last_seen_at": s.get("last_seen_at"),
            "work_hours": f"{s.get('work_hours_start', '09:00')} - {s.get('work_hours_end', '18:00')}"
        })
    
    return DashboardResponse(
        total_brands=total,
        brands_in_pool=in_pool,
        brands_assigned=assigned,
        brands_overdue=overdue,
        brands_by_status=brands_by_status,
        brands_by_stage=brands_by_stage,
        searchers_activity=searchers_activity
    )

# ============== SETTINGS ==============
@api_router.get("/settings")
async def get_settings_endpoint(admin: dict = Depends(require_admin)):
    return await get_settings()

@api_router.put("/settings")
async def update_settings(settings_data: SettingsUpdate, admin: dict = Depends(require_admin)):
    update_dict = {k: v for k, v in settings_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    await db.settings.update_one({"id": "global"}, {"$set": update_dict}, upsert=True)
    return await get_settings()

# ============== EXPORT ==============
@api_router.get("/export/brands")
async def export_brands(
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    admin: dict = Depends(require_admin)
):
    query = {}
    if status:
        query["status"] = status
    if assigned_to:
        query["assigned_to_user_id"] = assigned_to
    
    brands = await db.brands.find(query, {"_id": 0}).to_list(10000)
    
    # Get items for each brand
    for brand in brands:
        items = await db.brand_items.find({"brand_id": brand["id"]}, {"_id": 0}).to_list(10)
        brand["items"] = items
        
        if brand.get("assigned_to_user_id"):
            user = await db.users.find_one({"id": brand["assigned_to_user_id"]}, {"nickname": 1})
            brand["assigned_to_nickname"] = user["nickname"] if user else None
    
    return brands

# ============== INIT DATA ==============
@api_router.post("/init")
async def init_data():
    """Initialize admin user if not exists"""
    admin = await db.users.find_one({"email": "admin@procto13.com"})
    if not admin:
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@procto13.com",
            "password": "admin123",
            "secret_code": "PROCTO13",
            "nickname": "Admin",
            "role": UserRole.ADMIN,
            "status": "active",
            "work_hours_start": "09:00",
            "work_hours_end": "18:00",
            "last_seen_at": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        return {"status": "created", "admin_email": "admin@procto13.com", "password": "admin123", "secret_code": "PROCTO13"}
    return {"status": "exists"}

# Root route
@api_router.get("/")
async def root():
    return {"message": "PROCTO 13 Brand Management API"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
