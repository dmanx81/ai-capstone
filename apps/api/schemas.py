from typing import List, Optional, Literal

from pydantic import BaseModel, Field


class Risk(BaseModel):
    title: str
    severity: Literal["low", "medium", "high"]
    evidence: str
    confidence: float = Field(ge=0.0, le=1.0)


class Opportunity(BaseModel):
    title: str
    evidence: str
    recommended_action: str


class ActionItem(BaseModel):
    action: str
    owner: Optional[str] = None
    deadline: Optional[str] = None
    evidence: str


class AccountBrief(BaseModel):
    executive_summary: str
    health_score: int = Field(ge=0, le=100)
    health_justification: str
    risks: List[Risk]
    opportunities: List[Opportunity]
    action_items: List[ActionItem]
    next_steps: List[str]
    follow_up_email: str