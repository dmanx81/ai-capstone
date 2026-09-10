from __future__ import annotations

import httpx

from app.config import get_settings

settings = get_settings()


def send_invite_email(to_email: str, org_name: str, invite_url: str) -> bool:
    if not settings.resend_api_key:
        return False
    response = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {settings.resend_api_key}"},
        json={
            "from": settings.invite_from_email,
            "to": [to_email],
            "subject": f"You were invited to {org_name} on Relia",
            "text": (
                f"You have been invited to join {org_name} on Relia.\n\n"
                f"Accept the invitation:\n{invite_url}\n\n"
                "If you were not expecting this, ignore the email."
            ),
        },
        timeout=15.0,
    )
    return response.status_code < 300
