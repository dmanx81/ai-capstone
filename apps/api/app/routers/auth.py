from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import AuthContext, get_context, get_current_user
from app.models import OrgMember, Organization, User, uid
from app.routers import as_dict
from app.schemas import LoginIn, OrgCreate, ProfileUpdate, RegisterIn
from app.security import (
    clear_session_cookie,
    create_token,
    hash_password,
    set_session_cookie,
    verify_password,
)
from app.seed import slugify

router = APIRouter(prefix="/auth", tags=["auth"])


def _memberships(db: Session, user_id: str) -> list[dict[str, str]]:
    rows = (
        db.query(OrgMember, Organization)
        .join(Organization, Organization.id == OrgMember.org_id)
        .filter(OrgMember.user_id == user_id)
        .all()
    )
    return [{"org_id": org.id, "name": org.name, "role": member.role, "plan": org.plan} for member, org in rows]


def _session_payload(db: Session, user: User, org: Organization | None, role: str | None) -> dict:
    return {
        "user": as_dict(user),
        "organization": as_dict(org) if org else None,
        "role": role,
        "memberships": _memberships(db, user.id),
    }


@router.post("/register", status_code=201)
def register(payload: RegisterIn, response: Response, db: Session = Depends(get_db)) -> dict:
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        id=uid(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    db.flush()
    org = None
    role = None
    if payload.organization_name:
        org = Organization(
            id=uid(),
            name=payload.organization_name,
            slug=f"{slugify(payload.organization_name)}-{uid()[:8]}",
            plan="free",
        )
        db.add(org)
        db.flush()
        db.add(OrgMember(id=uid(), org_id=org.id, user_id=user.id, role="owner"))
        role = "owner"
    db.commit()
    token = create_token(user.id, user.email, org.id if org else None)
    set_session_cookie(response, token)
    return _session_payload(db, user, org, role)


@router.post("/login")
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.email == payload.email.lower()).one_or_none()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    member = db.query(OrgMember).filter(OrgMember.user_id == user.id).first()
    org = db.get(Organization, member.org_id) if member else None
    token = create_token(user.id, user.email, org.id if org else None)
    set_session_cookie(response, token)
    return _session_payload(db, user, org, member.role if member else None)


@router.post("/logout")
def logout(response: Response) -> dict:
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me")
def me(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    member = db.query(OrgMember).filter(OrgMember.user_id == user.id).first()
    org = db.get(Organization, member.org_id) if member else None
    return _session_payload(db, user, org, member.role if member else None)


@router.patch("/profile")
def update_profile(payload: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    if payload.full_name:
        user.full_name = payload.full_name
    if payload.title is not None:
        user.title = payload.title
    db.commit()
    db.refresh(user)
    return as_dict(user)


@router.post("/orgs")
def create_org(payload: OrgCreate, response: Response, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    org = Organization(id=uid(), name=payload.name, slug=f"{slugify(payload.name)}-{uid()[:8]}", plan="free")
    db.add(org)
    db.flush()
    db.add(OrgMember(id=uid(), org_id=org.id, user_id=user.id, role="owner"))
    db.commit()
    token = create_token(user.id, user.email, org.id)
    set_session_cookie(response, token)
    return _session_payload(db, user, org, "owner")


@router.post("/orgs/{org_id}/switch")
def switch_org(org_id: str, response: Response, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    member = db.query(OrgMember).filter(OrgMember.user_id == user.id, OrgMember.org_id == org_id).one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    org = db.get(Organization, org_id)
    token = create_token(user.id, user.email, org_id)
    set_session_cookie(response, token)
    return _session_payload(db, user, org, member.role)


@router.get("/members")
def members(ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)) -> list[dict]:
    rows = (
        db.query(OrgMember, User)
        .join(User, User.id == OrgMember.user_id)
        .filter(OrgMember.org_id == ctx.organization.id)
        .all()
    )
    return [
        {"user_id": user.id, "email": user.email, "full_name": user.full_name, "role": member.role}
        for member, user in rows
    ]
