from typing import List
import math
import json
import logging
import os
from datetime import datetime, date as date_cls, timedelta
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from apscheduler.schedulers.background import BackgroundScheduler
from pywebpush import webpush, WebPushException

from database import Base, engine, get_db, SessionLocal
import models
import schemas
from auth import hash_password, verify_password, create_access_token, get_current_user

# VAPID keys: in production, set VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY / VAPID_CLAIM_EMAIL
# as environment variables. Locally, falls back to vapid_config.py (generated once
# via generate_vapid_keys.py) so you don't need to set env vars for dev.
try:
    from vapid_config import (
        VAPID_PRIVATE_KEY_PEM as _LOCAL_VAPID_PRIVATE,
        VAPID_PUBLIC_KEY as _LOCAL_VAPID_PUBLIC,
        VAPID_CLAIM_EMAIL as _LOCAL_VAPID_EMAIL,
    )
except ImportError:
    _LOCAL_VAPID_PRIVATE = _LOCAL_VAPID_PUBLIC = _LOCAL_VAPID_EMAIL = None

VAPID_PRIVATE_KEY_PEM = os.environ.get("VAPID_PRIVATE_KEY") or _LOCAL_VAPID_PRIVATE
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY") or _LOCAL_VAPID_PUBLIC
VAPID_CLAIM_EMAIL = (
    os.environ.get("VAPID_CLAIM_EMAIL") or _LOCAL_VAPID_EMAIL or "mailto:you@example.com"
)

logger = logging.getLogger("uvicorn.error")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smart Attendance Tracker")

# Locally: allows everything (fine for dev).
# In production: set ALLOWED_ORIGINS env var to your frontend's URL(s),
# comma-separated, e.g. "https://your-app.vercel.app"
_allowed_origins_env = os.environ.get("ALLOWED_ORIGINS")
allowed_origins = (
    [o.strip() for o in _allowed_origins_env.split(",")] if _allowed_origins_env else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== AUTH ====================

@app.post("/signup", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = models.User(
        name=user.name,
        email=user.email,
        hashed_password=hash_password(user.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/login")
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


# ==================== SUBJECTS ====================

@app.post("/subjects", response_model=schemas.SubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(
    subject: schemas.SubjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    new_subject = models.Subject(
        user_id=current_user.id,
        name=subject.name,
        code=subject.code,
        target_percentage=subject.target_percentage or 75.0,
    )
    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)
    return new_subject


@app.get("/subjects", response_model=List[schemas.SubjectOut])
def list_subjects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Subject).filter(models.Subject.user_id == current_user.id).all()


def get_owned_subject(subject_id: int, db: Session, current_user: models.User) -> models.Subject:
    subject = (
        db.query(models.Subject)
        .filter(models.Subject.id == subject_id, models.Subject.user_id == current_user.id)
        .first()
    )
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@app.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    subject = get_owned_subject(subject_id, db, current_user)

    # cascade delete: attendance records and timetable slots tied to this subject
    db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.subject_id == subject_id
    ).delete()
    db.query(models.Timetable).filter(
        models.Timetable.subject_id == subject_id
    ).delete()

    db.delete(subject)
    db.commit()
    return None


# ==================== TIMETABLE ====================

@app.post("/timetable", response_model=schemas.TimetableOut, status_code=status.HTTP_201_CREATED)
def create_timetable_slot(
    slot: schemas.TimetableCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_owned_subject(slot.subject_id, db, current_user)  # ownership check

    new_slot = models.Timetable(
        user_id=current_user.id,
        subject_id=slot.subject_id,
        day_of_week=slot.day_of_week,
        start_time=slot.start_time,
        end_time=slot.end_time,
    )
    db.add(new_slot)
    db.commit()
    db.refresh(new_slot)
    return new_slot


@app.get("/timetable", response_model=List[schemas.TimetableOut])
def list_timetable(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Timetable).filter(models.Timetable.user_id == current_user.id).all()


@app.delete("/timetable/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timetable_slot(
    slot_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    slot = (
        db.query(models.Timetable)
        .filter(models.Timetable.id == slot_id, models.Timetable.user_id == current_user.id)
        .first()
    )
    if not slot:
        raise HTTPException(status_code=404, detail="Timetable slot not found")

    # unlink attendance records tied to this slot instead of deleting them
    # (past attendance history should survive even if the slot is removed)
    db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.timetable_id == slot_id
    ).update({models.AttendanceRecord.timetable_id: None})

    db.delete(slot)
    db.commit()
    return None


# ==================== ATTENDANCE ====================

@app.post("/attendance", response_model=schemas.AttendanceOut, status_code=status.HTTP_201_CREATED)
def mark_attendance(
    record: schemas.AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_owned_subject(record.subject_id, db, current_user)  # ownership check

    if record.timetable_id is not None:
        slot = (
            db.query(models.Timetable)
            .filter(
                models.Timetable.id == record.timetable_id,
                models.Timetable.user_id == current_user.id,
            )
            .first()
        )
        if not slot:
            raise HTTPException(status_code=404, detail="Timetable slot not found")

        # For a timetable-linked slot, only one record should exist per date.
        # If one already exists (e.g. marked from a different device), update
        # its status instead of creating a duplicate — last action wins.
        existing = (
            db.query(models.AttendanceRecord)
            .filter(
                models.AttendanceRecord.user_id == current_user.id,
                models.AttendanceRecord.timetable_id == record.timetable_id,
                models.AttendanceRecord.date == record.date,
            )
            .first()
        )
        if existing:
            existing.status = record.status
            db.commit()
            db.refresh(existing)
            return existing

    new_record = models.AttendanceRecord(
        user_id=current_user.id,
        subject_id=record.subject_id,
        timetable_id=record.timetable_id,
        date=record.date,
        status=record.status,
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record


@app.get("/attendance", response_model=List[schemas.AttendanceOut])
def list_attendance(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.AttendanceRecord)
        .filter(models.AttendanceRecord.user_id == current_user.id)
        .order_by(models.AttendanceRecord.date.desc())
        .all()
    )


@app.delete("/attendance/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attendance(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    record = (
        db.query(models.AttendanceRecord)
        .filter(
            models.AttendanceRecord.id == record_id,
            models.AttendanceRecord.user_id == current_user.id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    db.delete(record)
    db.commit()
    return None


# ==================== PERCENTAGE (calculated, not stored) ====================

@app.get("/subjects/{subject_id}/percentage")
def get_subject_percentage(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    subject = get_owned_subject(subject_id, db, current_user)

    counted = (
        db.query(models.AttendanceRecord)
        .filter(
            models.AttendanceRecord.subject_id == subject_id,
            models.AttendanceRecord.user_id == current_user.id,
            models.AttendanceRecord.status != models.StatusEnum.cancelled,
        )
        .all()
    )

    total = len(counted)
    attended = sum(1 for r in counted if r.status == models.StatusEnum.attended)
    percentage = round((attended / total) * 100, 2) if total > 0 else 0.0

    target = subject.target_percentage
    target_fraction = target / 100

    classes_needed = 0    # classes to attend in a row to reach target
    classes_can_skip = 0  # classes that can still be missed and stay at/above target
    target_achievable = True

    if total == 0:
        pass  # no data yet, nothing to compute
    elif percentage >= target:
        if target_fraction > 0:
            can_skip = (attended - target_fraction * total) / target_fraction
            classes_can_skip = max(0, math.floor(can_skip + 1e-9))
    else:
        if target_fraction < 1:
            needed = (target_fraction * total - attended) / (1 - target_fraction)
            classes_needed = max(0, math.ceil(needed - 1e-9))
        else:
            # target is 100% but at least one class was already missed —
            # mathematically impossible to reach from here
            target_achievable = False

    return {
        "subject_id": subject_id,
        "total_classes": total,
        "attended_classes": attended,
        "percentage": percentage,
        "target_percentage": target,
        "target_achievable": target_achievable,
        "classes_needed_to_reach_target": classes_needed,
        "classes_can_skip_and_stay_on_target": classes_can_skip,
    }


# ==================== PUSH NOTIFICATIONS ====================

@app.get("/push/vapid-public-key")
def get_vapid_public_key():
    return {"public_key": VAPID_PUBLIC_KEY}


@app.post("/push/subscribe", status_code=status.HTTP_201_CREATED)
def subscribe_push(
    sub: schemas.PushSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = (
        db.query(models.PushSubscription)
        .filter(models.PushSubscription.endpoint == sub.endpoint)
        .first()
    )
    if existing:
        existing.user_id = current_user.id
        existing.p256dh = sub.keys.p256dh
        existing.auth = sub.keys.auth
    else:
        db.add(
            models.PushSubscription(
                user_id=current_user.id,
                endpoint=sub.endpoint,
                p256dh=sub.keys.p256dh,
                auth=sub.keys.auth,
            )
        )
    db.commit()
    return {"message": "subscribed"}


@app.delete("/push/subscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe_push(
    endpoint: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == endpoint,
        models.PushSubscription.user_id == current_user.id,
    ).delete()
    db.commit()
    return None


def send_push_to_subscription(sub: models.PushSubscription, payload: dict):
    try:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY_PEM,
            vapid_claims={"sub": VAPID_CLAIM_EMAIL},
            ttl=0,
            # WNS (Edge/Windows push service) rejects the request with 400 if this
            # header isn't set to match ttl — pywebpush doesn't set it automatically.
            # Harmless extra header for FCM (Chrome) and Mozilla's push service.
            headers={"x-wns-cache-policy": "no-cache"},
        )
        return True
    except WebPushException as e:
        # 404/410 means the subscription is gone (browser cleared it) — clean it up
        status_code = getattr(e.response, "status_code", None)
        if status_code in (404, 410):
            db = SessionLocal()
            try:
                db.query(models.PushSubscription).filter(
                    models.PushSubscription.id == sub.id
                ).delete()
                db.commit()
            finally:
                db.close()
        else:
            resp = e.response
            logger.warning(
                f"Push failed for subscription {sub.id}: {e} | "
                f"status={getattr(resp, 'status_code', None)} | "
                f"body={getattr(resp, 'text', None)!r} | "
                f"headers={dict(getattr(resp, 'headers', {}) or {})}"
            )
        return False


def check_and_send_class_end_notifications():
    """Runs every minute: finds timetable slots whose end_time just passed
    for today, and sends a push notification (once per slot per day)."""
    db = SessionLocal()
    try:
        now = datetime.now()
        today_date = now.date()
        backend_day_of_week = today_date.weekday()  # 0=Monday..6=Sunday, matches our convention
        window_start = (now - timedelta(minutes=2)).time()
        window_end = now.time()

        slots = (
            db.query(models.Timetable)
            .filter(
                models.Timetable.day_of_week == backend_day_of_week,
                models.Timetable.end_time.isnot(None),
                models.Timetable.end_time > window_start,
                models.Timetable.end_time <= window_end,
            )
            .all()
        )

        for slot in slots:
            already_sent = (
                db.query(models.NotificationLog)
                .filter(
                    models.NotificationLog.timetable_id == slot.id,
                    models.NotificationLog.date == today_date,
                )
                .first()
            )
            if already_sent:
                continue

            subs = (
                db.query(models.PushSubscription)
                .filter(models.PushSubscription.user_id == slot.user_id)
                .all()
            )
            if not subs:
                continue

            subject = db.query(models.Subject).filter(models.Subject.id == slot.subject_id).first()
            if not subject:
                continue

            payload = {
                "title": subject.name,
                "body": subject.code or "Mark your attendance",
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_code": subject.code,
                "timetable_id": slot.id,
                "date": today_date.isoformat(),
            }

            for sub in subs:
                send_push_to_subscription(sub, payload)

            db.add(
                models.NotificationLog(
                    user_id=slot.user_id,
                    timetable_id=slot.id,
                    date=today_date,
                )
            )
            db.commit()
    finally:
        db.close()


scheduler = BackgroundScheduler()
scheduler.add_job(check_and_send_class_end_notifications, "interval", minutes=1)


@app.on_event("startup")
def start_scheduler():
    if not scheduler.running:
        scheduler.start()


@app.on_event("shutdown")
def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)


@app.get("/")
def root():
    return {"message": "Smart Attendance Tracker API running"}