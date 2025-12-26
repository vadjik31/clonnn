from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query, Body, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any, Literal
import uuid
from uuid import uuid4
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
JWT_EXPIRATION_HOURS = 48  # Увеличено с 24 до 48 часов

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
    # Подстатусы для "Ответил"
    REPLIED_NEED_ACTION = "REPLIED_NEED_ACTION"  # Ответил, нужно действие с нашей стороны
    REPLIED_NEED_SEARCHER = "REPLIED_NEED_SEARCHER"  # Ответил, надо внимание сёрчера!
    REPLIED_WAITING = "REPLIED_WAITING"  # Ответил, ожидаем от них
    REPLIED_APPROVED = "REPLIED_APPROVED"  # Ответил и одобрил
    REPLIED_DECLINED = "REPLIED_DECLINED"  # Ответил и отказал
    PROBLEMATIC = "PROBLEMATIC"
    ARCHIVED = "ARCHIVED"  # Новый статус для архива
    BLACKLISTED = "BLACKLISTED"  # Новый статус для чёрного списка

class ContactType:
    EMAIL = "email"
    PHONE = "phone"
    LINKEDIN = "linkedin"
    WEBSITE_FORM = "website_form"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    OTHER = "other"

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

# Нормализация legacy-значений этапов (ранние версии саб-сапплаеров использовали другие ключи)
LEGACY_PIPELINE_STAGE_MAP = {
    "review": PipelineStage.REVIEW,
    "letter_1": PipelineStage.EMAIL_1_DONE,
    "letter_2": PipelineStage.EMAIL_2_DONE,
    "letter_3": PipelineStage.EMAIL_2_DONE,
    "call": PipelineStage.CALL_OR_PUSH_RECOMMENDED,
    "negotiation": PipelineStage.CALL_OR_PUSH_RECOMMENDED,
    "completed": PipelineStage.CLOSED,
    "closed": PipelineStage.CLOSED,
}

def normalize_pipeline_stage(stage: Optional[str]) -> str:
    if not stage:
        return PipelineStage.REVIEW
    if stage in STAGE_TRANSITIONS:
        return stage
    mapped = LEGACY_PIPELINE_STAGE_MAP.get(stage)
    return mapped or stage

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
    STATUS_CHANGE = "status_change"

class TaskStatus:
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class TaskPriority:
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

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
    ADMIN_BULK_DELETE = "admin_bulk_delete"  # Массовое удаление
    IMPORT_DELETED = "import_deleted"  # Удаление импорта
    HEARTBEAT = "heartbeat"
    HEARTBEAT_AGGREGATED = "heartbeat_aggregated"  # Закрывает дыру #22
    IMPORT_COMPLETED = "import_completed"
    IMPORT_STARTED = "import_started"  # Закрывает дыру #28
    EXPORT_CREATED = "export_created"
    SENSITIVE_VIEW = "sensitive_view"
    OUTCOME_SET = "outcome_set"
    INFO_UPDATED = "info_updated"
    CONTACT_ADDED = "contact_added"
    NOTE_ADDED = "note_added"

# Русские названия событий для UI
EVENT_LABELS_RU = {
    "user_login": "Вошёл в систему",
    "user_logout": "Вышел из системы",
    "user_check_in": "Отметился",
    "brands_assigned": "Получил бренды",
    "status_changed": "Изменил статус",
    "stage_completed": "Завершил этап",
    "returned_to_pool": "Вернул в пул",
    "marked_problematic": "Пометил проблемным",
    "marked_on_hold": "Поставил на паузу",
    "marked_no_response": "Нет ответа",
    "marked_archived": "Архивировал",
    "marked_blacklisted": "В чёрный список",
    "restored_from_archive": "Восстановил из архива",
    "removed_from_blacklist": "Убрал из ЧС",
    "reassigned": "Переназначен",
    "admin_released": "Админ освободил",
    "admin_bulk_release": "Массовое освобождение",
    "admin_bulk_archive": "Массовая архивация",
    "admin_bulk_blacklist": "Массовый ЧС",
    "admin_bulk_assign": "Массовое назначение",
    "admin_bulk_delete": "Массовое удаление",
    "import_deleted": "Удалён импорт",
    "heartbeat": "Активность",
    "heartbeat_aggregated": "Сводка активности",
    "import_completed": "Импорт завершён",
    "import_started": "Импорт начат",
    "export_created": "Экспорт создан",
    "sensitive_view": "Просмотр данных",
    "outcome_set": "Установил исход",
    "info_updated": "Обновил информацию",
    "contact_added": "Добавил контакт",
    "note_added": "Добавил заметку"
}

# Лимиты (закрывает дыру #9)
MAX_ACTIVE_BRANDS_PER_SEARCHER = 300
CLAIM_BATCH_SIZE = 100
QUICK_RETURN_HOURS = 48  # Время для определения "быстрой очистки"
MAX_RETURN_RATE_PERCENT = 30  # Порог для алерта
REVIEW_TIMEOUT_DAYS = 3  # Закрывает дыру #10 - таймаут REVIEW
INACTIVITY_TIMEOUT_DAYS = 7  # Закрывает дыру #7
HEARTBEAT_AGGREGATE_MINUTES = 60  # Закрывает дыру #22 - агрегация heartbeat
UNDO_WINDOW_MINUTES = 10  # Закрывает дыру #31 - окно отмены


# ============== NOTIFICATION TYPES ==============
class NotificationType:
    NOTE_ADDED = "note_added"
    BRAND_ASSIGNED = "brand_assigned"
    TASK_ASSIGNED = "task_assigned"
    TASK_UPDATED = "task_updated"
    STAGE_COMPLETED = "stage_completed"
    STATUS_CHANGED = "status_changed"


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
    contacts: List[Dict[str, Any]] = []
    contacts_count: int = 0
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
    contacts: List[Dict[str, Any]] = []

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
    clear_history: bool = True  # По умолчанию очищаем историю назначений

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

# Модели для контактов бренда
class ContactInfo(BaseModel):
    contact_type: str  # email, phone, linkedin, etc.
    value: str
    is_primary: bool = False
    notes: Optional[str] = None

class AddContactRequest(BaseModel):
    contacts: List[ContactInfo]

class RepliedStatusRequest(BaseModel):
    sub_status: str  # need_action, need_searcher_attention, waiting, approved, declined
    note_text: str
    next_action_date: Optional[str] = None

# ============== SUB-SUPPLIER MODELS ==============
class SubSupplierCreate(BaseModel):
    name: str
    website_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None

class SubSupplierResponse(BaseModel):
    id: str
    parent_brand_id: str
    parent_brand_name: str
    name: str
    website_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    status: str
    pipeline_stage: str
    priority_score: int  # Наследуется от родительского бренда
    items_count: int = 0  # Наследуется от родительского бренда
    assigned_to_user_id: Optional[str] = None
    assigned_to_nickname: Optional[str] = None
    last_action_at: Optional[str] = None
    next_action_at: Optional[str] = None
    on_hold_reason: Optional[str] = None
    on_hold_review_date: Optional[str] = None
    contacts_count: int = 0
    created_at: str
    created_by_user_id: str
    created_by_nickname: Optional[str] = None
    is_sub_supplier: bool = True

class SubSupplierUpdate(BaseModel):
    name: Optional[str] = None
    website_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

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


async def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    brand_id: Optional[str] = None,
    task_id: Optional[str] = None,
    link: Optional[str] = None,
    from_user_id: Optional[str] = None
):
    """Создать уведомление для пользователя"""
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "brand_id": brand_id,
        "task_id": task_id,
        "link": link,
        "from_user_id": from_user_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    return notification


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
    # Убираем пробелы из полей ввода
    email = req.email.strip().lower()
    password = req.password.strip()
    secret_code = req.secret_code.strip().upper()
    
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    if user["password"] != password:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    if user["secret_code"].upper() != secret_code:
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
    is_super_admin = admin.get("role") == UserRole.SUPER_ADMIN
    
    for u in users:
        active_count = await db.brands.count_documents({
            "assigned_to_user_id": u["id"],
            "status": {"$nin": [BrandStatus.IN_POOL]}
        })
        u["active_brands_count"] = active_count
        u["return_rate"] = 0.0
        
        # Скрываем пароль и секретный код супер-админа от обычного админа
        if not is_super_admin and u.get("role") == UserRole.SUPER_ADMIN:
            u["password"] = "********"
            u["secret_code"] = "********"
        
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
    
    # Фильтруем бренды с менее чем 2 товарами (мусор)
    MIN_ITEMS_PER_BRAND = 2
    filtered_brand_counts = {k: v for k, v in brand_counts.items() if v >= MIN_ITEMS_PER_BRAND}
    skipped_brands = len(brand_counts) - len(filtered_brand_counts)
    
    stats = {
        "total_rows": len(df),
        "unique_brands": len(brand_counts),
        "new_brands": 0,
        "duplicate_brands": 0,
        "items_added": 0,
        "missing_columns": missing_optional,
        "similar_brands_warnings": [],
        "skipped_low_items": skipped_brands
    }
    
    # ОПТИМИЗАЦИЯ: загружаем все нормализованные имена в память ОДИН раз
    existing_brands_cursor = db.brands.find({}, {"name_normalized": 1, "name_original": 1, "id": 1, "priority_score": 1})
    existing_brands = await existing_brands_cursor.to_list(None)
    existing_normalized = {b["name_normalized"]: b for b in existing_brands}
    
    # Подготовка batch операций
    brands_to_insert = []
    items_to_insert = []
    updates_to_apply = []
    now_iso = datetime.now(timezone.utc).isoformat()
    
    for brand_name, count in filtered_brand_counts.items():
        brand_normalized = normalize_brand_name(str(brand_name))
        if not brand_normalized:
            continue
        
        # ОПТИМИЗАЦИЯ: проверка в памяти вместо запроса к БД
        existing = existing_normalized.get(brand_normalized)
        
        if existing:
            if count > existing.get("priority_score", 0):
                updates_to_apply.append({
                    "filter": {"id": existing["id"]},
                    "update": {"$set": {"priority_score": count, "updated_at": now_iso}}
                })
            stats["duplicate_brands"] += 1
        else:
            # Упрощённый fuzzy matching (только для первых 100 для скорости)
            similar = []
            check_limit = min(100, len(existing_normalized))
            for i, (existing_norm, existing_data) in enumerate(existing_normalized.items()):
                if i >= check_limit:
                    break
                similarity = calculate_similarity(brand_normalized, existing_norm)
                if 0.8 <= similarity < 1.0:
                    similar.append({"name": existing_data["name_original"], "similarity": round(similarity * 100)})
            
            if similar:
                stats["similar_brands_warnings"].append({
                    "new_brand": str(brand_name),
                    "similar_to": similar[:3]
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
                "created_at": now_iso,
                "updated_at": now_iso
            }
            brands_to_insert.append(brand)
            existing_normalized[brand_normalized] = {"name_original": str(brand_name), "id": brand_id, "priority_score": count}
            stats["new_brands"] += 1
            
            # Подготовка items для batch insert
            brand_items = df[df['Brand'] == brand_name].head(10)
            for _, row in brand_items.iterrows():
                image_url = str(row.get('Image', '')) if pd.notna(row.get('Image')) else None
                if image_url and ';' in image_url:
                    image_url = image_url.split(';')[0]
                
                items_to_insert.append({
                    "id": str(uuid.uuid4()),
                    "brand_id": brand_id,
                    "asin": str(row.get('ASIN', '')) if pd.notna(row.get('ASIN')) else None,
                    "title": str(row.get('Title', '')) if pd.notna(row.get('Title')) else None,
                    "image_url": image_url,
                    "created_at": now_iso
                })
                stats["items_added"] += 1
    
    # ОПТИМИЗАЦИЯ: Bulk insert вместо отдельных запросов
    if brands_to_insert:
        await db.brands.insert_many(brands_to_insert, ordered=False)
    
    if items_to_insert:
        await db.brand_items.insert_many(items_to_insert, ordered=False)
    
    # Batch updates для существующих брендов
    for upd in updates_to_apply:
        await db.brands.update_one(upd["filter"], upd["update"])
    
    import_record = {
        "id": str(uuid.uuid4()),
        "file_name": file.filename,
        "imported_by_user_id": admin["id"],
        "imported_by_nickname": admin["nickname"],
        "imported_at": now_iso,
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
    
    # Расширенный поиск: по названию, сайту, заметкам, контактам
    if search:
        search_lower = search.lower()
        # Получаем IDs брендов из заметок и контактов
        notes_brand_ids = await db.brand_notes.distinct(
            "brand_id",
            {"note_text": {"$regex": search, "$options": "i"}}
        )
        contacts_brand_ids = await db.brand_contacts.distinct(
            "brand_id",
            {"$or": [
                {"email": {"$regex": search, "$options": "i"}},
                {"name": {"$regex": search, "$options": "i"}},
                {"notes": {"$regex": search, "$options": "i"}}
            ]}
        )
        
        # Объединяем поиск
        query["$or"] = [
            {"name_normalized": {"$regex": search_lower, "$options": "i"}},
            {"name_original": {"$regex": search, "$options": "i"}},
            {"website_url": {"$regex": search, "$options": "i"}},
            {"id": {"$in": notes_brand_ids + contacts_brand_ids}}
        ]
    
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
        
        # Добавляем последнюю заметку и количество контактов
        last_note = await db.brand_notes.find_one(
            {"brand_id": brand["id"]},
            {"_id": 0, "note_text": 1, "created_at": 1, "note_type": 1}
        )
        if last_note:
            brand["last_note"] = last_note.get("note_text", "")[:100]  # Первые 100 символов
            brand["last_note_at"] = last_note.get("created_at")
        else:
            brand["last_note"] = None
            brand["last_note_at"] = None
        
        brand["contacts_count"] = await db.brand_contacts.count_documents({"brand_id": brand["id"]})
        brand["is_sub_supplier"] = False
        
        # Количество под-сапплаеров у бренда
        brand["sub_suppliers_count"] = await db.sub_suppliers.count_documents({"parent_brand_id": brand["id"]})
    
    # Добавляем под-сапплаеров в общий список (для админов и сёрчеров)
    ss_query = {}
    if user["role"] == UserRole.SEARCHER:
        ss_query["assigned_to_user_id"] = user["id"]
    
    if search:
        search_lower = search.lower()
        ss_query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"website_url": {"$regex": search, "$options": "i"}},
            {"contact_email": {"$regex": search, "$options": "i"}}
        ]
    
    if status:
        ss_query["status"] = status
    
    sub_suppliers = await db.sub_suppliers.find(ss_query, {"_id": 0}).to_list(100)
    
    # Обогащаем данные под-сапплаеров
    for ss in sub_suppliers:
        parent_brand = await db.brands.find_one({"id": ss["parent_brand_id"]}, {"_id": 0, "name_original": 1, "priority_score": 1})
        if parent_brand:
            ss["parent_brand_name"] = parent_brand["name_original"]
            ss["priority_score"] = parent_brand["priority_score"]
            ss["items_count"] = await db.brand_items.count_documents({"brand_id": ss["parent_brand_id"]})
        else:
            ss["parent_brand_name"] = "Unknown"
            ss["priority_score"] = 0
            ss["items_count"] = 0
        
        ss["is_sub_supplier"] = True
        ss["name_original"] = f"↳ {ss['name']}"  # Маркер что это под-сапплаер
        ss["name_normalized"] = ss["name"].lower()
        
        if ss.get("assigned_to_user_id"):
            assigned = await db.users.find_one({"id": ss["assigned_to_user_id"]}, {"nickname": 1})
            ss["assigned_to_nickname"] = assigned["nickname"] if assigned else None
        else:
            ss["assigned_to_nickname"] = None
        
        # Последняя заметка
        last_note = await db.sub_supplier_notes.find_one(
            {"sub_supplier_id": ss["id"]},
            {"_id": 0, "note_text": 1}
        )
        ss["last_note"] = last_note.get("note_text", "")[:100] if last_note else None
        ss["contacts_count"] = await db.sub_supplier_contacts.count_documents({"sub_supplier_id": ss["id"]})
        ss["sub_suppliers_count"] = 0
    
    # Объединяем и сортируем
    all_items = brands + sub_suppliers
    all_items.sort(key=lambda x: (-x.get("priority_score", 0), x.get("created_at", "")))
    
    # Пагинация для объединённого списка
    total_combined = total + len(sub_suppliers)
    
    return {
        "brands": all_items[:limit],
        "total": total_combined,
        "page": page,
        "limit": limit,
        "pages": (total_combined + limit - 1) // limit
    }

@api_router.get("/brands/{brand_id}/timeline")
async def get_brand_timeline(brand_id: str, user: dict = Depends(get_current_user)):
    """Краткая история действий с брендом для тултипа"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0, "assigned_to_user_id": 1})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    
    # Получаем последние события
    events = await db.brand_events.find(
        {"brand_id": brand_id},
        {"_id": 0, "event_type": 1, "created_at": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Получаем количество заметок и контактов
    notes_count = await db.brand_notes.count_documents({"brand_id": brand_id})
    contacts_count = await db.brand_contacts.count_documents({"brand_id": brand_id})
    
    # Формируем краткую историю с русскими названиями
    timeline = []
    for event in events:
        event_type = event.get("event_type", "unknown")
        timeline.append({
            "action": EVENT_LABELS_RU.get(event_type, event_type),
            "date": event.get("created_at", "")[:10]
        })
    
    return {
        "timeline": timeline,
        "notes_count": notes_count,
        "contacts_count": contacts_count
    }

@api_router.get("/brands/ids")
async def get_all_brand_ids(
    status: Optional[str] = None,
    pipeline_stage: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(require_admin)
):
    """Получить все ID брендов по фильтрам (для массовых действий)"""
    query = {"status": {"$nin": [BrandStatus.ARCHIVED, BrandStatus.BLACKLISTED]}}
    
    if status:
        query["status"] = status
    if pipeline_stage:
        query["pipeline_stage"] = pipeline_stage
    if assigned_to:
        query["assigned_to_user_id"] = assigned_to
    if search:
        query["name_normalized"] = {"$regex": search.lower(), "$options": "i"}
    
    brands = await db.brands.find(query, {"_id": 0, "id": 1}).to_list(10000)
    return {"ids": [b["id"] for b in brands], "total": len(brands)}

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
    
    # Контакты бренда
    contacts = await db.brand_contacts.find({"brand_id": brand_id}, {"_id": 0}).to_list(100)
    brand["contacts"] = contacts
    brand["contacts_count"] = len(contacts)
    
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
        assignment_history=assignment_history,
        contacts=contacts
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
        attempts = 0
        max_attempts = batch_size * 3  # Больше попыток на случай конкуренции
        
        while len(assigned_brands) < batch_size and attempts < max_attempts:
            attempts += 1
            
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
                {"$limit": 5}  # Берём 5 кандидатов для большей надёжности
            ]
            
            result = await db.brands.aggregate(pipeline).to_list(5)
            
            if not result:
                # Если все бренды уже были - берём любой свободный атомарно
                brand = await db.brands.find_one_and_update(
                    {"status": BrandStatus.IN_POOL, "assigned_to_user_id": None},
                    {"$set": {
                        "status": BrandStatus.ASSIGNED,
                        "assigned_to_user_id": user["id"],
                        "assigned_at": now,
                        "pipeline_stage": PipelineStage.REVIEW,
                        "updated_at": now
                    },
                    "$inc": {"assignment_count": 1}},
                    sort=[("priority_score", -1), ("created_at", 1)],
                    return_document=True
                )
                if brand:
                    assigned_brands.append(brand["id"])
                    await record_assignment_history(brand["id"], user["id"])
                else:
                    break  # Больше свободных брендов нет
            else:
                # Пытаемся захватить один из кандидатов атомарно
                for candidate in result:
                    brand_id = candidate["id"]
                    # Атомарный захват - защита от race condition
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
                    if brand:
                        assigned_brands.append(brand["id"])
                        await record_assignment_history(brand["id"], user["id"])
                        break  # Успешно захватили, переходим к следующему
        
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
    old_status = brand.get("status")
    
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
    
    # Создаем уведомление для назначенного пользователя при изменении статуса
    assigned_user_id = brand.get("assigned_to_user_id")
    if assigned_user_id and assigned_user_id != user["id"]:
        brand_name = brand.get("name_original") or brand.get("name") or "Без названия"
        status_labels = {
            BrandStatus.OUTCOME_APPROVED: "Одобрен",
            BrandStatus.OUTCOME_DECLINED: "Отказ",
            BrandStatus.OUTCOME_REPLIED: "Ответил"
        }
        status_label = status_labels.get(req.outcome, req.outcome)
        await create_notification(
            user_id=assigned_user_id,
            notification_type=NotificationType.STATUS_CHANGED,
            title="Изменение статуса",
            message=f'Статус бренда "{brand_name}" изменён на "{status_label}"',
            brand_id=brand_id,
            link=f"/brand/{brand_id}",
            from_user_id=user["id"]
        )
    
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
        "next_action_at": req.review_date,  # Дата напоминания для сёрчера
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

@api_router.post("/brands/{brand_id}/contacts")
async def add_brand_contacts(brand_id: str, req: AddContactRequest, user: dict = Depends(get_current_user)):
    """Добавить контакты бренда"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    now = datetime.now(timezone.utc)
    
    # Сохраняем контакты в отдельную коллекцию
    for contact in req.contacts:
        contact_doc = {
            "id": str(uuid.uuid4()),
            "brand_id": brand_id,
            "contact_type": sanitize_input(contact.contact_type),
            "value": sanitize_input(contact.value),
            "is_primary": contact.is_primary,
            "notes": sanitize_input(contact.notes) if contact.notes else None,
            "added_by_user_id": user["id"],
            "added_by_nickname": user["nickname"],
            "created_at": now.isoformat()
        }
        await db.brand_contacts.insert_one(contact_doc)
    
    # Обновляем флаг contacts_found
    await db.brands.update_one(
        {"id": brand_id},
        {"$set": {
            "contacts_found": True,
            "contacts_count": await db.brand_contacts.count_documents({"brand_id": brand_id}),
            "updated_at": now.isoformat()
        }}
    )
    
    await log_event(EventType.INFO_UPDATED, user["id"], brand_id, {
        "action": "contacts_added",
        "count": len(req.contacts)
    })
    
    return {"status": "success", "contacts_added": len(req.contacts)}

@api_router.get("/brands/{brand_id}/contacts")
async def get_brand_contacts(brand_id: str, user: dict = Depends(get_current_user)):
    """Получить контакты бренда"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    contacts = await db.brand_contacts.find({"brand_id": brand_id}, {"_id": 0}).to_list(100)
    
    return {"contacts": contacts, "count": len(contacts)}

@api_router.delete("/brands/{brand_id}/contacts/{contact_id}")
async def delete_brand_contact(brand_id: str, contact_id: str, user: dict = Depends(get_current_user)):
    """Удалить контакт бренда"""
    contact = await db.brand_contacts.find_one({"id": contact_id, "brand_id": brand_id})
    if not contact:
        raise HTTPException(status_code=404, detail="Контакт не найден")
    
    # Только добавивший или админ может удалить
    if user["role"] == UserRole.SEARCHER and contact.get("added_by_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Нет прав на удаление")
    
    await db.brand_contacts.delete_one({"id": contact_id})
    
    # Обновляем счётчик
    count = await db.brand_contacts.count_documents({"brand_id": brand_id})
    await db.brands.update_one(
        {"id": brand_id},
        {"$set": {
            "contacts_found": count > 0,
            "contacts_count": count
        }}
    )
    
    return {"status": "success"}

@api_router.post("/brands/{brand_id}/replied")
async def set_replied_status(brand_id: str, req: RepliedStatusRequest, user: dict = Depends(get_current_user)):
    """Установить статус 'Ответил' с подстатусом"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Бренд не закреплён за вами")
    
    now = datetime.now(timezone.utc)
    old_status = brand.get("status")
    
    # Маппинг подстатусов
    status_map = {
        "need_action": BrandStatus.REPLIED_NEED_ACTION,
        "need_searcher_attention": BrandStatus.REPLIED_NEED_SEARCHER,
        "waiting": BrandStatus.REPLIED_WAITING,
        "approved": BrandStatus.REPLIED_APPROVED,
        "declined": BrandStatus.REPLIED_DECLINED
    }
    
    new_status = status_map.get(req.sub_status, BrandStatus.OUTCOME_REPLIED)
    
    # Определяем этап
    if req.sub_status in ["approved", "declined"]:
        new_stage = PipelineStage.CLOSED
    else:
        new_stage = brand.get("pipeline_stage", PipelineStage.REVIEW)
    
    # Вычисляем next_action_at если указана дата
    next_action = None
    if req.next_action_date:
        next_action = req.next_action_date
    elif req.sub_status == "need_action":
        # По умолчанию через 2 дня
        next_action = (now + timedelta(days=2)).isoformat()
    elif req.sub_status == "need_searcher_attention":
        # Срочно - через 1 день
        next_action = (now + timedelta(days=1)).isoformat()
    elif req.sub_status == "waiting":
        # По умолчанию через 5 дней
        next_action = (now + timedelta(days=5)).isoformat()
    
    await db.brands.update_one(
        {"id": brand_id},
        {"$set": {
            "status": new_status,
            "pipeline_stage": new_stage,
            "replied_sub_status": req.sub_status,
            "last_action_at": now.isoformat(),
            "next_action_at": next_action,
            "updated_at": now.isoformat()
        }}
    )
    
    # Добавляем заметку
    note = {
        "id": str(uuid.uuid4()),
        "brand_id": brand_id,
        "user_id": user["id"],
        "note_text": sanitize_input(req.note_text),
        "note_type": NoteType.STATUS_CHANGE,
        "created_at": now.isoformat()
    }
    await db.brand_notes.insert_one(note)
    
    await log_event(EventType.OUTCOME_SET, user["id"], brand_id, {
        "status": new_status,
        "sub_status": req.sub_status,
        "prev_status": brand.get("status")
    })
    
    # Создаем уведомление для назначенного пользователя при изменении статуса
    assigned_user_id = brand.get("assigned_to_user_id")
    if assigned_user_id and assigned_user_id != user["id"]:
        brand_name = brand.get("name_original") or brand.get("name") or "Без названия"
        sub_status_labels = {
            "need_action": "Нужно действие",
            "need_searcher_attention": "Нужно внимание сёрчера",
            "waiting": "Ожидание",
            "approved": "Одобрен",
            "declined": "Отказ"
        }
        status_label = sub_status_labels.get(req.sub_status, req.sub_status)
        await create_notification(
            user_id=assigned_user_id,
            notification_type=NotificationType.STATUS_CHANGED,
            title="Изменение статуса",
            message=f'Статус бренда "{brand_name}" изменён: "{status_label}"',
            brand_id=brand_id,
            link=f"/brand/{brand_id}",
            from_user_id=user["id"]
        )
    
    return {"status": "success", "new_status": new_status, "new_stage": new_stage}

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
    
    # Создаем уведомление для назначенного пользователя (если это не он сам добавил заметку)
    assigned_user_id = brand.get("assigned_to_user_id")
    if assigned_user_id and assigned_user_id != user["id"]:
        brand_name = brand.get("name_original") or brand.get("name") or "Без названия"
        await create_notification(
            user_id=assigned_user_id,
            notification_type=NotificationType.NOTE_ADDED,
            title="Новая заметка",
            message=f'{user.get("nickname", "Пользователь")} добавил заметку к бренду "{brand_name}"',
            brand_id=brand_id,
            link=f"/brand/{brand_id}",
            from_user_id=user["id"]
        )
    
    return {"status": "success"}


@api_router.put("/brands/{brand_id}/notes/{note_id}")
async def update_brand_note(brand_id: str, note_id: str, note_text: str = Body(..., embed=True), user: dict = Depends(get_current_user)):
    """Редактировать заметку"""
    note = await db.brand_notes.find_one({"id": note_id, "brand_id": brand_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    
    # Только автор или админ может редактировать
    if note["user_id"] != user["id"] and user["role"] not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Нет прав на редактирование")
    
    await db.brand_notes.update_one(
        {"id": note_id},
        {"$set": {
            "note_text": note_text,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "success"}


@api_router.delete("/brands/{brand_id}/notes/{note_id}")
async def delete_brand_note(brand_id: str, note_id: str, user: dict = Depends(get_current_user)):
    """Удалить заметку"""
    note = await db.brand_notes.find_one({"id": note_id, "brand_id": brand_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    
    # Только автор или админ может удалять
    if note["user_id"] != user["id"] and user["role"] not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Нет прав на удаление")
    
    await db.brand_notes.delete_one({"id": note_id})
    
    return {"status": "success"}


@api_router.put("/brands/{brand_id}/contacts/{contact_id}")
async def update_brand_contact(
    brand_id: str, 
    contact_id: str, 
    contact_type: Optional[str] = Body(None),
    value: Optional[str] = Body(None),
    notes: Optional[str] = Body(None),
    is_primary: Optional[bool] = Body(None),
    user: dict = Depends(get_current_user)
):
    """Редактировать контакт"""
    contact = await db.brand_contacts.find_one({"id": contact_id, "brand_id": brand_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Контакт не найден")
    
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    # Проверка прав
    if user["role"] == UserRole.SEARCHER and brand.get("assigned_to_user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Нет прав на редактирование")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if contact_type is not None:
        update_data["contact_type"] = contact_type
    if value is not None:
        update_data["value"] = value
    if notes is not None:
        update_data["notes"] = notes
    if is_primary is not None:
        update_data["is_primary"] = is_primary
    
    await db.brand_contacts.update_one({"id": contact_id}, {"$set": update_data})
    
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
    
    # Очищаем историю назначений, чтобы бренды могли снова попасть к тем же сёрчерам
    # с учётом приоритета
    if req.clear_history:
        await db.brand_assignment_history.delete_many({"brand_id": {"$in": req.brand_ids}})
    
    await log_event(EventType.ADMIN_BULK_RELEASE, admin["id"], metadata={
        "reason": req.reason,
        "count": result.modified_count,
        "brand_ids": req.brand_ids,
        "history_cleared": req.clear_history
    })
    
    return {"status": "success", "count": result.modified_count, "history_cleared": req.clear_history}

# ============== DASHBOARD ==============
@api_router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    
    # Параллельные агрегации для основных счётчиков
    total_future = db.brands.count_documents({})
    in_pool_future = db.brands.count_documents({"status": BrandStatus.IN_POOL})
    
    overdue_future = db.brands.count_documents({
        "next_action_at": {"$lt": now_iso, "$ne": None},
        "status": {"$nin": [BrandStatus.IN_POOL, BrandStatus.ON_HOLD, 
                           BrandStatus.OUTCOME_APPROVED, BrandStatus.OUTCOME_DECLINED, 
                           BrandStatus.OUTCOME_REPLIED]}
    })
    
    # Aggregation для статусов и стадий
    status_pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    stage_pipeline = [{"$group": {"_id": "$pipeline_stage", "count": {"$sum": 1}}}]
    
    # Aggregation для сёрчеров - все данные одним запросом
    searcher_brands_pipeline = [
        {"$match": {"assigned_to_user_id": {"$ne": None}}},
        {"$group": {
            "_id": "$assigned_to_user_id",
            "assigned_count": {"$sum": 1},
            "overdue_count": {"$sum": {"$cond": [
                {"$and": [
                    {"$lt": ["$next_action_at", now_iso]},
                    {"$ne": ["$next_action_at", None]},
                    {"$not": {"$in": ["$status", [BrandStatus.ON_HOLD, BrandStatus.OUTCOME_APPROVED, 
                                                   BrandStatus.OUTCOME_DECLINED, BrandStatus.OUTCOME_REPLIED]]}}
                ]}, 1, 0
            ]}},
            "low_quality_count": {"$sum": {"$cond": [
                {"$and": [
                    {"$lt": ["$health_score", 30]},
                    {"$ne": ["$status", BrandStatus.IN_POOL]}
                ]}, 1, 0
            ]}}
        }}
    ]
    
    # Events aggregation для cleared_count и quick_returns
    events_pipeline = [
        {"$match": {
            "event_type": EventType.RETURNED_TO_POOL,
            "created_at": {"$gte": week_ago}
        }},
        {"$group": {
            "_id": "$user_id",
            "cleared_count": {"$sum": 1},
            "quick_returns": {"$sum": {"$cond": [{"$eq": ["$metadata.quick_return", True]}, 1, 0]}}
        }}
    ]
    
    # Выполняем все запросы параллельно
    today_str = now.strftime("%Y-%m-%d")
    total, in_pool, overdue, status_counts, stage_counts, searcher_brands, events_stats, searchers, alerts, today_checkins = await asyncio.gather(
        total_future,
        in_pool_future,
        overdue_future,
        db.brands.aggregate(status_pipeline).to_list(100),
        db.brands.aggregate(stage_pipeline).to_list(100),
        db.brands.aggregate(searcher_brands_pipeline).to_list(100),
        db.brand_events.aggregate(events_pipeline).to_list(100),
        db.users.find({"role": UserRole.SEARCHER}, {"_id": 0}).to_list(100),
        db.alerts.find({"resolved": False}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10),
        db.check_ins.find({"date": today_str}, {"user_id": 1}).to_list(100)
    )
    
    # Сет ID отметившихся сегодня
    checked_in_today_ids = {c["user_id"] for c in today_checkins}
    
    assigned = total - in_pool
    brands_by_status = {s["_id"]: s["count"] for s in status_counts}
    brands_by_stage = {s["_id"]: s["count"] for s in stage_counts}
    
    # Маппинг данных по сёрчерам
    searcher_brand_map = {s["_id"]: s for s in searcher_brands}
    events_map = {e["_id"]: e for e in events_stats}
    
    searchers_activity = []
    for s in searchers:
        user_id = s["id"]
        brand_data = searcher_brand_map.get(user_id, {})
        event_data = events_map.get(user_id, {})
        
        # Светофор активности
        last_seen = s.get("last_seen_at")
        work_start = s.get("work_hours_start", "09:00")
        work_end = s.get("work_hours_end", "18:00")
        
        current_hour = now.hour
        try:
            start_hour = int(work_start.split(":")[0])
            end_hour = int(work_end.split(":")[0])
            in_work_hours = start_hour <= current_hour < end_hour
        except:
            in_work_hours = True
        
        if last_seen:
            try:
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
            except:
                activity_status = "offline"
        else:
            activity_status = "offline" if in_work_hours else "off_hours"
        
        searchers_activity.append({
            "id": user_id,
            "nickname": s["nickname"],
            "assigned_count": brand_data.get("assigned_count", 0),
            "overdue_count": brand_data.get("overdue_count", 0),
            "cleared_count": event_data.get("cleared_count", 0),
            "checked_in_today": user_id in checked_in_today_ids,
            "low_quality_count": brand_data.get("low_quality_count", 0),
            "activity_status": activity_status,
            "last_seen_at": s.get("last_seen_at"),
            "work_hours": f"{work_start} - {work_end}",
            "in_work_hours": in_work_hours
        })
    
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
    await db.brands.create_index("import_id")  # Для быстрой статистики импортов
    await db.check_ins.create_index([("date", 1), ("user_id", 1)])  # Для check-ins
    # Дополнительные индексы для аналитики
    await db.brand_events.create_index([("user_id", 1), ("created_at", -1)])
    await db.brand_notes.create_index([("user_id", 1), ("created_at", -1)])
    await db.brand_contacts.create_index("brand_id")
    await db.brands.create_index([("assigned_to_user_id", 1), ("assigned_at", 1)])
    
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
    """Бренды без активности больше N дней (оптимизированная версия)"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=INACTIVITY_TIMEOUT_DAYS)).isoformat()
    
    # Запрос для подсчёта общего количества
    count_query = {
        "status": {"$nin": [BrandStatus.IN_POOL, BrandStatus.ON_HOLD, 
                           BrandStatus.OUTCOME_APPROVED, BrandStatus.OUTCOME_DECLINED,
                           BrandStatus.OUTCOME_REPLIED, BrandStatus.ARCHIVED, BrandStatus.BLACKLISTED]},
        "$or": [
            {"last_action_at": {"$lt": cutoff}},
            {"last_action_at": None}
        ]
    }
    
    # Получаем общее количество
    total_count = await db.brands.count_documents(count_query)
    
    # Используем aggregation pipeline для оптимизации (показываем только 100)
    pipeline = [
        {"$match": count_query},
        {"$limit": 100},
        {
            "$lookup": {
                "from": "users",
                "localField": "assigned_to_user_id",
                "foreignField": "id",
                "as": "assigned_user"
            }
        },
        {
            "$project": {
                "_id": 0,
                "id": 1,
                "name_original": 1,
                "last_action_at": 1,
                "assigned_to_user_id": 1,
                "assigned_to_nickname": {"$arrayElemAt": ["$assigned_user.nickname", 0]}
            }
        }
    ]
    
    brands = await db.brands.aggregate(pipeline).to_list(100)
    now = datetime.now(timezone.utc)
    
    for brand in brands:
        if brand.get("last_action_at"):
            try:
                last_dt = datetime.fromisoformat(brand["last_action_at"].replace('Z', '+00:00'))
                brand["days_inactive"] = (now - last_dt).days
            except:
                brand["days_inactive"] = 999
        else:
            brand["days_inactive"] = 999
    
    # Сортируем по дням неактивности
    brands.sort(key=lambda x: x.get("days_inactive", 0), reverse=True)
    
    return {"brands": brands, "count": total_count, "threshold_days": INACTIVITY_TIMEOUT_DAYS}

@api_router.get("/analytics/inactive-brands/all-ids")
async def get_all_inactive_brand_ids(admin: dict = Depends(require_admin)):
    """Получить все ID неактивных брендов для массового удаления"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=INACTIVITY_TIMEOUT_DAYS)).isoformat()
    
    brands = await db.brands.find(
        {
            "status": {"$nin": [BrandStatus.IN_POOL, BrandStatus.ON_HOLD, 
                               BrandStatus.OUTCOME_APPROVED, BrandStatus.OUTCOME_DECLINED,
                               BrandStatus.OUTCOME_REPLIED, BrandStatus.ARCHIVED, BrandStatus.BLACKLISTED]},
            "$or": [
                {"last_action_at": {"$lt": cutoff}},
                {"last_action_at": None}
            ]
        },
        {"id": 1, "_id": 0}
    ).to_list(50000)
    
    return {"ids": [b["id"] for b in brands], "count": len(brands)}

@api_router.get("/analytics/kpi")
async def get_kpi_report(
    period_days: int = Query(7, ge=1, le=90),
    admin: dict = Depends(require_admin)
):
    """Оптимизированный KPI отчёт по сёрчерам"""
    period_start = (datetime.now(timezone.utc) - timedelta(days=period_days)).isoformat()
    
    searchers = await db.users.find({"role": UserRole.SEARCHER}, {"_id": 0, "id": 1, "nickname": 1}).to_list(100)
    
    if not searchers:
        return {"kpi": [], "period_days": period_days}
    
    searcher_ids = [s["id"] for s in searchers]
    searcher_map = {s["id"]: s["nickname"] for s in searchers}
    
    # Агрегация всех событий за период одним запросом
    events_pipeline = [
        {"$match": {"user_id": {"$in": searcher_ids}, "created_at": {"$gte": period_start}}},
        {"$group": {
            "_id": "$user_id",
            "brand_ids": {"$addToSet": "$brand_id"},
            "outcomes": {"$sum": {"$cond": [{"$eq": ["$event_type", EventType.OUTCOME_SET]}, 1, 0]}},
            "events_count": {"$sum": 1},
            "first_event": {"$min": "$created_at"},
            "last_event": {"$max": "$created_at"}
        }}
    ]
    events_stats = {doc["_id"]: doc for doc in await db.brand_events.aggregate(events_pipeline).to_list(100)}
    
    # Получаем все brand_ids для следующих запросов
    all_brand_ids = set()
    for stats in events_stats.values():
        all_brand_ids.update(stats.get("brand_ids", []))
    all_brand_ids = list(all_brand_ids)
    
    # Агрегация контактов одним запросом
    contacts_pipeline = [
        {"$match": {"brand_id": {"$in": all_brand_ids}}},
        {"$group": {"_id": "$brand_id"}}
    ]
    brands_with_contacts = set(doc["_id"] for doc in await db.brand_contacts.aggregate(contacts_pipeline).to_list(10000))
    
    # Агрегация заметок одним запросом
    notes_pipeline = [
        {"$match": {"user_id": {"$in": searcher_ids}, "created_at": {"$gte": period_start}}},
        {"$group": {"_id": {"user_id": "$user_id", "brand_id": "$brand_id"}}}
    ]
    notes_by_user = {}
    for doc in await db.brand_notes.aggregate(notes_pipeline).to_list(10000):
        user_id = doc["_id"]["user_id"]
        if user_id not in notes_by_user:
            notes_by_user[user_id] = set()
        notes_by_user[user_id].add(doc["_id"]["brand_id"])
    
    # Мёртвые бренды - агрегация
    dead_pipeline = [
        {"$match": {"assigned_to_user_id": {"$in": searcher_ids}, "assigned_at": {"$lte": period_start}}},
        {"$group": {"_id": "$assigned_to_user_id", "brand_ids": {"$addToSet": "$id"}}}
    ]
    assigned_by_user = {doc["_id"]: set(doc["brand_ids"]) for doc in await db.brands.aggregate(dead_pipeline).to_list(100)}
    
    kpi_data = []
    for user_id, nickname in searcher_map.items():
        stats = events_stats.get(user_id, {})
        processed_ids = set(stats.get("brand_ids", []))
        brands_processed = len(processed_ids)
        
        # Контакты
        contacts_count = len(processed_ids & brands_with_contacts)
        
        # Заметки
        notes_count = len(notes_by_user.get(user_id, set()) & processed_ids)
        
        # Исходы
        outcomes = stats.get("outcomes", 0)
        
        # Мёртвые
        assigned_ids = assigned_by_user.get(user_id, set())
        dead_brands = len(assigned_ids - processed_ids) if assigned_ids else 0
        
        # Скорость (упрощённый расчёт)
        speed_per_hour = 0
        if brands_processed > 0 and stats.get("first_event") and stats.get("last_event"):
            try:
                first = stats["first_event"]
                last = stats["last_event"]
                if isinstance(first, str):
                    first = datetime.fromisoformat(first.replace("Z", "+00:00"))
                if isinstance(last, str):
                    last = datetime.fromisoformat(last.replace("Z", "+00:00"))
                hours = max((last - first).total_seconds() / 3600, 0.5)
                speed_per_hour = round(brands_processed / hours, 1)
            except:
                speed_per_hour = 0
        
        # Эффективность
        efficiency = 0
        if brands_processed > 0:
            useful_work = contacts_count + notes_count + outcomes
            efficiency = min(round((useful_work / brands_processed) * 100, 0), 200)
        
        kpi_data.append({
            "user_id": user_id,
            "nickname": nickname,
            "period_days": period_days,
            "metrics": {
                "brands_processed": brands_processed,
                "with_contacts": contacts_count,
                "with_notes": notes_count,
                "outcomes": outcomes,
                "dead_brands": dead_brands,
                "speed_per_hour": speed_per_hour
            },
            "efficiency": int(efficiency)
        })
    
    # Сортируем по эффективности
    kpi_data.sort(key=lambda x: (x["efficiency"], x["metrics"]["brands_processed"]), reverse=True)
    
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
    
    # Автоматически продлеваем токен при активности
    new_token = create_token(user["id"], user["role"])
    
    return {"status": "ok", "token": new_token}

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
@api_router.get("/admin/user/{user_id}/activity")
async def get_user_activity_logs(
    user_id: str,
    days: int = Query(7, ge=1, le=90),
    admin: dict = Depends(require_admin)
):
    """Логи активности сёрчера для админа/супер-админа"""
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
    
    # Добавляем русские названия и информацию о брендах
    enriched_events = []
    brand_ids = list(set(e.get("brand_id") for e in events if e.get("brand_id")))
    brands_map = {}
    if brand_ids:
        brands = await db.brands.find({"id": {"$in": brand_ids}}, {"_id": 0, "id": 1, "name_original": 1}).to_list(len(brand_ids))
        brands_map = {b["id"]: b.get("name_original", "Неизвестно") for b in brands}
    
    for event in events[:100]:
        event_type = event.get("event_type", "unknown")
        brand_id = event.get("brand_id")
        brand_name = brands_map.get(brand_id, "")
        
        enriched_events.append({
            **event,
            "label_ru": EVENT_LABELS_RU.get(event_type, event_type),
            "brand_name": brand_name
        })
    
    # Статистика по дням с русскими названиями
    daily_stats = {}
    for event in events:
        date = event["created_at"][:10]
        if date not in daily_stats:
            daily_stats[date] = {"events": 0, "types": {}}
        daily_stats[date]["events"] += 1
        event_type = event["event_type"]
        label = EVENT_LABELS_RU.get(event_type, event_type)
        daily_stats[date]["types"][label] = daily_stats[date]["types"].get(label, 0) + 1
    
    return {
        "user": target_user,
        "activities": activities,
        "check_ins": check_ins,
        "events": enriched_events,
        "daily_stats": daily_stats,
        "period_days": days
    }

@api_router.get("/super-admin/check-ins")
@api_router.get("/admin/check-ins")
async def get_all_check_ins(
    date: Optional[str] = None,
    admin: dict = Depends(require_admin)
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
    admin: dict = Depends(require_admin)  # Доступно админам и супер-админам
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
    admin: dict = Depends(require_admin)  # Доступно админам и супер-админам
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
    admin: dict = Depends(require_admin)  # Доступно админам и супер-админам
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
    admin: dict = Depends(require_admin)  # Доступно админам и супер-админам
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
    admin: dict = Depends(require_admin)  # Доступно админам и супер-админам
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

# ВАЖНО: Статические роуты ДОЛЖНЫ быть ВЫШЕ динамических!
# Массовое удаление брендов (полное удаление из БД)
@api_router.delete("/super-admin/brands/bulk-delete")
async def bulk_delete_brands(
    brand_ids: List[str] = Body(...),
    admin: dict = Depends(require_admin)
):
    """Массовое удаление брендов (полное удаление из БД)"""
    if not brand_ids:
        return {"status": "success", "deleted_count": 0}
    
    # Удаляем бренды и связанные данные
    result = await db.brands.delete_many({"id": {"$in": brand_ids}})
    await db.brand_items.delete_many({"brand_id": {"$in": brand_ids}})
    await db.brand_notes.delete_many({"brand_id": {"$in": brand_ids}})
    await db.brand_events.delete_many({"brand_id": {"$in": brand_ids}})
    await db.brand_contacts.delete_many({"brand_id": {"$in": brand_ids}})
    
    await log_event(EventType.ADMIN_BULK_DELETE, admin["id"], metadata={
        "action": "bulk_delete",
        "count": result.deleted_count
    })
    
    return {"status": "success", "deleted_count": result.deleted_count}

# Удалить тестовые бренды
@api_router.delete("/super-admin/brands/cleanup-test")
async def cleanup_test_brands(
    admin: dict = Depends(require_admin)
):
    """Удалить тестовые бренды (начинающиеся с Test)"""
    test_brands = await db.brands.find({
        "$or": [
            {"name_original": {"$regex": "^Test", "$options": "i"}},
            {"name_normalized": {"$regex": "^test", "$options": "i"}}
        ]
    }, {"id": 1}).to_list(1000)
    
    brand_ids = [b["id"] for b in test_brands]
    
    if not brand_ids:
        return {"status": "success", "deleted_count": 0}
    
    await db.brands.delete_many({"id": {"$in": brand_ids}})
    await db.brand_items.delete_many({"brand_id": {"$in": brand_ids}})
    await db.brand_notes.delete_many({"brand_id": {"$in": brand_ids}})
    await db.brand_events.delete_many({"brand_id": {"$in": brand_ids}})
    await db.brand_contacts.delete_many({"brand_id": {"$in": brand_ids}})
    
    await log_event(EventType.ADMIN_BULK_DELETE, admin["id"], metadata={
        "action": "cleanup_test_brands",
        "count": len(brand_ids)
    })
    
    return {"status": "success", "deleted_count": len(brand_ids)}

# Удаление одного бренда из архива полностью (динамический роут - должен быть ПОСЛЕ статических!)
@api_router.delete("/super-admin/brands/{brand_id}")
async def delete_brand_permanently(
    brand_id: str,
    admin: dict = Depends(require_admin)
):
    """Полное удаление бренда из системы"""
    brand = await db.brands.find_one({"id": brand_id})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    # Удаляем бренд и все связанные данные
    await db.brands.delete_one({"id": brand_id})
    await db.brand_notes.delete_many({"brand_id": brand_id})
    await db.brand_contacts.delete_many({"brand_id": brand_id})
    await db.brand_events.delete_many({"brand_id": brand_id})
    await db.brand_items.delete_many({"brand_id": brand_id})
    
    await log_event(
        EventType.BRAND_DELETED, 
        admin["id"], 
        metadata={"brand_name": brand.get("name_original"), "brand_id": brand_id}
    )
    
    return {"status": "success", "deleted": brand.get("name_original")}

@api_router.delete("/super-admin/imports/{import_id}")
async def delete_import_with_brands(
    import_id: str,
    archive: bool = Query(True, description="Архивировать бренды вместо удаления"),
    admin: dict = Depends(require_admin)  # Доступно админам и супер-админам
):
    """Удаление импорта с архивированием/удалением связанных брендов"""
    # Находим импорт в batch_imports
    import_doc = await db.batch_imports.find_one({"id": import_id}, {"_id": 0})
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
        await db.brand_contacts.delete_many({"brand_id": {"$in": brand_ids}})
        await db.brand_events.delete_many({"brand_id": {"$in": brand_ids}})
    
    # Удаляем запись импорта
    await db.batch_imports.delete_one({"id": import_id})
    
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
async def get_imports_list(admin: dict = Depends(require_admin)):
    """Список всех импортов с возможностью удаления"""
    # Используем batch_imports - это основная коллекция импортов
    imports = await db.batch_imports.find(
        {},
        {"_id": 0}
    ).sort("imported_at", -1).to_list(100)
    
    if not imports:
        return {"imports": []}
    
    # Получаем все import_id одним списком
    import_ids = [imp["id"] for imp in imports]
    
    # Агрегация для подсчёта брендов по импортам за один запрос
    pipeline = [
        {"$match": {"import_id": {"$in": import_ids}}},
        {"$group": {
            "_id": {
                "import_id": "$import_id",
                "is_archived": {"$eq": ["$status", BrandStatus.ARCHIVED]},
                "is_blacklisted": {"$eq": ["$status", BrandStatus.BLACKLISTED]}
            },
            "count": {"$sum": 1}
        }}
    ]
    
    counts_cursor = db.brands.aggregate(pipeline)
    counts = await counts_cursor.to_list(1000)
    
    # Собираем статистику в словарь
    stats = {}
    for c in counts:
        imp_id = c["_id"]["import_id"]
        if imp_id not in stats:
            stats[imp_id] = {"active": 0, "archived": 0, "blacklisted": 0}
        
        if c["_id"]["is_archived"]:
            stats[imp_id]["archived"] = c["count"]
        elif c["_id"]["is_blacklisted"]:
            stats[imp_id]["blacklisted"] = c["count"]
        else:
            stats[imp_id]["active"] += c["count"]
    
    # Добавляем статистику к импортам
    for imp in imports:
        imp_stats = stats.get(imp["id"], {"active": 0, "archived": 0, "blacklisted": 0})
        imp["active_brands_count"] = imp_stats["active"]
        imp["archived_brands_count"] = imp_stats["archived"]
        imp["blacklisted_brands_count"] = imp_stats["blacklisted"]
        imp["total_brands_count"] = imp_stats["active"] + imp_stats["archived"] + imp_stats["blacklisted"]
    
    return {"imports": imports}
    
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
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    admin: dict = Depends(require_admin)
):
    """Список архивированных брендов с пагинацией"""
    query = {"status": BrandStatus.ARCHIVED}
    
    if search:
        query["name_normalized"] = {"$regex": search.lower(), "$options": "i"}
    
    skip = (page - 1) * limit
    
    brands = await db.brands.find(
        query,
        {"_id": 0}
    ).sort("archived_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.brands.count_documents(query)
    
    return {
        "brands": brands,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if limit > 0 else 0
    }

@api_router.get("/super-admin/archived-brands/all-ids")
async def get_all_archived_brand_ids(
    admin: dict = Depends(require_admin)
):
    """Получить все ID архивированных брендов для массового выбора"""
    brands = await db.brands.find(
        {"status": BrandStatus.ARCHIVED},
        {"id": 1, "_id": 0}
    ).to_list(50000)
    
    return {"ids": [b["id"] for b in brands], "count": len(brands)}

@api_router.get("/super-admin/blacklisted-brands")
async def get_blacklisted_brands(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    admin: dict = Depends(require_admin)
):
    """Список брендов в чёрном списке с пагинацией"""
    query = {"status": BrandStatus.BLACKLISTED}
    
    if search:
        query["name_normalized"] = {"$regex": search.lower(), "$options": "i"}
    
    skip = (page - 1) * limit
    
    brands = await db.brands.find(
        query,
        {"_id": 0}
    ).sort("blacklisted_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.brands.count_documents(query)
    
    return {
        "brands": brands,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if limit > 0 else 0
    }

@api_router.post("/super-admin/brands/bulk-restore")
async def bulk_restore_brands(
    brand_ids: List[str] = Body(...),
    admin: dict = Depends(require_admin)  # Доступно админам и супер-админам
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

# ============== SUB-SUPPLIER ROUTES ==============

@api_router.post("/brands/{brand_id}/sub-suppliers")
async def create_sub_supplier(brand_id: str, req: SubSupplierCreate, user: dict = Depends(get_current_user)):
    """Создать под-сапплаера для бренда"""
    # Проверяем что бренд существует
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    now = datetime.now(timezone.utc).isoformat()
    sub_supplier = {
        "id": str(uuid.uuid4()),
        "parent_brand_id": brand_id,
        "name": req.name.strip(),
        "website_url": req.website_url.strip() if req.website_url else None,
        "contact_email": req.contact_email.strip() if req.contact_email else None,
        "contact_phone": req.contact_phone.strip() if req.contact_phone else None,
        "status": BrandStatus.ASSIGNED,
        "pipeline_stage": PipelineStage.REVIEW,
        "assigned_to_user_id": user["id"],
        "assigned_at": now,
        "funnel_started_at": None,
        "last_action_at": now,
        "next_action_at": None,
        "on_hold_reason": None,
        "on_hold_review_date": None,
        "created_at": now,
        "created_by_user_id": user["id"],
        "updated_at": now
    }
    
    # Добавляем начальную заметку если есть
    if req.notes:
        note = {
            "id": str(uuid.uuid4()),
            "sub_supplier_id": sub_supplier["id"],
            "user_id": user["id"],
            "note_text": req.notes,
            "note_type": NoteType.GENERAL,
            "created_at": now
        }
        await db.sub_supplier_notes.insert_one(note)
    
    await db.sub_suppliers.insert_one(sub_supplier)
    await log_event("sub_supplier_created", user["id"], brand_id, {"sub_supplier_id": sub_supplier["id"], "name": req.name})
    
    return {"status": "success", "id": sub_supplier["id"]}

@api_router.get("/brands/{brand_id}/sub-suppliers")
async def get_sub_suppliers(brand_id: str, user: dict = Depends(get_current_user)):
    """Получить под-сапплаеров бренда"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0, "name_original": 1, "priority_score": 1})
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден")
    
    sub_suppliers = await db.sub_suppliers.find({"parent_brand_id": brand_id}, {"_id": 0}).to_list(100)

    for ss in sub_suppliers:
        ss["pipeline_stage"] = normalize_pipeline_stage(ss.get("pipeline_stage"))
    
    # Добавляем данные от родительского бренда и пользователей
    items_count = await db.brand_items.count_documents({"brand_id": brand_id})
    
    for ss in sub_suppliers:
        ss["parent_brand_name"] = brand["name_original"]
        ss["priority_score"] = brand["priority_score"]
        ss["items_count"] = items_count
        ss["is_sub_supplier"] = True
        
        # Получаем никнейм создателя
        creator = await db.users.find_one({"id": ss["created_by_user_id"]}, {"nickname": 1})
        ss["created_by_nickname"] = creator["nickname"] if creator else None
        
        # Получаем никнейм назначенного
        if ss.get("assigned_to_user_id"):
            assigned = await db.users.find_one({"id": ss["assigned_to_user_id"]}, {"nickname": 1})
            ss["assigned_to_nickname"] = assigned["nickname"] if assigned else None
        else:
            ss["assigned_to_nickname"] = None
        
        # Количество контактов
        ss["contacts_count"] = await db.sub_supplier_contacts.count_documents({"sub_supplier_id": ss["id"]})
    
    return {"sub_suppliers": sub_suppliers}

@api_router.get("/sub-suppliers/ids")
async def get_sub_supplier_ids(
    status: Optional[str] = None,
    pipeline_stage: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Получить все ID суб-поставщиков для массовых операций"""
    if user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    query = {}
    if status:
        query["status"] = status
    if pipeline_stage:
        query["pipeline_stage"] = pipeline_stage
    if assigned_to:
        query["assigned_to_user_id"] = assigned_to
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    sub_suppliers = await db.sub_suppliers.find(query, {"id": 1, "_id": 0}).to_list(10000)
    ids = [ss["id"] for ss in sub_suppliers]
    
    return {"ids": ids, "total": len(ids)}


# ============== BULK OPERATIONS FOR SUB-SUPPLIERS ==============

class BulkSubSupplierRequest(BaseModel):
    sub_supplier_ids: List[str]
    reason: Optional[str] = None


@api_router.post("/sub-suppliers/bulk-release")
async def bulk_release_sub_suppliers(req: BulkSubSupplierRequest, user: dict = Depends(get_current_user)):
    """Массовое освобождение под-сапплаеров (сброс в пул)"""
    if user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    if not req.sub_supplier_ids:
        raise HTTPException(status_code=400, detail="Список ID пуст")
    
    now = datetime.now(timezone.utc).isoformat()
    updated_count = 0
    
    for ss_id in req.sub_supplier_ids:
        result = await db.sub_suppliers.update_one(
            {"id": ss_id},
            {"$set": {
                "status": BrandStatus.IN_POOL,
                "assigned_to_user_id": None,
                "assigned_at": None,
                "updated_at": now
            }}
        )
        if result.modified_count > 0:
            updated_count += 1
            await log_event("sub_supplier_bulk_release", user["id"], ss_id, {"reason": req.reason})
    
    return {"status": "success", "released_count": updated_count}


@api_router.post("/sub-suppliers/bulk-assign")
async def bulk_assign_sub_suppliers(req: BulkSubSupplierRequest, user_id: str = Query(...), user: dict = Depends(get_current_user)):
    """Массовое назначение под-сапплаеров на сёрчера"""
    if user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    if not req.sub_supplier_ids:
        raise HTTPException(status_code=400, detail="Список ID пуст")
    
    # Проверяем что целевой пользователь существует
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    now = datetime.now(timezone.utc).isoformat()
    updated_count = 0
    
    for ss_id in req.sub_supplier_ids:
        result = await db.sub_suppliers.update_one(
            {"id": ss_id},
            {"$set": {
                "status": BrandStatus.ASSIGNED,
                "assigned_to_user_id": user_id,
                "assigned_at": now,
                "updated_at": now
            }}
        )
        if result.modified_count > 0:
            updated_count += 1
            await log_event("sub_supplier_bulk_assign", user["id"], ss_id, {
                "assigned_to": user_id,
                "reason": req.reason
            })
    
    return {"status": "success", "assigned_count": updated_count}


@api_router.delete("/sub-suppliers/bulk-delete")
async def bulk_delete_sub_suppliers(req: BulkSubSupplierRequest, user: dict = Depends(get_current_user)):
    """Массовое удаление под-сапплаеров"""
    if user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Только для супер-админа")
    
    if not req.sub_supplier_ids:
        raise HTTPException(status_code=400, detail="Список ID пуст")
    
    deleted_count = 0
    
    for ss_id in req.sub_supplier_ids:
        # Удаляем заметки
        await db.sub_supplier_notes.delete_many({"sub_supplier_id": ss_id})
        # Удаляем контакты
        await db.sub_supplier_contacts.delete_many({"sub_supplier_id": ss_id})
        # Удаляем под-сапплаера
        result = await db.sub_suppliers.delete_one({"id": ss_id})
        if result.deleted_count > 0:
            deleted_count += 1
            await log_event("sub_supplier_bulk_delete", user["id"], ss_id, {"reason": req.reason})
    
    return {"status": "success", "deleted_count": deleted_count}


@api_router.post("/sub-suppliers/bulk-archive")
async def bulk_archive_sub_suppliers(req: BulkSubSupplierRequest, user: dict = Depends(get_current_user)):
    """Массовая архивация под-сапплаеров"""
    if user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    if not req.sub_supplier_ids:
        raise HTTPException(status_code=400, detail="Список ID пуст")
    
    now = datetime.now(timezone.utc).isoformat()
    archived_count = 0
    
    for ss_id in req.sub_supplier_ids:
        result = await db.sub_suppliers.update_one(
            {"id": ss_id},
            {"$set": {
                "status": BrandStatus.ARCHIVED,
                "archived_at": now,
                "archive_reason": req.reason or "Массовая архивация",
                "updated_at": now
            }}
        )
        if result.modified_count > 0:
            archived_count += 1
            await log_event("sub_supplier_bulk_archive", user["id"], ss_id, {"reason": req.reason})
    
    return {"status": "success", "archived_count": archived_count}


@api_router.get("/sub-suppliers/{sub_supplier_id}")
async def get_sub_supplier_detail(sub_supplier_id: str, user: dict = Depends(get_current_user)):
    """Получить детали под-сапплаера"""
    ss = await db.sub_suppliers.find_one({"id": sub_supplier_id}, {"_id": 0})
    if not ss:
        raise HTTPException(status_code=404, detail="Под-сапплаер не найден")
    
    # Получаем родительский бренд
    brand = await db.brands.find_one({"id": ss["parent_brand_id"]}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Родительский бренд не найден")
    
    ss["parent_brand_name"] = brand["name_original"]
    ss["priority_score"] = brand["priority_score"]
    ss["is_sub_supplier"] = True
    
    # Нормализуем этап (чтобы UI всегда видел те же значения, что и у брендов)
    ss["pipeline_stage"] = normalize_pipeline_stage(ss.get("pipeline_stage"))

    # Items от родительского бренда
    items = await db.brand_items.find({"brand_id": ss["parent_brand_id"]}, {"_id": 0}).to_list(10)
    ss["items_count"] = await db.brand_items.count_documents({"brand_id": ss["parent_brand_id"]})
    
    # Заметки под-сапплаера
    notes = await db.sub_supplier_notes.find({"sub_supplier_id": sub_supplier_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for note in notes:
        note_user = await db.users.find_one({"id": note["user_id"]}, {"nickname": 1})
        note["user_nickname"] = note_user["nickname"] if note_user else "Unknown"
    
    # Контакты под-сапплаера
    contacts = await db.sub_supplier_contacts.find({"sub_supplier_id": sub_supplier_id}, {"_id": 0}).to_list(100)
    
    # Получаем никнеймы
    creator = await db.users.find_one({"id": ss["created_by_user_id"]}, {"nickname": 1})
    ss["created_by_nickname"] = creator["nickname"] if creator else None
    
    if ss.get("assigned_to_user_id"):
        assigned = await db.users.find_one({"id": ss["assigned_to_user_id"]}, {"nickname": 1})
        ss["assigned_to_nickname"] = assigned["nickname"] if assigned else None
    else:
        ss["assigned_to_nickname"] = None
    
    ss["contacts_count"] = len(contacts)
    
    return {
        "sub_supplier": ss,
        "items": items,
        "notes": notes,
        "contacts": contacts
    }

@api_router.put("/sub-suppliers/{sub_supplier_id}")
async def update_sub_supplier(sub_supplier_id: str, req: SubSupplierUpdate, user: dict = Depends(get_current_user)):
    """Обновить под-сапплаера"""
    ss = await db.sub_suppliers.find_one({"id": sub_supplier_id}, {"_id": 0})
    if not ss:
        raise HTTPException(status_code=404, detail="Под-сапплаер не найден")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if req.name:
        update_data["name"] = req.name.strip()
    if req.website_url is not None:
        update_data["website_url"] = req.website_url.strip() if req.website_url else None
    if req.contact_email is not None:
        update_data["contact_email"] = req.contact_email.strip() if req.contact_email else None
    if req.contact_phone is not None:
        update_data["contact_phone"] = req.contact_phone.strip() if req.contact_phone else None
    
    await db.sub_suppliers.update_one({"id": sub_supplier_id}, {"$set": update_data})
    return {"status": "success"}

@api_router.delete("/sub-suppliers/{sub_supplier_id}")
async def delete_sub_supplier(sub_supplier_id: str, user: dict = Depends(get_current_user)):
    """Удалить под-сапплаера"""
    ss = await db.sub_suppliers.find_one({"id": sub_supplier_id}, {"_id": 0})
    if not ss:
        raise HTTPException(status_code=404, detail="Под-сапплаер не найден")
    
    # Удаляем заметки и контакты
    await db.sub_supplier_notes.delete_many({"sub_supplier_id": sub_supplier_id})
    await db.sub_supplier_contacts.delete_many({"sub_supplier_id": sub_supplier_id})
    await db.sub_suppliers.delete_one({"id": sub_supplier_id})
    
    await log_event("sub_supplier_deleted", user["id"], ss["parent_brand_id"], {"sub_supplier_id": sub_supplier_id})
    return {"status": "success"}

@api_router.post("/sub-suppliers/{sub_supplier_id}/stage")
async def update_sub_supplier_stage(sub_supplier_id: str, req: StageCompleteRequest, user: dict = Depends(get_current_user)):
    """Обновить этап под-сапплаера"""
    ss = await db.sub_suppliers.find_one({"id": sub_supplier_id}, {"_id": 0})
    if not ss:
        raise HTTPException(status_code=404, detail="Под-сапплаер не найден")
    
    now = datetime.now(timezone.utc).isoformat()

    
    # Валидация перехода этапов (как у бренда)
    current_stage = normalize_pipeline_stage(ss.get("pipeline_stage", PipelineStage.REVIEW))
    requested_stage = normalize_pipeline_stage(req.stage)

    allowed_transitions = STAGE_TRANSITIONS.get(current_stage, [])
    if requested_stage not in allowed_transitions:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимый переход: {current_stage} → {req.stage}. Разрешены: {allowed_transitions}"
        )

    settings = await get_settings()
    next_dt = calculate_next_action(requested_stage, settings)

    await db.sub_suppliers.update_one({"id": sub_supplier_id}, {"$set": {
        "pipeline_stage": requested_stage,
        "status": BrandStatus.IN_WORK,
        "last_action_at": now,
        "next_action_at": next_dt.isoformat() if next_dt else None,
        "updated_at": now,
        "funnel_started_at": ss.get("funnel_started_at") or now
    }})
    
    # Добавляем заметку
    if req.note_text:
        note = {
            "id": str(uuid.uuid4()),
            "sub_supplier_id": sub_supplier_id,
            "user_id": user["id"],
            "note_text": req.note_text,
            "note_type": NoteType.STAGE_DONE,
            "created_at": now
        }
        await db.sub_supplier_notes.insert_one(note)
    
    return {"status": "success"}

@api_router.post("/sub-suppliers/{sub_supplier_id}/replied")
async def sub_supplier_replied(sub_supplier_id: str, req: RepliedStatusRequest, user: dict = Depends(get_current_user)):
    """Отметить что под-сапплаер ответил"""
    ss = await db.sub_suppliers.find_one({"id": sub_supplier_id}, {"_id": 0})
    if not ss:
        raise HTTPException(status_code=404, detail="Под-сапплаер не найден")
    
    status_map = {
        "need_action": BrandStatus.REPLIED_NEED_ACTION,
        "need_searcher_attention": BrandStatus.REPLIED_NEED_SEARCHER,
        "waiting": BrandStatus.REPLIED_WAITING,
        "approved": BrandStatus.REPLIED_APPROVED,
        "declined": BrandStatus.REPLIED_DECLINED
    }
    
    new_status = status_map.get(req.sub_status, BrandStatus.OUTCOME_REPLIED)
    now = datetime.now(timezone.utc)
    
    next_action = None
    if req.next_action_date:
        next_action = req.next_action_date
    elif req.sub_status == "need_action":
        next_action = (now + timedelta(days=2)).isoformat()
    elif req.sub_status == "need_searcher_attention":
        next_action = (now + timedelta(days=1)).isoformat()
    elif req.sub_status == "waiting":
        next_action = (now + timedelta(days=5)).isoformat()
    
    await db.sub_suppliers.update_one({"id": sub_supplier_id}, {"$set": {
        "status": new_status,
        "last_action_at": now.isoformat(),
        "next_action_at": next_action,
        "updated_at": now.isoformat()
    }})
    
    # Добавляем заметку
    note = {
        "id": str(uuid.uuid4()),
        "sub_supplier_id": sub_supplier_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": NoteType.STATUS_CHANGE,
        "created_at": now.isoformat()
    }
    await db.sub_supplier_notes.insert_one(note)
    
    return {"status": "success"}

@api_router.post("/sub-suppliers/{sub_supplier_id}/on-hold")
async def sub_supplier_on_hold(sub_supplier_id: str, req: MarkOnHoldRequest, user: dict = Depends(get_current_user)):
    """Поставить под-сапплаера на паузу"""
    ss = await db.sub_suppliers.find_one({"id": sub_supplier_id}, {"_id": 0})
    if not ss:
        raise HTTPException(status_code=404, detail="Под-сапплаер не найден")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.sub_suppliers.update_one({"id": sub_supplier_id}, {"$set": {
        "status": BrandStatus.ON_HOLD,
        "on_hold_reason": req.reason,
        "on_hold_review_date": req.review_date,
        "last_action_at": now,
        "next_action_at": req.review_date,
        "updated_at": now
    }})
    
    note = {
        "id": str(uuid.uuid4()),
        "sub_supplier_id": sub_supplier_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": NoteType.ON_HOLD,
        "created_at": now
    }
    await db.sub_supplier_notes.insert_one(note)
    
    return {"status": "success"}

@api_router.post("/sub-suppliers/{sub_supplier_id}/no-response")
async def sub_supplier_no_response(sub_supplier_id: str, req: BrandNoteCreate, user: dict = Depends(get_current_user)):
    """Отметить что под-сапплаер не ответил"""
    ss = await db.sub_suppliers.find_one({"id": sub_supplier_id}, {"_id": 0})
    if not ss:
        raise HTTPException(status_code=404, detail="Под-сапплаер не найден")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.sub_suppliers.update_one({"id": sub_supplier_id}, {"$set": {
        "status": BrandStatus.NO_RESPONSE,
        "last_action_at": now,
        "next_action_at": None,
        "updated_at": now
    }})
    
    note = {
        "id": str(uuid.uuid4()),
        "sub_supplier_id": sub_supplier_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": NoteType.NO_RESPONSE,
        "created_at": now
    }
    await db.sub_supplier_notes.insert_one(note)
    
    return {"status": "success"}


@api_router.post("/sub-suppliers/{sub_supplier_id}/return")
async def sub_supplier_return_to_pool(sub_supplier_id: str, req: ReturnToPoolRequest, user: dict = Depends(get_current_user)):
    """Вернуть под-сапплаера в пул (полный сброс состояния)"""
    ss = await db.sub_suppliers.find_one({"id": sub_supplier_id}, {"_id": 0})
    if not ss:
        raise HTTPException(status_code=404, detail="Под-сапплаер не найден")

    # Валидация причины
    if req.reason_code not in RETURN_REASONS:
        raise HTTPException(status_code=400, detail=f"Неверная причина. Допустимые: {list(RETURN_REASONS.keys())}")

    now = datetime.now(timezone.utc).isoformat()

    # Полный сброс состояния (аналогично бренду)
    await db.sub_suppliers.update_one({"id": sub_supplier_id}, {"$set": {
        "status": BrandStatus.IN_POOL,
        "pipeline_stage": PipelineStage.REVIEW,
        "assigned_to_user_id": None,
        "next_action_at": None,
        "funnel_started_at": None,
        "on_hold_reason": None,
        "on_hold_review_date": None,
        "updated_at": now
    }})

    note = {
        "id": str(uuid.uuid4()),
        "sub_supplier_id": sub_supplier_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": NoteType.RETURN_TO_POOL,
        "reason_code": req.reason_code,
        "reason_label": RETURN_REASONS[req.reason_code],
        "created_at": now
    }
    await db.sub_supplier_notes.insert_one(note)

    return {"status": "success"}

@api_router.post("/sub-suppliers/{sub_supplier_id}/problematic")
async def sub_supplier_problematic(sub_supplier_id: str, req: MarkProblematicRequest, user: dict = Depends(get_current_user)):
    """Отметить под-сапплаера как проблемного"""
    ss = await db.sub_suppliers.find_one({"id": sub_supplier_id}, {"_id": 0})
    if not ss:
        raise HTTPException(status_code=404, detail="Под-сапплаер не найден")

    # Валидация причины
    if req.reason_code not in PROBLEMATIC_REASONS:
        raise HTTPException(status_code=400, detail=f"Неверная причина. Допустимые: {list(PROBLEMATIC_REASONS.keys())}")

    now = datetime.now(timezone.utc).isoformat()

    # Дата пересмотра по умолчанию через 30 дней
    review_date = req.review_date or (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")

    await db.sub_suppliers.update_one({"id": sub_supplier_id}, {"$set": {
        "status": BrandStatus.PROBLEMATIC,
        "on_hold_reason": req.reason_code,
        "on_hold_review_date": review_date,
        "last_action_at": now,
        "updated_at": now
    }})

    note = {
        "id": str(uuid.uuid4()),
        "sub_supplier_id": sub_supplier_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": NoteType.PROBLEMATIC,
        "reason_code": req.reason_code,
        "reason_label": PROBLEMATIC_REASONS[req.reason_code],
        "review_date": review_date,
        "created_at": now
    }
    await db.sub_supplier_notes.insert_one(note)

    return {"status": "success"}

@api_router.post("/sub-suppliers/{sub_supplier_id}/note")
async def add_sub_supplier_note(sub_supplier_id: str, req: BrandNoteCreate, user: dict = Depends(get_current_user)):
    """Добавить заметку к под-сапплаеру"""
    ss = await db.sub_suppliers.find_one({"id": sub_supplier_id}, {"_id": 0})
    if not ss:
        raise HTTPException(status_code=404, detail="Под-сапплаер не найден")
    
    now = datetime.now(timezone.utc).isoformat()
    note = {
        "id": str(uuid.uuid4()),
        "sub_supplier_id": sub_supplier_id,
        "user_id": user["id"],
        "note_text": req.note_text,
        "note_type": req.note_type,
        "created_at": now
    }
    await db.sub_supplier_notes.insert_one(note)
    
    await db.sub_suppliers.update_one({"id": sub_supplier_id}, {"$set": {
        "last_action_at": now,
        "updated_at": now
    }})
    
    return {"status": "success", "note_id": note["id"]}

@api_router.post("/sub-suppliers/{sub_supplier_id}/contact")
async def add_sub_supplier_contact(sub_supplier_id: str, req: AddContactRequest, user: dict = Depends(get_current_user)):
    """Добавить контакт к под-сапплаеру"""
    ss = await db.sub_suppliers.find_one({"id": sub_supplier_id}, {"_id": 0})
    if not ss:
        raise HTTPException(status_code=404, detail="Под-сапплаер не найден")
    
    now = datetime.now(timezone.utc).isoformat()
    contact = {
        "id": str(uuid.uuid4()),
        "sub_supplier_id": sub_supplier_id,
        "name": req.name,
        "role": req.role,
        "email": req.email,
        "phone": req.phone,
        "notes": req.notes,
        "created_at": now,
        "created_by_user_id": user["id"]
    }
    await db.sub_supplier_contacts.insert_one(contact)
    
    return {"status": "success", "contact_id": contact["id"]}

# ============== ALL SUB-SUPPLIERS LIST ==============

@api_router.get("/sub-suppliers")
async def get_all_sub_suppliers(
    status: Optional[str] = None,
    pipeline_stage: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    overdue: Optional[bool] = False,
    include_archived: Optional[bool] = False,
    page: int = 1,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Получить список всех под-сапплаеров с фильтрами"""
    query = {}
    
    # Фильтр по статусу
    if status:
        query["status"] = status
    elif not include_archived:
        # По умолчанию исключаем архивированные и blacklisted
        query["status"] = {"$nin": [BrandStatus.ARCHIVED, BrandStatus.BLACKLISTED]}
    
    # Фильтр по этапу воронки
    if pipeline_stage:
        query["pipeline_stage"] = pipeline_stage
    
    # Фильтр по назначенному пользователю
    if assigned_to:
        query["assigned_to_user_id"] = assigned_to
    
    # Поиск по имени
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    # Фильтр просроченных
    if overdue:
        now = datetime.now(timezone.utc).isoformat()
        query["next_action_at"] = {"$lt": now, "$ne": None}
    
    # Для searcher показываем только его суб-поставщиков
    if user["role"] == "searcher":
        query["assigned_to_user_id"] = user["id"]
    
    total = await db.sub_suppliers.count_documents(query)
    skip = (page - 1) * limit
    
    sub_suppliers = await db.sub_suppliers.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Обогащаем данные
    for ss in sub_suppliers:
        ss["pipeline_stage"] = normalize_pipeline_stage(ss.get("pipeline_stage"))
        ss["is_sub_supplier"] = True
        
        # Получаем родительский бренд
        brand = await db.brands.find_one({"id": ss["parent_brand_id"]}, {"_id": 0, "name_original": 1, "priority_score": 1})
        if brand:
            ss["parent_brand_name"] = brand["name_original"]
            ss["priority_score"] = brand.get("priority_score", 0)
            ss["items_count"] = await db.brand_items.count_documents({"brand_id": ss["parent_brand_id"]})
        else:
            ss["parent_brand_name"] = "—"
            ss["priority_score"] = 0
            ss["items_count"] = 0
        
        # Никнеймы
        if ss.get("assigned_to_user_id"):
            assigned = await db.users.find_one({"id": ss["assigned_to_user_id"]}, {"nickname": 1})
            ss["assigned_to_nickname"] = assigned["nickname"] if assigned else None
        else:
            ss["assigned_to_nickname"] = None
        
        creator = await db.users.find_one({"id": ss.get("created_by_user_id")}, {"nickname": 1})
        ss["created_by_nickname"] = creator["nickname"] if creator else None
    
    return {
        "sub_suppliers": sub_suppliers,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit if total > 0 else 1
    }


# ============== BASH FEATURE: BATCH MANAGEMENT ==============

# Кастомные статусы товаров
ITEM_STATUSES = [
    {"value": "", "label": "Без статуса", "color": "#94A3B8"},
    {"value": "out_of_stock", "label": "Аут оф сток", "color": "#EF4444"},
    {"value": "no_stock", "label": "Нет в наличии", "color": "#F97316"},
    {"value": "not_found", "label": "Не нашёл", "color": "#8B5CF6"},
    {"value": "heavy", "label": "Тяжелый", "color": "#6366F1"},
    {"value": "low_sales", "label": "Мало продаж", "color": "#EAB308"},
    {"value": "low_traffic", "label": "Слабый трафик", "color": "#14B8A6"},
    {"value": "approved", "label": "Одобрено", "color": "#22C55E"},
    {"value": "ordered", "label": "Заказано", "color": "#3B82F6"},
]

# Популярные перевозчики для автокомплита
# Load carriers from CSV file
import csv

def load_carriers_from_csv():
    """Load carriers from CSV file"""
    carriers = []
    csv_path = ROOT_DIR / 'carriers.csv'
    if csv_path.exists():
        try:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    carriers.append({
                        "key": row.get("key", ""),
                        "name": row.get("name_en", "")
                    })
        except Exception as e:
            logger.error(f"Error loading carriers CSV: {e}")
    return carriers

ALL_CARRIERS = load_carriers_from_csv()

# Popular carriers for quick access (fallback if CSV not loaded)
POPULAR_CARRIERS = [
    {"key": "100001", "name": "DHL Express"},
    {"key": "100002", "name": "UPS"},
    {"key": "100003", "name": "FedEx"},
    {"key": "100006", "name": "Aramex"},
    {"key": "100012", "name": "SF Express"},
    {"key": "3013", "name": "China EMS"},
    {"key": "3011", "name": "China Post"},
    {"key": "21051", "name": "USPS"},
    {"key": "11031", "name": "Royal Mail"},
    {"key": "18031", "name": "Russian Post"},
    {"key": "100030", "name": "CDEK"},
    {"key": "100035", "name": "Nova Poshta"},
    {"key": "100004", "name": "TNT"},
    {"key": "7041", "name": "DHL Paket"},
    {"key": "6051", "name": "La Poste (Colissimo)"},
    {"key": "14041", "name": "PostNL"},
    {"key": "100005", "name": "GLS"},
    {"key": "7047", "name": "DHL eCommerce US"},
    {"key": "7048", "name": "DHL eCommerce Asia"},
    {"key": "100040", "name": "Sagawa (佐川急便)"},
    {"key": "100062", "name": "Yamato (ヤマト運輸)"},
    {"key": "10021", "name": "Japan Post"},
    {"key": "100074", "name": "J&T Express (ID)"},
    {"key": "100124", "name": "Ninjavan (SG)"},
    {"key": "100391", "name": "BEST EXPRESS"},
    {"key": "100590", "name": "SiCepat"},
]

class BatchStatus:
    ACTIVE = "active"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    ARCHIVED = "archived"

class BatchItemUpdate(BaseModel):
    cost_price: Optional[float] = None
    extra_costs: Optional[float] = None
    quantity: Optional[int] = None
    supplier_link: Optional[str] = None
    supplier_sku: Optional[str] = None
    status: Optional[str] = None  # Кастомный статус товара
    shipping_cost: Optional[float] = None  # Доставка (редактируемая)
    prep_cost: Optional[float] = None  # Преп-кост

class BatchUpdate(BaseModel):
    name: Optional[str] = None
    supplier: Optional[str] = None
    tracking_number: Optional[str] = None
    carrier_code: Optional[str] = None  # Код перевозчика для 17track
    carrier_name: Optional[str] = None  # Название перевозчика
    status: Optional[str] = None

class BatchNoteCreate(BaseModel):
    text: str
    item_id: Optional[str] = None

class SkuQuantityImport(BaseModel):
    items: List[dict]  # [{"supplier_sku": "ABC123", "quantity": 5}, ...]

# Формула расчёта доставки (фунт * 0.8 на Амазон)
def calculate_shipping_cost(weight_grams: float) -> float:
    """Расчёт стоимости доставки: вес в фунтах * 0.8"""
    if not weight_grams or weight_grams <= 0:
        return 0.0
    weight_pounds = weight_grams / 453.592  # конвертация граммы -> фунты
    return round(weight_pounds * 0.8, 2)

def calculate_profit_roi(item: dict) -> dict:
    """
    Расчёт Profit и ROI для товара
    
    Profit = Buy Box Price - Referral Fee - FBA Fee - Cost Price - Shipping Cost - Extra Costs
    ROI = (Profit / Total Investment) * 100
    """
    buy_box_price = item.get("buy_box_price", 0) or 0
    referral_fee = item.get("referral_fee", 0) or 0
    fba_fee = item.get("fba_fee", 0) or 0
    cost_price = item.get("cost_price", 0) or 0
    extra_costs = item.get("extra_costs", 0) or 0
    shipping_cost = item.get("shipping_cost", 0) or 0
    prep_cost = item.get("prep_cost", 0) or 0
    quantity = item.get("quantity", 1) or 1
    
    # Profit на единицу (включая prep_cost)
    profit_per_unit = buy_box_price - referral_fee - fba_fee - cost_price - shipping_cost - extra_costs - prep_cost
    
    # Total investment (затраты)
    total_investment = cost_price + shipping_cost + extra_costs + prep_cost
    
    # ROI
    roi = 0.0
    if total_investment > 0:
        roi = (profit_per_unit / total_investment) * 100
    
    # Total profit
    total_profit = profit_per_unit * quantity
    
    return {
        "profit_per_unit": round(profit_per_unit, 2),
        "total_profit": round(total_profit, 2),
        "roi": round(roi, 2),
        "total_investment": round(total_investment, 2)
    }

@api_router.post("/bash/upload")
async def upload_bash_file(
    file: UploadFile = File(...),
    batch_name: Optional[str] = None,
    supplier: Optional[str] = None,
    admin: dict = Depends(require_admin)
):
    """Загрузка Excel файла Keepa для создания новой партии"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Только Excel файлы (.xlsx, .xls)")
    
    try:
        contents = await file.read()
        df = pd.read_excel(BytesIO(contents))
        
        # Создаём партию
        batch_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        batch = {
            "id": batch_id,
            "name": batch_name or file.filename.replace(".xlsx", "").replace(".xls", ""),
            "file_name": file.filename,
            "supplier": supplier or "",
            "status": BatchStatus.ACTIVE,
            "tracking_number": "",
            "tracking_status": "",
            "created_at": now,
            "created_by": admin["id"],
            "items_count": 0,
            "total_cost": 0,
            "total_profit": 0,
            "notes": ""
        }
        
        await db.batches.insert_one(batch)
        
        # Парсим товары из Excel
        items = []
        for idx, row in df.iterrows():
            # Извлекаем данные из Keepa export
            asin = str(row.get("ASIN", "")) if pd.notna(row.get("ASIN")) else ""
            if not asin:
                continue
            
            # Название товара (разные варианты колонок)
            title = ""
            for col in ["Buy Box 🚚: Current Title", "Buy Box: Current Title", "Title", "Name"]:
                if col in df.columns and pd.notna(row.get(col)):
                    title = str(row.get(col))
                    break
            
            # Цена Buy Box (сначала текущая, потом 90-day avg)
            buy_box_price = 0.0
            buy_box_90d = 0.0
            
            # Сначала пробуем текущую цену
            for col in ["Buy Box 🚚: Current", "Buy Box: Current"]:
                if col in df.columns and pd.notna(row.get(col)):
                    try:
                        buy_box_price = float(row.get(col))
                        break
                    except (ValueError, TypeError):
                        pass
            
            # Получаем 90-day avg
            for col in ["Buy Box 🚚: 90 days avg.", "Buy Box: 90 days avg."]:
                if col in df.columns and pd.notna(row.get(col)):
                    try:
                        buy_box_90d = float(row.get(col))
                        break
                    except (ValueError, TypeError):
                        pass
            
            # Если нет текущей цены, берём 90-day avg
            if buy_box_price <= 0 and buy_box_90d > 0:
                buy_box_price = buy_box_90d
            
            # Referral Fee
            referral_fee = 0.0
            for col in ["Referral Fee based on current Buy Box price", "Referral Fee"]:
                if col in df.columns and pd.notna(row.get(col)):
                    try:
                        referral_fee = float(row.get(col))
                        break
                    except (ValueError, TypeError):
                        pass
            
            # FBA Fee
            fba_fee = 0.0
            for col in ["FBA Pick&Pack Fee", "FBA Fee"]:
                if col in df.columns and pd.notna(row.get(col)):
                    try:
                        fba_fee = float(row.get(col))
                        break
                    except (ValueError, TypeError):
                        pass
            
            # Вес (граммы)
            weight_grams = 0.0
            for col in ["Package: Weight (g)", "Item: Weight (g)", "Weight (g)"]:
                if col in df.columns and pd.notna(row.get(col)):
                    try:
                        weight_grams = float(row.get(col))
                        break
                    except (ValueError, TypeError):
                        pass
            
            # Изображение
            image_url = ""
            if "Image" in df.columns and pd.notna(row.get("Image")):
                img_data = str(row.get("Image"))
                # Keepa может хранить несколько URL через ;
                image_url = img_data.split(";")[0] if img_data else ""
            
            # Бренд
            brand = ""
            if "Brand" in df.columns and pd.notna(row.get("Brand")):
                brand = str(row.get("Brand"))
            
            # Sales Rank
            sales_rank = 0
            for col in ["Sales Rank: Current", "Sales Rank"]:
                if col in df.columns and pd.notna(row.get(col)):
                    try:
                        sales_rank = int(float(row.get(col)))
                        break
                    except (ValueError, TypeError):
                        pass
            
            # Monthly sold
            monthly_sold = 0
            if "monthly sold" in df.columns and pd.notna(row.get("monthly sold")):
                try:
                    monthly_sold = int(float(row.get("monthly sold")))
                except (ValueError, TypeError):
                    pass
            
            # Bought in past month
            bought_past_month = 0
            if "Bought in past month" in df.columns and pd.notna(row.get("Bought in past month")):
                try:
                    bought_past_month = int(float(row.get("Bought in past month")))
                except (ValueError, TypeError):
                    pass
            
            # Категория
            category = ""
            for col in ["Sales Rank: Subcategory", "Categories: Sub", "Categories: Root"]:
                if col in df.columns and pd.notna(row.get(col)):
                    category = str(row.get(col))
                    break
            
            # Расчёт стоимости доставки
            shipping_cost = calculate_shipping_cost(weight_grams)
            
            item = {
                "id": str(uuid.uuid4()),
                "batch_id": batch_id,
                "asin": asin,
                "title": title[:500] if title else "",
                "brand": brand,
                "image_url": image_url,
                "buy_box_price": buy_box_price,
                "buy_box_90d": buy_box_90d,
                "referral_fee": referral_fee,
                "fba_fee": fba_fee,
                "weight_grams": weight_grams,
                "shipping_cost": 0.0,  # Пользователь вводит сам
                "prep_cost": 0.0,  # Преп-кост
                "cost_price": 0.0,
                "extra_costs": 0.0,
                "quantity": 1,
                "profit_per_unit": 0.0,
                "total_profit": 0.0,
                "roi": 0.0,
                "sales_rank": sales_rank,
                "monthly_sold": monthly_sold,
                "bought_past_month": bought_past_month,
                "category": category,
                "supplier_link": "",
                "supplier_sku": "",
                "status": "",  # Кастомный статус товара
                "created_at": now
            }
            
            # Рассчитываем начальные profit/ROI (будут 0 пока нет cost_price)
            calcs = calculate_profit_roi(item)
            item.update(calcs)
            
            items.append(item)
        
        if items:
            await db.batch_items.insert_many(items)
        
        # Обновляем счётчик в партии
        await db.batches.update_one(
            {"id": batch_id},
            {"$set": {"items_count": len(items)}}
        )
        
        return {
            "status": "success",
            "batch_id": batch_id,
            "items_count": len(items),
            "batch_name": batch["name"]
        }
        
    except Exception as e:
        logger.error(f"Error uploading BASH file: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка обработки файла: {str(e)}")

# ВАЖНО: Static routes должны быть ПЕРЕД dynamic routes (/bash/{batch_id})
@api_router.get("/bash/item-statuses")
async def get_item_statuses(admin: dict = Depends(require_admin)):
    """Получить список доступных статусов товаров (включая кастомные)"""
    # Получаем все уникальные статусы из базы
    custom_statuses = await db.batch_items.distinct("status")
    # Фильтруем пустые и добавляем в список
    all_statuses = list(set([s for s in custom_statuses if s]))
    return {"statuses": all_statuses}

@api_router.get("/bash/carriers")
async def search_carriers(
    q: str = Query("", description="Поисковый запрос"),
    admin: dict = Depends(require_admin)
):
    """Поиск перевозчиков по названию или коду"""
    # Use ALL_CARRIERS if loaded from CSV, otherwise fallback to POPULAR_CARRIERS
    carriers_list = ALL_CARRIERS if ALL_CARRIERS else POPULAR_CARRIERS
    
    if not q:
        # Return popular carriers when no search query
        return {"carriers": POPULAR_CARRIERS[:20]}
    
    q_lower = q.lower()
    # Search by name or key (code)
    matched = [
        c for c in carriers_list 
        if q_lower in c["name"].lower() or q_lower in c["key"].lower()
    ]
    return {"carriers": matched[:30]}

@api_router.get("/bash")
async def get_batches(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    admin: dict = Depends(require_admin)
):
    """Получить список всех партий"""
    query = {}
    if status:
        query["status"] = status
    
    batches = await db.batches.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.batches.count_documents(query)
    
    return {
        "batches": batches,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.get("/bash/{batch_id}")
async def get_batch(
    batch_id: str,
    admin: dict = Depends(require_admin)
):
    """Получить партию с товарами"""
    batch = await db.batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Партия не найдена")
    
    items = await db.batch_items.find(
        {"batch_id": batch_id},
        {"_id": 0}
    ).to_list(10000)
    
    # Пересчитываем общую статистику
    total_cost = sum((i.get("cost_price", 0) or 0) * (i.get("quantity", 1) or 1) for i in items)
    total_profit = sum(i.get("total_profit", 0) or 0 for i in items)
    total_revenue = sum((i.get("buy_box_price", 0) or 0) * (i.get("quantity", 1) or 1) for i in items)
    
    # Правильный расчёт ROI - только для товаров с себестоимостью
    items_with_cost = [i for i in items if (i.get("cost_price", 0) or 0) > 0]
    avg_roi = 0.0
    if items_with_cost:
        # Профит только от товаров с себестоимостью
        profit_from_priced = sum(i.get("total_profit", 0) or 0 for i in items_with_cost)
        # Инвестиции только от товаров с себестоимостью (включая prep_cost)
        total_investment = sum(
            ((i.get("cost_price", 0) or 0) + (i.get("shipping_cost", 0) or 0) + (i.get("extra_costs", 0) or 0) + (i.get("prep_cost", 0) or 0)) * (i.get("quantity", 1) or 1)
            for i in items_with_cost
        )
        if total_investment > 0:
            avg_roi = (profit_from_priced / total_investment) * 100
    
    # Собираем уникальные статусы для этой партии
    unique_statuses = list(set([i.get("status", "") for i in items if i.get("status")]))
    
    batch["items"] = items
    batch["calculated_stats"] = {
        "total_cost": round(total_cost, 2),
        "total_profit": round(total_profit, 2),
        "total_revenue": round(total_revenue, 2),
        "avg_roi": round(avg_roi, 1),
        "items_with_cost": len(items_with_cost)
    }
    batch["unique_statuses"] = unique_statuses
    
    return batch

@api_router.put("/bash/{batch_id}")
async def update_batch(
    batch_id: str,
    update: BatchUpdate,
    admin: dict = Depends(require_admin)
):
    """Обновить партию"""
    batch = await db.batches.find_one({"id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Партия не найдена")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.batches.update_one(
        {"id": batch_id},
        {"$set": update_data}
    )
    
    return {"status": "success"}

@api_router.delete("/bash/{batch_id}")
async def delete_batch(
    batch_id: str,
    admin: dict = Depends(require_admin)
):
    """Удалить партию со всеми товарами"""
    batch = await db.batches.find_one({"id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Партия не найдена")
    
    # Удаляем товары
    await db.batch_items.delete_many({"batch_id": batch_id})
    
    # Удаляем партию
    await db.batches.delete_one({"id": batch_id})
    
    return {"status": "success"}

@api_router.put("/bash/item/{item_id}")
async def update_batch_item(
    item_id: str,
    update: BatchItemUpdate,
    admin: dict = Depends(require_admin)
):
    """Обновить товар в партии (cost_price, extra_costs, quantity)"""
    item = await db.batch_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    # Обновляем товар
    if update_data:
        # Применяем обновления
        new_item = {**item, **update_data}
        
        # Пересчитываем profit/ROI
        calcs = calculate_profit_roi(new_item)
        update_data.update(calcs)
        
        await db.batch_items.update_one(
            {"id": item_id},
            {"$set": update_data}
        )
    
    # Возвращаем обновлённый товар
    updated = await db.batch_items.find_one({"id": item_id}, {"_id": 0})
    return updated

@api_router.delete("/bash/items/{item_id}")
async def delete_batch_item(
    item_id: str,
    admin: dict = Depends(require_admin)
):
    """Удаление одного товара из партии"""
    item = await db.batch_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    await db.batch_items.delete_one({"id": item_id})
    
    # Обновляем счётчик в партии
    batch_id = item.get("batch_id")
    if batch_id:
        remaining = await db.batch_items.count_documents({"batch_id": batch_id})
        await db.batches.update_one(
            {"id": batch_id},
            {"$set": {"items_count": remaining}}
        )
    
    return {"status": "success", "deleted_id": item_id}

@api_router.put("/bash/items/bulk-update")
async def bulk_update_batch_items(
    item_ids: List[str] = Body(...),
    cost_price: Optional[float] = Body(None),
    extra_costs: Optional[float] = Body(None),
    quantity: Optional[int] = Body(None),
    admin: dict = Depends(require_admin)
):
    """Массовое обновление товаров"""
    update_data = {}
    if cost_price is not None:
        update_data["cost_price"] = cost_price
    if extra_costs is not None:
        update_data["extra_costs"] = extra_costs
    if quantity is not None:
        update_data["quantity"] = quantity
    
    if not update_data:
        return {"status": "no_changes", "updated_count": 0}
    
    updated_count = 0
    for item_id in item_ids:
        item = await db.batch_items.find_one({"id": item_id})
        if item:
            new_item = {**item, **update_data}
            calcs = calculate_profit_roi(new_item)
            update_data_with_calcs = {**update_data, **calcs}
            
            await db.batch_items.update_one(
                {"id": item_id},
                {"$set": update_data_with_calcs}
            )
            updated_count += 1
    
    return {"status": "success", "updated_count": updated_count}

# Заметки к партиям и товарам
@api_router.post("/bash/{batch_id}/notes")
async def add_batch_note(
    batch_id: str,
    note: BatchNoteCreate,
    admin: dict = Depends(require_admin)
):
    """Добавить заметку к партии или товару"""
    batch = await db.batches.find_one({"id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Партия не найдена")
    
    note_record = {
        "id": str(uuid.uuid4()),
        "batch_id": batch_id,
        "item_id": note.item_id,  # Может быть None если заметка к партии
        "text": note.text,
        "created_by": admin["id"],
        "created_by_nickname": admin.get("nickname", "Admin"),
        "created_by_role": admin["role"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.batch_notes.insert_one(note_record)
    note_record.pop("_id", None)
    
    return note_record

@api_router.get("/bash/{batch_id}/notes")
async def get_batch_notes(
    batch_id: str,
    item_id: Optional[str] = None,
    admin: dict = Depends(require_admin)
):
    """Получить заметки партии или товара"""
    query = {"batch_id": batch_id}
    if item_id:
        query["item_id"] = item_id
    
    notes = await db.batch_notes.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"notes": notes}

@api_router.delete("/bash/notes/{note_id}")
async def delete_batch_note(
    note_id: str,
    admin: dict = Depends(require_admin)
):
    """Удалить заметку"""
    result = await db.batch_notes.delete_one({"id": note_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    return {"status": "success"}

# 17track API Integration v2.4
import httpx

TRACK17_API_KEY = os.environ.get("TRACK17_API_KEY", "114009CAF9576DB785D2108EAD87B842")
TRACK17_REGISTER_URL = "https://api.17track.net/track/v2.4/register"
TRACK17_INFO_URL = "https://api.17track.net/track/v2.4/gettrackinfo"

def extract_carrier_from_response(item):
    """Извлечь имя перевозчика из ответа API"""
    try:
        providers = item.get("track_info", {}).get("tracking", {}).get("providers", [])
        if providers:
            return providers[0].get("provider", {}).get("name", "")
    except:
        pass
    return ""

def extract_status_from_response(item):
    """Извлечь статус из ответа API"""
    try:
        latest = item.get("track_info", {}).get("latest_status", {})
        status = latest.get("status", "")
        sub_status = latest.get("sub_status", "")
        if status and sub_status:
            return f"{status} / {sub_status}"
        return status or sub_status or "Нет данных"
    except:
        pass
    return "Нет данных"

def extract_latest_event(item):
    """Извлечь последнее событие"""
    try:
        latest_event = item.get("track_info", {}).get("latest_event", {})
        description = latest_event.get("description", "")
        time_str = latest_event.get("time_iso", "")
        location = latest_event.get("location", "")
        
        parts = []
        if description:
            parts.append(description)
        if location:
            parts.append(f"({location})")
        
        return {
            "description": " ".join(parts) if parts else "",
            "time": time_str
        }
    except:
        pass
    return {"description": "", "time": ""}

@api_router.get("/tracking/{tracking_number}")
async def track_shipment(
    tracking_number: str,
    carrier_code: Optional[str] = None,
    admin: dict = Depends(require_admin)
):
    """Получить статус отправления через 17track API v2.4"""
    if not TRACK17_API_KEY:
        raise HTTPException(status_code=500, detail="17track API key not configured")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "17token": TRACK17_API_KEY,
                "Content-Type": "application/json"
            }
            
            # 1. Регистрируем трекинг номер
            register_payload = [{"number": tracking_number}]
            if carrier_code:
                register_payload[0]["carrier"] = int(carrier_code)
            
            await client.post(TRACK17_REGISTER_URL, json=register_payload, headers=headers)
            
            # Небольшая пауза для обработки
            await asyncio.sleep(0.5)
            
            # 2. Получаем информацию о треке
            info_payload = [{"number": tracking_number}]
            info_resp = await client.post(TRACK17_INFO_URL, json=info_payload, headers=headers)
            
            if info_resp.status_code == 200:
                data = info_resp.json()
                
                # Парсим ответ
                result = {
                    "tracking_number": tracking_number,
                    "status": "success",
                    "carrier": "",
                    "tracking_status": "Нет данных",
                    "last_event": "",
                    "last_time": "",
                    "raw_data": data
                }
                
                # Извлекаем информацию из accepted
                accepted = data.get("data", {}).get("accepted", [])
                if accepted:
                    item = accepted[0]
                    result["carrier"] = extract_carrier_from_response(item)
                    result["tracking_status"] = extract_status_from_response(item)
                    event = extract_latest_event(item)
                    result["last_event"] = event["description"]
                    result["last_time"] = event["time"]
                
                # Проверяем rejected
                rejected = data.get("data", {}).get("rejected", [])
                if rejected and not accepted:
                    error_msg = rejected[0].get("error", {}).get("message", "Ошибка")
                    result["tracking_status"] = error_msg
                
                return result
            else:
                return {
                    "tracking_number": tracking_number,
                    "status": "error",
                    "error": f"API error: {info_resp.status_code}"
                }
                
    except Exception as e:
        logger.error(f"17track API error: {e}")
        return {
            "tracking_number": tracking_number,
            "status": "error",
            "error": str(e)
        }

@api_router.post("/bash/{batch_id}/track")
async def track_batch(
    batch_id: str,
    admin: dict = Depends(require_admin)
):
    """Получить статус отслеживания партии"""
    batch = await db.batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Партия не найдена")
    
    tracking_number = batch.get("tracking_number")
    if not tracking_number:
        return {
            "batch_id": batch_id,
            "status": "no_tracking",
            "message": "Трекинг номер не указан"
        }
    
    carrier_code = batch.get("carrier_code")
    
    # Вызываем трекинг API с carrier_code
    tracking_result = await track_shipment(tracking_number, carrier_code=carrier_code, admin=admin)
    
    # Парсим статус для удобного отображения из tracking_result напрямую
    parsed_status = None
    if tracking_result.get("status") == "success":
        parsed_status = {
            "status_code": 10,  # По умолчанию "В пути"
            "status_text": tracking_result.get("tracking_status", "Нет данных"),
            "last_event": tracking_result.get("last_event", ""),
            "last_time": tracking_result.get("last_time", ""),
            "carrier": tracking_result.get("carrier", "")
        }
        
        # Определяем status_code по тексту статуса
        status_text_lower = (tracking_result.get("tracking_status") or "").lower()
        if "deliver" in status_text_lower or "доставлен" in status_text_lower:
            parsed_status["status_code"] = 40
        elif "transit" in status_text_lower or "пути" in status_text_lower:
            parsed_status["status_code"] = 10
        elif "expired" in status_text_lower or "истёк" in status_text_lower:
            parsed_status["status_code"] = 20
        elif "pickup" in status_text_lower or "pending" in status_text_lower or "ожидан" in status_text_lower:
            parsed_status["status_code"] = 35
        elif "not found" in status_text_lower or "нет данных" in status_text_lower:
            parsed_status["status_code"] = 0
    
    # Сохраняем результат
    await db.batches.update_one(
        {"id": batch_id},
        {"$set": {
            "tracking_status": tracking_result.get("tracking_status", ""),
            "tracking_parsed": parsed_status,
            "tracking_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    tracking_result["parsed"] = parsed_status
    return tracking_result

# Массовое удаление товаров по статусу
@api_router.delete("/bash/{batch_id}/items-by-status")
async def delete_items_by_status(
    batch_id: str,
    statuses: List[str] = Query(..., description="Статусы для удаления"),
    admin: dict = Depends(require_admin)
):
    """Удалить товары с указанными статусами"""
    batch = await db.batches.find_one({"id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Партия не найдена")
    
    # Удаляем товары с указанными статусами
    result = await db.batch_items.delete_many({
        "batch_id": batch_id,
        "status": {"$in": statuses}
    })
    
    # Обновляем счётчик в партии
    remaining = await db.batch_items.count_documents({"batch_id": batch_id})
    await db.batches.update_one(
        {"id": batch_id},
        {"$set": {"items_count": remaining}}
    )
    
    return {
        "status": "success",
        "deleted_count": result.deleted_count,
        "remaining_count": remaining
    }

# Импорт SKU + количество
@api_router.post("/bash/{batch_id}/import-sku-quantity")
async def import_sku_quantity(
    batch_id: str,
    data: SkuQuantityImport,
    admin: dict = Depends(require_admin)
):
    """Импорт количества по артикулу поставщика"""
    batch = await db.batches.find_one({"id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Партия не найдена")
    
    updated_count = 0
    not_found = []
    
    for item_data in data.items:
        supplier_sku = item_data.get("supplier_sku", "").strip()
        quantity = item_data.get("quantity", 0)
        
        if not supplier_sku:
            continue
        
        # Ищем товар по supplier_sku
        existing = await db.batch_items.find_one({
            "batch_id": batch_id,
            "supplier_sku": supplier_sku
        })
        
        if existing:
            # Обновляем количество и пересчитываем прибыль
            new_item = {**existing, "quantity": quantity}
            calcs = calculate_profit_roi(new_item)
            
            await db.batch_items.update_one(
                {"id": existing["id"]},
                {"$set": {"quantity": quantity, **calcs}}
            )
            updated_count += 1
        else:
            not_found.append(supplier_sku)
    
    return {
        "status": "success",
        "updated_count": updated_count,
        "not_found": not_found
    }

# Экспорт SKU + количество (товары где есть supplier_sku и quantity > 0)
@api_router.get("/bash/{batch_id}/export-sku-quantity")
async def export_sku_quantity(
    batch_id: str,
    admin: dict = Depends(require_admin)
):
    """Экспорт SKU + количество для товаров с заполненными данными"""
    batch = await db.batches.find_one({"id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Партия не найдена")
    
    # Получаем товары с supplier_sku и quantity > 0
    items = await db.batch_items.find({
        "batch_id": batch_id,
        "supplier_sku": {"$ne": "", "$exists": True},
        "quantity": {"$gt": 0}
    }, {"_id": 0, "supplier_sku": 1, "quantity": 1, "asin": 1, "title": 1}).to_list(10000)
    
    return {
        "items": items,
        "total": len(items)
    }

# Массовое обновление статуса товаров
@api_router.put("/bash/{batch_id}/items-status")
async def bulk_update_items_status(
    batch_id: str,
    item_ids: List[str] = Body(...),
    status: str = Body(...),
    admin: dict = Depends(require_admin)
):
    """Массовое обновление статуса товаров"""
    batch = await db.batches.find_one({"id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Партия не найдена")
    
    result = await db.batch_items.update_many(
        {"batch_id": batch_id, "id": {"$in": item_ids}},
        {"$set": {"status": status}}
    )
    
    return {
        "status": "success",
        "updated_count": result.modified_count
    }

# ===================== SUPPLIERS SECTION =====================

def extract_domain_name(url: str) -> str:
    """Извлечь чистое доменное имя без TLD (amazon из amazon.com, ebay из ebay.ru)"""
    if not url:
        return ""
    # Убираем протокол
    domain = url.lower().strip()
    domain = re.sub(r'^https?://', '', domain)
    domain = re.sub(r'^www\.', '', domain)
    # Берём только первую часть (до первого /)
    domain = domain.split('/')[0]
    # Убираем TLD (.com, .ru, .co.uk и т.д.)
    parts = domain.split('.')
    if len(parts) >= 2:
        # Убираем последние части (TLD)
        # Для случаев типа co.uk, com.br - убираем 2 последних если предпоследний короткий
        if len(parts) >= 3 and len(parts[-2]) <= 3:
            return parts[-3]
        return parts[-2] if parts[-2] else parts[0]
    return parts[0] if parts else ""

class SupplierCreate(BaseModel):
    site: str = ""
    name: str
    login: str = ""
    password: str = ""
    notes: str = ""

class SupplierUpdate(BaseModel):
    site: Optional[str] = None
    name: Optional[str] = None
    login: Optional[str] = None
    password: Optional[str] = None
    notes: Optional[str] = None

@api_router.get("/suppliers")
async def get_suppliers(
    user: dict = Depends(get_current_user)
):
    """Получить список поставщиков (админы видят всё, сёрчеры - только свои)"""
    role = user.get("role")
    
    if role in ["admin", "super_admin"]:
        # Админы видят всех поставщиков
        suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    else:
        # Сёрчеры видят только своих поставщиков
        suppliers = await db.suppliers.find(
            {"created_by": user.get("id")}, 
            {"_id": 0}
        ).to_list(1000)
    
    return {"suppliers": suppliers}

@api_router.post("/suppliers")
async def create_supplier(
    supplier: SupplierCreate,
    user: dict = Depends(get_current_user)
):
    """Создать нового поставщика с проверкой дублей по домену для сёрчеров"""
    if user.get("role") not in ["searcher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Нет прав для создания поставщика")
    
    role = user.get("role")
    user_id = user.get("id")
    
    # Для сёрчеров проверяем дубли по доменному имени
    if role == "searcher" and supplier.site:
        new_domain = extract_domain_name(supplier.site)
        if new_domain:
            # Проверяем есть ли уже такой домен у этого сёрчера
            existing_suppliers = await db.suppliers.find(
                {"created_by": user_id},
                {"_id": 0, "site": 1}
            ).to_list(1000)
            
            for existing in existing_suppliers:
                existing_domain = extract_domain_name(existing.get("site", ""))
                if existing_domain and existing_domain == new_domain:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Поставщик с сайтом '{new_domain}' уже существует"
                    )
    
    supplier_dict = {
        "id": str(uuid4()),
        "site": supplier.site,
        "name": supplier.name,
        "login": supplier.login,
        "password": supplier.password,
        "notes": supplier.notes,
        "created_by": user.get("id"),
        "created_by_nickname": user.get("nickname", user.get("email", "")),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.suppliers.insert_one(supplier_dict)
    
    # Log activity
    await db.user_activities.insert_one({
        "id": str(uuid4()),
        "user_id": user.get("id"),
        "user_nickname": user.get("nickname"),
        "role": user.get("role"),
        "action": "create_supplier",
        "details": f"Создан поставщик: {supplier.name}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    if "_id" in supplier_dict:
        del supplier_dict["_id"]
    return supplier_dict

@api_router.put("/suppliers/{supplier_id}")
async def update_supplier(
    supplier_id: str,
    supplier: SupplierUpdate,
    user: dict = Depends(get_current_user)
):
    """Обновить поставщика (сёрчеры - только свои, админы - все)"""
    role = user.get("role")
    user_id = user.get("id")
    
    existing = await db.suppliers.find_one({"id": supplier_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Поставщик не найден")
    
    # Сёрчеры могут редактировать только своих поставщиков
    if role == "searcher" and existing.get("created_by") != user_id:
        raise HTTPException(status_code=403, detail="Нет прав для редактирования этого поставщика")
    
    update_data = {k: v for k, v in supplier.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.suppliers.update_one({"id": supplier_id}, {"$set": update_data})
    
    # Log activity
    await db.user_activities.insert_one({
        "id": str(uuid4()),
        "user_id": user.get("id"),
        "user_nickname": user.get("nickname"),
        "role": user.get("role"),
        "action": "update_supplier",
        "details": f"Обновлён поставщик ID: {supplier_id}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    updated = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    return updated

@api_router.delete("/suppliers/{supplier_id}")
async def delete_supplier(
    supplier_id: str,
    user: dict = Depends(get_current_user)
):
    """Удалить поставщика (сёрчеры - только свои, админы - все)"""
    role = user.get("role")
    user_id = user.get("id")
    
    existing = await db.suppliers.find_one({"id": supplier_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Поставщик не найден")
    
    # Сёрчеры могут удалять только своих поставщиков
    if role == "searcher" and existing.get("created_by") != user_id:
        raise HTTPException(status_code=403, detail="Нет прав для удаления этого поставщика")
    
    await db.suppliers.delete_one({"id": supplier_id})
    
    # Log activity
    await db.user_activities.insert_one({
        "id": str(uuid4()),
        "user_id": user.get("id"),
        "user_nickname": user.get("nickname"),
        "role": user.get("role"),
        "action": "delete_supplier",
        "details": f"Удалён поставщик: {existing.get('name')}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"status": "success", "message": "Поставщик удалён"}

# ============== TASKS API ==============

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    assigned_to_id: str  # ID админа которому назначена задача
    priority: str = TaskPriority.MEDIUM
    deadline: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[str] = None
    admin_notes: Optional[str] = None

@api_router.get("/tasks")
async def get_tasks(user: dict = Depends(require_admin)):
    """Получить список задач (супер-админ видит все, админ - только свои)"""
    role = user.get("role")
    user_id = user.get("id")
    
    if role == "super_admin":
        # Супер-админ видит все задачи
        tasks = await db.tasks.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    else:
        # Админ видит только назначенные ему задачи
        tasks = await db.tasks.find({"assigned_to_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Добавляем имена пользователей
    user_ids = list(set([t.get("assigned_to_id") for t in tasks if t.get("assigned_to_id")] + 
                       [t.get("created_by_id") for t in tasks if t.get("created_by_id")]))
    users = await db.users.find({"id": {"$in": user_ids}}, {"id": 1, "nickname": 1, "_id": 0}).to_list(100)
    users_map = {u["id"]: u["nickname"] for u in users}
    
    for task in tasks:
        task["assigned_to_name"] = users_map.get(task.get("assigned_to_id"), "")
        task["created_by_name"] = users_map.get(task.get("created_by_id"), "")
    
    return {"tasks": tasks}

@api_router.post("/tasks")
async def create_task(task: TaskCreate, admin: dict = Depends(require_super_admin)):
    """Создать задачу (только супер-админ)"""
    # Проверяем что назначенный пользователь существует
    assigned_user = await db.users.find_one({"id": task.assigned_to_id})
    if not assigned_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    new_task = {
        "id": str(uuid4()),
        "title": sanitize_input(task.title),
        "description": sanitize_input(task.description),
        "assigned_to_id": task.assigned_to_id,
        "created_by_id": admin["id"],
        "priority": task.priority,
        "deadline": task.deadline,
        "status": TaskStatus.PENDING,
        "admin_notes": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tasks.insert_one(new_task)
    new_task.pop("_id", None)
    
    # Создаем уведомление для назначенного админа
    if assigned_user.get("role") in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        await create_notification(
            user_id=task.assigned_to_id,
            notification_type=NotificationType.TASK_ASSIGNED,
            title="Новая задача",
            message=f'Вам назначена задача: "{sanitize_input(task.title)}"',
            task_id=new_task["id"],
            link="/tasks",
            from_user_id=admin["id"]
        )
    
    return new_task

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, update: TaskUpdate, user: dict = Depends(require_admin)):
    """Обновить задачу"""
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    role = user.get("role")
    user_id = user.get("id")
    
    # Админ может обновлять только свои задачи (статус и заметки)
    # Супер-админ может обновлять всё
    if role != "super_admin" and task.get("assigned_to_id") != user_id:
        raise HTTPException(status_code=403, detail="Нет прав")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if role == "super_admin":
        # Супер-админ может менять всё
        if update.title is not None:
            update_data["title"] = sanitize_input(update.title)
        if update.description is not None:
            update_data["description"] = sanitize_input(update.description)
        if update.priority is not None:
            update_data["priority"] = update.priority
        if update.deadline is not None:
            update_data["deadline"] = update.deadline
    
    # И админ и супер-админ могут менять статус и заметки
    if update.status is not None:
        update_data["status"] = update.status
    if update.admin_notes is not None:
        update_data["admin_notes"] = sanitize_input(update.admin_notes)
    
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    
    updated = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return updated

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, admin: dict = Depends(require_super_admin)):
    """Удалить задачу (только супер-админ)"""
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    await db.tasks.delete_one({"id": task_id})
    return {"status": "success"}


# ============== NOTIFICATIONS API ==============

@api_router.get("/notifications")
async def get_notifications(
    limit: int = Query(50, ge=1, le=200),
    unread_only: bool = Query(False),
    user: dict = Depends(get_current_user)
):
    """Получить уведомления текущего пользователя"""
    query = {"user_id": user["id"]}
    if unread_only:
        query["is_read"] = False
    
    notifications = await db.notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Подсчитываем непрочитанные
    unread_count = await db.notifications.count_documents({
        "user_id": user["id"],
        "is_read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }


@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    """Отметить уведомление как прочитанное"""
    notification = await db.notifications.find_one({
        "id": notification_id,
        "user_id": user["id"]
    })
    
    if not notification:
        raise HTTPException(status_code=404, detail="Уведомление не найдено")
    
    await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "success"}


@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    """Отметить все уведомления как прочитанные"""
    result = await db.notifications.update_many(
        {"user_id": user["id"], "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "success", "updated_count": result.modified_count}


@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, user: dict = Depends(get_current_user)):
    """Удалить уведомление"""
    notification = await db.notifications.find_one({
        "id": notification_id,
        "user_id": user["id"]
    })
    
    if not notification:
        raise HTTPException(status_code=404, detail="Уведомление не найдено")
    
    await db.notifications.delete_one({"id": notification_id})
    
    return {"status": "success"}


@api_router.get("/")
async def root():
    return {"message": "PROCTO 13 Brand Management API v5.1 - Suppliers Edition"}

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
