from fastapi import FastAPI
from pydantic import BaseModel

from analyzer import analyze_account


app = FastAPI(
    title="AI Capstone API",
    version="1.0.0",
)


class AnalyzeRequest(BaseModel):
    customer_text: str


@app.get("/health")
def health():
    return {
        "status": "ok"
    }


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    brief = analyze_account(
        request.customer_text
    )

    return brief.model_dump()