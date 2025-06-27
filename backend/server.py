import os
import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
import uvicorn

# Import our Telegram modules
from telegram_manager import TelegramManager
from models import *
from auth import get_current_user, create_access_token
from websocket_manager import WebSocketManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables
mongo_client: Optional[AsyncIOMotorClient] = None
db = None
telegram_manager: Optional[TelegramManager] = None
websocket_manager = WebSocketManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    global mongo_client, db, telegram_manager
    
    try:
        # Initialize MongoDB
        mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017/telegram_manager")
        mongo_client = AsyncIOMotorClient(mongo_url)
        db = mongo_client.telegram_manager
        
        # Test connection
        await mongo_client.admin.command('ping')
        logger.info("✅ Connected to MongoDB")
        
        # Initialize Telegram Manager
        telegram_manager = TelegramManager(db)
        await telegram_manager.initialize()
        logger.info("✅ Telegram Manager initialized")
        
        yield
        
    except Exception as e:
        logger.error(f"❌ Startup error: {e}")
        raise
    finally:
        # Shutdown
        if telegram_manager:
            await telegram_manager.cleanup()
        if mongo_client:
            mongo_client.close()
        logger.info("🔄 Application shutdown complete")

# Create FastAPI app
app = FastAPI(
    title="Telegram Message Manager",
    description="Advanced Telegram message forwarding and management system",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/api/health")
async def health_check():
    """System health check"""
    try:
        # Check MongoDB
        await mongo_client.admin.command('ping')
        mongo_status = "healthy"
    except Exception as e:
        mongo_status = f"error: {str(e)}"
    
    # Check Telegram Manager
    telegram_status = "healthy" if telegram_manager and telegram_manager.is_ready else "not ready"
    
    return {
        "status": "healthy" if mongo_status == "healthy" and telegram_status == "healthy" else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "mongodb": mongo_status,
            "telegram_manager": telegram_status,
            "active_sessions": len(telegram_manager.active_sessions) if telegram_manager else 0
        }
    }

# Authentication endpoints
@app.post("/api/auth/login")
async def login(credentials: LoginRequest):
    """User authentication"""
    try:
        # Simple authentication for now - can be enhanced with proper user management
        if credentials.username == "admin" and credentials.password == "admin":
            access_token = create_access_token({"sub": credentials.username})
            return {"access_token": access_token, "token_type": "bearer"}
        else:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")

# Session management endpoints
@app.post("/api/sessions/create")
async def create_session(session_data: SessionCreateRequest):
    """Create new Telegram session"""
    try:
        result = await telegram_manager.create_session(
            api_id=session_data.api_id,
            api_hash=session_data.api_hash,
            phone=session_data.phone,
            use_qr=session_data.use_qr
        )
        return result
    except Exception as e:
        logger.error(f"Session creation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

@app.post("/api/sessions/{session_id}/authenticate")
async def authenticate_session(session_id: str, auth_data: SessionAuthRequest):
    """Authenticate session with code or password"""
    try:
        result = await telegram_manager.authenticate_session(
            session_id=session_id,
            code=auth_data.code,
            password=auth_data.password
        )
        return result
    except Exception as e:
        logger.error(f"Session authentication error: {e}")
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")

@app.get("/api/sessions")
async def get_sessions():
    """Get all active sessions"""
    try:
        sessions = await telegram_manager.get_all_sessions()
        return {"sessions": sessions}
    except Exception as e:
        logger.error(f"Get sessions error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get sessions")

@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session"""
    try:
        await telegram_manager.delete_session(session_id)
        return {"message": "Session deleted successfully"}
    except Exception as e:
        logger.error(f"Delete session error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete session")

# Channel management endpoints
@app.get("/api/channels/{session_id}")
async def get_channels(session_id: str):
    """Get available channels for a session"""
    try:
        channels = await telegram_manager.get_channels(session_id)
        return {"channels": channels}
    except Exception as e:
        logger.error(f"Get channels error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get channels")

@app.post("/api/channels/resolve")
async def resolve_channel(resolve_data: ChannelResolveRequest):
    """Resolve channel by ID or username"""
    try:
        channel = await telegram_manager.resolve_channel(
            session_id=resolve_data.session_id,
            channel_identifier=resolve_data.channel_identifier
        )
        return channel
    except Exception as e:
        logger.error(f"Resolve channel error: {e}")
        raise HTTPException(status_code=500, detail="Failed to resolve channel")

# Forwarding job endpoints
@app.post("/api/jobs/create")
async def create_forwarding_job(job_data: ForwardingJobRequest, background_tasks: BackgroundTasks):
    """Create a new forwarding job"""
    try:
        job = await telegram_manager.create_forwarding_job(job_data)
        
        # Start the job in background
        background_tasks.add_task(
            telegram_manager.run_forwarding_job,
            job["_id"]
        )
        
        return job
    except Exception as e:
        logger.error(f"Create job error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create job: {str(e)}")

@app.get("/api/jobs")
async def get_jobs():
    """Get all forwarding jobs"""
    try:
        jobs = await telegram_manager.get_all_jobs()
        return {"jobs": jobs}
    except Exception as e:
        logger.error(f"Get jobs error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get jobs")

@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    """Get specific job details"""
    try:
        job = await telegram_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return job
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get job error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get job")

@app.post("/api/jobs/{job_id}/start")
async def start_job(job_id: str, background_tasks: BackgroundTasks):
    """Start a forwarding job"""
    try:
        await telegram_manager.update_job_status(job_id, "running")
        background_tasks.add_task(telegram_manager.run_forwarding_job, job_id)
        return {"message": "Job started successfully"}
    except Exception as e:
        logger.error(f"Start job error: {e}")
        raise HTTPException(status_code=500, detail="Failed to start job")

@app.post("/api/jobs/{job_id}/stop")
async def stop_job(job_id: str):
    """Stop a forwarding job"""
    try:
        await telegram_manager.stop_job(job_id)
        return {"message": "Job stopped successfully"}
    except Exception as e:
        logger.error(f"Stop job error: {e}")
        raise HTTPException(status_code=500, detail="Failed to stop job")

@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job"""
    try:
        await telegram_manager.delete_job(job_id)
        return {"message": "Job deleted successfully"}
    except Exception as e:
        logger.error(f"Delete job error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete job")

# Statistics endpoints
@app.get("/api/stats/overview")
async def get_stats_overview():
    """Get system overview statistics"""
    try:
        stats = await telegram_manager.get_system_stats()
        return stats
    except Exception as e:
        logger.error(f"Get stats error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get statistics")

@app.get("/api/stats/job/{job_id}")
async def get_job_stats(job_id: str):
    """Get job-specific statistics"""
    try:
        stats = await telegram_manager.get_job_stats(job_id)
        return stats
    except Exception as e:
        logger.error(f"Get job stats error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get job statistics")

# WebSocket endpoint for real-time updates
@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await websocket_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)

# Export endpoints
@app.get("/api/export/logs/{job_id}")
async def export_job_logs(job_id: str):
    """Export job logs"""
    try:
        logs = await telegram_manager.export_job_logs(job_id)
        return {"logs": logs}
    except Exception as e:
        logger.error(f"Export logs error: {e}")
        raise HTTPException(status_code=500, detail="Failed to export logs")

# Configuration endpoints
@app.get("/api/config")
async def get_config():
    """Get system configuration"""
    try:
        config = await telegram_manager.get_config()
        return config
    except Exception as e:
        logger.error(f"Get config error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get configuration")

@app.post("/api/config")
async def update_config(config_data: ConfigUpdateRequest):
    """Update system configuration"""
    try:
        await telegram_manager.update_config(config_data.dict())
        return {"message": "Configuration updated successfully"}
    except Exception as e:
        logger.error(f"Update config error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update configuration")

if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )