import asyncio
import json
import logging
from typing import List, Dict, Any
from fastapi import WebSocket
from datetime import datetime

logger = logging.getLogger(__name__)

class WebSocketManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_metadata: Dict[WebSocket, Dict] = {}
    
    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection"""
        try:
            await websocket.accept()
            self.active_connections.append(websocket)
            self.connection_metadata[websocket] = {
                "connected_at": datetime.utcnow(),
                "last_activity": datetime.utcnow()
            }
            
            logger.info(f"✅ WebSocket connected. Total connections: {len(self.active_connections)}")
            
            # Send welcome message
            await self.send_personal_message({
                "type": "connection_established",
                "data": {
                    "message": "Connected to Telegram Manager",
                    "timestamp": datetime.utcnow().isoformat()
                }
            }, websocket)
            
        except Exception as e:
            logger.error(f"Failed to accept WebSocket connection: {e}")
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        try:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
            
            if websocket in self.connection_metadata:
                del self.connection_metadata[websocket]
            
            logger.info(f"🔌 WebSocket disconnected. Total connections: {len(self.active_connections)}")
            
        except Exception as e:
            logger.error(f"Error during WebSocket disconnect: {e}")
    
    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Send a message to a specific WebSocket connection"""
        try:
            if websocket in self.active_connections:
                await websocket.send_text(json.dumps(message, default=str))
                
                # Update last activity
                if websocket in self.connection_metadata:
                    self.connection_metadata[websocket]["last_activity"] = datetime.utcnow()
                    
        except Exception as e:
            logger.error(f"Failed to send personal message: {e}")
            # Remove broken connection
            self.disconnect(websocket)
    
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast a message to all connected WebSocket clients"""
        if not self.active_connections:
            return
        
        # Add timestamp if not present
        if "timestamp" not in message:
            message["timestamp"] = datetime.utcnow().isoformat()
        
        # Convert message to JSON
        message_json = json.dumps(message, default=str)
        
        # Send to all connections
        disconnected_connections = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message_json)
                
                # Update last activity
                if connection in self.connection_metadata:
                    self.connection_metadata[connection]["last_activity"] = datetime.utcnow()
                    
            except Exception as e:
                logger.warning(f"Failed to send broadcast message to a connection: {e}")
                disconnected_connections.append(connection)
        
        # Remove failed connections
        for connection in disconnected_connections:
            self.disconnect(connection)
        
        if disconnected_connections:
            logger.info(f"Removed {len(disconnected_connections)} failed connections")
    
    async def send_job_update(self, job_id: str, update_type: str, data: Dict[str, Any]):
        """Send job-specific update"""
        message = {
            "type": f"job_{update_type}",
            "job_id": job_id,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast(message)
    
    async def send_session_update(self, session_id: str, update_type: str, data: Dict[str, Any]):
        """Send session-specific update"""
        message = {
            "type": f"session_{update_type}",
            "session_id": session_id,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast(message)
    
    async def send_system_notification(self, level: str, message: str, metadata: Dict[str, Any] = None):
        """Send system notification"""
        notification = {
            "type": "system_notification",
            "data": {
                "level": level,
                "message": message,
                "metadata": metadata or {},
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        await self.broadcast(notification)
    
    async def send_error_notification(self, error_message: str, job_id: str = None, session_id: str = None):
        """Send error notification"""
        notification = {
            "type": "error_notification",
            "data": {
                "message": error_message,
                "job_id": job_id,
                "session_id": session_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        await self.broadcast(notification)
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get WebSocket connection statistics"""
        now = datetime.utcnow()
        active_count = len(self.active_connections)
        
        # Calculate connection durations
        durations = []
        for connection, metadata in self.connection_metadata.items():
            duration = (now - metadata["connected_at"]).total_seconds()
            durations.append(duration)
        
        return {
            "active_connections": active_count,
            "average_duration_seconds": sum(durations) / len(durations) if durations else 0,
            "total_duration_seconds": sum(durations),
            "connections_metadata": [
                {
                    "connected_at": metadata["connected_at"].isoformat(),
                    "last_activity": metadata["last_activity"].isoformat(),
                    "duration_seconds": (now - metadata["connected_at"]).total_seconds()
                }
                for metadata in self.connection_metadata.values()
            ]
        }
    
    async def cleanup_stale_connections(self, max_idle_minutes: int = 30):
        """Clean up connections that have been idle for too long"""
        if not self.connection_metadata:
            return
        
        now = datetime.utcnow()
        stale_connections = []
        
        for connection, metadata in self.connection_metadata.items():
            idle_time = (now - metadata["last_activity"]).total_seconds() / 60
            if idle_time > max_idle_minutes:
                stale_connections.append(connection)
        
        for connection in stale_connections:
            try:
                await connection.close()
            except:
                pass
            finally:
                self.disconnect(connection)
        
        if stale_connections:
            logger.info(f"Cleaned up {len(stale_connections)} stale WebSocket connections")
    
    async def ping_all_connections(self):
        """Send ping to all connections to check if they're still alive"""
        if not self.active_connections:
            return
        
        ping_message = {
            "type": "ping",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.broadcast(ping_message)