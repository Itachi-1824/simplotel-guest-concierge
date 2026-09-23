import json
from .app import _load_retrieval, _load_laya, _analyze, health

print("Preparing MiniLM and FlashRank. First run downloads model weights.", flush=True)
_load_retrieval()
print("Preparing Laya. First run downloads approximately 808 MB.", flush=True)
_load_laya()
print(json.dumps(health(),indent=2),flush=True)
result = _analyze("What time is check-in?",())
print(json.dumps({"models":result["models"],"intent":result["intent"],"top_result":result["reranked"][:1],"judgments":result["judgments"],"duration_ms":result["duration_ms"]},indent=2),flush=True)
