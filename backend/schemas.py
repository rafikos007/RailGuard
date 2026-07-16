from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    region: Optional[str] = None
    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    username: str
    password: str
    region: Optional[str] = None


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    region: Optional[str] = None

class DefectResponse(BaseModel):
    id: int
    image_path: str
    defect_class: str
    confidence: float
    lat: float
    lon: float
    date_detected: datetime
    assigned_to: Optional[int] = None
    class Config:
        from_attributes = True


class FixedDefectResponse(BaseModel):
    id: int
    original_defect_id: int
    original_image_path: Optional[str] = None
    repaired_image_path: str
    defect_class: str
    confidence: float
    lat: float
    lon: float
    date_detected: datetime
    assigned_to: Optional[int] = None
    report_text: Optional[str] = None
    repaired_by: int
    repaired_by_username: Optional[str] = None
    repaired_at: datetime
    is_seen_by_admin: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
