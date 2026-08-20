from apps.api.analyzer import analyze_account


customer_notes = """
Customer: Northbridge University

The customer reported that faculty adoption has been
lower than expected this semester.

Their current contract expires in three months.

The Head of Learning Technology asked whether additional
faculty training could be provided before the next semester.

They are also interested in learning more about new
AI-related functionality.

We agreed to send available training dates next week.
"""


brief = analyze_account(customer_notes)


print("\n========== ACCOUNT BRIEF ==========\n")

print("EXECUTIVE SUMMARY")
print(brief.executive_summary)


print("\nRISKS")
for risk in brief.risks:
    print(f"- {risk.title}")
    print(f"  Severity: {risk.severity}")
    print(f"  Evidence: {risk.evidence}")
    print(f"  Confidence: {risk.confidence}")


print("\nOPPORTUNITIES")
for opportunity in brief.opportunities:
    print(f"- {opportunity.title}")
    print(f"  Evidence: {opportunity.evidence}")
    print(f"  Recommended action: {opportunity.recommended_action}")


print("\nACTION ITEMS")
for action in brief.action_items:
    print(f"- {action.action}")
    print(f"  Owner: {action.owner}")
    print(f"  Deadline: {action.deadline}")
    print(f"  Evidence: {action.evidence}")


print("\nNEXT STEPS")
for step in brief.next_steps:
    print(f"- {step}")


print("\nFOLLOW-UP EMAIL")
print(brief.follow_up_email)