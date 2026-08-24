from pydantic import BaseModel, field_validator
from datetime import datetime, date, time
from typing import Optional
from models import StatusEnum


# ---------- User ----------
class UserCreate(BaseModel):
    name: str
    email: str  # free-text user ID, not validated as a real email
    password: str

    @field_validator("email")
    @classmethod
    def user_id_not_blank(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("User ID cannot be blank")
        return v


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: str
    password: str


# ---------- Subject ----------
class SubjectCreate(BaseModel):
    name: str
    code: Optional[str] = None
    target_percentage: Optional[float] = 75.0


class SubjectOut(BaseModel):
    id: int
    name: str
    code: Optional[str]
    target_percentage: float

    class Config:
        from_attributes = True


# ---------- Timetable ----------
class TimetableCreate(BaseModel):
    subject_id: int
    day_of_week: int          # 0=Monday ... 6=Sunday
    start_time: time
    end_time: Optional[time] = None


class TimetableOut(BaseModel):
    id: int
    subject_id: int
    day_of_week: int
    start_time: time
    end_time: Optional[time]

    class Config:
        from_attributes = True


# ---------- Attendance ----------
class AttendanceCreate(BaseModel):
    subject_id: int
    timetable_id: Optional[int] = None   # None = extra/unplanned class
    date: date
    status: StatusEnum


class AttendanceOut(BaseModel):
    id: int
    subject_id: int
    timetable_id: Optional[int]
    date: date
    status: StatusEnum

    class Config:
        from_attributes = True


# ---------- Push notifications ----------
class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys