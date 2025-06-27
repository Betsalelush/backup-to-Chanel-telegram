import asyncio
import json
import logging
import os
import io
import qrcode
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Set
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import uuid

from telethon import TelegramClient, errors, types
from telethon.sessions import StringSession
from telethon.tl.types import (
    InputPeerChannel, InputPeerChat, MessageMediaPhoto, 
    MessageMediaDocument, Channel, Chat, Message
)

from models import *
from websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)

class TelegramManager:
    """Central manager for all Telegram operations"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.active_sessions: Dict[str, TelegramClient] = {}
        self.active_jobs: Dict[str, bool] = {}  # job_id -> is_running
        self.websocket_manager = WebSocketManager()
        self.is_ready = False
        
        # Rate limiting settings
        self.default_delay = 2.0
        self.default_rate_limit = 20
        
    async def initialize(self):
        """Initialize the Telegram Manager"""
        try:
            # Create indexes
            await self._create_indexes()
            
            # Load existing sessions
            await self._load_existing_sessions()
            
            self.is_ready = True
            logger.info("✅ Telegram Manager initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Telegram Manager: {e}")
            raise
    
    async def _create_indexes(self):
        """Create database indexes"""
        try:
            # Sessions collection indexes
            await self.db.sessions.create_index("phone", unique=True, sparse=True)
            await self.db.sessions.create_index("status")
            await self.db.sessions.create_index("created_at")
            
            # Jobs collection indexes
            await self.db.jobs.create_index("session_id")
            await self.db.jobs.create_index("status")
            await self.db.jobs.create_index("created_at")
            await self.db.jobs.create_index([("name", "text")])
            
            # Logs collection indexes
            await self.db.logs.create_index("timestamp")
            await self.db.logs.create_index("job_id")
            await self.db.logs.create_index("level")
            
            logger.info("✅ Database indexes created")
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to create some indexes: {e}")
    
    async def _load_existing_sessions(self):
        """Load existing active sessions"""
        try:
            cursor = self.db.sessions.find({"status": SessionStatus.AUTHENTICATED})
            async for session_doc in cursor:
                try:
                    await self._restore_session(session_doc)
                except Exception as e:
                    logger.warning(f"Failed to restore session {session_doc['_id']}: {e}")
                    # Update session status to disconnected
                    await self.db.sessions.update_one(
                        {"_id": session_doc["_id"]},
                        {"$set": {"status": SessionStatus.DISCONNECTED}}
                    )
            
            logger.info(f"✅ Loaded {len(self.active_sessions)} active sessions")
            
        except Exception as e:
            logger.error(f"Failed to load existing sessions: {e}")
    
    async def _restore_session(self, session_doc: Dict):
        """Restore a session from database"""
        try:
            session_id = str(session_doc["_id"])
            
            # Create client
            client = TelegramClient(
                StringSession(session_doc["session_string"]),
                session_doc["api_id"],
                session_doc["api_hash"]
            )
            
            # Connect and verify
            await client.connect()
            if await client.is_user_authorized():
                self.active_sessions[session_id] = client
                
                # Update last active
                await self.db.sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {"$set": {"last_active": datetime.utcnow()}}
                )
                
                logger.info(f"✅ Restored session {session_id}")
            else:
                await client.disconnect()
                logger.warning(f"Session {session_id} is no longer authorized")
                
        except Exception as e:
            logger.error(f"Failed to restore session {session_doc['_id']}: {e}")
            raise
    
    async def create_session(self, api_id: int, api_hash: str, phone: Optional[str] = None, use_qr: bool = True) -> Dict:
        """Create a new Telegram session"""
        try:
            session_id = str(ObjectId())
            
            # Create session document
            session_doc = SessionDocument(
                _id=session_id,
                phone=phone,
                api_id=api_id,
                api_hash=api_hash,
                status=SessionStatus.CREATED
            )
            
            # Save to database
            await self.db.sessions.insert_one(session_doc.dict())
            
            # Create Telegram client
            client = TelegramClient(StringSession(), api_id, api_hash)
            await client.connect()
            
            if use_qr:
                # Generate QR code
                qr_login = await client.qr_login()
                
                # Generate QR code image
                qr = qrcode.QRCode(border=2)
                qr.add_data(qr_login.url)
                qr_text = io.StringIO()
                qr.print_ascii(out=qr_text)
                qr_code_ascii = qr_text.getvalue()
                
                # Update session with QR code
                await self.db.sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {
                        "$set": {
                            "qr_code_data": qr_code_ascii,
                            "status": SessionStatus.AUTHENTICATING
                        }
                    }
                )
                
                # Store client temporarily
                self.active_sessions[f"{session_id}_temp"] = client
                
                # Start QR authentication process
                asyncio.create_task(self._handle_qr_authentication(session_id, qr_login))
                
                return {
                    "session_id": session_id,
                    "qr_code": qr_code_ascii,
                    "status": "authenticating",
                    "url": qr_login.url
                }
            else:
                # Phone number authentication
                if not phone:
                    raise ValueError("Phone number required for non-QR authentication")
                
                await client.send_code_request(phone)
                
                await self.db.sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {"$set": {"status": SessionStatus.AUTHENTICATING}}
                )
                
                self.active_sessions[f"{session_id}_temp"] = client
                
                return {
                    "session_id": session_id,
                    "status": "authenticating",
                    "message": "Code sent to phone number"
                }
                
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            raise
    
    async def _handle_qr_authentication(self, session_id: str, qr_login):
        """Handle QR code authentication process"""
        try:
            # Wait for QR scan (2 minutes timeout)
            await asyncio.wait_for(qr_login.wait(), timeout=120)
            
            # Get the temporary client
            client = self.active_sessions.get(f"{session_id}_temp")
            if not client:
                raise Exception("Client not found")
            
            # Check if authorized
            if await client.is_user_authorized():
                # Get session string
                session_string = client.session.save()
                
                # Get user info
                me = await client.get_me()
                phone = me.phone if hasattr(me, 'phone') else None
                
                # Update database
                await self.db.sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {
                        "$set": {
                            "session_string": session_string,
                            "phone": phone,
                            "status": SessionStatus.AUTHENTICATED,
                            "is_authorized": True,
                            "last_active": datetime.utcnow()
                        }
                    }
                )
                
                # Move client to active sessions
                self.active_sessions[session_id] = client
                del self.active_sessions[f"{session_id}_temp"]
                
                # Send WebSocket notification
                await self.websocket_manager.broadcast({
                    "type": WSMessageType.SESSION_STATUS_UPDATE,
                    "data": {
                        "session_id": session_id,
                        "status": "authenticated",
                        "phone": phone
                    }
                })
                
                logger.info(f"✅ Session {session_id} authenticated successfully")
            else:
                raise Exception("Authorization failed")
                
        except asyncio.TimeoutError:
            # QR code expired
            await self._handle_session_failure(session_id, "QR code expired")
        except Exception as e:
            await self._handle_session_failure(session_id, str(e))
    
    async def _handle_session_failure(self, session_id: str, error_message: str):
        """Handle session authentication failure"""
        try:
            # Update database
            await self.db.sessions.update_one(
                {"_id": ObjectId(session_id)},
                {
                    "$set": {
                        "status": SessionStatus.FAILED,
                        "error_message": error_message
                    }
                }
            )
            
            # Clean up temporary client
            temp_key = f"{session_id}_temp"
            if temp_key in self.active_sessions:
                await self.active_sessions[temp_key].disconnect()
                del self.active_sessions[temp_key]
            
            # Send WebSocket notification
            await self.websocket_manager.broadcast({
                "type": WSMessageType.SESSION_STATUS_UPDATE,
                "data": {
                    "session_id": session_id,
                    "status": "failed",
                    "error": error_message
                }
            })
            
            logger.error(f"❌ Session {session_id} authentication failed: {error_message}")
            
        except Exception as e:
            logger.error(f"Failed to handle session failure: {e}")
    
    async def authenticate_session(self, session_id: str, code: Optional[str] = None, password: Optional[str] = None) -> Dict:
        """Authenticate session with code or password"""
        try:
            client = self.active_sessions.get(f"{session_id}_temp")
            if not client:
                raise Exception("Session not found or not in authentication state")
            
            if code:
                # Phone authentication with code
                session_doc = await self.db.sessions.find_one({"_id": ObjectId(session_id)})
                if not session_doc:
                    raise Exception("Session not found")
                
                await client.sign_in(session_doc["phone"], code)
                
            elif password:
                # Two-factor authentication
                await client.sign_in(password=password)
            else:
                raise ValueError("Either code or password required")
            
            # Check if authorized
            if await client.is_user_authorized():
                # Get session string and user info
                session_string = client.session.save()
                me = await client.get_me()
                phone = me.phone if hasattr(me, 'phone') else None
                
                # Update database
                await self.db.sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {
                        "$set": {
                            "session_string": session_string,
                            "phone": phone,
                            "status": SessionStatus.AUTHENTICATED,
                            "is_authorized": True,
                            "last_active": datetime.utcnow()
                        }
                    }
                )
                
                # Move to active sessions
                self.active_sessions[session_id] = client
                del self.active_sessions[f"{session_id}_temp"]
                
                return {
                    "session_id": session_id,
                    "status": "authenticated",
                    "phone": phone
                }
            else:
                raise Exception("Authentication failed")
                
        except errors.SessionPasswordNeededError:
            return {
                "session_id": session_id,
                "status": "password_required",
                "message": "Two-factor authentication required"
            }
        except Exception as e:
            await self._handle_session_failure(session_id, str(e))
            raise
    
    async def get_all_sessions(self) -> List[Dict]:
        """Get all sessions"""
        try:
            sessions = []
            cursor = self.db.sessions.find({}).sort("created_at", -1)
            
            async for session_doc in cursor:
                session_data = {
                    "id": str(session_doc["_id"]),
                    "phone": session_doc.get("phone"),
                    "status": session_doc["status"],
                    "created_at": session_doc["created_at"],
                    "last_active": session_doc.get("last_active"),
                    "is_authorized": session_doc.get("is_authorized", False),
                    "is_connected": str(session_doc["_id"]) in self.active_sessions
                }
                sessions.append(session_data)
            
            return sessions
            
        except Exception as e:
            logger.error(f"Failed to get sessions: {e}")
            raise
    
    async def delete_session(self, session_id: str):
        """Delete a session"""
        try:
            # Disconnect client if active
            if session_id in self.active_sessions:
                await self.active_sessions[session_id].disconnect()
                del self.active_sessions[session_id]
            
            # Remove from database
            await self.db.sessions.delete_one({"_id": ObjectId(session_id)})
            
            logger.info(f"✅ Session {session_id} deleted")
            
        except Exception as e:
            logger.error(f"Failed to delete session {session_id}: {e}")
            raise
    
    async def get_channels(self, session_id: str) -> List[Dict]:
        """Get available channels for a session"""
        try:
            client = self.active_sessions.get(session_id)
            if not client:
                raise Exception("Session not found or not connected")
            
            channels = []
            dialogs = await client.get_dialogs()
            
            for dialog in dialogs:
                if hasattr(dialog.entity, 'broadcast') or hasattr(dialog.entity, 'megagroup'):
                    entity_type = "channel" if getattr(dialog.entity, 'broadcast', False) else "group"
                    username = getattr(dialog.entity, 'username', None)
                    
                    channel_data = {
                        "id": dialog.entity.id,
                        "title": dialog.title,
                        "username": username,
                        "type": entity_type,
                        "is_broadcast": getattr(dialog.entity, 'broadcast', False),
                        "is_megagroup": getattr(dialog.entity, 'megagroup', False),
                        "is_forum": getattr(dialog.entity, 'forum', False),
                        "member_count": getattr(dialog.entity, 'participants_count', None)
                    }
                    channels.append(channel_data)
            
            return channels
            
        except Exception as e:
            logger.error(f"Failed to get channels for session {session_id}: {e}")
            raise
    
    async def resolve_channel(self, session_id: str, channel_identifier: str) -> Dict:
        """Resolve channel by ID or username"""
        try:
            client = self.active_sessions.get(session_id)
            if not client:
                raise Exception("Session not found or not connected")
            
            # Try to resolve the channel
            entity = await client.get_entity(channel_identifier)
            
            return {
                "id": entity.id,
                "title": getattr(entity, 'title', 'Unknown'),
                "username": getattr(entity, 'username', None),
                "type": "channel" if getattr(entity, 'broadcast', False) else "group",
                "is_broadcast": getattr(entity, 'broadcast', False),
                "is_megagroup": getattr(entity, 'megagroup', False),
                "is_forum": getattr(entity, 'forum', False),
                "member_count": getattr(entity, 'participants_count', None)
            }
            
        except Exception as e:
            logger.error(f"Failed to resolve channel {channel_identifier}: {e}")
            raise
    
    async def create_forwarding_job(self, job_data: ForwardingJobRequest) -> Dict:
        """Create a new forwarding job"""
        try:
            # Validate session
            if job_data.session_id not in self.active_sessions:
                raise Exception("Session not found or not connected")
            
            # Resolve source and target channels
            source_channel = await self.resolve_channel(job_data.session_id, job_data.source_channel)
            target_channel = await self.resolve_channel(job_data.session_id, job_data.target_channel)
            
            # Create job document
            job_id = str(ObjectId())
            job_doc = JobDocument(
                _id=job_id,
                name=job_data.name,
                description=job_data.description,
                session_id=job_data.session_id,
                source_channel=source_channel,
                target_channel=target_channel,
                config={
                    "file_types": [ft.value for ft in job_data.file_types],
                    "custom_extensions": job_data.custom_extensions,
                    "start_from_message_id": job_data.start_from_message_id,
                    "delay_between_messages": job_data.delay_between_messages,
                    "max_messages_per_minute": job_data.max_messages_per_minute,
                    "schedule_enabled": job_data.schedule_enabled,
                    "schedule_cron": job_data.schedule_cron,
                    "auto_restart": job_data.auto_restart,
                    "reset_progress": job_data.reset_progress,
                    "use_tor": job_data.use_tor
                }
            )
            
            # Save to database
            await self.db.jobs.insert_one(job_doc.dict())
            
            logger.info(f"✅ Created forwarding job {job_id}")
            
            return job_doc.dict()
            
        except Exception as e:
            logger.error(f"Failed to create forwarding job: {e}")
            raise
    
    async def cleanup(self):
        """Cleanup resources"""
        try:
            # Disconnect all active sessions
            for session_id, client in self.active_sessions.items():
                try:
                    if client.is_connected():
                        await client.disconnect()
                except Exception as e:
                    logger.warning(f"Failed to disconnect session {session_id}: {e}")
            
            self.active_sessions.clear()
            logger.info("✅ Telegram Manager cleanup completed")
            
        except Exception as e:
            logger.error(f"Cleanup error: {e}")
    
    # Additional methods will be implemented in the next part...
    async def get_all_jobs(self) -> List[Dict]:
        """Get all jobs"""
        try:
            jobs = []
            cursor = self.db.jobs.find({}).sort("created_at", -1)
            
            async for job_doc in cursor:
                job_doc["id"] = str(job_doc["_id"])
                jobs.append(job_doc)
            
            return jobs
            
        except Exception as e:
            logger.error(f"Failed to get jobs: {e}")
            raise
    
    async def get_job(self, job_id: str) -> Optional[Dict]:
        """Get specific job"""
        try:
            job_doc = await self.db.jobs.find_one({"_id": ObjectId(job_id)})
            if job_doc:
                job_doc["id"] = str(job_doc["_id"])
            return job_doc
            
        except Exception as e:
            logger.error(f"Failed to get job {job_id}: {e}")
            raise
    
    async def update_job_status(self, job_id: str, status: str):
        """Update job status"""
        try:
            await self.db.jobs.update_one(
                {"_id": ObjectId(job_id)},
                {
                    "$set": {
                        "status": status,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            # Send WebSocket notification
            await self.websocket_manager.broadcast({
                "type": WSMessageType.JOB_STATUS_UPDATE,
                "data": {
                    "job_id": job_id,
                    "status": status
                }
            })
            
        except Exception as e:
            logger.error(f"Failed to update job status: {e}")
            raise
    
    async def stop_job(self, job_id: str):
        """Stop a running job"""
        try:
            self.active_jobs[job_id] = False
            await self.update_job_status(job_id, JobStatus.STOPPED)
            
        except Exception as e:
            logger.error(f"Failed to stop job {job_id}: {e}")
            raise
    
    async def delete_job(self, job_id: str):
        """Delete a job"""
        try:
            # Stop if running
            if job_id in self.active_jobs:
                self.active_jobs[job_id] = False
            
            # Remove from database
            await self.db.jobs.delete_one({"_id": ObjectId(job_id)})
            
            logger.info(f"✅ Job {job_id} deleted")
            
        except Exception as e:
            logger.error(f"Failed to delete job {job_id}: {e}")
            raise
    
    async def get_system_stats(self) -> Dict:
        """Get system statistics"""
        try:
            # Count jobs by status
            total_jobs = await self.db.jobs.count_documents({})
            active_jobs = await self.db.jobs.count_documents({"status": {"$in": ["running", "pending"]}})
            completed_jobs = await self.db.jobs.count_documents({"status": "completed"})
            failed_jobs = await self.db.jobs.count_documents({"status": "failed"})
            
            # Count sessions
            total_sessions = await self.db.sessions.count_documents({})
            active_sessions = len(self.active_sessions)
            
            # Calculate total messages forwarded
            pipeline = [
                {"$group": {"_id": None, "total": {"$sum": "$progress.successful_messages"}}}
            ]
            result = await self.db.jobs.aggregate(pipeline).to_list(1)
            total_messages = result[0]["total"] if result else 0
            
            return {
                "total_jobs": total_jobs,
                "active_jobs": active_jobs,
                "completed_jobs": completed_jobs,
                "failed_jobs": failed_jobs,
                "total_messages_forwarded": total_messages,
                "total_sessions": total_sessions,
                "active_sessions": active_sessions,
                "system_uptime": "N/A",  # Will be calculated based on start time
                "last_activity": datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Failed to get system stats: {e}")
            raise
    
    async def get_job_stats(self, job_id: str) -> Dict:
        """Get job-specific statistics"""
        try:
            job = await self.get_job(job_id)
            if not job:
                raise Exception("Job not found")
            
            return {
                "job_id": job_id,
                "progress": job.get("progress", {}),
                "stats": job.get("stats", {}),
                "status": job.get("status"),
                "created_at": job.get("created_at"),
                "started_at": job.get("started_at"),
                "completed_at": job.get("completed_at")
            }
            
        except Exception as e:
            logger.error(f"Failed to get job stats {job_id}: {e}")
            raise
    
    async def export_job_logs(self, job_id: str) -> List[Dict]:
        """Export job logs"""
        try:
            cursor = self.db.logs.find({"job_id": job_id}).sort("timestamp", 1)
            logs = []
            
            async for log_doc in cursor:
                log_doc["_id"] = str(log_doc["_id"])
                logs.append(log_doc)
            
            return logs
            
        except Exception as e:
            logger.error(f"Failed to export logs for job {job_id}: {e}")
            raise
    
    async def get_config(self) -> Dict:
        """Get system configuration"""
        try:
            config_doc = await self.db.config.find_one({"_id": "system_config"})
            if config_doc:
                return config_doc["config"]
            else:
                # Return default config
                default_config = SystemConfig()
                await self.db.config.insert_one({
                    "_id": "system_config",
                    "config": default_config.dict(),
                    "updated_at": datetime.utcnow()
                })
                return default_config.dict()
                
        except Exception as e:
            logger.error(f"Failed to get config: {e}")
            raise
    
    async def update_config(self, config_data: Dict):
        """Update system configuration"""
        try:
            await self.db.config.update_one(
                {"_id": "system_config"},
                {
                    "$set": {
                        "config": config_data,
                        "updated_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            
            logger.info("✅ Configuration updated")
            
        except Exception as e:
            logger.error(f"Failed to update config: {e}")
            raise
    
    async def run_forwarding_job(self, job_id: str):
        """Run a forwarding job - this will be implemented with the existing scripts logic"""
        # This is a placeholder - will implement the actual forwarding logic
        # using the existing Python scripts in the next iteration
        logger.info(f"Starting forwarding job {job_id}")
        self.active_jobs[job_id] = True
        
        try:
            await self.update_job_status(job_id, JobStatus.RUNNING)
            
            # TODO: Implement actual forwarding logic here
            # This will integrate the existing tor.py, bob.py, etc. functionality
            
            await asyncio.sleep(5)  # Placeholder
            
            if self.active_jobs.get(job_id, False):
                await self.update_job_status(job_id, JobStatus.COMPLETED)
            
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            await self.update_job_status(job_id, JobStatus.FAILED)
        finally:
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]