export type Health = "healthy" | "watch" | "at_risk" | "critical";
export type Lifecycle = "prospect" | "onboarding" | "active" | "renewal" | "churn_risk" | "churned";

export type User = {
  id: string;
  email: string;
  full_name: string;
  title?: string | null;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  plan_status: string;
};

export type Membership = {
  org_id: string;
  name: string;
  role: string;
  plan: string;
};

export type Session = {
  user: User | null;
  organization: Organization | null;
  role: string | null;
  memberships: Membership[];
};

export type Account = {
  id: string;
  org_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  lifecycle: Lifecycle;
  owner_id: string | null;
  health: Health;
  health_score: number;
  arr: number | null;
  tags: string[];
  description: string | null;
  renewal_date: string | null;
  created_at: string;
  updated_at: string;
  owner_name?: string | null;
  contact_count: number;
  open_risk_count: number;
};

export type Contact = {
  id: string;
  account_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  stakeholder_role: string;
  influence: string;
  sentiment: string;
  notes: string | null;
};

export type Evidence = {
  source_type: string;
  source_id?: string | null;
  excerpt: string;
  url?: string | null;
};

export type TimelineEvent = {
  id: string;
  account_id: string;
  event_type: string;
  title: string;
  body: string | null;
  occurred_at: string;
  created_at?: string;
  updated_at?: string;
  contact_ids: string[];
  evidence_source: string | null;
  evidence_url: string | null;
  evidence_excerpt: string | null;
  source_object_type: string | null;
  source_object_id: string | null;
  editable?: boolean;
};

export type Risk = {
  id: string;
  title: string;
  description: string;
  severity: string;
  confidence: number;
  evidence: Evidence[];
  status: string;
  detected_at: string;
  source: string;
};

export type Opportunity = {
  id: string;
  title: string;
  description: string;
  potential_value: number | null;
  confidence: number;
  evidence: Evidence[];
  status: string;
  next_action: string | null;
};

export type Commitment = {
  id: string;
  description: string;
  direction: "us" | "customer" | string;
  due_date: string | null;
  status: string;
  evidence: Evidence[];
};

export type Task = {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  source: string;
  rationale: string | null;
  account_name?: string | null;
};

export type AccountDetail = {
  account: Account;
  contacts: Contact[];
  risks: Risk[];
  opportunities: Opportunity[];
  commitments: Commitment[];
  tasks: Task[];
  recent_activity: TimelineEvent[];
  latest_brief: AccountBrief | null;
  latest_brief_at: string | null;
};

export type AccountBrief = {
  executive_summary: string;
  relationship_health: { label: string; score: number; drivers: string[] };
  recent_changes: { title: string; occurred_at: string; type: string; evidence: Evidence }[];
  key_stakeholders: {
    id: string;
    name: string;
    title: string | null;
    role: string;
    influence: string;
    sentiment: string;
  }[];
  risks: { id: string; title: string; severity: string; status: string; confidence: number; evidence: Evidence[] }[];
  opportunities: {
    id: string;
    title: string;
    status: string;
    potential_value: number | null;
    confidence: number;
    next_action: string | null;
    evidence: Evidence[];
  }[];
  open_commitments: {
    id: string;
    description: string;
    direction: string;
    due_date: string | null;
    status: string;
    overdue: boolean;
    evidence: Evidence[];
  }[];
  upcoming_deadlines: { kind: string; label: string; due: string | null; id: string }[];
  recommended_next_actions: { title: string; rationale: string; evidence: Evidence[] }[];
  questions_to_ask: string[];
  model: string;
  disclaimer: string;
};

export type Dashboard = {
  summary: {
    accounts: number;
    arr: number;
    at_risk: number;
    open_opportunities: number;
    overdue_commitments: number;
    open_tasks: number;
  };
  health_distribution: Record<string, number>;
  attention: Account[];
  high_risk: Account[];
  opportunities: {
    id: string;
    account_id: string;
    account_name: string;
    title: string;
    potential_value: number | null;
    status: string;
    confidence: number;
  }[];
  overdue_commitments: {
    id: string;
    account_id: string;
    account_name: string;
    description: string;
    due_date: string | null;
    direction: string;
  }[];
  upcoming: {
    tasks: { id: string; account_id: string; account_name: string; title: string; due_date: string | null }[];
    renewals: Account[];
  };
  recent_intelligence: {
    id: string;
    account_id: string;
    account_name: string;
    created_at: string;
    summary: string;
  }[];
  recent_activity: {
    id: string;
    account_id: string;
    account_name: string;
    event_type: string;
    title: string;
    occurred_at: string;
  }[];
  focus: string;
  today: {
    kind: "account" | "commitment" | "risk" | "task" | "opportunity" | "change" | string;
    urgency: "high" | "medium" | "low" | string;
    title: string;
    detail: string;
    account_id: string;
    account_name?: string | null;
  }[];
};

export type BillingStatus = {
  plan: string;
  plan_status: string;
  stripe_enabled: boolean;
  current_period_end: string | null;
  ai_actions_used: number;
  ai_actions_limit: number | null;
  max_accounts: number | null;
  documents_enabled: boolean;
};

export type AskResponse = {
  question: string;
  answer: string;
  evidence: {
    chunk_id: string;
    account_id: string;
    source_type: string;
    source_id: string;
    excerpt: string;
    similarity: number;
  }[];
  model: string;
  grounded: boolean;
};

export type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  last_sent_at?: string;
  created_at: string;
  invite_url?: string;
  emailed?: boolean;
};

export type InvitePreview = {
  email: string;
  role: string;
  organization: string | null;
  expires_at: string;
};

export type AgentRun = {
  id: string;
  action: string;
  status: string;
  confirmed: boolean;
  output_payload: {
    proposed_writes?: { type: string; title: string; rationale?: string }[];
    requires_confirmation?: boolean;
    applied_task_ids?: string[];
    [key: string]: unknown;
  };
};
