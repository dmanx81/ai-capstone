from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import OrgMember, Organization, User
from app.security import decode_token, token_from_request

WRITE_ROLES = {"owner", "admin", "member"}
INVITE_ROLES = {"owner", "admin"}


@dataclass
class AuthContext:
    user: User
    organization: Organization
    role: str
    memberships: list[OrgMember]


def _sync_user(db: Session, payload: dict) -> User | None:
    user_id = payload.get("sub")
    email = (payload.get("email") or "").lower() or None
    if user_id:
        user = db.get(User, user_id)
        if user:
            return user
    if email:
        user = db.query(User).filter(User.email == email).one_or_none()
        if user:
            return user
    if user_id and email:
        user = User(
            id=user_id,
            email=email,
            full_name=payload.get("user_metadata", {}).get("full_name") or email.split("@")[0],
            password_hash=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    return None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = token_from_request(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(token)
    user = _sync_user(db, payload)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_context(
    request: Request,
    db: Session = Depends(get_db),
    x_organization_id: str | None = Header(default=None, alias="X-Organization-Id"),
) -> AuthContext:
    user = get_current_user(request, db)
    memberships = db.query(OrgMember).filter(OrgMember.user_id == user.id).all()
    if not memberships:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Complete onboarding to create a workspace")

    org_id = x_organization_id
    if not org_id:
        token = token_from_request(request)
        payload = decode_token(token) if token else {}
        org_id = payload.get("org_id")
    if not org_id:
        org_id = memberships[0].org_id

    member = next((m for m in memberships if m.org_id == org_id), None)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return AuthContext(user=user, organization=org, role=member.role, memberships=memberships)


def require_write(ctx: AuthContext = Depends(get_context)) -> AuthContext:
    if ctx.role not in WRITE_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This role is read-only")
    return ctx


def require_invite_admin(ctx: AuthContext = Depends(get_context)) -> AuthContext:
    if ctx.role not in INVITE_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners and admins can manage invitations")
    return ctx


def require_role(*roles: str):
    def _inner(ctx: AuthContext = Depends(get_context)) -> AuthContext:
        if ctx.role not in roles and ctx.role != "owner":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return ctx

    return _inner
