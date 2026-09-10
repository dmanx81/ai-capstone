from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import (
    Account,
    Commitment,
    Contact,
    Opportunity,
    OrgMember,
    Organization,
    Risk,
    Task,
    TimelineEvent,
    User,
    uid,
)
from app.security import hash_password
from app.services.health import recompute_health
from app.services.indexing import index_account_graph

NOW = datetime.now(timezone.utc)


def _dt(days: int, hours: int = 0) -> datetime:
    return NOW + timedelta(days=days, hours=hours)


def slugify(name: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "-" for ch in name).strip("-")[:60]


def ensure_user(db: Session, email: str, password: str, full_name: str, title: str | None = None) -> User:
    user = db.query(User).filter(User.email == email).one_or_none()
    if user:
        return user
    user = User(id=uid(), email=email, password_hash=hash_password(password), full_name=full_name, title=title)
    db.add(user)
    db.flush()
    return user


def ensure_org(db: Session, name: str, owner: User, plan: str = "growth") -> Organization:
    existing = (
        db.query(Organization)
        .join(OrgMember, OrgMember.org_id == Organization.id)
        .filter(OrgMember.user_id == owner.id, Organization.name == name)
        .one_or_none()
    )
    if existing:
        return existing
    org = Organization(id=uid(), name=name, slug=f"{slugify(name)}-{uid()[:8]}", plan=plan, plan_status="active")
    db.add(org)
    db.flush()
    db.add(OrgMember(id=uid(), org_id=org.id, user_id=owner.id, role="owner"))
    db.flush()
    return org


def add_event(db: Session, account: Account, owner_id: str, days: int, event_type: str, title: str, body: str, **kwargs: object) -> None:
    db.add(
        TimelineEvent(
            id=uid(),
            org_id=account.org_id,
            account_id=account.id,
            event_type=event_type,
            title=title,
            body=body,
            occurred_at=_dt(days),
            created_by=owner_id,
            **kwargs,
        )
    )


def seed_demo(db: Session) -> None:
    if get_settings().app_env == "production":
        raise RuntimeError("Refusing to seed demo data when APP_ENV=production")
    if db.query(User).filter(User.email == "demo@relia.app").first():
        return

    owner = ensure_user(db, "demo@relia.app", "demo-password", "Alex Rivera", "Director of Customer Success")
    teammate = ensure_user(db, "jordan@relia.app", "demo-password", "Jordan Lee", "Account Manager")
    org = ensure_org(db, "Northstar Customer Success", owner, plan="growth")
    if not db.query(OrgMember).filter(OrgMember.org_id == org.id, OrgMember.user_id == teammate.id).first():
        db.add(OrgMember(id=uid(), org_id=org.id, user_id=teammate.id, role="member"))

    isolated = ensure_user(db, "isolated@example.com", "isolation-test", "Sam Isolated")
    ensure_org(db, "Isolated Workspace", isolated, plan="free")
    iso_org = db.query(Organization).join(OrgMember).filter(OrgMember.user_id == isolated.id).one()
    iso_account = Account(
        id=uid(),
        org_id=iso_org.id,
        name="Secret Customer Co",
        domain="secretcustomer.example",
        industry="Privacy",
        lifecycle="active",
        owner_id=isolated.id,
        tags=["confidential"],
        description="Should never be visible to the Northstar demo user.",
        arr=10000,
    )
    db.add(iso_account)

    def acc(**kwargs: object) -> Account:
        row = Account(id=uid(), org_id=org.id, owner_id=owner.id, **kwargs)
        db.add(row)
        db.flush()
        return row

    meridian = acc(
        name="Meridian Health Systems",
        domain="meridianhealth.example",
        industry="Healthcare",
        lifecycle="renewal",
        arr=420000,
        tags=["enterprise", "hipaa", "named"],
        description="Regional hospital network on the clinical operations suite. Renewal in three weeks. SSO still open.",
        renewal_date=_dt(23),
    )
    northwind = acc(
        name="Northwind Logistics",
        domain="northwindlogistics.example",
        industry="Transportation",
        lifecycle="active",
        arr=210000,
        tags=["mid-market", "expansion"],
        description="Freight network using Relia-adjacent ops tooling. Healthy QBR last month; warehouse module in evaluation.",
        renewal_date=_dt(140),
    )
    brightpath = acc(
        name="Brightpath Education",
        domain="brightpath.example",
        industry="Education",
        lifecycle="active",
        arr=96000,
        tags=["edu", "outage-follow-up"],
        description="K-12 LMS customer. Mixed sentiment after a February availability incident.",
        renewal_date=_dt(60),
    )
    helios = acc(
        name="Helios Energy",
        domain="heliosenergy.example",
        industry="Energy",
        lifecycle="onboarding",
        arr=150000,
        tags=["onboarding"],
        description="New logo. Kickoff completed; executive sponsor still missing from the stakeholder map.",
        renewal_date=_dt(340),
    )
    canvas = acc(
        name="Canvas Retail Group",
        domain="canvasretail.example",
        industry="Retail",
        lifecycle="churn_risk",
        arr=310000,
        tags=["churn-risk", "retail"],
        description="Champion departed. Inventory sync defects and a competitive bake-off are both on the timeline.",
        renewal_date=_dt(18),
    )
    apex = acc(
        name="Apex Capital",
        domain="apexcapital.example",
        industry="Financial services",
        lifecycle="active",
        arr=540000,
        tags=["enterprise", "expansion", "strategic"],
        description="Strong champion in operations. Wealth desk rollout is the live expansion thread.",
        renewal_date=_dt(210),
    )
    lumen = acc(
        name="Lumen Labs",
        domain="lumenlabs.example",
        industry="SaaS",
        lifecycle="prospect",
        arr=0,
        tags=["pipeline"],
        description="Late-stage evaluation. Security questionnaire returned; no commercial paper yet.",
        renewal_date=None,
    )

    def contact(account: Account, **kwargs: object) -> Contact:
        row = Contact(id=uid(), org_id=org.id, account_id=account.id, **kwargs)
        db.add(row)
        db.flush()
        return row

    priya = contact(
        meridian,
        name="Priya Shah",
        title="VP Clinical Operations",
        email="priya.shah@meridianhealth.example",
        stakeholder_role="champion",
        influence="high",
        sentiment="neutral",
        notes="Rumored to be interviewing. Confirm before QBR.",
    )
    contact(
        meridian,
        name="Marcus Chen",
        title="CISO",
        email="marcus.chen@meridianhealth.example",
        stakeholder_role="influencer",
        influence="high",
        sentiment="negative",
        notes="Blocked SSO go-live until IdP metadata is complete.",
    )
    contact(
        meridian,
        name="Elena Voss",
        title="Director of Procurement",
        email="elena.voss@meridianhealth.example",
        stakeholder_role="economic_buyer",
        influence="high",
        sentiment="unknown",
    )
    contact(
        northwind,
        name="Diego Alvarez",
        title="Head of Network Ops",
        email="diego@northwindlogistics.example",
        stakeholder_role="champion",
        influence="high",
        sentiment="positive",
    )
    contact(
        northwind,
        name="Hannah Cole",
        title="CFO",
        email="hannah.cole@northwindlogistics.example",
        stakeholder_role="economic_buyer",
        influence="high",
        sentiment="positive",
    )
    contact(
        brightpath,
        name="Noah Patel",
        title="IT Director",
        email="noah.patel@brightpath.example",
        stakeholder_role="decision_maker",
        influence="high",
        sentiment="negative",
        notes="Escalated after the Feb 12 outage.",
    )
    contact(
        helios,
        name="Rita Gomez",
        title="Program Manager",
        email="rita.gomez@heliosenergy.example",
        stakeholder_role="end_user",
        influence="medium",
        sentiment="positive",
        notes="Day-to-day onboarding owner. No exec sponsor mapped.",
    )
    contact(
        canvas,
        name="Chris Nguyen",
        title="Interim Ops Lead",
        email="chris.nguyen@canvasretail.example",
        stakeholder_role="decision_maker",
        influence="medium",
        sentiment="negative",
        notes="Stepped in after champion Maya Brooks left on 8/22.",
    )
    contact(
        apex,
        name="Sofia Berg",
        title="COO",
        email="sofia.berg@apexcapital.example",
        stakeholder_role="champion",
        influence="high",
        sentiment="positive",
    )
    contact(
        lumen,
        name="Owen Park",
        title="VP Information Security",
        email="owen.park@lumenlabs.example",
        stakeholder_role="influencer",
        influence="high",
        sentiment="neutral",
    )

    def risk(account: Account, **kwargs: object) -> Risk:
        row = Risk(id=uid(), org_id=org.id, account_id=account.id, owner_id=owner.id, **kwargs)
        db.add(row)
        db.flush()
        return row

    r1 = risk(
        meridian,
        title="Champion may leave before renewal",
        description="Priya Shah (VP Clinical Ops) mentioned she is exploring other roles in the 8/29 call. She is the named champion for renewal.",
        severity="high",
        confidence=0.72,
        status="open",
        source="user",
        evidence=[{"source_type": "timeline", "excerpt": "Priya: I may not be here through the fall planning cycle."}],
        detected_at=_dt(-12),
    )
    r2 = risk(
        meridian,
        title="SSO implementation slipped six weeks",
        description="IdP metadata from Meridian security is still outstanding. CISO will not approve production SSO without it.",
        severity="medium",
        confidence=0.9,
        status="monitoring",
        source="user",
        evidence=[{"source_type": "commitment", "excerpt": "Customer to provide IdP metadata — still open."}],
        detected_at=_dt(-20),
    )
    risk(
        canvas,
        title="Executive champion departed",
        description="Maya Brooks left Canvas on 8/22. Interim owner has not confirmed renewal intent.",
        severity="critical",
        confidence=0.95,
        status="open",
        source="user",
        evidence=[{"source_type": "timeline", "excerpt": "HR notice: Maya Brooks last day 22 Aug."}],
        detected_at=_dt(-19),
    )
    risk(
        canvas,
        title="Inventory sync defects in production",
        description="Nightly inventory job failed 11 times in 30 days. Store ops filed a severity-2 product issue.",
        severity="high",
        confidence=0.88,
        status="open",
        source="system",
        evidence=[{"source_type": "timeline", "excerpt": "Product issue: inventory sync failed 11/30 nights."}],
        detected_at=_dt(-9),
    )
    risk(
        brightpath,
        title="Trust damaged after February outage",
        description="IT director escalated after a 4-hour outage during midterms. Post-incident review still unpublished to the customer.",
        severity="medium",
        confidence=0.8,
        status="monitoring",
        source="user",
        evidence=[{"source_type": "timeline", "excerpt": "Outage 12 Feb, 4 hours, midterms week."}],
        detected_at=_dt(-28),
    )

    def opp(account: Account, **kwargs: object) -> Opportunity:
        row = Opportunity(id=uid(), org_id=org.id, account_id=account.id, owner_id=owner.id, **kwargs)
        db.add(row)
        db.flush()
        return row

    opp(
        meridian,
        title="Expand clinical suite to three regional hospitals",
        description="Priya asked for a scoping deck covering Dayton, Toledo, and Akron campuses during the August QBR.",
        potential_value=180000,
        confidence=0.55,
        status="qualifying",
        next_action="Send multi-campus scoping deck and confirm economic buyer attendance.",
        evidence=[{"source_type": "timeline", "excerpt": "QBR: Priya requested regional hospital expansion scope."}],
    )
    opp(
        northwind,
        title="Warehouse module add-on",
        description="Diego wants to replace a homegrown yard tool before peak season.",
        potential_value=72000,
        confidence=0.7,
        status="pursuing",
        next_action="Schedule a 45-minute product walkthrough with yard ops.",
        evidence=[{"source_type": "timeline", "excerpt": "Diego: we need the warehouse module before peak."}],
    )
    opp(
        apex,
        title="Wealth desk rollout",
        description="Sofia committed to a Q4 advisory-desk pilot if audit findings stay clean.",
        potential_value=260000,
        confidence=0.64,
        status="qualifying",
        next_action="Share control mapping for FINRA audit packet.",
        evidence=[{"source_type": "timeline", "excerpt": "Sofia: wealth desk in Q4 if audit stays clean."}],
    )

    def commit(account: Account, **kwargs: object) -> Commitment:
        row = Commitment(id=uid(), org_id=org.id, account_id=account.id, owner_id=owner.id, **kwargs)
        db.add(row)
        db.flush()
        return row

    c_sso = commit(
        meridian,
        description="Deliver production SSO for Meridian clinicians",
        direction="us",
        due_date=_dt(-6),
        status="open",
        evidence=[{"source_type": "timeline", "excerpt": "We committed to SSO by last Friday's steering meeting."}],
    )
    commit(
        meridian,
        description="Provide IdP metadata and test accounts",
        direction="customer",
        due_date=_dt(-10),
        status="open",
        evidence=[{"source_type": "timeline", "excerpt": "Marcus to send IdP XML this week (still outstanding)."}],
    )
    commit(
        brightpath,
        description="Publish post-incident review and customer-facing RCA",
        direction="us",
        due_date=_dt(-3),
        status="in_progress",
        evidence=[{"source_type": "timeline", "excerpt": "Noah asked for the RCA before the school board meeting."}],
    )
    commit(
        northwind,
        description="Share warehouse module security whitepaper",
        direction="us",
        due_date=_dt(9),
        status="open",
        evidence=[{"source_type": "timeline", "excerpt": "Hannah requested security whitepaper before finance review."}],
    )
    commit(
        canvas,
        description="Name an executive sponsor for the renewal",
        direction="customer",
        due_date=_dt(5),
        status="open",
        evidence=[{"source_type": "timeline", "excerpt": "Chris will identify who owns the relationship after Maya."}],
    )

    def task(account: Account, **kwargs: object) -> Task:
        row = Task(id=uid(), org_id=org.id, account_id=account.id, owner_id=owner.id, **kwargs)
        db.add(row)
        db.flush()
        return row

    task(
        meridian,
        title="Confirm Priya's role through renewal",
        due_date=_dt(2),
        status="open",
        source="user",
        rationale="High-severity risk: champion may leave.",
        related_object_type="risk",
        related_object_id=r1.id,
    )
    task(
        canvas,
        title="Book recovery QBR with interim owner",
        due_date=_dt(1),
        status="open",
        source="user",
        rationale="Critical health after champion departure.",
    )
    task(
        brightpath,
        title="Send RCA draft to Noah Patel",
        due_date=_dt(-1),
        status="open",
        source="user",
        rationale="Overdue customer-facing incident review.",
    )
    task(
        helios,
        title="Map executive sponsor",
        due_date=_dt(4),
        status="open",
        source="ai",
        rationale="Onboarding account has no champion or economic buyer on file.",
    )
    task(
        northwind,
        title="Warehouse module walkthrough",
        due_date=_dt(8),
        status="open",
        source="user",
        rationale="Expansion opportunity in pursuing status.",
    )

    add_event(
        db,
        meridian,
        owner.id,
        -2,
        "call",
        "Working session on SSO blockers",
        "Marcus restated that production SSO is blocked on IdP metadata. Priya asked if we can ship a temporary SAML bypass for two clinics.",
        contact_ids=[priya.id],
        evidence_source="Call notes",
        evidence_excerpt="SSO still blocked on IdP metadata.",
    )
    add_event(
        db,
        meridian,
        owner.id,
        -12,
        "meeting",
        "Monthly operations review",
        "Priya mentioned she may not be here through the fall planning cycle. Expansion to Dayton/Toledo/Akron requested.",
        contact_ids=[priya.id],
        evidence_source="Gong-style meeting summary",
        evidence_excerpt="Priya: I may not be here through the fall planning cycle.",
    )
    add_event(
        db,
        meridian,
        owner.id,
        -6,
        "commitment",
        "SSO due date missed",
        "We missed the committed SSO date. Customer still owes IdP metadata.",
        source_object_type="commitment",
        source_object_id=c_sso.id,
    )
    add_event(
        db,
        meridian,
        owner.id,
        -20,
        "risk",
        "SSO slip recorded",
        r2.description,
        source_object_type="risk",
        source_object_id=r2.id,
    )
    add_event(
        db,
        northwind,
        owner.id,
        -18,
        "meeting",
        "QBR — strong quarter",
        "On-time implementation, NPS 72. Diego asked to evaluate warehouse module before peak season.",
        evidence_source="QBR deck follow-up email",
    )
    add_event(
        db,
        northwind,
        owner.id,
        -5,
        "email",
        "Security whitepaper requested",
        "Hannah Cole (CFO) asked for the warehouse module security whitepaper before the finance committee.",
    )
    add_event(
        db,
        brightpath,
        owner.id,
        -28,
        "product_issue",
        "4-hour outage during midterms",
        "Platform unavailable 08:10–12:18 local. Noah escalated to superintendent. RCA promised.",
        evidence_source="Incident #4821",
    )
    add_event(
        db,
        brightpath,
        owner.id,
        -4,
        "note",
        "School board meeting next week",
        "Noah needs a customer-facing RCA before Thursday's board packet.",
    )
    add_event(
        db,
        helios,
        owner.id,
        -10,
        "meeting",
        "Onboarding kickoff",
        "Rita Gomez is the program manager. No executive sponsor attended. Success plan drafted.",
    )
    add_event(
        db,
        canvas,
        owner.id,
        -19,
        "note",
        "Champion Maya Brooks departed",
        "HR notice forwarded by Chris Nguyen. No successor named for the commercial relationship.",
    )
    add_event(
        db,
        canvas,
        owner.id,
        -7,
        "product_issue",
        "Inventory sync failed 11 nights",
        "Store ops opened a Sev-2. Competitor bake-off mentioned on the same thread.",
        evidence_source="Ticket RET-2031",
    )
    add_event(
        db,
        canvas,
        owner.id,
        -3,
        "email",
        "Competitive evaluation with Shelfly",
        "Chris asked for a side-by-side versus Shelfly before renewal. Tone is transactional.",
    )
    add_event(
        db,
        apex,
        owner.id,
        -8,
        "meeting",
        "Q3 business review",
        "Sofia restated wealth desk Q4 pilot if audit remains clean. Asked for FINRA control mapping.",
    )
    add_event(
        db,
        apex,
        owner.id,
        -1,
        "email",
        "Audit packet acknowledged",
        "Compliance team confirmed receipt of last year's SOC 2. No open questions.",
    )
    add_event(
        db,
        lumen,
        owner.id,
        -6,
        "email",
        "Security questionnaire returned",
        "Owen Park returned the SIG Lite. Commercial discussion parked until legal redlines.",
    )
    add_event(
        db,
        lumen,
        owner.id,
        -21,
        "meeting",
        "Discovery with product and security",
        "Use case is vendor risk workflows for their enterprise customers. Budget not confirmed.",
    )

    db.flush()
    for account in db.query(Account).filter(Account.org_id == org.id).all():
        recompute_health(db, account)
        index_account_graph(db, account.id, org.id)
    recompute_health(db, iso_account)
    index_account_graph(db, iso_account.id, iso_org.id)
    db.commit()
