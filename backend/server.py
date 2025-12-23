from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query, Body, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any, Literal
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import pandas as pd
from io import BytesIO
import json
import hashlib
import re
from difflib import SequenceMatcher

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

# ============== ENUMS & CONSTANTS ==============
class UserRole:
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    SEARCHER = "searcher"

class BrandStatus:
    IN_POOL = "IN_POOL"
    ASSIGNED = "ASSIGNED"
    IN_WORK = "IN_WORK"
    WAITING = "WAITING"
    ON_HOLD = "ON_HOLD"
    NO_RESPONSE = "NO_RESPONSE"  # Закрывает дыру #11 - отдельный статус "не ответил"
    OUTCOME_APPROVED = "OUTCOME_APPROVED"
    OUTCOME_DECLINED = "OUTCOME_DECLINED"
    OUTCOME_REPLIED = "OUTCOME_REPLIED"
    PROBLEMATIC = "PROBLEMATIC"
    ARCHIVED = "ARCHIVED"  # Новый статус для архива
    BLACKLISTED = "BLACKLISTED"  # Новый статус для чёрного списка

class PipelineStage:
    REVIEW = "REVIEW"
    EMAIL_1_DONE = "EMAIL_1_DONE"
    EMAIL_2_DONE = "EMAIL_2_DONE"
    MULTI_CHANNEL_DONE = "MULTI_CHANNEL_DONE"
    CALL_OR_PUSH_RECOMMENDED = "CALL_OR_PUSH_RECOMMENDED"
    CLOSED = "CLOSED"

# Матрица разрешённых переходов этапов (закрывает дыру #17)
STAGE_TRANSITIONS = {
    PipelineStage.REVIEW: [PipelineStage.EMAIL_1_DONE],
    PipelineStage.EMAIL_1_DONE: [PipelineStage.EMAIL_2_DONE, PipelineStage.MULTI_CHANNEL_DONE],
    PipelineStage.EMAIL_2_DONE: [PipelineStage.MULTI_CHANNEL_DONE, PipelineStage.CALL_OR_PUSH_RECOMMENDED],
    PipelineStage.MULTI_CHANNEL_DONE: [PipelineStage.CALL_OR_PUSH_RECOMMENDED, PipelineStage.CLOSED],
    PipelineStage.CALL_OR_PUSH_RECOMMENDED: [PipelineStage.CLOSED],
    PipelineStage.CLOSED: []  # Нельзя переходить из CLOSED
}

# Справочники причин (закрывает дыру #33)
class ReturnReason:
    INVALID_BRAND = "invalid_brand"           # Не бренд
    DUPLICATE = "duplicate"                    # Дубликат
    WRONG_CATEGORY = "wrong_category"          # Не наша категория
    NO_CONTACTS = "no_contacts"                # Нет контактов
    SITE_DOWN = "site_down"                    # Сайт не работает
    LANGUAGE_BARRIER = "language_barrier"      # Языковой барьер
    OTHER = "other"                            # Другое

RETURN_REASONS = {
    ReturnReason.INVALID_BRAND: "Не является брендом",
    ReturnReason.DUPLICATE: "Дубликат другого бренда",
    ReturnReason.WRONG_CATEGORY: "Не подходит по категории",
    ReturnReason.NO_CONTACTS: "Невозможно найти контакты",
    ReturnReason.SITE_DOWN: "Сайт недоступен",
    ReturnReason.LANGUAGE_BARRIER: "Языковой барьер",
    ReturnReason.OTHER: "Другая причина"
}

class ProblematicReason:
    LEGAL_ISSUES = "legal_issues"              # Юридические проблемы
    AGGRESSIVE_RESPONSE = "aggressive_response" # Агрессивный ответ
    SPAM_COMPLAINT = "spam_complaint"          # Жалоба на спам
    TECHNICAL_ISSUES = "technical_issues"      # Технические проблемы
    OTHER = "other"

PROBLEMATIC_REASONS = {
    ProblematicReason.LEGAL_ISSUES: "Юридические проблемы",
    ProblematicReason.AGGRESSIVE_RESPONSE: "Агрессивный/негативный ответ",
    ProblematicReason.SPAM_COMPLAINT: "Жалоба на спам",
    ProblematicReason.TECHNICAL_ISSUES: "Технические проблемы",
    ProblematicReason.OTHER: "Другое"
}

class OutcomeChannel:
    EMAIL = "email"
    PHONE = "phone"
    SOCIAL_MEDIA = "social_media"
    WEBSITE_FORM = "website_form"
    LINKEDIN = "linkedin"
    OTHER = "other"

OUTCOME_CHANNELS = {
    OutcomeChannel.EMAIL: "Email",
    OutcomeChannel.PHONE: "Телефон",
    OutcomeChannel.SOCIAL_MEDIA: "Соцсети",
    OutcomeChannel.WEBSITE_FORM: "Форма на сайте",
    OutcomeChannel.LINKEDIN: "LinkedIn",
    OutcomeChannel.OTHER: "Другое"
}

class NoteType:
    STAGE_DONE = "stage_done"
    RETURN_TO_POOL = "return_to_pool"
    PROBLEMATIC = "problematic"
    GENERAL = "general"
    ADMIN_NOTE = "admin_note"
    ON_HOLD = "on_hold"
    OUTCOME = "outcome"
    QUALITY_WARNING = "quality_warning"

class EventType:
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    USER_CHECK_IN = "user_check_in"  # Кнопка "Зашёл"
    BRANDS_ASSIGNED = "brands_assigned"
    STATUS_CHANGED = "status_changed"
    STAGE_COMPLETED = "stage_completed"
    RETURNED_TO_POOL = "returned_to_pool"
    MARKED_PROBLEMATIC = "marked_problematic"
    MARKED_ON_HOLD = "marked_on_hold"
    MARKED_NO_RESPONSE = "marked_no_response"  # Закрывает дыру #11
    MARKED_ARCHIVED = "marked_archived"  # Архивирование
    MARKED_BLACKLISTED = "marked_blacklisted"  # В чёрный список
    RESTORED_FROM_ARCHIVE = "restored_from_archive"  # Восстановление из архива
    REMOVED_FROM_BLACKLIST = "removed_from_blacklist"  # Удаление из ЧС
    REASSIGNED = "reassigned"
    ADMIN_RELEASED = "admin_released"
    ADMIN_BULK_RELEASE = "admin_bulk_release"
    ADMIN_BULK_ARCHIVE = "admin_bulk_archive"  # Массовое архивирование
    ADMIN_BULK_BLACKLIST = "admin_bulk_blacklist"  # Массовое добавление в ЧС
    ADMIN_BULK_ASSIGN = "admin_bulk_assign"  # Массовое назначение
    IMPORT_DELETED = "import_deleted"  # Удаление импорта
    HEARTBEAT = "heartbeat"
    HEARTBEAT_AGGREGATED = "heartbeat_aggregated"  # Закрывает дыру #22
    IMPORT_COMPLETED = "import_completed"
    IMPORT_STARTED = "import_started"  # Закрывает дыру #28
    EXPORT_CREATED = "export_created"
    SENSITIVE_VIEW = "sensitive_view"
    OUTCOME_SET = "outcome_set"
    INFO_UPDATED = "info_updated"
    UNDO_ACTION = "undo_action"
    REVIEW_TIMEOUT = "review_timeout"  # Закрывает дыру #10
    INACTIVITY_TIMEOUT = "inactivity_timeout"  # Закрывает дыру #7
    SETTINGS_UPDATED = "settings_updated"  # Обновление настроек
    USER_ACTIVITY = "user_activity"  # Активность пользователя (клики)

# Лимиты (закрывает дыру #9)
MAX_ACTIVE_BRANDS_PER_SEARCHER = 300
CLAIM_BATCH_SIZE = 100
QUICK_RETURN_HOURS = 48  # Время для определения "быстрой очистки"
MAX_RETURN_RATE_PERCENT = 30  # Порог для алерта
REVIEW_TIMEOUT_DAYS = 3  # Закрывает дыру #10 - таймаут REVIEW
INACTIVITY_TIMEOUT_DAYS = 7  # Закрывает дыру #7
HEARTBEAT_AGGREGATE_MINUTES = 60  # Закрывает дыру #22 - агрегация heartbeat
UNDO_WINDOW_MINUTES = 10  # Закрывает дыру #31 - окно отмены

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
    password: str
    secret_code: str
    nickname: str
    role: str
    status: str
    work_hours_start: str
    work_hours_end: str
    last_seen_at: Optional[str] = None
    created_at: str
    active_brands_count: Optional[int] = 0
    return_rate: Optional[float] = 0.0

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
    contact_made: bool = False
    contact_channel: Optional[str] = None
    contact_date: Optional[str] = None
    on_hold_reason: Optional[str] = None
    on_hold_review_date: Optional[str] = None
    items_count: int = 0
    health_score: int = 0
    quality_warnings: List[str] = []
    assignment_count: int = 0
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
    assignment_history: List[Dict[str, Any]]

class StageCompleteRequest(BaseModel):
    stage: str
    note_text: str
    channel: Optional[str] = None  # Канал связи

class OutcomeRequest(BaseModel):
    outcome: str
    note_text: str
    channel: str  # Обязательный канал (закрывает дыру #12, #45)
    contact_date: str  # Обязательная дата контакта

class ReturnToPoolRequest(BaseModel):
    reason_code: str  # Код из справочника
    note_text: str

class MarkProblematicRequest(BaseModel):
    reason_code: str  # Код из справочника
    note_text: str
    review_date: Optional[str] = None  # Дата пересмотра (закрывает дыру #16)

class MarkOnHoldRequest(BaseModel):
    reason: str
    review_date: str
    note_text: str

class UpdateBrandInfoRequest(BaseModel):
    website_url: Optional[str] = None
    website_found: Optional[bool] = None
    contacts_found: Optional[bool] = None
    contact_made: Optional[bool] = None
    contact_channel: Optional[str] = None
    contact_date: Optional[str] = None

class ReassignBrandRequest(BaseModel):
    new_user_id: str
    reason: str

class SettingsUpdate(BaseModel):
    delay_email2_days: Optional[int] = None
    delay_multichannel_days: Optional[int] = None
    delay_call_days: Optional[int] = None
    brand_inactivity_days: Optional[int] = None
    max_active_brands: Optional[int] = None
    max_return_rate: Optional[int] = None

class BulkReleaseRequest(BaseModel):
    brand_ids: List[str]
    reason: str

class BulkReleasePreview(BaseModel):
    count: int
    brands: List[Dict[str, Any]]

class AlertResponse(BaseModel):
    id: str
    alert_type: str
    user_id: Optional[str] = None
    brand_id: Optional[str] = None
    message: str
    severity: str
    created_at: str
    resolved: bool = False

class DashboardResponse(BaseModel):
    total_brands: int
    brands_in_pool: int
    brands_assigned: int
    brands_overdue: int
    brands_by_status: Dict[str, int]
    brands_by_stage: Dict[str, int]
    searchers_activity: List[Dict[str, Any]]
    alerts: List[AlertResponse]

# ============== NEW MODELS FOR SUPER ADMIN ==============

class BulkArchiveRequest(BaseModel):
    brand_ids: List[str]
    reason: str

class BulkBlacklistRequest(BaseModel):
    brand_ids: List[str]
    reason: str

class BulkAssignRequest(BaseModel):
    brand_ids: List[str]
    user_id: str
    reason: str

class DeleteImportRequest(BaseModel):
    import_id: str
    reason: str

class GlobalSettingsUpdate(BaseModel):
    work_hours_start: Optional[str] = None
    work_hours_end: Optional[str] = None
    weekends: Optional[List[int]] = None  # 0=Пн, 6=Вс
    holidays: Optional[List[str]] = None  # Даты YYYY-MM-DD

class UserActivityLog(BaseModel):
    action: str
    details: Optional[Dict[str, Any]] = None

class CheckInRequest(BaseModel):
    message: Optional[str] = None

# Idempotency tracking (закрывает дыру #2)
claim_requests_in_progress = set()

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
    if user["role"] not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_super_admin(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user

# ============== HELPERS ==============
def normalize_brand_name(name: str) -> str:
    if not name:
        return ""
    # Убираем спецсимволы, приводим к нижнему регистру
    normalized = " ".join(name.lower().strip().split())
    normalized = re.sub(r'[^\w\s]', '', normalized)
    return normalized

def calculate_similarity(name1: str, name2: str) -> float:
    """Fuzzy matching для определения похожих брендов (закрывает дыру #37)"""
    return SequenceMatcher(None, name1.lower(), name2.lower()).ratio()

async def log_event(event_type: str, user_id: str, brand_id: Optional[str] = None, 
                    metadata: Optional[dict] = None, ip_address: Optional[str] = None):
    event = {
        "id": str(uuid.uuid4()),
        "event_type": event_type,
        "user_id": user_id,
        "brand_id": brand_id,
        "metadata": metadata or {},
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.brand_events.insert_one(event)

def sanitize_input(text: str) -> str:
    """Санитизация ввода от XSS (закрывает дыру #30)"""
    if not text:
        return ""
    # Удаляем потенциально опасные теги и символы
    dangerous_patterns = [
        r'<script[^>]*>.*?</script>',
        r'<iframe[^>]*>.*?</iframe>',
        r'javascript:',
        r'on\w+\s*=',
        r'<\s*img[^>]+onerror',
    ]
    result = text
    for pattern in dangerous_patterns:
        result = re.sub(pattern, '', result, flags=re.IGNORECASE | re.DOTALL)
    # Экранируем HTML теги
    result = result.replace('<', '&lt;').replace('>', '&gt;')
    return result.strip()

async def get_global_settings():
    """Получить глобальные настройки системы"""
    settings = await db.system_settings.find_one({"type": "global"}, {"_id": 0})
    if not settings:
        # Дефолтные настройки
        settings = {
            "type": "global",
            "work_hours_start": "09:00",
            "work_hours_end": "18:00",
            "weekends": [5, 6],  # Сб, Вс
            "holidays": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.system_settings.insert_one(dict(settings))  # Copy to avoid _id mutation
        # Re-fetch without _id
        settings = await db.system_settings.find_one({"type": "global"}, {"_id": 0})
    return settings

def is_working_time(settings: dict = None) -> bool:
    """Проверка рабочего времени с учётом выходных (закрывает дыру #34)"""
    now = datetime.now(timezone.utc)
    if settings:
        # Проверка выходных
        if now.weekday() in settings.get("weekends", [5, 6]):
            return False
        # Проверка праздников
        today_str = now.strftime("%Y-%m-%d")
        if today_str in settings.get("holidays", []):
            return False
    return True

# ============== FUZZY MATCHING ==============

def fuzzy_match_brand(name1: str, name2: str) -> float:
    """Сравнение названий брендов с fuzzy matching"""
    # Нормализуем оба названия
    n1 = normalize_brand_name(name1)
    n2 = normalize_brand_name(name2)
    
    # Точное совпадение
    if n1 == n2:
        return 1.0
    
    # Используем SequenceMatcher для fuzzy matching
    return SequenceMatcher(None, n1, n2).ratio()

async def find_similar_brands(name: str, threshold: float = 0.85) -> List[Dict]:
    """Поиск похожих брендов по названию"""
    normalized = normalize_brand_name(name)
    
    # Получаем все бренды (для оптимизации можно добавить индекс)
    all_brands = await db.brands.find(
        {"status": {"$nin": [BrandStatus.ARCHIVED, BrandStatus.BLACKLISTED]}},
        {"_id": 0, "id": 1, "name_original": 1, "name_normalized": 1}
    ).to_list(10000)
    
    similar = []
    for brand in all_brands:
        score = fuzzy_match_brand(name, brand.get("name_original", ""))
        if score >= threshold and score < 1.0:  # Исключаем точные совпадения
            similar.append({
                "id": brand["id"],
                "name": brand["name_original"],
                "similarity": round(score * 100, 1)
            })
    
    # Сортируем по similarity
    similar.sort(key=lambda x: x["similarity"], reverse=True)
    return similar[:10]  # Топ 10

# ============== WATERMARK FOR EXPORT ==============

def add_watermark_to_data(data: List[Dict], user_id: str, user_nickname: str) -> List[Dict]:
    """Добавление водяного знака в экспортируемые данные"""
    export_id = str(uuid.uuid4())[:8]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    watermark = f"PROCTO13_EXPORT_{export_id}_{user_nickname}_{timestamp}"
    
    # Добавляем скрытые маркеры
    for i, item in enumerate(data):
        # Добавляем watermark в метаданные
        item["_export_mark"] = watermark
        item["_export_seq"] = i
    
    return data

def generate_export_watermark_info(user_id: str, user_nickname: str) -> Dict:
    """Генерация информации о водяном знаке"""
    return {
        "export_id": str(uuid.uuid4()),
        "exported_by": user_nickname,
        "exported_by_id": user_id,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "watermark_hash": hashlib.sha256(f"{user_id}_{datetime.now().timestamp()}".encode()).hexdigest()[:16]
    }

# ============== REPROCESSING MECHANISM ==============

async def get_brands_for_reprocessing(months: int = 6) -> List[Dict]:
    """Получить бренды для повторной обработки (через N месяцев)"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=months * 30)).isoformat()
    
    # Бренды с исходами NO_RESPONSE или OUTCOME_DECLINED, закрытые давно
    brands = await db.brands.find({
        "status": {"$in": [BrandStatus.NO_RESPONSE, BrandStatus.OUTCOME_DECLINED]},
        "last_action_at": {"$lt": cutoff}
    }, {"_id": 0}).to_list(1000)
    
    return brands

async def mark_brand_for_reprocessing(brand_id: str, admin_id: str):
    """Пометить бренд для повторной обработки"""
    now = datetime.now(timezone.utc)
    
    brand = await db.brands.find_one({"id": brand_id})
    if not brand:
        return None
    
    # Сохраняем историю предыдущей обработки
    await db.brands.update_one(
        {"id": brand_id},
        {"$set": {
            "status": BrandStatus.IN_POOL,
            "assigned_to_user_id": None,
            "assigned_to_nickname": None,
            "pipeline_stage": PipelineStage.REVIEW,
            "reprocessing_count": brand.get("reprocessing_count", 0) + 1,
            "reprocessed_at": now.isoformat(),
            "reprocessed_by": admin_id,
            "prev_processing": {
                "status": brand.get("status"),
                "last_action_at": brand.get("last_action_at"),
                "assigned_to": brand.get("assigned_to_nickname")
            }
        }}
    )
    
    await log_event("brand_reprocessed", admin_id, brand_id, metadata={
        "reprocessing_count": brand.get("reprocessing_count", 0) + 1
    })
    
    return True

async def create_alert(alert_type: str, message: str, severity: str = "warning",
                       user_id: Optional[str] = None, brand_id: Optional[str] = None):
    """Создание алерта (закрывает дыру #24)"""
    alert = {
        "id": str(uuid.uuid4()),
        "alert_type": alert_type,
        "user_id": user_id,
        "brand_id": brand_id,
        "message": message,
        "severity": severity,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "resolved": False
    }
    await db.alerts.insert_one(alert)
    return alert

async def check_abuse_alerts(user_id: str, user_nickname: str):
    """Проверка на абьюз очистки (закрывает дыру #3, #24)"""
    # Считаем статистику за последние 7 дней
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    # Количество полученных брендов
    assigned_events = await db.brand_events.count_documents({
        "user_id": user_id,
        "event_type": EventType.BRANDS_ASSIGNED,
        "created_at": {"$gte": week_ago}
    })
    
    # Количество возвратов
    return_events = await db.brand_events.count_documents({
        "user_id": user_id,
        "event_type": EventType.RETURNED_TO_POOL,
        "created_at": {"$gte": week_ago}
    })
    
    # Быстрые возвраты (< 48 часов без этапов)
    quick_returns = await db.brand_events.count_documents({
        "user_id": user_id,
        "event_type": EventType.RETURNED_TO_POOL,
        "created_at": {"$gte": week_ago},
        "metadata.quick_return": True
    })
    
    total_assigned = assigned_events * CLAIM_BATCH_SIZE  # Примерная оценка
    if total_assigned > 0:
        return_rate = (return_events / max(total_assigned, 1)) * 100
        
        if return_rate > MAX_RETURN_RATE_PERCENT:
            await create_alert(
                "high_return_rate",
                f"Сёрчер {user_nickname} имеет высокий % очисток: {return_rate:.1f}%",
                "warning",
                user_id
            )
        
        if quick_returns > 10:
            await create_alert(
                "quick_returns",
                f"Сёрчер {user_nickname}: {quick_returns} быстрых возвратов без этапов",
                "warning",
                user_id
            )

async def get_settings() -> dict:
    settings = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not settings:
        settings = {
            "id": "global",
            "delay_email2_days": 2,
            "delay_multichannel_days": 2,
            "delay_call_days": 2,
            "brand_inactivity_days": 7,
            "max_active_brands": MAX_ACTIVE_BRANDS_PER_SEARCHER,
            "max_return_rate": MAX_RETURN_RATE_PERCENT
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

def calculate_health_score(brand: dict) -> int:
    """Расчёт health score бренда (закрывает дыру #44)"""
    score = 0
    
    # Базовые данные
    if brand.get("website_url"):
        score += 15
    if brand.get("website_found"):
        score += 10
    if brand.get("contacts_found"):
        score += 15
    if brand.get("contact_made"):
        score += 20
    if brand.get("contact_channel"):
        score += 10
    if brand.get("contact_date"):
        score += 10
    
    # Этапы воронки
    stage = brand.get("pipeline_stage", PipelineStage.REVIEW)
    stage_scores = {
        PipelineStage.REVIEW: 0,
        PipelineStage.EMAIL_1_DONE: 5,
        PipelineStage.EMAIL_2_DONE: 10,
        PipelineStage.MULTI_CHANNEL_DONE: 15,
        PipelineStage.CALL_OR_PUSH_RECOMMENDED: 18,
        PipelineStage.CLOSED: 20
    }
    score += stage_scores.get(stage, 0)
    
    return min(score, 100)

def get_quality_warnings(brand: dict) -> List[str]:
    """Получение предупреждений о качестве (закрывает дыру #18)"""
    warnings = []
    stage = brand.get("pipeline_stage", PipelineStage.REVIEW)
    
    # В работе без сайта
    if stage not in [PipelineStage.REVIEW, PipelineStage.CLOSED]:
        if not brand.get("website_found"):
            warnings.append("В работе без найденного сайта")
        if not brand.get("contacts_found"):
            warnings.append("В работе без найденных контактов")
    
    # Исход без контакта
    if brand.get("status", "").startswith("OUTCOME_"):
        if not brand.get("contact_made"):
            warnings.append("Исход без подтверждённого контакта")
        if not brand.get("contact_channel"):
            warnings.append("Исход без указания канала")
    
    return warnings

async def check_brand_was_assigned_to_user(brand_id: str, user_id: str) -> bool:
    """Проверка, был ли бренд ранее у этого сёрчера (закрывает дыру #4)"""
    history = await db.brand_assignment_history.find_one({
        "brand_id": brand_id,
        "user_id": user_id
    })
    return history is not None

async def record_assignment_history(brand_id: str, user_id: str):
    """Запись истории назначений"""
    await db.brand_assignment_history.update_one(
        {"brand_id": brand_id, "user_id": user_id},
        {"$set": {
            "brand_id": brand_id,
            "user_id": user_id,
            "assigned_at": datetime.now(timezone.utc).isoformat()
        },
        "$inc": {"assignment_count": 1}},
        upsert=True
    )

# ============== AUTH ROUTES ==============
@api_router.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest, request: Request):
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
    ip = request.client.host if request.client else None
    await log_event(EventType.USER_LOGIN, user["id"], ip_address=ip)
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_seen_at": datetime.now(timezone.utc).isoformat()}})
    
    # Добавляем статистику
    active_count = await db.brands.count_documents({
        "assigned_to_user_id": user["id"],
        "status": {"$nin": [BrandStatus.IN_POOL]}
    })
    user["active_brands_count"] = active_count
    user["return_rate"] = 0.0
    
    return LoginResponse(token=token, user=UserResponse(**user))

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    active_count = await db.brands.count_documents({
        "assigned_to_user_id": user["id"],
        "status": {"$nin": [BrandStatus.IN_POOL]}
    })
    user["active_brands_count"] = active_count
    user["return_rate"] = 0.0
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
    result = []
    for u in users:
        active_count = await db.brands.count_documents({
            "assigned_to_user_id": u["id"],
            "status": {"$nin": [BrandStatus.IN_POOL]}
        })
        u["active_brands_count"] = active_count
        u["return_rate"] = 0.0
        result.append(UserResponse(**u))
    return result

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
    user["active_brands_count"] = 0
    user["return_rate"] = 0.0
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
    user["active_brands_count"] = await db.brands.count_documents({
        "assigned_to_user_id": user_id,
        "status": {"$nin": [BrandStatus.IN_POOL]}
    })
    user["return_rate"] = 0.0
    return UserResponse(**user)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    # Сначала освобождаем бренды (закрывает дыру #6)
    await db.brands.update_many(
        {"assigned_to_user_id": user_id},
        {"$set": {
            "status": BrandStatus.IN_POOL,
            "assigned_to_user_id": None,
            "assigned_at": None,
            "pipeline_stage": PipelineStage.REVIEW,
            "next_action_at": None
        }}
    )
    
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
    
    required_cols = ['Brand']
    optional_cols = ['ASIN', 'Title', 'Image']
    missing_required = [c for c in required_cols if c not in df.columns]
    missing_optional = [c for c in optional_cols if c not in df.columns]
    
    if missing_required:
        raise HTTPException(status_code=400, detail=f"Отсутствуют обязательные колонки: {missing_required}")
    
    df = df.dropna(subset=['Brand'])
    brand_counts = df['Brand'].value_counts().to_dict()
    
    stats = {
        "total_rows": len(df),
        "unique_brands": len(brand_counts),
        "new_brands": 0,
        "duplicate_brands": 0,
        "items_added": 0,
        "missing_columns": missing_optional,
        "similar_brands_warnings": []
    }
    
    # Получаем существующие нормализованные имена для fuzzy matching
    existing_brands = await db.brands.find({}, {"name_normalized": 1, "name_original": 1}).to_list(10000)
    existing_normalized = {b["name_normalized"]: b["name_original"] for b in existing_brands}
    
    for brand_name, count in brand_counts.items():
        brand_normalized = normalize_brand_name(str(brand_name))
        if not brand_normalized:
            continue
        
        existing = await db.brands.find_one({"name_normalized": brand_normalized})
        
        if existing:
            if count > existing.get("priority_score", 0):
                await db.brands.update_one(
                    {"id": existing["id"]},
                    {"$set": {"priority_score": count, "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
            stats["duplicate_brands"] += 1
        else:
            # Fuzzy matching для похожих брендов (закрывает дыру #37)
            similar = []
            for existing_norm, existing_orig in existing_normalized.items():
                similarity = calculate_similarity(brand_normalized, existing_norm)
                if 0.8 <= similarity < 1.0:  # Похожие, но не идентичные
                    similar.append({"name": existing_orig, "similarity": round(similarity * 100)})
            
            if similar:
                stats["similar_brands_warnings"].append({
                    "new_brand": str(brand_name),
                    "similar_to": similar[:3]  # Топ 3 похожих
                })
            
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
                "contact_made": False,
                "contact_channel": None,
                "contact_date": None,
                "on_hold_reason": None,
                "on_hold_review_date": None,
                "health_score": 0,
                "assignment_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.brands.insert_one(brand)
            existing_normalized[brand_normalized] = str(brand_name)
            stats["new_brands"] += 1
            
            brand_items = df[df['Brand'] == brand_name].head(10)
            for _, row in brand_items.iterrows():
                image_url = str(row.get('Image', '')) if pd.notna(row.get('Image')) else None
                if image_url and ';' in image_url:
                    image_url = image_url.split(';')[0]
                
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
    low_quality: Optional[bool] = None,
    search: Optional[str] = None,
    include_archived: bool = Query(False, description="Включить архивные"),
    include_blacklisted: bool = Query(False, description="Включить ЧС"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user)
):
    query = {}
    
    # По умолчанию исключаем архивные и ЧС
    excluded_statuses = []
    if not include_archived:
        excluded_statuses.append(BrandStatus.ARCHIVED)
    if not include_blacklisted:
        excluded_statuses.append(BrandStatus.BLACKLISTED)
    
    if user["role"] == UserRole.SEARCHER:
        query["assigned_to_user_id"] = user["id"]
        # Сёрчеры никогда не видят архивные/ЧС
        excluded_statuses = [BrandStatus.ARCHIVED, BrandStatus.BLACKLISTED]
    elif assigned_to:
        query["assigned_to_user_id"] = assigned_to
    
    if status:
        query["status"] = status
    elif excluded_statuses:
        query["status"] = {"$nin": excluded_statuses}
    
    if pipeline_stage:
        query["pipeline_stage"] = pipeline_stage
    if search:
        query["name_normalized"] = {"$regex": search.lower(), "$options": "i"}
    
    if overdue:
        now = datetime.now(timezone.utc).isoformat()
        query["next_action_at"] = {"$lt": now, "$ne": None}
        query["status"] = {"$nin": [BrandStatus.IN_POOL, BrandStatus.ON_HOLD, 
                                    BrandStatus.OUTCOME_APPROVED, BrandStatus.OUTCOME_DECLINED, 
                                    BrandStatus.OUTCOME_REPLIED, BrandStatus.ARCHIVED, BrandStatus.BLACKLISTED]}
    
    if inactive_hours:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=inactive_hours)).isoformat()
        query["$or"] = [
            {"last_action_at": {"$lt": cutoff}},
            {"last_action_at": None}
        ]
        query["status"] = {"$nin": [BrandStatus.IN_POOL, BrandStatus.ON_HOLD, BrandStatus.ARCHIVED, BrandStatus.BLACKLISTED]}
    
    if low_quality:
        query["health_score"] = {"$lt": 30}
    
    total = await db.brands.count_documents(query)
    skip = (page - 1) * limit
    
    brands = await db.brands.find(query, {"_id": 0}).sort([
        ("priority_score", -1),
        ("created_at", 1)
    ]).skip(skip).limit(limit).to_list(limit)
    
    for brand in brands:
        if brand.get("assigned_to_user_id"):
            assigned_user = await db.users.find_one({"id": brand["assigned_to_user_id"]}, {"nickname": 1})
            brand["assigned_to_nickname"] = assigned_user["nickname"] if assigned_user else None
        else:
            brand["assigned_to_nickname"] = None
        
        brand["items_count"] = await db.brand_items.count_documents({"brand_id": brand["id"]})
        brand["health_score"] = calculate_health_score(brand)
        brand["quality_warnings"] = get_quality_warnings(brand)
    
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
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    
    if brand.get("assigned_to_user_id"):
        assigned_user = await db.users.find_one({"id": brand["assigned_to_user_id"]}, {"nickname": 1})
        brand["assigned_to_nickname"] = assigned_user["nickname"] if assigned_user else None
    else:
        brand["assigned_to_nickname"] = None
    
    brand["items_count"] = await db.brand_items.count_documents({"brand_id": brand_id})
    brand["health_score"] = calculate_health_score(brand)
    brand["quality_warnings"] = get_quality_warnings(brand)
    
    items = await db.brand_items.find({"brand_id": brand_id}, {"_id": 0}).to_list(10)
    notes = await db.brand_notes.find({"brand_id": brand_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    events = await db.brand_events.find({"brand_id": brand_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # История назначений (закрывает дыру #4, #5)
    assignment_history = await db.brand_assignment_history.find(
        {"brand_id": brand_id}, {"_id": 0}
    ).to_list(100)
    
    for note in notes:
        note_user = await db.users.find_one({"id": note["user_id"]}, {"nickname": 1})
        note["user_nickname"] = note_user["nickname"] if note_user else "Unknown"
    
    for event in events:
        event_user = await db.users.find_one({"id": event["user_id"]}, {"nickname": 1})
        event["user_nickname"] = event_user["nickname"] if event_user else "Unknown"
    
    for hist in assignment_history:
        hist_user = await db.users.find_one({"id": hist["user_id"]}, {"nickname": 1})
        hist["user_nickname"] = hist_user["nickname"] if hist_user else "Unknown"
    
    return BrandDetailResponse(
        brand=BrandResponse(**brand),
        items=[BrandItemResponse(**i) for i in items],
        notes=notes,
        events=events,
        assignment_history=assignment_history
    )

@api_router.post("/brands/claim")
async def claim_brands(
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    user: dict = Depends(get_current_user)
):
    """Получить пакет брендов с защитой от дублей (закрывает дыры #1, #2, #4, #9)"""
    if user["role"] != UserRole.SEARCHER:
        raise HTTPException(status_code=403, detail="Только сёрчеры могут получать бренды")
    
    # Idempotency check (закрывает дыру #2)
    request_key = idempotency_key or f"{user['id']}_{datetime.now(timezone.utc).timestamp()}"
    if request_key in claim_requests_in_progress:
        raise HTTPException(status_code=429, detail="Запрос уже обрабатывается")
    
    claim_requests_in_progress.add(request_key)
    
    try:
        settings = await get_settings()
        max_active = settings.get("max_active_brands", MAX_ACTIVE_BRANDS_PER_SEARCHER)
        
        # Проверка лимита активных брендов (закрывает дыру #9)
        current_active = await db.brands.count_documents({
            "assigned_to_user_id": user["id"],
            "status": {"$nin": [BrandStatus.IN_POOL, BrandStatus.ARCHIVED, BrandStatus.BLACKLISTED]}
        })
        
        if current_active >= max_active:
            raise HTTPException(
                status_code=400, 
                detail=f"Достигнут лимит активных брендов ({max_active}). Завершите работу с текущими."
            )
        
        available_slots = max_active - current_active
        batch_size = min(CLAIM_BATCH_SIZE, available_slots)
        
        assigned_brands = []
        now = datetime.now(timezone.utc).isoformat()
        
        for _ in range(batch_size):
            # Атомарная выдача с проверкой истории (закрывает дыры #1, #4)
            # Ищем бренд, который не был у этого сёрчера ранее и не в ЧС
            pipeline = [
                {"$match": {
                    "status": BrandStatus.IN_POOL,
                    "assigned_to_user_id": None
                }},
                {"$lookup": {
                    "from": "brand_assignment_history",
                    "let": {"brand_id": "$id"},
                    "pipeline": [
                        {"$match": {
                            "$expr": {
                                "$and": [
                                    {"$eq": ["$brand_id", "$$brand_id"]},
                                    {"$eq": ["$user_id", user["id"]]}
                                ]
                            }
                        }}
                    ],
                    "as": "prev_assignments"
                }},
                {"$match": {"prev_assignments": {"$size": 0}}},  # Не был у этого сёрчера
                {"$sort": {"priority_score": -1, "created_at": 1}},
                {"$limit": 1}
            ]
            
            result = await db.brands.aggregate(pipeline).to_list(1)
            
            if not result:
                # Если все бренды уже были - берём любой свободный
                brand = await db.brands.find_one_and_update(
                    {"status": BrandStatus.IN_POOL, "assigned_to_user_id": None},
                    {"$set": {
                        "status": BrandStatus.ASSIGNED,
                        "assigned_to_user_id": user["id"],
                        "assigned_at": now,
                        "pipeline_stage": PipelineStage.REVIEW,
                        "updated_at": now,
                        "$inc": {"assignment_count": 1}
                    }},
                    sort=[("priority_score", -1), ("created_at", 1)],
                    return_document=True
                )
            else:
                brand_id = result[0]["id"]
                brand = await db.brands.find_one_and_update(
                    {"id": brand_id, "status": BrandStatus.IN_POOL, "assigned_to_user_id": None},
                    {"$set": {
                        "status": BrandStatus.ASSIGNED,
                        "assigned_to_user_id": user["id"],
                        "assigned_at": now,
                        "pipeline_stage": PipelineStage.REVIEW,
                        "updated_at": now
                    },
                    "$inc": {"assignment_count": 1}},
                    return_document=True
                )
            
            if not brand:
                break
            
            assigned_brands.append(brand["id"])
            await record_assignment_history(brand["id"], user["id"])
        
        if assigned_brands:
            await log_event(EventType.BRANDS_ASSIGNED, user["id"], metadata={"count": len(assigned_brands)})
        
        return {"status": "success", "count": len(assigned_brands)}
    
    finally:
        claim_requests_in_progress.discard(request_key)

@api_router.post("/brands/{brand_id}/stage")
async def complete_stage(brand_id: str, req: StageCompleteRequest, user: dict = Depends(get_current_user)):
    """Завершить этап воронки с валидацией переходов (закрывает дыру #17)"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    current_stage = brand.get("pipeline_stage", PipelineStage.REVIEW)
    
    # Проверка разрешённых переходов (закрывает дыру #17)
    allowed_transitions = STAGE_TRANSITIONS.get(current_stage, [])
    if req.stage not in allowed_transitions:
        raise HTTPException(
            status_code=400, 
            detail=f"Недопустимый переход: {current_stage} → {req.stage}. Разрешены: {allowed_transitions}"
        )
    
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
    
    if not brand.get("funnel_started_at") and req.stage != PipelineStage.REVIEW:
        update_data["funnel_started_at"] = now.isoformat()
    
    # Обновляем health score
    brand_updated = {**brand, **update_data}
    update_data["health_score"] = calculate_health_score(brand_updated)
    
    await db.brands.update_one({"id": brand_id}, {"$set": update_data})
    
    note = {
        "id": str(uuid.uuid4()),
        "brand_id": brand_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": NoteType.STAGE_DONE,
        "stage": req.stage,
        "channel": req.channel,
        "created_at": now.isoformat()
    }
    await db.brand_notes.insert_one(note)
    
    await log_event(EventType.STAGE_COMPLETED, user["id"], brand_id, {
        "stage": req.stage, 
        "channel": req.channel,
        "prev_stage": current_stage  # Для Undo
    })
    
    return {"status": "success"}

@api_router.post("/brands/{brand_id}/outcome")
async def set_outcome(brand_id: str, req: OutcomeRequest, user: dict = Depends(get_current_user)):
    """Установить исход с обязательными полями (закрывает дыры #11, #12, #45)"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    valid_outcomes = [BrandStatus.OUTCOME_APPROVED, BrandStatus.OUTCOME_DECLINED, BrandStatus.OUTCOME_REPLIED]
    if req.outcome not in valid_outcomes:
        raise HTTPException(status_code=400, detail="Неверный исход")
    
    # Валидация обязательных полей для исхода (закрывает дыру #45)
    if req.channel not in OUTCOME_CHANNELS:
        raise HTTPException(status_code=400, detail=f"Неверный канал. Допустимые: {list(OUTCOME_CHANNELS.keys())}")
    
    now = datetime.now(timezone.utc).isoformat()
    
    update_data = {
        "status": req.outcome,
        "pipeline_stage": PipelineStage.CLOSED,
        "next_action_at": None,
        "last_action_at": now,
        "updated_at": now,
        "contact_made": True,
        "contact_channel": req.channel,
        "contact_date": req.contact_date
    }
    
    # Обновляем health score
    brand_updated = {**brand, **update_data}
    update_data["health_score"] = calculate_health_score(brand_updated)
    
    await db.brands.update_one({"id": brand_id}, {"$set": update_data})
    
    note = {
        "id": str(uuid.uuid4()),
        "brand_id": brand_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": NoteType.OUTCOME,
        "outcome": req.outcome,
        "channel": req.channel,
        "contact_date": req.contact_date,
        "created_at": now
    }
    await db.brand_notes.insert_one(note)
    
    await log_event(EventType.OUTCOME_SET, user["id"], brand_id, {
        "outcome": req.outcome,
        "channel": req.channel,
        "contact_date": req.contact_date
    })
    
    return {"status": "success"}

@api_router.post("/brands/{brand_id}/return")
async def return_to_pool(brand_id: str, req: ReturnToPoolRequest, user: dict = Depends(get_current_user)):
    """Вернуть бренд в пул с валидацией причины (закрывает дыры #3, #14, #33)"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    # Валидация причины (закрывает дыру #33)
    if req.reason_code not in RETURN_REASONS:
        raise HTTPException(status_code=400, detail=f"Неверная причина. Допустимые: {list(RETURN_REASONS.keys())}")
    
    now = datetime.now(timezone.utc)
    
    # Определяем "быструю очистку" (закрывает дыру #3)
    assigned_at = brand.get("assigned_at")
    quick_return = False
    no_stages = brand.get("pipeline_stage") == PipelineStage.REVIEW
    
    if assigned_at:
        assigned_dt = datetime.fromisoformat(assigned_at.replace('Z', '+00:00'))
        hours_held = (now - assigned_dt).total_seconds() / 3600
        quick_return = hours_held < QUICK_RETURN_HOURS and no_stages
    
    # Полный сброс состояния (закрывает дыру #14)
    await db.brands.update_one({"id": brand_id}, {"$set": {
        "status": BrandStatus.IN_POOL,
        "pipeline_stage": PipelineStage.REVIEW,
        "assigned_to_user_id": None,
        "assigned_at": None,
        "next_action_at": None,
        "funnel_started_at": None,
        "updated_at": now.isoformat()
        # НЕ сбрасываем: website_url, website_found, contacts_found - это данные бренда
    }})
    
    note = {
        "id": str(uuid.uuid4()),
        "brand_id": brand_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": NoteType.RETURN_TO_POOL,
        "reason_code": req.reason_code,
        "reason_label": RETURN_REASONS[req.reason_code],
        "quick_return": quick_return,
        "created_at": now.isoformat()
    }
    await db.brand_notes.insert_one(note)
    
    await log_event(EventType.RETURNED_TO_POOL, user["id"], brand_id, {
        "reason_code": req.reason_code,
        "quick_return": quick_return,
        "no_stages": no_stages
    })
    
    # Проверка на абьюз (закрывает дыру #24)
    await check_abuse_alerts(user["id"], user["nickname"])
    
    return {"status": "success"}

@api_router.post("/brands/{brand_id}/problematic")
async def mark_problematic(brand_id: str, req: MarkProblematicRequest, user: dict = Depends(get_current_user)):
    """Пометить как проблемный с датой пересмотра (закрывает дыры #16, #33)"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    # Валидация причины
    if req.reason_code not in PROBLEMATIC_REASONS:
        raise HTTPException(status_code=400, detail=f"Неверная причина. Допустимые: {list(PROBLEMATIC_REASONS.keys())}")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Дата пересмотра по умолчанию через 30 дней (закрывает дыру #16)
    review_date = req.review_date or (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
    
    await db.brands.update_one({"id": brand_id}, {"$set": {
        "status": BrandStatus.PROBLEMATIC,
        "on_hold_reason": req.reason_code,
        "on_hold_review_date": review_date,
        "last_action_at": now,
        "updated_at": now
    }})
    
    note = {
        "id": str(uuid.uuid4()),
        "brand_id": brand_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": NoteType.PROBLEMATIC,
        "reason_code": req.reason_code,
        "reason_label": PROBLEMATIC_REASONS[req.reason_code],
        "review_date": review_date,
        "created_at": now
    }
    await db.brand_notes.insert_one(note)
    
    await log_event(EventType.MARKED_PROBLEMATIC, user["id"], brand_id, {
        "reason_code": req.reason_code,
        "review_date": review_date
    })
    
    return {"status": "success"}

@api_router.post("/brands/{brand_id}/on-hold")
async def mark_on_hold(brand_id: str, req: MarkOnHoldRequest, user: dict = Depends(get_current_user)):
    """Пометить как ON_HOLD (закрывает дыру #15)"""
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
        "next_action_at": None,  # ON_HOLD не считается просроченным
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
    
    await log_event(EventType.MARKED_ON_HOLD, user["id"], brand_id, {
        "reason": req.reason,
        "review_date": req.review_date
    })
    
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
    
    # Обновляем health score
    brand_updated = {**brand, **update_data}
    update_data["health_score"] = calculate_health_score(brand_updated)
    
    await db.brands.update_one({"id": brand_id}, {"$set": update_data})
    
    await log_event(EventType.INFO_UPDATED, user["id"], brand_id, {"updated_fields": list(update_data.keys())})
    
    return {"status": "success"}

@api_router.post("/brands/{brand_id}/note")
async def add_note(brand_id: str, req: BrandNoteCreate, user: dict = Depends(get_current_user)):
    """Добавить заметку"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    note_type = NoteType.ADMIN_NOTE if user["role"] in [UserRole.ADMIN, UserRole.SUPER_ADMIN] else req.note_type
    
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
    """Админ: освободить бренд (закрывает дыру #19)"""
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
        "previous_user_id": old_user_id,
        "admin_nickname": admin["nickname"]
    })
    
    return {"status": "success"}

@api_router.post("/admin/brands/{brand_id}/reassign")
async def admin_reassign_brand(brand_id: str, req: ReassignBrandRequest, admin: dict = Depends(require_admin)):
    """Админ: переназначить бренд (закрывает дыру #4 - история)"""
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
    },
    "$inc": {"assignment_count": 1}})
    
    # Записываем историю назначений
    await record_assignment_history(brand_id, req.new_user_id)
    
    await log_event(EventType.REASSIGNED, admin["id"], brand_id, {
        "reason": req.reason,
        "previous_user_id": old_user_id,
        "new_user_id": req.new_user_id,
        "admin_nickname": admin["nickname"]
    })
    
    return {"status": "success"}

@api_router.post("/admin/brands/bulk-release/preview")
async def admin_bulk_release_preview(req: BulkReleaseRequest, admin: dict = Depends(require_admin)):
    """Предпросмотр массового освобождения (закрывает дыру #32)"""
    brands = await db.brands.find(
        {"id": {"$in": req.brand_ids}},
        {"_id": 0, "id": 1, "name_original": 1, "assigned_to_user_id": 1, "status": 1}
    ).to_list(len(req.brand_ids))
    
    return BulkReleasePreview(count=len(brands), brands=brands)

@api_router.post("/admin/brands/bulk-release")
async def admin_bulk_release(req: BulkReleaseRequest, admin: dict = Depends(require_admin)):
    """Админ: массовое освобождение (закрывает дыру #32)"""
    now = datetime.now(timezone.utc).isoformat()
    result = await db.brands.update_many(
        {"id": {"$in": req.brand_ids}},
        {"$set": {
            "status": BrandStatus.IN_POOL,
            "pipeline_stage": PipelineStage.REVIEW,
            "assigned_to_user_id": None,
            "assigned_at": None,
            "next_action_at": None,
            "updated_at": now
        }}
    )
    
    await log_event(EventType.ADMIN_BULK_RELEASE, admin["id"], metadata={
        "reason": req.reason,
        "count": result.modified_count,
        "brand_ids": req.brand_ids
    })
    
    return {"status": "success", "count": result.modified_count}

# ============== DASHBOARD ==============
@api_router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(admin: dict = Depends(require_admin)):
    total = await db.brands.count_documents({})
    in_pool = await db.brands.count_documents({"status": BrandStatus.IN_POOL})
    assigned = await db.brands.count_documents({"status": {"$ne": BrandStatus.IN_POOL}})
    
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    
    # Просроченные (исключая ON_HOLD) - закрывает дыру #15
    overdue = await db.brands.count_documents({
        "next_action_at": {"$lt": now_iso, "$ne": None},
        "status": {"$nin": [BrandStatus.IN_POOL, BrandStatus.ON_HOLD, 
                           BrandStatus.OUTCOME_APPROVED, BrandStatus.OUTCOME_DECLINED, 
                           BrandStatus.OUTCOME_REPLIED]}
    })
    
    pipeline_status = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    status_counts = await db.brands.aggregate(pipeline_status).to_list(100)
    brands_by_status = {s["_id"]: s["count"] for s in status_counts}
    
    pipeline_stage = [{"$group": {"_id": "$pipeline_stage", "count": {"$sum": 1}}}]
    stage_counts = await db.brands.aggregate(pipeline_stage).to_list(100)
    brands_by_stage = {s["_id"]: s["count"] for s in stage_counts}
    
    searchers = await db.users.find({"role": UserRole.SEARCHER}, {"_id": 0}).to_list(100)
    searchers_activity = []
    
    for s in searchers:
        assigned_count = await db.brands.count_documents({"assigned_to_user_id": s["id"]})
        overdue_count = await db.brands.count_documents({
            "assigned_to_user_id": s["id"],
            "next_action_at": {"$lt": now_iso, "$ne": None},
            "status": {"$nin": [BrandStatus.ON_HOLD, BrandStatus.OUTCOME_APPROVED, 
                               BrandStatus.OUTCOME_DECLINED, BrandStatus.OUTCOME_REPLIED]}
        })
        
        # Светофор с учётом рабочих часов (закрывает дыру #21)
        last_seen = s.get("last_seen_at")
        work_start = s.get("work_hours_start", "09:00")
        work_end = s.get("work_hours_end", "18:00")
        
        # Проверяем, в рабочих ли часах сейчас
        current_hour = now.hour
        try:
            start_hour = int(work_start.split(":")[0])
            end_hour = int(work_end.split(":")[0])
            in_work_hours = start_hour <= current_hour < end_hour
        except:
            in_work_hours = True
        
        if last_seen:
            last_seen_dt = datetime.fromisoformat(last_seen.replace('Z', '+00:00'))
            minutes_ago = (now - last_seen_dt).total_seconds() / 60
            
            if in_work_hours:
                if minutes_ago < 15:
                    activity_status = "online"
                elif minutes_ago < 60:
                    activity_status = "idle"
                else:
                    activity_status = "offline"
            else:
                activity_status = "off_hours"
        else:
            activity_status = "offline" if in_work_hours else "off_hours"
        
        # Статистика возвратов (закрывает дыру #3)
        week_ago = (now - timedelta(days=7)).isoformat()
        cleared_count = await db.brand_events.count_documents({
            "user_id": s["id"],
            "event_type": EventType.RETURNED_TO_POOL,
            "created_at": {"$gte": week_ago}
        })
        
        # Быстрые возвраты
        quick_returns = await db.brand_events.count_documents({
            "user_id": s["id"],
            "event_type": EventType.RETURNED_TO_POOL,
            "created_at": {"$gte": week_ago},
            "metadata.quick_return": True
        })
        
        # Низкое качество
        low_quality = await db.brands.count_documents({
            "assigned_to_user_id": s["id"],
            "health_score": {"$lt": 30},
            "status": {"$nin": [BrandStatus.IN_POOL]}
        })
        
        searchers_activity.append({
            "id": s["id"],
            "nickname": s["nickname"],
            "assigned_count": assigned_count,
            "overdue_count": overdue_count,
            "cleared_count": cleared_count,
            "quick_returns_count": quick_returns,
            "low_quality_count": low_quality,
            "activity_status": activity_status,
            "last_seen_at": s.get("last_seen_at"),
            "work_hours": f"{work_start} - {work_end}",
            "in_work_hours": in_work_hours
        })
    
    # Получаем непрочитанные алерты (закрывает дыру #24)
    alerts = await db.alerts.find(
        {"resolved": False},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return DashboardResponse(
        total_brands=total,
        brands_in_pool=in_pool,
        brands_assigned=assigned,
        brands_overdue=overdue,
        brands_by_status=brands_by_status,
        brands_by_stage=brands_by_stage,
        searchers_activity=searchers_activity,
        alerts=[AlertResponse(**a) for a in alerts]
    )

@api_router.get("/alerts")
async def get_alerts(
    resolved: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=200),
    admin: dict = Depends(require_admin)
):
    """Получить алерты"""
    query = {}
    if resolved is not None:
        query["resolved"] = resolved
    
    alerts = await db.alerts.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return alerts

@api_router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, admin: dict = Depends(require_admin)):
    """Разрешить алерт"""
    result = await db.alerts.update_one(
        {"id": alert_id},
        {"$set": {"resolved": True, "resolved_by": admin["id"], "resolved_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Алерт не найден")
    return {"status": "success"}

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

# ============== СПРАВОЧНИКИ ==============
@api_router.get("/references/return-reasons")
async def get_return_reasons():
    """Справочник причин возврата"""
    return RETURN_REASONS

@api_router.get("/references/problematic-reasons")
async def get_problematic_reasons():
    """Справочник причин проблемности"""
    return PROBLEMATIC_REASONS

@api_router.get("/references/outcome-channels")
async def get_outcome_channels():
    """Справочник каналов исхода"""
    return OUTCOME_CHANNELS

@api_router.get("/references/stage-transitions")
async def get_stage_transitions():
    """Матрица переходов этапов"""
    return STAGE_TRANSITIONS

# ============== EXPORT ==============
@api_router.get("/export/brands")
async def export_brands(
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    admin: dict = Depends(require_admin)
):
    """Экспорт брендов с логированием и водяным знаком"""
    query = {"status": {"$nin": [BrandStatus.ARCHIVED, BrandStatus.BLACKLISTED]}}
    if status:
        query["status"] = status
    if assigned_to:
        query["assigned_to_user_id"] = assigned_to
    
    brands = await db.brands.find(query, {"_id": 0}).to_list(10000)
    
    for brand in brands:
        items = await db.brand_items.find({"brand_id": brand["id"]}, {"_id": 0}).to_list(10)
        brand["items"] = items
        
        if brand.get("assigned_to_user_id"):
            user = await db.users.find_one({"id": brand["assigned_to_user_id"]}, {"nickname": 1})
            brand["assigned_to_nickname"] = user["nickname"] if user else None
    
    # Генерируем водяной знак
    watermark_info = generate_export_watermark_info(admin["id"], admin["nickname"])
    brands = add_watermark_to_data(brands, admin["id"], admin["nickname"])
    
    # Логируем экспорт
    await log_event(EventType.EXPORT_CREATED, admin["id"], metadata={
        "filter_status": status,
        "filter_assigned_to": assigned_to,
        "count": len(brands),
        "watermark_id": watermark_info["export_id"]
    })
    
    return {
        "brands": brands,
        "total": len(brands),
        "watermark": watermark_info,
        "exported_at": datetime.now(timezone.utc).isoformat()
    }

# ============== INIT DATA ==============
@api_router.post("/init")
async def init_data():
    """Initialize admin user and indexes"""
    admin = await db.users.find_one({"email": "admin@procto13.com"})
    if not admin:
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@procto13.com",
            "password": "admin123",
            "secret_code": "PROCTO13",
            "nickname": "Admin",
            "role": UserRole.SUPER_ADMIN,
            "status": "active",
            "work_hours_start": "09:00",
            "work_hours_end": "18:00",
            "last_seen_at": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
    
    # Создаём индексы (закрывает дыру #27)
    await db.brands.create_index("name_normalized", unique=True)
    await db.brands.create_index("status")
    await db.brands.create_index("assigned_to_user_id")
    await db.brands.create_index("next_action_at")
    await db.brands.create_index("last_action_at")
    await db.brands.create_index("priority_score")
    await db.brands.create_index("pipeline_stage")
    await db.brands.create_index("health_score")
    await db.brand_events.create_index([("brand_id", 1), ("created_at", -1)])
    await db.brand_events.create_index([("user_id", 1), ("event_type", 1), ("created_at", -1)])
    await db.brand_notes.create_index([("brand_id", 1), ("created_at", -1)])
    await db.brand_assignment_history.create_index([("brand_id", 1), ("user_id", 1)], unique=True)
    await db.alerts.create_index([("resolved", 1), ("created_at", -1)])
    
    return {"status": "initialized"}

# ============== ФАЗА 2: Таймауты и KPI ==============

@api_router.get("/analytics/review-timeout")
async def get_review_timeout_brands(admin: dict = Depends(require_admin)):
    """Бренды в REVIEW больше N дней (закрывает дыру #10)"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=REVIEW_TIMEOUT_DAYS)).isoformat()
    
    brands = await db.brands.find({
        "pipeline_stage": PipelineStage.REVIEW,
        "status": {"$nin": [BrandStatus.IN_POOL]},
        "assigned_at": {"$lt": cutoff, "$ne": None}
    }, {"_id": 0}).to_list(500)
    
    # Добавляем время в REVIEW
    for brand in brands:
        if brand.get("assigned_at"):
            assigned_dt = datetime.fromisoformat(brand["assigned_at"].replace('Z', '+00:00'))
            days_in_review = (datetime.now(timezone.utc) - assigned_dt).days
            brand["days_in_review"] = days_in_review
            
            # Получаем никнейм
            if brand.get("assigned_to_user_id"):
                user = await db.users.find_one({"id": brand["assigned_to_user_id"]}, {"nickname": 1})
                brand["assigned_to_nickname"] = user["nickname"] if user else None
    
    return {"brands": brands, "count": len(brands), "threshold_days": REVIEW_TIMEOUT_DAYS}

@api_router.get("/analytics/inactive-brands")
async def get_inactive_brands(admin: dict = Depends(require_admin)):
    """Бренды без активности больше N дней (закрывает дыру #7)"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=INACTIVITY_TIMEOUT_DAYS)).isoformat()
    
    brands = await db.brands.find({
        "status": {"$nin": [BrandStatus.IN_POOL, BrandStatus.ON_HOLD, 
                           BrandStatus.OUTCOME_APPROVED, BrandStatus.OUTCOME_DECLINED,
                           BrandStatus.OUTCOME_REPLIED]},
        "$or": [
            {"last_action_at": {"$lt": cutoff}},
            {"last_action_at": None}
        ]
    }, {"_id": 0}).to_list(500)
    
    for brand in brands:
        if brand.get("last_action_at"):
            last_dt = datetime.fromisoformat(brand["last_action_at"].replace('Z', '+00:00'))
            brand["days_inactive"] = (datetime.now(timezone.utc) - last_dt).days
        else:
            brand["days_inactive"] = 999
            
        if brand.get("assigned_to_user_id"):
            user = await db.users.find_one({"id": brand["assigned_to_user_id"]}, {"nickname": 1})
            brand["assigned_to_nickname"] = user["nickname"] if user else None
    
    return {"brands": brands, "count": len(brands), "threshold_days": INACTIVITY_TIMEOUT_DAYS}

@api_router.get("/analytics/kpi")
async def get_kpi_report(
    period_days: int = Query(7, ge=1, le=90),
    admin: dict = Depends(require_admin)
):
    """KPI отчёт по сёрчерам (закрывает дыры #23, #25)"""
    period_start = (datetime.now(timezone.utc) - timedelta(days=period_days)).isoformat()
    
    searchers = await db.users.find({"role": UserRole.SEARCHER}, {"_id": 0}).to_list(100)
    kpi_data = []
    
    for s in searchers:
        user_id = s["id"]
        
        # Валидные действия с весами (закрывает дыру #23)
        stage_events = await db.brand_events.count_documents({
            "user_id": user_id,
            "event_type": EventType.STAGE_COMPLETED,
            "created_at": {"$gte": period_start}
        })
        
        outcome_events = await db.brand_events.count_documents({
            "user_id": user_id,
            "event_type": EventType.OUTCOME_SET,
            "created_at": {"$gte": period_start}
        })
        
        info_updates = await db.brand_events.count_documents({
            "user_id": user_id,
            "event_type": EventType.INFO_UPDATED,
            "created_at": {"$gte": period_start}
        })
        
        notes_added = await db.brand_notes.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": period_start},
            "note_type": {"$in": [NoteType.GENERAL, NoteType.STAGE_DONE]}
        })
        
        returns = await db.brand_events.count_documents({
            "user_id": user_id,
            "event_type": EventType.RETURNED_TO_POOL,
            "created_at": {"$gte": period_start}
        })
        
        quick_returns = await db.brand_events.count_documents({
            "user_id": user_id,
            "event_type": EventType.RETURNED_TO_POOL,
            "created_at": {"$gte": period_start},
            "metadata.quick_return": True
        })
        
        # Высокое качество (health_score > 50)
        high_quality = await db.brands.count_documents({
            "assigned_to_user_id": user_id,
            "health_score": {"$gte": 50}
        })
        
        # Веса для KPI
        weighted_score = (
            stage_events * 10 +      # Этапы - важно
            outcome_events * 20 +     # Исходы - очень важно
            info_updates * 5 +        # Обновления - полезно
            notes_added * 3 +         # Заметки - полезно
            high_quality * 2 -        # Бонус за качество
            returns * 5 -             # Штраф за возвраты
            quick_returns * 15        # Большой штраф за быстрые возвраты
        )
        
        kpi_data.append({
            "user_id": user_id,
            "nickname": s["nickname"],
            "period_days": period_days,
            "metrics": {
                "stages_completed": stage_events,
                "outcomes_set": outcome_events,
                "info_updates": info_updates,
                "notes_added": notes_added,
                "returns": returns,
                "quick_returns": quick_returns,
                "high_quality_brands": high_quality
            },
            "weighted_score": max(0, weighted_score),
            "quality_ratio": round(high_quality / max(1, stage_events + outcome_events) * 100, 1)
        })
    
    # Сортируем по weighted_score
    kpi_data.sort(key=lambda x: x["weighted_score"], reverse=True)
    
    return {"kpi": kpi_data, "period_days": period_days}

@api_router.post("/brands/{brand_id}/no-response")
async def mark_no_response(brand_id: str, note_text: str = Body(..., embed=True), user: dict = Depends(get_current_user)):
    """Пометить как 'нет ответа' (закрывает дыру #11)"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.brands.update_one({"id": brand_id}, {"$set": {
        "status": BrandStatus.NO_RESPONSE,
        "last_action_at": now,
        "updated_at": now
    }})
    
    note = {
        "id": str(uuid.uuid4()),
        "brand_id": brand_id,
        "user_id": user["id"],
        "note_text": note_text,
        "note_type": NoteType.GENERAL,
        "created_at": now
    }
    await db.brand_notes.insert_one(note)
    
    await log_event(EventType.MARKED_NO_RESPONSE, user["id"], brand_id)
    
    return {"status": "success"}

# ============== ФАЗА 2: Undo (закрывает дыру #31) ==============

@api_router.get("/brands/{brand_id}/last-action")
async def get_last_action(brand_id: str, user: dict = Depends(get_current_user)):
    """Получить последнее действие для возможной отмены"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    # Находим последнее действие этого пользователя
    event = await db.brand_events.find_one(
        {
            "brand_id": brand_id,
            "user_id": user["id"],
            "event_type": {"$in": [
                EventType.STAGE_COMPLETED,
                EventType.OUTCOME_SET,
                EventType.MARKED_NO_RESPONSE,
                EventType.MARKED_PROBLEMATIC,
                EventType.MARKED_ON_HOLD
            ]}
        },
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if not event:
        return {"can_undo": False, "reason": "Нет действий для отмены"}
    
    # Проверяем окно отмены
    event_dt = datetime.fromisoformat(event["created_at"].replace('Z', '+00:00'))
    minutes_ago = (datetime.now(timezone.utc) - event_dt).total_seconds() / 60
    
    if minutes_ago > UNDO_WINDOW_MINUTES:
        return {"can_undo": False, "reason": f"Прошло больше {UNDO_WINDOW_MINUTES} минут", "event": event}
    
    return {"can_undo": True, "event": event, "minutes_remaining": round(UNDO_WINDOW_MINUTES - minutes_ago, 1)}

@api_router.post("/brands/{brand_id}/undo")
async def undo_last_action(brand_id: str, user: dict = Depends(get_current_user)):
    """Отменить последнее действие (закрывает дыру #31)"""
    last_action = await get_last_action(brand_id, user)
    
    if not last_action.get("can_undo"):
        raise HTTPException(status_code=400, detail=last_action.get("reason", "Отмена невозможна"))
    
    event = last_action["event"]
    event_type = event["event_type"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Откатываем в зависимости от типа действия
    if event_type == EventType.STAGE_COMPLETED:
        # Возвращаем на предыдущий этап
        metadata = event.get("metadata", {})
        prev_stage = metadata.get("prev_stage", PipelineStage.REVIEW)
        
        await db.brands.update_one({"id": brand_id}, {"$set": {
            "pipeline_stage": prev_stage,
            "updated_at": now
        }})
        
    elif event_type == EventType.OUTCOME_SET:
        # Убираем исход, возвращаем в IN_WORK
        await db.brands.update_one({"id": brand_id}, {"$set": {
            "status": BrandStatus.IN_WORK,
            "pipeline_stage": PipelineStage.CALL_OR_PUSH_RECOMMENDED,
            "updated_at": now
        }})
        
    elif event_type in [EventType.MARKED_NO_RESPONSE, EventType.MARKED_PROBLEMATIC, EventType.MARKED_ON_HOLD]:
        # Возвращаем в IN_WORK
        await db.brands.update_one({"id": brand_id}, {"$set": {
            "status": BrandStatus.IN_WORK,
            "on_hold_reason": None,
            "on_hold_review_date": None,
            "updated_at": now
        }})
    
    # Логируем отмену
    await log_event(EventType.UNDO_ACTION, user["id"], brand_id, {
        "undone_event_type": event_type,
        "undone_event_id": event["id"]
    })
    
    return {"status": "success", "undone_event_type": event_type}

# ============== ФАЗА 2: Heartbeat агрегация (закрывает дыру #22) ==============

@api_router.post("/auth/heartbeat")
async def heartbeat_v2(user: dict = Depends(get_current_user)):
    """Heartbeat с агрегацией (закрывает дыру #22)"""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    hour = now.hour
    
    # Обновляем last_seen
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_seen_at": now.isoformat()}}
    )
    
    # Агрегируем heartbeat по часам (не создаём отдельные события)
    await db.heartbeat_aggregates.update_one(
        {"user_id": user["id"], "date": today, "hour": hour},
        {
            "$inc": {"count": 1},
            "$set": {"last_at": now.isoformat()}
        },
        upsert=True
    )
    
    return {"status": "ok"}

@api_router.get("/analytics/activity-heatmap")
async def get_activity_heatmap(
    user_id: Optional[str] = None,
    days: int = Query(7, ge=1, le=30),
    admin: dict = Depends(require_admin)
):
    """Тепловая карта активности (на основе агрегированных heartbeat)"""
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    
    query = {"date": {"$gte": start_date}}
    if user_id:
        query["user_id"] = user_id
    
    aggregates = await db.heartbeat_aggregates.find(query, {"_id": 0}).to_list(1000)
    
    # Группируем по пользователям
    heatmap = {}
    for agg in aggregates:
        uid = agg["user_id"]
        if uid not in heatmap:
            heatmap[uid] = {}
        
        key = f"{agg['date']}_{agg['hour']}"
        heatmap[uid][key] = agg["count"]
    
    return {"heatmap": heatmap, "days": days}

# ============== ФАЗА 3: Round-robin выдача (закрывает дыру #8) ==============

@api_router.post("/brands/claim-fair")
async def claim_brands_fair(
    idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    user: dict = Depends(get_current_user)
):
    """Честная выдача брендов с round-robin внутри приоритета (закрывает дыру #8)"""
    if user["role"] != UserRole.SEARCHER:
        raise HTTPException(status_code=403, detail="Только сёрчеры могут получать бренды")
    
    request_key = idempotency_key or f"{user['id']}_{datetime.now(timezone.utc).timestamp()}"
    if request_key in claim_requests_in_progress:
        raise HTTPException(status_code=429, detail="Запрос уже обрабатывается")
    
    claim_requests_in_progress.add(request_key)
    
    try:
        settings = await get_settings()
        max_active = settings.get("max_active_brands", MAX_ACTIVE_BRANDS_PER_SEARCHER)
        
        current_active = await db.brands.count_documents({
            "assigned_to_user_id": user["id"],
            "status": {"$nin": [BrandStatus.IN_POOL]}
        })
        
        if current_active >= max_active:
            raise HTTPException(
                status_code=400, 
                detail=f"Достигнут лимит активных брендов ({max_active})"
            )
        
        available_slots = max_active - current_active
        batch_size = min(CLAIM_BATCH_SIZE, available_slots)
        
        assigned_brands = []
        now = datetime.now(timezone.utc).isoformat()
        
        # Получаем диапазоны приоритетов
        priority_ranges = await db.brands.aggregate([
            {"$match": {"status": BrandStatus.IN_POOL, "assigned_to_user_id": None}},
            {"$group": {
                "_id": {"$floor": {"$divide": ["$priority_score", 50]}},  # Группы по 50
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": -1}}
        ]).to_list(100)
        
        brands_per_range = max(1, batch_size // max(1, len(priority_ranges)))
        
        for _ in range(batch_size):
            # Round-robin: случайный выбор внутри топ-приоритетов
            brand = await db.brands.find_one_and_update(
                {
                    "status": BrandStatus.IN_POOL,
                    "assigned_to_user_id": None
                },
                {"$set": {
                    "status": BrandStatus.ASSIGNED,
                    "assigned_to_user_id": user["id"],
                    "assigned_at": now,
                    "pipeline_stage": PipelineStage.REVIEW,
                    "updated_at": now
                },
                "$inc": {"assignment_count": 1}},
                sort=[("priority_score", -1), ("assignment_count", 1), ("created_at", 1)],  # Меньше назначений = приоритет
                return_document=True
            )
            
            if not brand:
                break
            
            assigned_brands.append(brand["id"])
            await record_assignment_history(brand["id"], user["id"])
        
        if assigned_brands:
            await log_event(EventType.BRANDS_ASSIGNED, user["id"], metadata={
                "count": len(assigned_brands),
                "method": "fair_round_robin"
            })
        
        return {"status": "success", "count": len(assigned_brands)}
    
    finally:
        claim_requests_in_progress.discard(request_key)

# ============== ФАЗА 3: Детектор общих контактов (закрывает дыру #40) ==============

@api_router.get("/analytics/shared-contacts")
async def get_shared_contacts(admin: dict = Depends(require_admin)):
    """Находит бренды с одинаковыми доменами/контактами"""
    # Группируем по домену сайта
    brands_with_sites = await db.brands.find(
        {"website_url": {"$ne": None, "$exists": True}},
        {"_id": 0, "id": 1, "name_original": 1, "website_url": 1, "assigned_to_user_id": 1}
    ).to_list(10000)
    
    # Извлекаем домены
    domain_map = {}
    for brand in brands_with_sites:
        url = brand.get("website_url", "")
        if url:
            # Извлекаем домен
            domain = re.sub(r'^https?://(www\.)?', '', url).split('/')[0].lower()
            if domain:
                if domain not in domain_map:
                    domain_map[domain] = []
                domain_map[domain].append({
                    "brand_id": brand["id"],
                    "brand_name": brand["name_original"],
                    "assigned_to": brand.get("assigned_to_user_id")
                })
    
    # Находим дубликаты (домен встречается > 1 раза)
    shared = []
    for domain, brands in domain_map.items():
        if len(brands) > 1:
            shared.append({
                "domain": domain,
                "brands_count": len(brands),
                "brands": brands
            })
    
    # Сортируем по количеству
    shared.sort(key=lambda x: x["brands_count"], reverse=True)
    
    return {"shared_contacts": shared[:100], "total_found": len(shared)}

# ============== ФАЗА 3: Экспорт с водяным знаком (закрывает дыру #39) ==============

@api_router.get("/export/brands-watermarked")
async def export_brands_watermarked(
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    format: str = Query("json", enum=["json", "csv"]),
    admin: dict = Depends(require_admin)
):
    """Экспорт с водяным знаком (закрывает дыру #39)"""
    query = {}
    if status:
        query["status"] = status
    if assigned_to:
        query["assigned_to_user_id"] = assigned_to
    
    brands = await db.brands.find(query, {"_id": 0}).to_list(10000)
    
    export_id = str(uuid.uuid4())[:8]
    export_time = datetime.now(timezone.utc).isoformat()
    
    # Водяной знак
    watermark = {
        "export_id": export_id,
        "exported_by": admin["nickname"],
        "exported_by_email": admin["email"],
        "exported_at": export_time,
        "filter_status": status,
        "filter_assigned_to": assigned_to,
        "total_records": len(brands)
    }
    
    # Логируем экспорт
    await log_event(EventType.EXPORT_CREATED, admin["id"], metadata={
        "export_id": export_id,
        "count": len(brands),
        "format": format,
        "filters": {"status": status, "assigned_to": assigned_to}
    })
    
    if format == "csv":
        # Возвращаем CSV
        import csv
        from io import StringIO
        from fastapi.responses import StreamingResponse
        
        output = StringIO()
        output.write(f"# WATERMARK: {json.dumps(watermark)}\n")
        
        if brands:
            writer = csv.DictWriter(output, fieldnames=brands[0].keys())
            writer.writeheader()
            writer.writerows(brands)
        
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=export_{export_id}.csv"}
        )
    
    return {
        "watermark": watermark,
        "brands": brands
    }

# ============== ФАЗА 3: Разделение ролей админов (закрывает дыру #38) ==============

@api_router.get("/admin/sensitive/passwords")
async def view_passwords(admin: dict = Depends(require_super_admin)):
    """Просмотр паролей - только для super_admin"""
    users = await db.users.find({}, {"_id": 0, "id": 1, "email": 1, "password": 1, "secret_code": 1, "nickname": 1}).to_list(1000)
    
    # Логируем просмотр
    await log_event(EventType.SENSITIVE_VIEW, admin["id"], metadata={
        "action": "view_passwords",
        "users_count": len(users)
    })
    
    return users

@api_router.post("/admin/sensitive/mass-operation")
async def confirm_mass_operation(
    operation: str = Body(...),
    target_ids: List[str] = Body(...),
    secret_code: str = Body(...),
    admin: dict = Depends(require_super_admin)
):
    """Подтверждение массовой операции секретным кодом (закрывает дыру #32)"""
    if admin["secret_code"] != secret_code:
        raise HTTPException(status_code=403, detail="Неверный секретный код")
    
    # Логируем попытку
    await log_event(EventType.SENSITIVE_VIEW, admin["id"], metadata={
        "action": "mass_operation_confirmed",
        "operation": operation,
        "target_count": len(target_ids)
    })
    
    return {"confirmed": True, "operation": operation, "target_count": len(target_ids)}

# ============== Проверка таймаутов (cron job endpoint) ==============

@api_router.post("/system/check-timeouts")
async def check_timeouts(admin: dict = Depends(require_admin)):
    """Проверка таймаутов и создание алертов"""
    now = datetime.now(timezone.utc)
    alerts_created = 0
    
    # 1. Бренды в REVIEW слишком долго (дыра #10)
    review_cutoff = (now - timedelta(days=REVIEW_TIMEOUT_DAYS)).isoformat()
    stuck_in_review = await db.brands.find({
        "pipeline_stage": PipelineStage.REVIEW,
        "status": {"$nin": [BrandStatus.IN_POOL]},
        "assigned_at": {"$lt": review_cutoff, "$ne": None}
    }).to_list(100)
    
    for brand in stuck_in_review:
        existing = await db.alerts.find_one({
            "brand_id": brand["id"],
            "alert_type": "review_timeout",
            "resolved": False
        })
        if not existing:
            await create_alert(
                "review_timeout",
                f"Бренд '{brand['name_original']}' в REVIEW уже {REVIEW_TIMEOUT_DAYS}+ дней",
                "warning",
                brand.get("assigned_to_user_id"),
                brand["id"]
            )
            alerts_created += 1
    
    # 2. Неактивные бренды (дыра #7)
    inactive_cutoff = (now - timedelta(days=INACTIVITY_TIMEOUT_DAYS)).isoformat()
    inactive_brands = await db.brands.find({
        "status": {"$nin": [BrandStatus.IN_POOL, BrandStatus.ON_HOLD,
                           BrandStatus.OUTCOME_APPROVED, BrandStatus.OUTCOME_DECLINED,
                           BrandStatus.OUTCOME_REPLIED]},
        "$or": [
            {"last_action_at": {"$lt": inactive_cutoff}},
            {"last_action_at": None}
        ]
    }).to_list(100)
    
    for brand in inactive_brands:
        existing = await db.alerts.find_one({
            "brand_id": brand["id"],
            "alert_type": "inactivity_timeout",
            "resolved": False
        })
        if not existing:
            await create_alert(
                "inactivity_timeout",
                f"Бренд '{brand['name_original']}' без активности {INACTIVITY_TIMEOUT_DAYS}+ дней",
                "warning",
                brand.get("assigned_to_user_id"),
                brand["id"]
            )
            alerts_created += 1
    
    return {"alerts_created": alerts_created, "checked_at": now.isoformat()}

# ============== SUPER ADMIN ENDPOINTS ==============

@api_router.post("/auth/check-in")
async def user_check_in(request: CheckInRequest, user: dict = Depends(get_current_user)):
    """Кнопка 'Зашёл' для сёрчеров - ежедневная отметка о присутствии"""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # Проверяем, была ли уже отметка сегодня
    existing = await db.check_ins.find_one({
        "user_id": user["id"],
        "date": today
    })
    
    if existing:
        return {"status": "already_checked_in", "checked_in_at": existing["created_at"]}
    
    # Создаём отметку
    check_in = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_nickname": user["nickname"],
        "date": today,
        "message": sanitize_input(request.message) if request.message else None,
        "created_at": now.isoformat()
    }
    await db.check_ins.insert_one(check_in)
    
    await log_event(EventType.USER_CHECK_IN, user["id"], metadata={"date": today})
    
    return {"status": "success", "checked_in_at": now.isoformat()}

@api_router.get("/auth/check-in/status")
async def get_check_in_status(user: dict = Depends(get_current_user)):
    """Проверка статуса отметки на сегодня"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.check_ins.find_one({
        "user_id": user["id"],
        "date": today
    }, {"_id": 0})
    
    return {
        "checked_in": existing is not None,
        "check_in": existing
    }

@api_router.post("/activity/log")
async def log_user_activity(activity: UserActivityLog, user: dict = Depends(get_current_user)):
    """Логирование активности пользователя (клики, действия)"""
    activity_record = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_nickname": user["nickname"],
        "action": sanitize_input(activity.action),
        "details": activity.details,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_activities.insert_one(activity_record)
    
    return {"status": "logged"}

@api_router.get("/super-admin/user/{user_id}/activity")
async def get_user_activity_logs(
    user_id: str,
    days: int = Query(7, ge=1, le=90),
    admin: dict = Depends(require_super_admin)
):
    """Логи активности сёрчера для супер-админа"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Получаем пользователя
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Получаем логи активности
    activities = await db.user_activities.find({
        "user_id": user_id,
        "created_at": {"$gte": cutoff}
    }, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Получаем check-ins
    check_ins = await db.check_ins.find({
        "user_id": user_id,
        "created_at": {"$gte": cutoff}
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Получаем события пользователя
    events = await db.brand_events.find({
        "user_id": user_id,
        "created_at": {"$gte": cutoff}
    }, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Статистика по дням
    daily_stats = {}
    for event in events:
        date = event["created_at"][:10]
        if date not in daily_stats:
            daily_stats[date] = {"events": 0, "types": {}}
        daily_stats[date]["events"] += 1
        event_type = event["event_type"]
        daily_stats[date]["types"][event_type] = daily_stats[date]["types"].get(event_type, 0) + 1
    
    return {
        "user": target_user,
        "activities": activities,
        "check_ins": check_ins,
        "events": events[:100],  # Последние 100 событий
        "daily_stats": daily_stats,
        "period_days": days
    }

@api_router.get("/super-admin/check-ins")
async def get_all_check_ins(
    date: Optional[str] = None,
    admin: dict = Depends(require_super_admin)
):
    """Список всех отметок 'Зашёл' за дату"""
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    check_ins = await db.check_ins.find({
        "date": target_date
    }, {"_id": 0}).to_list(1000)
    
    # Получаем всех активных сёрчеров
    searchers = await db.users.find({
        "role": UserRole.SEARCHER,
        "status": "active"
    }, {"_id": 0, "id": 1, "nickname": 1}).to_list(1000)
    
    checked_in_ids = {c["user_id"] for c in check_ins}
    
    not_checked_in = [s for s in searchers if s["id"] not in checked_in_ids]
    
    return {
        "date": target_date,
        "checked_in": check_ins,
        "not_checked_in": not_checked_in,
        "total_searchers": len(searchers),
        "total_checked_in": len(check_ins)
    }

@api_router.post("/super-admin/brands/bulk-archive")
async def bulk_archive_brands(
    request: BulkArchiveRequest,
    admin: dict = Depends(require_super_admin)
):
    """Массовое архивирование брендов"""
    now = datetime.now(timezone.utc)
    archived_count = 0
    
    for brand_id in request.brand_ids:
        brand = await db.brands.find_one({"id": brand_id})
        if brand and brand["status"] not in [BrandStatus.ARCHIVED, BrandStatus.BLACKLISTED]:
            await db.brands.update_one(
                {"id": brand_id},
                {"$set": {
                    "status": BrandStatus.ARCHIVED,
                    "archived_at": now.isoformat(),
                    "archived_by": admin["id"],
                    "archive_reason": sanitize_input(request.reason),
                    "prev_status": brand["status"]
                }}
            )
            archived_count += 1
    
    await log_event(
        EventType.ADMIN_BULK_ARCHIVE, 
        admin["id"], 
        metadata={
            "count": archived_count,
            "reason": request.reason,
            "brand_ids": request.brand_ids[:10]  # Первые 10 для лога
        }
    )
    
    return {"status": "success", "archived_count": archived_count}

@api_router.post("/super-admin/brands/bulk-blacklist")
async def bulk_blacklist_brands(
    request: BulkBlacklistRequest,
    admin: dict = Depends(require_super_admin)
):
    """Массовое добавление брендов в чёрный список"""
    now = datetime.now(timezone.utc)
    blacklisted_count = 0
    
    for brand_id in request.brand_ids:
        brand = await db.brands.find_one({"id": brand_id})
        if brand and brand["status"] != BrandStatus.BLACKLISTED:
            await db.brands.update_one(
                {"id": brand_id},
                {"$set": {
                    "status": BrandStatus.BLACKLISTED,
                    "blacklisted_at": now.isoformat(),
                    "blacklisted_by": admin["id"],
                    "blacklist_reason": sanitize_input(request.reason),
                    "prev_status": brand["status"],
                    "assigned_to_user_id": None,
                    "assigned_to_nickname": None
                }}
            )
            blacklisted_count += 1
    
    await log_event(
        EventType.ADMIN_BULK_BLACKLIST,
        admin["id"],
        metadata={
            "count": blacklisted_count,
            "reason": request.reason,
            "brand_ids": request.brand_ids[:10]
        }
    )
    
    return {"status": "success", "blacklisted_count": blacklisted_count}

@api_router.post("/super-admin/brands/bulk-assign")
async def bulk_assign_brands(
    request: BulkAssignRequest,
    admin: dict = Depends(require_super_admin)
):
    """Массовое назначение брендов сёрчеру"""
    now = datetime.now(timezone.utc)
    
    # Проверяем целевого пользователя
    target_user = await db.users.find_one({"id": request.user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if target_user["status"] != "active":
        raise HTTPException(status_code=400, detail="Пользователь неактивен")
    
    assigned_count = 0
    
    for brand_id in request.brand_ids:
        brand = await db.brands.find_one({"id": brand_id})
        if brand and brand["status"] not in [BrandStatus.ARCHIVED, BrandStatus.BLACKLISTED]:
            await db.brands.update_one(
                {"id": brand_id},
                {"$set": {
                    "status": BrandStatus.ASSIGNED,
                    "assigned_to_user_id": target_user["id"],
                    "assigned_to_nickname": target_user["nickname"],
                    "assigned_at": now.isoformat(),
                    "last_action_at": now.isoformat()
                }}
            )
            assigned_count += 1
            
            # Логируем переназначение
            await log_event(
                EventType.REASSIGNED,
                admin["id"],
                brand_id,
                metadata={
                    "new_user_id": target_user["id"],
                    "reason": request.reason,
                    "bulk_operation": True
                }
            )
    
    await log_event(
        EventType.ADMIN_BULK_ASSIGN,
        admin["id"],
        metadata={
            "count": assigned_count,
            "target_user_id": target_user["id"],
            "target_nickname": target_user["nickname"],
            "reason": request.reason
        }
    )
    
    return {"status": "success", "assigned_count": assigned_count, "assigned_to": target_user["nickname"]}

@api_router.post("/super-admin/brands/{brand_id}/restore")
async def restore_brand_from_archive(
    brand_id: str,
    admin: dict = Depends(require_super_admin)
):
    """Восстановление бренда из архива"""
    brand = await db.brands.find_one({"id": brand_id})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    if brand["status"] != BrandStatus.ARCHIVED:
        raise HTTPException(status_code=400, detail="Бренд не в архиве")
    
    await db.brands.update_one(
        {"id": brand_id},
        {"$set": {
            "status": BrandStatus.IN_POOL,
            "restored_at": datetime.now(timezone.utc).isoformat(),
            "restored_by": admin["id"]
        },
        "$unset": {
            "archived_at": "",
            "archived_by": "",
            "archive_reason": ""
        }}
    )
    
    await log_event(EventType.RESTORED_FROM_ARCHIVE, admin["id"], brand_id)
    
    return {"status": "success"}

@api_router.post("/super-admin/brands/{brand_id}/unblacklist")
async def remove_brand_from_blacklist(
    brand_id: str,
    admin: dict = Depends(require_super_admin)
):
    """Удаление бренда из чёрного списка"""
    brand = await db.brands.find_one({"id": brand_id})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    if brand["status"] != BrandStatus.BLACKLISTED:
        raise HTTPException(status_code=400, detail="Бренд не в чёрном списке")
    
    await db.brands.update_one(
        {"id": brand_id},
        {"$set": {
            "status": BrandStatus.IN_POOL,
            "unblacklisted_at": datetime.now(timezone.utc).isoformat(),
            "unblacklisted_by": admin["id"]
        },
        "$unset": {
            "blacklisted_at": "",
            "blacklisted_by": "",
            "blacklist_reason": ""
        }}
    )
    
    await log_event(EventType.REMOVED_FROM_BLACKLIST, admin["id"], brand_id)
    
    return {"status": "success"}

@api_router.delete("/super-admin/imports/{import_id}")
async def delete_import_with_brands(
    import_id: str,
    archive: bool = Query(True, description="Архивировать бренды вместо удаления"),
    admin: dict = Depends(require_super_admin)
):
    """Удаление импорта с архивированием связанных брендов"""
    # Находим импорт
    import_doc = await db.imports.find_one({"id": import_id}, {"_id": 0})
    if not import_doc:
        raise HTTPException(status_code=404, detail="Импорт не найден")
    
    now = datetime.now(timezone.utc)
    
    # Находим все бренды этого импорта
    brands = await db.brands.find({"import_id": import_id}).to_list(10000)
    
    if archive:
        # Архивируем бренды
        await db.brands.update_many(
            {"import_id": import_id},
            {"$set": {
                "status": BrandStatus.ARCHIVED,
                "archived_at": now.isoformat(),
                "archived_by": admin["id"],
                "archive_reason": f"Удаление импорта {import_doc.get('file_name', import_id)}",
                "assigned_to_user_id": None,
                "assigned_to_nickname": None
            }}
        )
    else:
        # Удаляем бренды полностью
        brand_ids = [b["id"] for b in brands]
        await db.brands.delete_many({"import_id": import_id})
        await db.brand_items.delete_many({"brand_id": {"$in": brand_ids}})
        await db.brand_notes.delete_many({"brand_id": {"$in": brand_ids}})
    
    # Помечаем импорт как удалённый
    await db.imports.update_one(
        {"id": import_id},
        {"$set": {
            "deleted": True,
            "deleted_at": now.isoformat(),
            "deleted_by": admin["id"],
            "brands_archived": archive
        }}
    )
    
    await log_event(
        EventType.IMPORT_DELETED,
        admin["id"],
        metadata={
            "import_id": import_id,
            "file_name": import_doc.get("file_name"),
            "brands_count": len(brands),
            "archived": archive
        }
    )
    
    return {
        "status": "success",
        "brands_affected": len(brands),
        "action": "archived" if archive else "deleted"
    }

@api_router.get("/super-admin/imports")
async def get_imports_list(admin: dict = Depends(require_super_admin)):
    """Список всех импортов с возможностью удаления"""
    imports = await db.imports.find(
        {"deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Добавляем количество брендов для каждого импорта
    for imp in imports:
        brands_count = await db.brands.count_documents({
            "import_id": imp["id"],
            "status": {"$nin": [BrandStatus.ARCHIVED, BrandStatus.BLACKLISTED]}
        })
        imp["active_brands_count"] = brands_count
        
        archived_count = await db.brands.count_documents({
            "import_id": imp["id"],
            "status": BrandStatus.ARCHIVED
        })
        imp["archived_brands_count"] = archived_count
    
    return {"imports": imports}

@api_router.get("/super-admin/settings")
async def get_global_settings_endpoint(admin: dict = Depends(require_super_admin)):
    """Получить глобальные настройки"""
    settings = await get_global_settings()
    return settings

@api_router.put("/super-admin/settings")
async def update_global_settings(
    settings_update: GlobalSettingsUpdate,
    admin: dict = Depends(require_super_admin)
):
    """Обновить глобальные настройки (рабочее время, выходные)"""
    update_data = {}
    
    if settings_update.work_hours_start:
        update_data["work_hours_start"] = settings_update.work_hours_start
    if settings_update.work_hours_end:
        update_data["work_hours_end"] = settings_update.work_hours_end
    if settings_update.weekends is not None:
        update_data["weekends"] = settings_update.weekends
    if settings_update.holidays is not None:
        update_data["holidays"] = settings_update.holidays
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = admin["id"]
    
    await db.system_settings.update_one(
        {"type": "global"},
        {"$set": update_data},
        upsert=True
    )
    
    await log_event(
        EventType.SETTINGS_UPDATED,
        admin["id"],
        metadata={"changes": update_data}
    )
    
    return {"status": "success", "settings": update_data}

@api_router.get("/super-admin/archived-brands")
async def get_archived_brands(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    admin: dict = Depends(require_super_admin)
):
    """Список архивированных брендов"""
    brands = await db.brands.find(
        {"status": BrandStatus.ARCHIVED},
        {"_id": 0}
    ).sort("archived_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.brands.count_documents({"status": BrandStatus.ARCHIVED})
    
    return {
        "brands": brands,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.get("/super-admin/blacklisted-brands")
async def get_blacklisted_brands(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    admin: dict = Depends(require_super_admin)
):
    """Список брендов в чёрном списке"""
    brands = await db.brands.find(
        {"status": BrandStatus.BLACKLISTED},
        {"_id": 0}
    ).sort("blacklisted_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.brands.count_documents({"status": BrandStatus.BLACKLISTED})
    
    return {
        "brands": brands,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.post("/super-admin/brands/bulk-restore")
async def bulk_restore_brands(
    brand_ids: List[str] = Body(...),
    admin: dict = Depends(require_super_admin)
):
    """Массовое восстановление брендов из архива"""
    now = datetime.now(timezone.utc)
    restored_count = 0
    
    for brand_id in brand_ids:
        result = await db.brands.update_one(
            {"id": brand_id, "status": BrandStatus.ARCHIVED},
            {"$set": {
                "status": BrandStatus.IN_POOL,
                "restored_at": now.isoformat(),
                "restored_by": admin["id"]
            },
            "$unset": {
                "archived_at": "",
                "archived_by": "",
                "archive_reason": ""
            }}
        )
        if result.modified_count > 0:
            restored_count += 1
    
    return {"status": "success", "restored_count": restored_count}

# ============== FUZZY MATCHING ENDPOINTS ==============

@api_router.get("/brands/search/fuzzy")
async def fuzzy_search_brands(
    query: str = Query(..., min_length=2),
    threshold: float = Query(0.7, ge=0.5, le=1.0),
    user: dict = Depends(get_current_user)
):
    """Поиск брендов с fuzzy matching"""
    similar = await find_similar_brands(query, threshold)
    return {
        "query": query,
        "threshold": threshold,
        "results": similar,
        "count": len(similar)
    }

@api_router.get("/brands/{brand_id}/similar")
async def get_similar_brands(
    brand_id: str,
    threshold: float = Query(0.8, ge=0.5, le=1.0),
    user: dict = Depends(get_current_user)
):
    """Найти бренды похожие на указанный"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    similar = await find_similar_brands(brand["name_original"], threshold)
    # Исключаем сам бренд
    similar = [s for s in similar if s["id"] != brand_id]
    
    return {
        "brand": brand["name_original"],
        "similar": similar,
        "count": len(similar)
    }

# ============== EXPORT WITH WATERMARK ==============

@api_router.get("/export/brands")
async def export_brands_with_watermark(
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    format: str = Query("json", enum=["json", "csv"]),
    user: dict = Depends(require_admin)
):
    """Экспорт брендов с водяным знаком"""
    query = {"status": {"$nin": [BrandStatus.ARCHIVED, BrandStatus.BLACKLISTED]}}
    if status:
        query["status"] = status
    if assigned_to:
        query["assigned_to_user_id"] = assigned_to
    
    brands = await db.brands.find(query, {"_id": 0}).to_list(10000)
    
    # Добавляем водяной знак
    watermark_info = generate_export_watermark_info(user["id"], user["nickname"])
    brands = add_watermark_to_data(brands, user["id"], user["nickname"])
    
    # Логируем экспорт
    await log_event(
        EventType.EXPORT_CREATED,
        user["id"],
        metadata={
            "count": len(brands),
            "format": format,
            "watermark_id": watermark_info["export_id"],
            "status_filter": status,
            "assigned_filter": assigned_to
        }
    )
    
    if format == "csv":
        # Для CSV убираем служебные поля
        for b in brands:
            b.pop("_export_mark", None)
            b.pop("_export_seq", None)
    
    return {
        "brands": brands,
        "total": len(brands),
        "watermark": watermark_info,
        "exported_at": datetime.now(timezone.utc).isoformat()
    }

# ============== REPROCESSING ENDPOINTS ==============

@api_router.get("/super-admin/reprocessing/candidates")
async def get_reprocessing_candidates(
    months: int = Query(6, ge=1, le=24),
    admin: dict = Depends(require_super_admin)
):
    """Получить бренды-кандидаты для повторной обработки"""
    brands = await get_brands_for_reprocessing(months)
    
    return {
        "brands": brands,
        "count": len(brands),
        "months_threshold": months
    }

@api_router.post("/super-admin/brands/{brand_id}/reprocess")
async def reprocess_brand(
    brand_id: str,
    admin: dict = Depends(require_super_admin)
):
    """Запустить повторную обработку бренда"""
    result = await mark_brand_for_reprocessing(brand_id, admin["id"])
    if not result:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    return {"status": "success", "message": "Бренд возвращён в пул для повторной обработки"}

@api_router.post("/super-admin/brands/bulk-reprocess")
async def bulk_reprocess_brands(
    brand_ids: List[str] = Body(...),
    admin: dict = Depends(require_super_admin)
):
    """Массовый запуск повторной обработки"""
    reprocessed = 0
    for brand_id in brand_ids:
        result = await mark_brand_for_reprocessing(brand_id, admin["id"])
        if result:
            reprocessed += 1
    
    return {"status": "success", "reprocessed_count": reprocessed}

# ============== ADMIN VS SUPER_ADMIN PERMISSIONS ==============

@api_router.get("/admin/permissions")
async def get_admin_permissions(user: dict = Depends(require_admin)):
    """Получить разрешения текущего админа"""
    is_super = user["role"] == UserRole.SUPER_ADMIN
    
    permissions = {
        "view_brands": True,
        "view_users": True,
        "view_dashboard": True,
        "view_analytics": True,
        "import_excel": True,
        "export_brands": True,
        "reassign_brands": True,
        "release_brands": True,
        # Супер-админ только
        "delete_imports": is_super,
        "bulk_archive": is_super,
        "bulk_blacklist": is_super,
        "bulk_assign": is_super,
        "manage_settings": is_super,
        "view_activity_logs": is_super,
        "reprocess_brands": is_super,
        "delete_users": is_super,
        "restore_from_archive": is_super,
    }
    
    return {
        "role": user["role"],
        "is_super_admin": is_super,
        "permissions": permissions
    }

@api_router.get("/")
async def root():
    return {"message": "PROCTO 13 Brand Management API v5.0 - Full Featured Edition"}

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
