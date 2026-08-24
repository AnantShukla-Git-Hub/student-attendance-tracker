import enum
from sqlalchemy import (
    Column, Integer, String, DateTime, Date, Time,
    ForeignKey, Enum, Float
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class StatusEnum(str, enum.Enum):
    attended = "attended"
    not_attended = "not_attended"
    cancelled = "cancelled"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    subjects = relationship("Subject", back_populates="owner")
    timetable_slots = relationship("Timetable", back_populates="owner")
    attendance_records = relationship("AttendanceRecord", back_populates="owner")


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(20), nullable=True)
    target_percentage = Column(Float, nullable=False, default=75.0)

    owner = relationship("User", back_populates="subjects")
    timetable_slots = relationship("Timetable", back_populates="subject")
    attendance_records = relationship("AttendanceRecord", back_populates="subject")


class Timetable(Base):
    __tablename__ = "timetable"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday ... 6=Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=True)

    owner = relationship("User", back_populates="timetable_slots")
    subject = relationship("Subject", back_populates="timetable_slots")
    attendance_records = relationship("AttendanceRecord", back_populates="timetable_slot")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    timetable_id = Column(Integer, ForeignKey("timetable.id"), nullable=True)  # NULL = extra class
    date = Column(Date, nullable=False)
    status = Column(Enum(StatusEnum), nullable=False)

    owner = relationship("User", back_populates="attendance_records")
    subject = relationship("Subject", back_populates="attendance_records")
    timetable_slot = relationship("Timetable", back_populates="attendance_records")


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    endpoint = Column(String(500), unique=True, nullable=False)
    p256dh = Column(String(255), nullable=False)
    auth = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User")


class NotificationLog(Base):
    __tablename__ = "notification_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    timetable_id = Column(Integer, ForeignKey("timetable.id"), nullable=False)
    date = Column(Date, nullable=False)