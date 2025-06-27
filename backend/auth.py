import os
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Token security
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return {"username": username}
    except JWTError:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = verify_token(token)
        if payload is None:
            raise credentials_exception
        return payload
    except Exception:
        raise credentials_exception

# Optional: User management functions
class UserManager:
    """Simple user management for demo purposes"""
    
    def __init__(self):
        # In production, this would be in a database
        self.users = {
            "admin": {
                "username": "admin",
                "hashed_password": get_password_hash("admin"),
                "email": "admin@example.com",
                "is_active": True,
                "created_at": datetime.utcnow()
            }
        }
    
    def get_user(self, username: str) -> Optional[dict]:
        """Get user by username"""
        return self.users.get(username)
    
    def authenticate_user(self, username: str, password: str) -> Optional[dict]:
        """Authenticate user"""
        user = self.get_user(username)
        if not user or not verify_password(password, user["hashed_password"]):
            return None
        return user
    
    def create_user(self, username: str, password: str, email: str) -> dict:
        """Create new user"""
        if username in self.users:
            raise ValueError("User already exists")
        
        hashed_password = get_password_hash(password)
        user = {
            "username": username,
            "hashed_password": hashed_password,
            "email": email,
            "is_active": True,
            "created_at": datetime.utcnow()
        }
        
        self.users[username] = user
        return user
    
    def update_user(self, username: str, **kwargs) -> Optional[dict]:
        """Update user"""
        if username not in self.users:
            return None
        
        user = self.users[username]
        for key, value in kwargs.items():
            if key == "password":
                user["hashed_password"] = get_password_hash(value)
            else:
                user[key] = value
        
        return user
    
    def delete_user(self, username: str) -> bool:
        """Delete user"""
        if username not in self.users:
            return False
        
        del self.users[username]
        return True

# Global user manager instance
user_manager = UserManager()