from __future__ import annotations

import re
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.pipeline import Pipeline
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from training_data import TRAINING_ROWS

Category = Literal[
    "PAYMENT",
    "LOGIN",
    "REFUND",
    "DELIVERY",
    "TECHNICAL",
    "ACCOUNT",
    "NETWORK",
    "SUBSCRIPTION",
    "OTHER",
]
Priority = Literal["URGENT", "HIGH", "NORMAL"]
Sentiment = Literal["POSITIVE", "NEUTRAL", "NEGATIVE"]

category_model: Pipeline
priority_model: Pipeline
sentiment_model = SentimentIntensityAnalyzer()
MODEL_VERSION = "synthetic-tfidf-logreg-v1"


def train_models() -> tuple[Pipeline, Pipeline]:
    complaints = [row[0] for row in TRAINING_ROWS]
    categories = [row[1] for row in TRAINING_ROWS]
    priorities = [row[2] for row in TRAINING_ROWS]
    category = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
            ("classifier", LogisticRegression(max_iter=500, class_weight="balanced")),
        ]
    )
    priority = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
            ("classifier", LogisticRegression(max_iter=500, class_weight="balanced")),
        ]
    )
    category.fit(complaints, categories)
    priority.fit(complaints, priorities)
    return category, priority


@asynccontextmanager
async def lifespan(_: FastAPI):
    global category_model, priority_model
    category_model, priority_model = train_models()
    yield


app = FastAPI(title="SmartSLA complaint analysis", version="1.0.0", lifespan=lifespan)


class ExistingComplaint(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    subject: str = Field(max_length=160)
    description: str = Field(max_length=4000)


class AnalysisRequest(BaseModel):
    application: str = Field(min_length=2, max_length=80)
    subject: str = Field(min_length=6, max_length=160)
    description: str = Field(min_length=12, max_length=4000)
    existing: list[ExistingComplaint] = Field(default_factory=list, max_length=100)


class Duplicate(BaseModel):
    ticketId: str
    score: float


class AnalysisResponse(BaseModel):
    category: Category
    categoryConfidence: float
    priority: Priority
    priorityConfidence: float
    sentiment: Sentiment
    sentimentScore: float
    priorityReason: str
    modelVersion: str
    duplicates: list[Duplicate]


def priority_override(text: str) -> tuple[Priority | None, str | None]:
    urgent = re.search(
        r"\b(security|unauthorized|unauthorised|account locked|complete outage|service outage|money deducted.{0,30}failed)\b",
        text,
        re.IGNORECASE,
    )
    if urgent:
        return "URGENT", "Rule matched a security, account lockout, outage, or critical payment phrase."
    high = re.search(
        r"\b(payment failed|repeated error|cannot access|unable to access|not received|charged twice)\b",
        text,
        re.IGNORECASE,
    )
    if high:
        return "HIGH", "Rule matched a failed payment, repeated error, or important unavailable service."
    return None, None


def detect_sentiment(text: str) -> tuple[Sentiment, float]:
    compound = float(sentiment_model.polarity_scores(text)["compound"])
    label: Sentiment = "POSITIVE" if compound >= 0.05 else "NEGATIVE" if compound <= -0.05 else "NEUTRAL"
    return label, compound


def detect_duplicates(
    subject: str, description: str, existing: list[ExistingComplaint]
) -> list[Duplicate]:
    if not existing:
        return []
    texts = [f"{item.subject} {item.description}" for item in existing]
    candidate = f"{subject} {description}"
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
    matrix = vectorizer.fit_transform([candidate, *texts])
    scores = cosine_similarity(matrix[0:1], matrix[1:]).flatten()
    ranked = sorted(
        (
            Duplicate(ticketId=entry.id, score=round(float(score), 3))
            for entry, score in zip(existing, scores, strict=True)
            if score >= 0.25
        ),
        key=lambda item: item.score,
        reverse=True,
    )
    return ranked[:5]


@app.get("/health")
def health():
    return {"status": "ok", "modelVersion": MODEL_VERSION}


@app.post("/analyze", response_model=AnalysisResponse)
def analyze(payload: AnalysisRequest):
    text = f"{payload.application} {payload.subject} {payload.description}".strip()
    category_probabilities = category_model.predict_proba([text])[0]
    category_index = int(category_probabilities.argmax())
    category = str(category_model.classes_[category_index])
    category_confidence = float(category_probabilities[category_index])

    priority_probabilities = priority_model.predict_proba([text])[0]
    priority_index = int(priority_probabilities.argmax())
    priority = str(priority_model.classes_[priority_index])
    priority_confidence = float(priority_probabilities[priority_index])
    rule_priority, rule_reason = priority_override(text)
    if rule_priority:
        priority = rule_priority
        override_index = list(priority_model.classes_).index(rule_priority)
        priority_confidence = float(priority_probabilities[override_index])
        reason = rule_reason or "Priority rule matched."
    else:
        reason = f"Synthetic training classifier predicted {priority} (confidence {priority_confidence:.2f})."

    sentiment, sentiment_score = detect_sentiment(text)
    return AnalysisResponse(
        category=category,  # type: ignore[arg-type]
        categoryConfidence=round(category_confidence, 3),
        priority=priority,  # type: ignore[arg-type]
        priorityConfidence=round(priority_confidence, 3),
        sentiment=sentiment,
        sentimentScore=round(sentiment_score, 3),
        priorityReason=reason,
        modelVersion=MODEL_VERSION,
        duplicates=detect_duplicates(payload.subject, payload.description, payload.existing),
    )
