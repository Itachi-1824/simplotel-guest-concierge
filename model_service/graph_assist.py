import json
from .app import FACTS, CACHE, _load_laya, _choice


def main():
    _load_laya()
    proposals = []
    rooms = [fact for fact in FACTS if fact["topic"] == "Rooms"]
    policies = [fact for fact in FACTS if fact["id"] in ("breakfast", "wifi", "accessibility")]
    for room in rooms:
        for policy in policies:
            result = _choice({"room_fact":room["answer"], "policy_fact":policy["answer"]}, {"relation": {
                "type":"choice",
                "instructions":"Choose the relationship explicitly supported by these hotel facts. Do not infer missing features.",
                "criteria":{"A":"This room has an explicit meal policy", "B":"This room shares a hotel-wide amenity", "C":"This room has an explicit accessibility policy", "D":"No supported relationship"}
            }}).get("relation", {})
            relation = {"A":"meal_policy","B":"shared_amenity","C":"accessibility_policy"}.get(result.get("choice"))
            if relation:
                proposals.append({"from":room["id"],"to":policy["id"],"relation":relation,"evidence":[room["id"],policy["id"]],"classifier_confidence":result.get("confidence"),"requires_review":True})
    CACHE.mkdir(parents=True,exist_ok=True)
    output = CACHE / "graph-proposals.json"
    output.write_text(json.dumps({"notice":"Unreviewed classifier suggestions. Check both source facts before adding any edge to data/knowledge-graph.json.","proposals":proposals},indent=2),encoding="utf-8")
    print(f"Wrote {len(proposals)} review-only proposals to {output}. Active graph unchanged.")


if __name__ == "__main__":
    main()
