def compute_confidence(per_word_scores: list[float]) -> float:
    """
    Compute overall OCR confidence as mean of per-word scores.
    Returns 0.0 if no words were extracted (triggers LLM fallback in hybrid mode).
    """
    if not per_word_scores:
        return 0.0
    mean = sum(per_word_scores) / len(per_word_scores)
    return round(min(1.0, max(0.0, mean)), 10)
