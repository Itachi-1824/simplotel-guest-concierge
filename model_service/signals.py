import math


def booking_state(question):
    turns = [value.strip() for value in question.splitlines() if value.strip()]
    if len(turns) > 1:
        return [{"guest_request": value} for value in turns]
    return {"guest_request": question}


def relevance_signal(choice, confidence):
    if choice not in ("A", "B"):
        return .5
    try:
        value = float(confidence or 0)
    except (ValueError, TypeError):
        return .5
    if not math.isfinite(value):
        return .5
    certainty = max(0, min(1, value))
    return .5 + (.5 if choice == "A" else -.5) * certainty
