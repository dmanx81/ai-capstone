from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    organization_name: str | None = Field(default=None, max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORMModel):
    id: str
    email: str
    full_name: str
    title: str | None = None
    avatar_url: str | None = None


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)
    title: str | None = Field(default=None, max_length=200)


class OrgOut(ORMModel):
    id: str
    name: str
    slug: str
    plan: str
    plan_status: str
    current_period_end: datetime | None = None


class MemberOut(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str


class SessionOut(BaseModel):
    user: UserOut
    organization: OrgOut | None
    role: str | None
    memberships: list[dict[str, str]]


class AccountIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    domain: str | None = None
    industry: str | None = None
    lifecycle: Literal["prospect", "onboarding", "active", "renewal", "churn_risk", "churned"] = "active"
    owner_id: str | None = None
    arr: float | None = None
    tags: list[str] = Field(default_factory=list)
    description: str | None = None
    renewal_date: datetime | None = None


class AccountUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    industry: str | None = None
    lifecycle: Literal["prospect", "onboarding", "active", "renewal", "churn_risk", "churned"] | None = None
    owner_id: str | None = None
    arr: float | None = None
    tags: list[str] | None = None
    description: str | None = None
    renewal_date: datetime | None = None


class AccountOut(ORMModel):
    id: str
    org_id: str
    name: str
    domain: str | None
    industry: str | None
    lifecycle: str
    owner_id: str | None
    health: str
    health_score: int
    arr: float | None
    tags: list[str]
    description: str | None
    renewal_date: datetime | None
    created_at: datetime
    updated_at: datetime
    owner_name: str | None = None
    contact_count: int = 0
    open_risk_count: int = 0


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    title: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    stakeholder_role: Literal[
        "champion", "decision_maker", "influencer", "blocker", "end_user", "economic_buyer"
    ] = "end_user"
    influence: Literal["low", "medium", "high"] = "medium"
    sentiment: Literal["positive", "neutral", "negative", "unknown"] = "unknown"
    notes: str | None = None


class ContactOut(ORMModel):
    id: str
    org_id: str
    account_id: str
    name: str
    title: str | None
    email: str | None
    phone: str | None
    stakeholder_role: str
    influence: str
    sentiment: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


class Evidence(BaseModel):
    source_type: str
    source_id: str | None = None
    excerpt: str
    url: str | None = None


class TimelineIn(BaseModel):
    event_type: Literal[
        "meeting",
        "email",
        "call",
        "note",
        "task",
        "risk",
        "opportunity",
        "commitment",
        "customer_request",
        "product_issue",
        "renewal_event",
        "document",
        "ai_insight",
    ]
    title: str = Field(min_length=1, max_length=300)
    body: str | None = None
    occurred_at: datetime | None = None
    contact_ids: list[str] = Field(default_factory=list)
    evidence_source: str | None = None
    evidence_url: str | None = None
    evidence_excerpt: str | None = None


class TimelineUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    occurred_at: datetime | None = None
    contact_ids: list[str] | None = None
    evidence_source: str | None = None
    evidence_url: str | None = None
    evidence_excerpt: str | None = None


class TimelineOut(ORMModel):
    id: str
    org_id: str
    account_id: str
    event_type: str
    title: str
    body: str | None
    occurred_at: datetime
    created_by: str | None
    contact_ids: list[str]
    evidence_source: str | None
    evidence_url: str | None
    evidence_excerpt: str | None
    source_object_type: str | None
    source_object_id: str | None
    created_at: datetime
    updated_at: datetime


class RiskIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1)
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    confidence: float = Field(default=0.7, ge=0, le=1)
    evidence: list[Evidence] = Field(default_factory=list)
    owner_id: str | None = None
    status: Literal["open", "monitoring", "mitigated", "accepted", "closed"] = "open"
    source: Literal["user", "ai", "system"] = "user"


class RiskOut(ORMModel):
    id: str
    org_id: str
    account_id: str
    title: str
    description: str
    severity: str
    confidence: float
    evidence: list[Any]
    owner_id: str | None
    status: str
    detected_at: datetime
    source: str
    created_at: datetime
    updated_at: datetime


class OpportunityIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1)
    potential_value: float | None = None
    confidence: float = Field(default=0.6, ge=0, le=1)
    evidence: list[Evidence] = Field(default_factory=list)
    owner_id: str | None = None
    status: Literal["identified", "qualifying", "pursuing", "won", "lost"] = "identified"
    next_action: str | None = None


class OpportunityOut(ORMModel):
    id: str
    org_id: str
    account_id: str
    title: str
    description: str
    potential_value: float | None
    confidence: float
    evidence: list[Any]
    owner_id: str | None
    status: str
    next_action: str | None
    created_at: datetime
    updated_at: datetime


class CommitmentIn(BaseModel):
    description: str = Field(min_length=1)
    direction: Literal["us", "customer"] = "us"
    due_date: datetime | None = None
    owner_id: str | None = None
    status: Literal["open", "in_progress", "fulfilled", "missed", "cancelled"] = "open"
    evidence: list[Evidence] = Field(default_factory=list)


class CommitmentOut(ORMModel):
    id: str
    org_id: str
    account_id: str
    description: str
    direction: str
    due_date: datetime | None
    owner_id: str | None
    status: str
    evidence: list[Any]
    created_at: datetime
    updated_at: datetime


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    due_date: datetime | None = None
    owner_id: str | None = None
    status: Literal["open", "in_progress", "done", "cancelled"] = "open"
    rationale: str | None = None
    related_object_type: str | None = None
    related_object_id: str | None = None


class TaskOut(ORMModel):
    id: str
    org_id: str
    account_id: str
    title: str
    description: str | None
    due_date: datetime | None
    owner_id: str | None
    status: str
    source: str
    rationale: str | None
    related_object_type: str | None
    related_object_id: str | None
    created_at: datetime
    updated_at: datetime
    account_name: str | None = None


class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    account_id: str | None = None


class AgentIn(BaseModel):
    action: Literal[
        "prepare_meeting_brief",
        "analyze_account_risks",
        "find_expansion_opportunities",
        "generate_follow_up_plan",
        "summarize_recent_changes",
        "identify_missing_commitments",
        "suggest_next_best_actions",
    ]
    confirm: bool = False
    apply_writes: bool = False


class CheckoutIn(BaseModel):
    plan: Literal["starter", "growth"]


class OrgCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
