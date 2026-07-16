from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="employee")
    region = Column(String, nullable=True)

class Defect(Base):
    __tablename__ = "defects"
    id = Column(Integer, primary_key=True, index=True)
    image_path = Column(String)
    defect_class = Column(String, index=True)
    confidence = Column(Float)
    lat = Column(Float)
    lon = Column(Float)
    date_detected = Column(DateTime)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)


class FixedDefect(Base):
    __tablename__ = "fixed_defects"
    id = Column(Integer, primary_key=True, index=True)
    original_defect_id = Column(Integer, nullable=False, index=True)
    original_image_path = Column(String, nullable=True)
    repaired_image_path = Column(String, nullable=False)
    defect_class = Column(String, index=True)
    confidence = Column(Float)
    lat = Column(Float)
    lon = Column(Float)
    date_detected = Column(DateTime)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    report_text = Column(String, nullable=True)
    repaired_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    repaired_at = Column(DateTime, nullable=False)
    is_seen_by_admin = Column(Boolean, nullable=False, default=False)
