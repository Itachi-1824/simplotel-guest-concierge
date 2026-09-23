from __future__ import annotations

import json
import logging
import os
import time
from functools import lru_cache
from pathlib import Path
from threading import Lock
from contextlib import asynccontextmanager
from .signals import relevance_signal

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(os.getenv("MODEL_CACHE_DIR", str(ROOT / ".cache")))
os.environ.setdefault("HF_HOME", str(CACHE / "huggingface"))
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

FACTS = json.loads((ROOT / "data" / "hotel.json").read_text(encoding="utf-8"))["facts"]
EMBEDDING_MODEL = os.getenv("LOCAL_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
RERANK_MODEL = "ms-marco-TinyBERT-L-2-v2"
@asynccontextmanager
async def lifespan(app):
    try:
        _load_retrieval()
        _load_laya()
    except Exception as exc:
        _errors["embedding"] = type(exc).__name__
        logger.warning("Embedding model unavailable: %s", type(exc).__name__)
    yield


app = FastAPI(title="Simplotel Concierge local AI", docs_url="/docs", lifespan=lifespan)
logger = logging.getLogger("concierge.models")
_load_lock = Lock()
_inference_lock = Lock()
_embedder = _embeddings = _ranker = _laya = None
_errors = {}


class AnalysisRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1600)
    query_candidates: list[str] = Field(default_factory=list, max_length=5)


def _load_retrieval():
    global _embedder, _embeddings, _ranker
    with _load_lock:
        if _embedder is None:
            import torch
            from sentence_transformers import SentenceTransformer
            torch.set_num_threads(int(os.getenv("MODEL_CPU_THREADS", "4")))
            _embedder = SentenceTransformer(EMBEDDING_MODEL)
            _embeddings = _embedder.encode([f"{fact['question']} {fact['answer']}" for fact in FACTS], normalize_embeddings=True, show_progress_bar=False)
        if _ranker is None and "reranker" not in _errors:
            try:
                from flashrank import Ranker
                _ranker = Ranker(model_name=RERANK_MODEL, max_length=256, cache_dir=str(CACHE / "flashrank"))
            except Exception as exc:
                _errors["reranker"] = type(exc).__name__
                logger.warning("FlashRank unavailable: %s", type(exc).__name__)


def _load_laya():
    global _laya
    if os.getenv("LAYA_ENABLED", "1") == "0":
        return
    with _load_lock:
        if _laya is None and "classifier" not in _errors:
            try:
                import laya
                _laya = laya.load("convaiinnovations/laya", device=os.getenv("LAYA_DEVICE", "cpu"))
            except Exception as exc:
                _errors["classifier"] = type(exc).__name__
                logger.warning("Laya unavailable: %s", type(exc).__name__)


def _choice(state, questions):
    if _laya is None:
        return {}
    try:
        return _laya.predict(state, questions).get("answers", {})
    except Exception as exc:
        logger.warning("Laya decision failed: %s", type(exc).__name__)
        return {}


@lru_cache(maxsize=128)
def _analyze(question: str, candidates: tuple[str, ...]):
    started = time.perf_counter()
    _load_retrieval()
    _load_laya()
    with _inference_lock:
        questions = {"intent": {"type":"choice", "instructions":"Classify the hotel guest request.", "criteria":{
            "A":"Request room availability or a reservation for a stay",
            "B":"Ask about hotel rooms, services, amenities or policies",
            "C":"Discuss something unrelated to the hotel"
        }}}
        if len(candidates) > 1:
            questions["query"] = {"type":"choice", "instructions":"Choose the search query that best preserves the guest's meaning and relevant room context.", "criteria":{str(index): value[:180] for index,value in enumerate(candidates)}}
        decision = _choice({"guest_request":question},questions)
        route = decision.get("intent", {})
        query_choice = decision.get("query", {})
        selected_query = question
        choice = str(query_choice.get("choice", ""))
        if choice.isdigit() and int(choice) < len(candidates) and float(query_choice.get("confidence") or 0) >= .8:
            selected_query = candidates[int(choice)]
        query_vector = _embedder.encode(question, normalize_embeddings=True, show_progress_bar=False)
        scores = _embeddings @ query_vector
        if selected_query != question:
            alternate = _embedder.encode(selected_query, normalize_embeddings=True, show_progress_bar=False)
            scores = scores * .75 + (_embeddings @ alternate) * .25
        indices = sorted(range(len(FACTS)), key=lambda index: float(scores[index]), reverse=True)
        passages = [{"id":FACTS[index]["id"],"text":f"{FACTS[index]['question']} {FACTS[index]['answer']}"} for index in indices[:8]]
        ranked = []
        if _ranker is not None:
            from flashrank import RerankRequest
            ranked = _ranker.rerank(RerankRequest(query=question,passages=passages))
        judgments = []
        for passage in (ranked or passages)[:3]:
            result = _choice({"guest_request":question,"hotel_evidence":passage["text"]},{"relevance":{
                "type":"choice","instructions":"Does the hotel evidence directly answer a part of this guest request?","criteria":{"A":"The evidence directly answers the request","B":"The evidence is unrelated or does not answer it"}
            }}).get("relevance",{})
            if result.get("choice") in ("A","B"):
                judgments.append({"id":passage["id"],"score":relevance_signal(result["choice"],result.get("confidence")),"choice":result["choice"],"confidence":result.get("confidence")})
    return {
        "intent":{"A":"availability","B":"hotel_information","C":"outside_scope"}.get(route.get("choice")),
        "intent_confidence":route.get("confidence"),
        "selected_query":selected_query,
        "semantic":[{"id":FACTS[index]["id"],"score":float(scores[index])} for index in indices],
        "reranked":[{"id":item["id"],"score":float(item["score"])} for item in ranked],
        "judgments":judgments,
        "duration_ms":round((time.perf_counter()-started)*1000),
        "models":{"embedding":EMBEDDING_MODEL,"reranker":RERANK_MODEL if _ranker else None,"classifier":"convaiinnovations/laya" if _laya else None}
    }


@app.get("/health")
def health():
    return {"status":"ok","embedding_loaded":_embedder is not None,"reranker_loaded":_ranker is not None,"laya_loaded":_laya is not None,"degraded_components":list(_errors)}


@app.post("/v1/analyze")
def analyze(request: AnalysisRequest):
    try:
        return _analyze(request.question,tuple(value[:1600] for value in request.query_candidates))
    except Exception as exc:
        logger.exception("Local retrieval failed")
        raise HTTPException(status_code=503,detail="Local retrieval unavailable; the application can use its built-in fallback.") from exc
