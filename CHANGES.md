# Changes

## Session 3 - Relationship Health Score

Added an explainable 0-100 relationship health score and one-sentence
justification to newly generated account briefs. Scores are validated by
Pydantic, generated into the shared TypeScript contract, persisted in the
existing `briefs.health_score` column, and rendered on the relationship page.
Historical briefs without a score remain supported.

### Golden Scenario Stability

| Scenario | Scores | Range | Result | Note |
| --- | --- | --- | --- | --- |
| `expansion_opportunity` | 90 / 85 / 85 | 5 | Pass | No refinement required. |
| `low_adoption_renewal` | 48 / 55 / 55 | 7 | Pass | Rubric calibration was tightened after the initial range exceeded 10. |
| `prompt_injection_attempt` | 30 / 30 / 35 | 5 | Pass | No refinement required. |

Each scenario was run three times through the existing analysis pipeline.
No raw relationship text or secrets are included here.
