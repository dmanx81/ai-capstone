from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import AuthContext, get_current_user, require_invite_admin
from app.models import Invitation, OrgMember, Organization, User, uid
from app.routers import as_dict
from app.schemas import InviteIn
from app.services.mail import send_invite_email

router = APIRouter(tags=["invites"])
settings = get_settings()
ROLE_RANK = {"viewer": 0, "member": 1, "admin": 2, "owner": 3}


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _invite_url(token: str) -> str:
    return f"{settings.frontend_origin.rstrip('/')}/invite/{token}"


def _serialize(invite: Invitation, token: str | None = None) -> dict:
    data = as_dict(invite)
    data.pop("token_hash", None)
    if token:
        data["invite_url"] = _invite_url(token)
    return data


def _get_pending(db: Session, raw_token: str) -> Invitation:
    invite = db.query(Invitation).filter(Invitation.token_hash == _hash(raw_token)).one_or_none()
    if not invite or invite.status != "pending":
        raise HTTPException(status_code=404, detail="Invitation not found")
    expires = invite.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        invite.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="Invitation expired")
    return invite


@router.get("/invites")
def list_invites(ctx: AuthContext = Depends(require_invite_admin), db: Session = Depends(get_db)):
    rows = (
        db.query(Invitation)
        .filter(Invitation.org_id == ctx.organization.id)
        .order_by(Invitation.created_at.desc())
        .all()
    )
    return [_serialize(row) for row in rows]


@router.post("/invites", status_code=201)
def create_invite(payload: InviteIn, ctx: AuthContext = Depends(require_invite_admin), db: Session = Depends(get_db)):
    if ROLE_RANK[payload.role] >= ROLE_RANK.get(ctx.role, 0) and ctx.role != "owner":
        raise HTTPException(status_code=403, detail="You cannot assign a role at or above your own")
    existing_user = db.query(User).filter(User.email == payload.email.lower()).one_or_none()
    if existing_user:
        member = (
            db.query(OrgMember)
            .filter(OrgMember.org_id == ctx.organization.id, OrgMember.user_id == existing_user.id)
            .first()
        )
        if member:
            raise HTTPException(status_code=409, detail="That person is already a member")
    pending = (
        db.query(Invitation)
        .filter(
            Invitation.org_id == ctx.organization.id,
            Invitation.email == payload.email.lower(),
            Invitation.status == "pending",
        )
        .first()
    )
    if pending:
        raise HTTPException(status_code=409, detail="A pending invitation already exists for that email")
    raw = secrets.token_urlsafe(32)
    invite = Invitation(
        id=uid(),
        org_id=ctx.organization.id,
        email=payload.email.lower(),
        role=payload.role,
        token_hash=_hash(raw),
        invited_by=ctx.user.id,
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    emailed = send_invite_email(invite.email, ctx.organization.name, _invite_url(raw))
    data = _serialize(invite, raw)
    data["emailed"] = emailed
    return data


@router.post("/invites/{invite_id}/resend")
def resend_invite(invite_id: str, ctx: AuthContext = Depends(require_invite_admin), db: Session = Depends(get_db)):
    invite = (
        db.query(Invitation)
        .filter(Invitation.id == invite_id, Invitation.org_id == ctx.organization.id)
        .one_or_none()
    )
    if not invite or invite.status != "pending":
        raise HTTPException(status_code=404, detail="Pending invitation not found")
    raw = secrets.token_urlsafe(32)
    invite.token_hash = _hash(raw)
    invite.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    invite.last_sent_at = datetime.now(timezone.utc)
    db.commit()
    emailed = send_invite_email(invite.email, ctx.organization.name, _invite_url(raw))
    data = _serialize(invite, raw)
    data["emailed"] = emailed
    return data


@router.post("/invites/{invite_id}/revoke")
def revoke_invite(invite_id: str, ctx: AuthContext = Depends(require_invite_admin), db: Session = Depends(get_db)):
    invite = (
        db.query(Invitation)
        .filter(Invitation.id == invite_id, Invitation.org_id == ctx.organization.id)
        .one_or_none()
    )
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found")
    invite.status = "revoked"
    db.commit()
    return _serialize(invite)


@router.get("/invites/preview/{token}")
def preview_invite(token: str, db: Session = Depends(get_db)):
    invite = _get_pending(db, token)
    org = db.get(Organization, invite.org_id)
    return {"email": invite.email, "role": invite.role, "organization": org.name if org else None, "expires_at": invite.expires_at}


@router.post("/invites/accept/{token}")
def accept_invite(token: str, request_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    invite = _get_pending(db, token)
    if request_user.email.lower() != invite.email.lower():
        raise HTTPException(status_code=403, detail="Sign in with the invited email address to accept")
    existing = (
        db.query(OrgMember)
        .filter(OrgMember.org_id == invite.org_id, OrgMember.user_id == request_user.id)
        .first()
    )
    if not existing:
        db.add(OrgMember(id=uid(), org_id=invite.org_id, user_id=request_user.id, role=invite.role))
    invite.status = "accepted"
    invite.accepted_at = datetime.now(timezone.utc)
    db.commit()
    org = db.get(Organization, invite.org_id)
    return {"ok": True, "organization": as_dict(org) if org else None, "role": invite.role}
