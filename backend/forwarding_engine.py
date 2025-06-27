import asyncio
import logging
import random
import time
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Set, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from telethon import TelegramClient, errors
from telethon.tl.types import (
    InputPeerChannel, InputPeerChat, MessageMediaPhoto, 
    MessageMediaDocument, Channel, Chat, Message
)

from models import JobStatus, FileType
from websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)

class ForwardingEngine:
    """Advanced message forwarding engine based on existing scripts"""
    
    def __init__(self, db: AsyncIOMotorDatabase, websocket_manager: WebSocketManager):
        self.db = db
        self.websocket_manager = websocket_manager
        self.active_jobs: Dict[str, bool] = {}
        self.job_progress: Dict[str, Dict] = {}
        
    async def run_job(self, job_id: str, client: TelegramClient):
        """Run a forwarding job"""
        try:
            # Mark job as running
            self.active_jobs[job_id] = True
            
            # Get job details
            job = await self.db.jobs.find_one({"_id": ObjectId(job_id)})
            if not job:
                raise Exception("Job not found")
            
            # Update job status
            await self._update_job_status(job_id, JobStatus.RUNNING)
            
            # Initialize progress tracking
            self.job_progress[job_id] = {
                "start_time": datetime.utcnow(),
                "processed_messages": 0,
                "successful_messages": 0,
                "failed_messages": 0,
                "last_message_id": job["config"]["start_from_message_id"],
                "sent_message_ids": set()
            }
            
            # Load existing progress if not resetting
            if not job["config"]["reset_progress"]:
                await self._load_job_progress(job_id)
            
            # Get source and target entities
            source_entity = await self._get_entity_from_config(client, job["source_channel"])
            target_entity = await self._get_entity_from_config(client, job["target_channel"])
            
            # Start forwarding process
            await self._forward_messages(job_id, client, source_entity, target_entity, job["config"])
            
            # Mark as completed if not stopped
            if self.active_jobs.get(job_id, False):
                await self._update_job_status(job_id, JobStatus.COMPLETED)
                await self._send_completion_notification(job_id)
            
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            await self._update_job_status(job_id, JobStatus.FAILED, str(e))
            await self._send_error_notification(job_id, str(e))
        finally:
            # Cleanup
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]
            if job_id in self.job_progress:
                await self._save_job_progress(job_id)
                del self.job_progress[job_id]
    
    async def _get_entity_from_config(self, client: TelegramClient, channel_config: Dict):
        """Get Telegram entity from channel configuration"""
        try:
            channel_id = channel_config["id"]
            return await client.get_entity(channel_id)
        except Exception as e:
            logger.error(f"Failed to get entity for channel {channel_config}: {e}")
            raise
    
    async def _forward_messages(self, job_id: str, client: TelegramClient, source_entity, target_entity, config: Dict):
        """Forward messages from source to target"""
        progress = self.job_progress[job_id]
        file_types = config["file_types"]
        delay = config["delay_between_messages"]
        rate_limit = config["max_messages_per_minute"]
        
        # Rate limiting variables
        messages_this_minute = 0
        minute_start_time = datetime.utcnow()
        consecutive_successes = 0
        
        try:
            # Iterate through messages
            async for message in client.iter_messages(
                source_entity,
                offset_id=progress["last_message_id"],
                reverse=True
            ):
                # Check if job should continue
                if not self.active_jobs.get(job_id, False):
                    logger.info(f"Job {job_id} stopped by user")
                    break
                
                # Skip already processed messages
                if message.id <= progress["last_message_id"] or message.id in progress["sent_message_ids"]:
                    continue
                
                # Rate limiting check
                await self._check_rate_limits(rate_limit, messages_this_minute, minute_start_time)
                
                # Process message
                success = await self._process_single_message(
                    job_id, client, message, target_entity, file_types, config
                )
                
                if success:
                    progress["successful_messages"] += 1
                    progress["sent_message_ids"].add(message.id)
                    consecutive_successes += 1
                    messages_this_minute += 1
                else:
                    progress["failed_messages"] += 1
                    consecutive_successes = 0
                
                progress["processed_messages"] += 1
                progress["last_message_id"] = message.id
                
                # Update progress in database and send WebSocket update
                await self._update_progress(job_id, progress)
                
                # Dynamic delay based on success rate
                actual_delay = self._calculate_dynamic_delay(consecutive_successes, delay)
                await asyncio.sleep(actual_delay)
                
                # Reset rate limiting counter if minute passed
                if (datetime.utcnow() - minute_start_time).total_seconds() >= 60:
                    messages_this_minute = 0
                    minute_start_time = datetime.utcnow()
                
        except errors.FloodWaitError as e:
            logger.warning(f"FloodWait for job {job_id}: {e.seconds} seconds")
            await self._handle_flood_wait(job_id, e.seconds)
        except Exception as e:
            logger.error(f"Error in message forwarding for job {job_id}: {e}")
            raise
    
    async def _process_single_message(self, job_id: str, client: TelegramClient, message: Message, 
                                    target_entity, file_types: List[str], config: Dict) -> bool:
        """Process a single message for forwarding"""
        try:
            # Determine if message should be forwarded based on file types
            should_forward, forward_type = self._should_forward_message(message, file_types)
            
            if not should_forward:
                await self._log_message(job_id, "info", f"Skipped message {message.id} - type not in filter")
                return True  # Skipped successfully
            
            # Prepare target kwargs
            send_kwargs = {}
            if getattr(target_entity, 'forum', False):
                send_kwargs['message_thread_id'] = 1  # General topic
            
            # Forward based on type
            if forward_type == "media" and message.media:
                await self._forward_media_message(client, message, target_entity, send_kwargs)
            elif forward_type == "text" and message.text:
                await self._forward_text_message(client, message, target_entity, send_kwargs)
            else:
                await self._log_message(job_id, "warning", f"Unknown message type for message {message.id}")
                return False
            
            await self._log_message(job_id, "info", f"Successfully forwarded message {message.id}")
            return True
            
        except errors.FloodWaitError as e:
            await self._log_message(job_id, "warning", f"FloodWait on message {message.id}: {e.seconds}s")
            raise  # Re-raise to be handled by caller
        except errors.ChatWriteForbiddenError:
            await self._log_message(job_id, "error", f"No write permission for target channel")
            return False
        except Exception as e:
            await self._log_message(job_id, "error", f"Failed to forward message {message.id}: {e}")
            return False
    
    def _should_forward_message(self, message: Message, file_types: List[str]) -> tuple[bool, str]:
        """Determine if message should be forwarded and its type"""
        if "all_media" in file_types:
            if message.media:
                return True, "media"
            elif message.text:
                return True, "text"
        
        if "text_only" in file_types and message.text and not message.media:
            return True, "text"
        
        if message.media:
            if isinstance(message.media, MessageMediaPhoto) and ("images" in file_types or any(ext in ["jpg", "jpeg", "png", "gif", "webp"] for ext in file_types)):
                return True, "media"
            
            elif isinstance(message.media, MessageMediaDocument) and message.media.document:
                mime_type = message.media.document.mime_type or ""
                file_ext = self._get_file_extension(message.media.document)
                
                if "videos" in file_types and "video" in mime_type:
                    return True, "media"
                elif "audio" in file_types and "audio" in mime_type:
                    return True, "media"
                elif "documents" in file_types and ("application" in mime_type or file_ext in ["pdf", "doc", "docx", "txt"]):
                    return True, "media"
                elif file_ext and file_ext in file_types:  # Custom extensions
                    return True, "media"
        
        return False, "none"
    
    def _get_file_extension(self, document) -> Optional[str]:
        """Extract file extension from document"""
        try:
            for attr in document.attributes:
                if hasattr(attr, 'file_name') and attr.file_name:
                    return attr.file_name.lower().split('.')[-1]
        except:
            pass
        return None
    
    async def _forward_media_message(self, client: TelegramClient, message: Message, target_entity, send_kwargs: Dict):
        """Forward media message"""
        file_to_send = message.photo if isinstance(message.media, MessageMediaPhoto) else message.document
        
        await client.send_file(
            target_entity,
            file=file_to_send,
            caption=message.text or "",
            **send_kwargs
        )
    
    async def _forward_text_message(self, client: TelegramClient, message: Message, target_entity, send_kwargs: Dict):
        """Forward text message"""
        await client.send_message(
            target_entity,
            message=message.text,
            **send_kwargs
        )
    
    def _calculate_dynamic_delay(self, consecutive_successes: int, base_delay: float) -> float:
        """Calculate dynamic delay based on success rate"""
        if consecutive_successes > 20:
            return random.uniform(0.5, base_delay)
        elif consecutive_successes < 5:
            return random.uniform(base_delay, base_delay * 3)
        else:
            return random.uniform(base_delay * 0.8, base_delay * 1.2)
    
    async def _check_rate_limits(self, rate_limit: int, messages_this_minute: int, minute_start_time: datetime):
        """Check and enforce rate limits"""
        if messages_this_minute >= rate_limit:
            time_elapsed = (datetime.utcnow() - minute_start_time).total_seconds()
            if time_elapsed < 60:
                wait_time = 60 - time_elapsed
                logger.info(f"Rate limit reached. Waiting {wait_time} seconds...")
                await asyncio.sleep(wait_time)
    
    async def _handle_flood_wait(self, job_id: str, wait_seconds: int):
        """Handle FloodWait error"""
        wait_time = wait_seconds + random.uniform(2, 7)  # Add some randomness
        
        await self._log_message(job_id, "warning", f"FloodWait: waiting {wait_time} seconds")
        
        # Send WebSocket notification
        await self.websocket_manager.send_job_update(job_id, "flood_wait", {
            "wait_seconds": wait_time,
            "resume_at": (datetime.utcnow() + timedelta(seconds=wait_time)).isoformat()
        })
        
        await asyncio.sleep(wait_time)
    
    async def _update_job_status(self, job_id: str, status: JobStatus, error_message: str = None):
        """Update job status in database"""
        update_data = {
            "status": status,
            "updated_at": datetime.utcnow()
        }
        
        if status == JobStatus.RUNNING:
            update_data["started_at"] = datetime.utcnow()
        elif status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.STOPPED]:
            update_data["completed_at"] = datetime.utcnow()
        
        if error_message:
            update_data["error_message"] = error_message
        
        await self.db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": update_data}
        )
        
        # Send WebSocket notification
        await self.websocket_manager.send_job_update(job_id, "status_change", {
            "status": status,
            "error_message": error_message
        })
    
    async def _update_progress(self, job_id: str, progress: Dict):
        """Update job progress in database and send WebSocket update"""
        # Calculate statistics
        total_processed = progress["processed_messages"]
        success_rate = (progress["successful_messages"] / total_processed * 100) if total_processed > 0 else 0
        
        # Calculate messages per minute
        elapsed_time = (datetime.utcnow() - progress["start_time"]).total_seconds() / 60
        messages_per_minute = progress["processed_messages"] / elapsed_time if elapsed_time > 0 else 0
        
        progress_data = {
            "total_messages": 0,  # Will be updated when we know the total
            "processed_messages": progress["processed_messages"],
            "successful_messages": progress["successful_messages"],
            "failed_messages": progress["failed_messages"],
            "skipped_messages": total_processed - progress["successful_messages"] - progress["failed_messages"],
            "last_message_id": progress["last_message_id"],
            "completion_percentage": 0.0  # Will be calculated when we know total
        }
        
        stats_data = {
            "messages_per_minute": round(messages_per_minute, 2),
            "success_rate": round(success_rate, 2),
            "estimated_completion": None,  # Will be calculated later
            "error_rate": round((progress["failed_messages"] / total_processed * 100) if total_processed > 0 else 0, 2)
        }
        
        # Update database
        await self.db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "progress": progress_data,
                    "stats": stats_data,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Send WebSocket update
        await self.websocket_manager.send_job_update(job_id, "progress", {
            "progress": progress_data,
            "stats": stats_data
        })
    
    async def _load_job_progress(self, job_id: str):
        """Load existing job progress"""
        try:
            job = await self.db.jobs.find_one({"_id": ObjectId(job_id)})
            if job and "progress" in job:
                self.job_progress[job_id].update({
                    "processed_messages": job["progress"].get("processed_messages", 0),
                    "successful_messages": job["progress"].get("successful_messages", 0),
                    "failed_messages": job["progress"].get("failed_messages", 0),
                    "last_message_id": job["progress"].get("last_message_id", 0)
                })
                
                logger.info(f"Loaded progress for job {job_id}: {self.job_progress[job_id]}")
                
        except Exception as e:
            logger.error(f"Failed to load progress for job {job_id}: {e}")
    
    async def _save_job_progress(self, job_id: str):
        """Save job progress to database"""
        try:
            if job_id not in self.job_progress:
                return
            
            progress = self.job_progress[job_id]
            
            # Convert set to list for JSON serialization
            sent_ids = list(progress["sent_message_ids"])
            
            # Limit the size of sent_message_ids to prevent database bloat
            if len(sent_ids) > 100000:
                sent_ids = sent_ids[-100000:]  # Keep only the latest 100k IDs
            
            await self.db.job_progress.update_one(
                {"job_id": job_id},
                {
                    "$set": {
                        "progress": {
                            "processed_messages": progress["processed_messages"],
                            "successful_messages": progress["successful_messages"],
                            "failed_messages": progress["failed_messages"],
                            "last_message_id": progress["last_message_id"],
                            "sent_message_ids": sent_ids
                        },
                        "updated_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            
            logger.info(f"Saved progress for job {job_id}")
            
        except Exception as e:
            logger.error(f"Failed to save progress for job {job_id}: {e}")
    
    async def _log_message(self, job_id: str, level: str, message: str):
        """Log a message for the job"""
        try:
            log_entry = {
                "job_id": job_id,
                "level": level,
                "message": message,
                "timestamp": datetime.utcnow()
            }
            
            await self.db.logs.insert_one(log_entry)
            
            # Also send to WebSocket for real-time monitoring
            await self.websocket_manager.send_job_update(job_id, "log", log_entry)
            
        except Exception as e:
            logger.error(f"Failed to log message for job {job_id}: {e}")
    
    async def _send_completion_notification(self, job_id: str):
        """Send completion notification"""
        try:
            progress = self.job_progress.get(job_id, {})
            
            await self.websocket_manager.send_system_notification(
                "success",
                f"Job {job_id} completed successfully",
                {
                    "job_id": job_id,
                    "processed_messages": progress.get("processed_messages", 0),
                    "successful_messages": progress.get("successful_messages", 0)
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to send completion notification for job {job_id}: {e}")
    
    async def _send_error_notification(self, job_id: str, error_message: str):
        """Send error notification"""
        try:
            await self.websocket_manager.send_error_notification(
                f"Job {job_id} failed: {error_message}",
                job_id=job_id
            )
            
        except Exception as e:
            logger.error(f"Failed to send error notification for job {job_id}: {e}")
    
    def stop_job(self, job_id: str):
        """Stop a running job"""
        if job_id in self.active_jobs:
            self.active_jobs[job_id] = False
            logger.info(f"Job {job_id} marked for stopping")