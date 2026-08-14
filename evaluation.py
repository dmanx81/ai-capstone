"""Simple evaluation helpers for account brief quality checks."""

from typing import Any

from analyzer import analyze_account
from data.scenarios import SCENARIOS


def has_required_sections(brief: Any) -> bool:
    required = {
        "executive_summary",
        "risks",
        "opportunities",
        "action_items",
        "next_steps",
        "follow_up_email",
    }

    return required.issubset(
        set(brief.model_dump().keys())
    )


def section_score(brief: Any) -> int:
    data = brief.model_dump()

    score = 0

    if data.get("executive_summary"):
        score += 1

    if data.get("risks"):
        score += 1

    if data.get("opportunities"):
        score += 1

    if data.get("action_items"):
        score += 1

    if data.get("next_steps"):
        score += 1

    if data.get("follow_up_email"):
        score += 1

    return score


def contains_keyword(text, keywords):
    """
    Returns True if at least one expected keyword
    appears in the generated text.
    """

    if not keywords:
        return True

    text = text.lower()

    return any(
        keyword.lower() in text
        for keyword in keywords
    )


def evaluate_business_accuracy(
    brief,
    expected,
):
    risk_text = " ".join(
        risk.title + " " + risk.evidence
        for risk in brief.risks
    )

    opportunity_text = " ".join(
        opportunity.title
        + " "
        + opportunity.evidence
        + " "
        + opportunity.recommended_action
        for opportunity in brief.opportunities
    )

    action_text = " ".join(
        action.action + " " + action.evidence
        for action in brief.action_items
    )

    risk_pass = contains_keyword(
        risk_text,
        expected["risk_keywords"],
    )

    opportunity_pass = contains_keyword(
        opportunity_text,
        expected["opportunity_keywords"],
    )

    action_pass = contains_keyword(
        action_text,
        expected["action_keywords"],
    )

    return {
        "risk": risk_pass,
        "opportunity": opportunity_pass,
        "action": action_pass,
    }


def main():
    results = []

    for scenario in SCENARIOS:

        print(
            f"\n========== "
            f"{scenario['name']} "
            f"=========="
        )

        brief = analyze_account(
            scenario["notes"]
        )

        structure_score = section_score(brief)

        business_result = (
            evaluate_business_accuracy(
                brief,
                scenario["expected"],
            )
        )

        business_score = sum(
            business_result.values()
        )

        print(
            f"Structure score: "
            f"{structure_score}/6"
        )

        print(
            f"Required sections: "
            f"{has_required_sections(brief)}"
        )

        print("\nBusiness accuracy")

        print(
            f"Risk detection: "
            f"{business_result['risk']}"
        )

        print(
            f"Opportunity detection: "
            f"{business_result['opportunity']}"
        )

        print(
            f"Action detection: "
            f"{business_result['action']}"
        )

        print(
            f"Business score: "
            f"{business_score}/3"
        )

        results.append(
            {
                "name": scenario["name"],
                "structure": structure_score,
                "business": business_score,
            }
        )

    print(
        "\n========== FINAL SUMMARY =========="
    )

    total_scenarios = len(results)

    total_structure = sum(
        result["structure"]
        for result in results
    )

    total_business = sum(
        result["business"]
        for result in results
    )

    max_structure = (
        total_scenarios * 6
    )

    max_business = (
        total_scenarios * 3
    )

    print(
        f"Structure quality: "
        f"{total_structure}/"
        f"{max_structure}"
    )

    print(
        f"Business accuracy: "
        f"{total_business}/"
        f"{max_business}"
    )


if __name__ == "__main__":
    main()