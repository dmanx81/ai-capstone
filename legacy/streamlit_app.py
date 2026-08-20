import streamlit as st

from analyzer import analyze_account


# --------------------------------------------------
# PAGE CONFIGURATION
# --------------------------------------------------

st.set_page_config(
    page_title="AI Customer Intelligence Assistant",
    page_icon="🤖",
    layout="wide",
)


# --------------------------------------------------
# HEADER
# --------------------------------------------------

st.title("AI Customer Intelligence Assistant")

st.caption(
    "Turn customer notes into a structured account brief "
    "with risks, opportunities, actions, and next steps."
)


# --------------------------------------------------
# CUSTOMER INPUT
# --------------------------------------------------

customer_notes = st.text_area(
    "Customer Notes",
    height=260,
    placeholder=(
        "Paste meeting notes, CRM notes, customer emails, "
        "or account information here..."
    ),
)


analyze_clicked = st.button(
    "Analyze Account",
    type="primary",
)


# --------------------------------------------------
# ANALYSIS
# --------------------------------------------------

if analyze_clicked:

    if not customer_notes.strip():
        st.warning("Please enter some customer notes.")

    else:

        with st.spinner("Analyzing account..."):

            try:
                brief = analyze_account(customer_notes)

            except Exception as error:
                st.error(f"Analysis failed: {error}")
                st.stop()


        st.success("Analysis complete.")


        # --------------------------------------------------
        # TOP SUMMARY METRICS
        # --------------------------------------------------

        if brief.risks:

            severity_order = {
                "low": 1,
                "medium": 2,
                "high": 3,
            }

            highest_risk = max(
                brief.risks,
                key=lambda risk: severity_order.get(
                    risk.severity.lower(),
                    0,
                ),
            )

            highest_risk_label = (
                highest_risk.severity.upper()
            )

            average_confidence = (
                sum(
                    risk.confidence
                    for risk in brief.risks
                )
                / len(brief.risks)
            )

        else:

            highest_risk_label = "NONE"
            average_confidence = 0


        col1, col2, col3, col4 = st.columns(4)


        with col1:

            st.metric(
                "Highest Risk",
                highest_risk_label,
            )


        with col2:

            st.metric(
                "Opportunities",
                len(brief.opportunities),
            )


        with col3:

            st.metric(
                "Action Items",
                len(brief.action_items),
            )


        with col4:

            st.metric(
                "Avg. Risk Confidence",
                f"{average_confidence:.0%}",
            )


        st.divider()


        # --------------------------------------------------
        # EXECUTIVE SUMMARY
        # --------------------------------------------------

        st.subheader("Executive Summary")

        st.info(
            brief.executive_summary
        )


        st.divider()


        # --------------------------------------------------
        # RISKS AND OPPORTUNITIES
        # --------------------------------------------------

        risk_column, opportunity_column = st.columns(2)


        # RISKS

        with risk_column:

            st.subheader("⚠️ Risks")

            if not brief.risks:

                st.success(
                    "No significant risks identified."
                )

            for risk in brief.risks:

                with st.container(border=True):

                    st.markdown(
                        f"### {risk.title}"
                    )

                    st.write(
                        f"**Severity:** "
                        f"{risk.severity.upper()}"
                    )

                    st.progress(
                        risk.confidence
                    )

                    st.write(
                        f"**Confidence:** "
                        f"{risk.confidence:.0%}"
                    )

                    st.write(
                        f"**Evidence:** "
                        f"{risk.evidence}"
                    )


        # OPPORTUNITIES

        with opportunity_column:

            st.subheader("💡 Opportunities")

            if not brief.opportunities:

                st.info(
                    "No clear opportunities identified."
                )

            for opportunity in brief.opportunities:

                with st.container(border=True):

                    st.markdown(
                        f"### {opportunity.title}"
                    )

                    st.write(
                        f"**Evidence:** "
                        f"{opportunity.evidence}"
                    )

                    st.write(
                        "**Recommended Action:**"
                    )

                    st.write(
                        opportunity.recommended_action
                    )


        st.divider()


        # --------------------------------------------------
        # ACTION ITEMS
        # --------------------------------------------------

        st.subheader("✅ Action Items")


        if not brief.action_items:

            st.info(
                "No explicit action items identified."
            )


        for index, action in enumerate(
            brief.action_items,
            start=1,
        ):

            with st.container(border=True):

                st.markdown(
                    f"**{index}. {action.action}**"
                )

                action_col1, action_col2 = st.columns(2)


                with action_col1:

                    st.write(
                        "**Owner:** "
                        f"{action.owner or 'Not specified'}"
                    )


                with action_col2:

                    st.write(
                        "**Deadline:** "
                        f"{action.deadline or 'Not specified'}"
                    )


                st.write(
                    f"**Evidence:** "
                    f"{action.evidence}"
                )


        st.divider()


        # --------------------------------------------------
        # NEXT STEPS
        # --------------------------------------------------

        st.subheader("➡️ Next Steps")


        if not brief.next_steps:

            st.info(
                "No next steps identified."
            )


        for index, step in enumerate(
            brief.next_steps,
            start=1,
        ):

            st.write(
                f"**{index}.** {step}"
            )


        st.divider()


        # --------------------------------------------------
        # FOLLOW-UP EMAIL
        # --------------------------------------------------

        st.subheader("✉️ Follow-up Email")


        st.text_area(
            "Generated email",
            brief.follow_up_email,
            height=320,
        )