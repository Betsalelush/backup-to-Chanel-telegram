from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum

class JobStatus(str, Enum):
    """Job status enumeration"""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    STOPPED = "stopped"

class FileType(str, Enum):
    """File type enumeration"""
    TEXT_ONLY = "text_only"
    ALL_MEDIA = "all_media"
    IMAGES = "images"
    VIDEOS = "videos"
    AUDIO = "audio"
    DOCUMENTS = "documents"
    CUSTOM = "custom"

class SessionStatus(str, Enum):
    """Session status enumeration"""
    CREATED = "created"
    AUTHENTICATING = "authenticating"
    AUTHENTICATED = "authenticated"
    FAILED = "failed"
    DISCONNECTED = "disconnected"

# Request models
class LoginRequest(BaseModel):
    username: str
    password: str

class SessionCreateRequest(BaseModel):
    api_id: int
    api_hash: str
    phone: Optional[str] = None
    use_qr: bool = True

class SessionAuthRequest(BaseModel):
    code: Optional[str] = None
    password: Optional[str] = None

class ChannelResolveRequest(BaseModel):
    session_id: str
    channel_identifier: str

class ForwardingJobRequest(BaseModel):
    name: str
    description: Optional[str] = None
    session_id: str
    source_channel: str
    target_channel: str
    file_types: List[FileType] = [FileType.TEXT_ONLY]
    custom_extensions: Optional[List[str]] = None
    start_from_message_id: Optional[int] = 0
    delay_between_messages: float = 2.0
    max_messages_per_minute: int = 20
    schedule_enabled: bool = False
    schedule_cron: Optional[str] = None
    auto_restart: bool = False
    reset_progress: bool = False
    use_tor: bool = False

class ConfigUpdateRequest(BaseModel):
    max_concurrent_jobs: Optional[int] = None
    default_delay: Optional[float] = None
    default_rate_limit: Optional[int] = None
    notification_settings: Optional[Dict[str, Any]] = None
    security_settings: Optional[Dict[str, Any]] = None

# Response models
class SessionResponse(BaseModel):
    id: str
    phone: Optional[str]
    status: SessionStatus
    created_at: datetime
    last_active: Optional[datetime]
    is_authorized: bool
    qr_code: Optional[str] = None

class ChannelResponse(BaseModel):
    id: int
    title: str
    username: Optional[str]
    type: str
    member_count: Optional[int]
    is_broadcast: bool
    is_megagroup: bool
    is_forum: bool

class JobResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: JobStatus
    session_id: str
    source_channel: Dict[str, Any]
    target_channel: Dict[str, Any]
    config: Dict[str, Any]
    progress: Dict[str, Any]
    stats: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]

class StatsResponse(BaseModel):
    total_jobs: int
    active_jobs: int
    completed_jobs: int
    failed_jobs: int
    total_messages_forwarded: int
    total_sessions: int
    active_sessions: int
    system_uptime: str
    last_activity: Optional[datetime]

class LogEntry(BaseModel):
    timestamp: datetime
    level: str
    message: str
    job_id: Optional[str] = None
    session_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class NotificationSettings(BaseModel):
    email_enabled: bool = False
    email_address: Optional[str] = None
    telegram_enabled: bool = False
    telegram_chat_id: Optional[str] = None
    webhook_enabled: bool = False
    webhook_url: Optional[str] = None

class SecuritySettings(BaseModel):
    require_authentication: bool = True
    session_timeout: int = 1800  # 30 minutes
    max_failed_attempts: int = 5
    rate_limit_per_ip: int = 100
    allow_anonymous_access: bool = False

class SystemConfig(BaseModel):
    max_concurrent_jobs: int = 5
    default_delay_between_messages: float = 2.0
    default_max_messages_per_minute: int = 20
    auto_cleanup_completed_jobs: bool = True
    cleanup_after_days: int = 30
    notification_settings: NotificationSettings = NotificationSettings()
    security_settings: SecuritySettings = SecuritySettings()
    backup_settings: Optional[Dict[str, Any]] = None

# Database models (for MongoDB)
class SessionDocument(BaseModel):
    """Session document structure for MongoDB"""
    _id: Optional[str] = None
    phone: Optional[str]
    api_id: int
    api_hash: str
    session_string: Optional[str] = None
    status: SessionStatus = SessionStatus.CREATED
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active: Optional[datetime] = None
    is_authorized: bool = False
    qr_code_data: Optional[str] = None
    auth_attempts: int = 0
    use_tor: bool = False
    metadata: Optional[Dict[str, Any]] = None

class JobDocument(BaseModel):
    """Job document structure for MongoDB"""
    _id: Optional[str] = None
    name: str
    description: Optional[str] = None
    status: JobStatus = JobStatus.PENDING
    session_id: str
    source_channel: Dict[str, Any]  # Channel info
    target_channel: Dict[str, Any]  # Channel info
    config: Dict[str, Any]  # Job configuration
    progress: Dict[str, Any] = {
        "total_messages": 0,
        "processed_messages": 0,
        "successful_messages": 0,
        "failed_messages": 0,
        "skipped_messages": 0,
        "last_message_id": 0,
        "completion_percentage": 0.0
    }
    stats: Dict[str, Any] = {
        "messages_per_minute": 0.0,
        "average_processing_time": 0.0,
        "estimated_completion": None,
        "error_rate": 0.0
    }
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    logs: List[LogEntry] = []
    schedule_config: Optional[Dict[str, Any]] = None

class ConfigDocument(BaseModel):
    """Configuration document structure for MongoDB"""
    _id: str = "system_config"
    config: SystemConfig = SystemConfig()
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = None

# WebSocket message types
class WSMessageType(str, Enum):
    """WebSocket message types"""
    JOB_STATUS_UPDATE = "job_status_update"
    JOB_PROGRESS_UPDATE = "job_progress_update"
    SESSION_STATUS_UPDATE = "session_status_update"
    SYSTEM_NOTIFICATION = "system_notification"
    ERROR_NOTIFICATION = "error_notification"

class WSMessage(BaseModel):
    """WebSocket message structure"""
    type: WSMessageType
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    job_id: Optional[str] = None
    session_id: Optional[str] = None