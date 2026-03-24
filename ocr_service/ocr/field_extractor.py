import re

_DOSAGE_PATTERN = r"(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ml|mL|g|iu|IU|mEq|units?|tabs?|tablets?|caps?|capsules?|drops?|cc|tsp|tbsp|puffs?|patch(?:es)?|%)"
_FREQUENCY_WORDS = [
    "once daily", "twice daily", "three times daily", "four times daily",
    "every 4 hours", "every 6 hours", "every 8 hours", "every 12 hours",
    "once a day", "twice a day", "bid", "tid", "qid", "prn",
    "at bedtime", "in the morning", "before meals", "after meals",
    "daily", "weekly", "monthly", "qd", "od",
]

# Known label keywords — used to detect noise on a label line
_KNOWN_LABELS = [
    "patient", "name", "date", "diagnosis", "dx", "doctor", "physician",
    "attending", "medications", "clinic", "notes", "age", "sex", "address",
    "impression", "assessment", "prescribed", "prescriber",
]

_PATIENT_LABEL = re.compile(
    r"(?:patient\s*(?:name)?|name\s*(?:of\s*patient)?|pt|px)\s*[:\-\.]?\s*(.*)",
    re.IGNORECASE,
)
_DIAGNOSIS_LABEL = re.compile(
    r"(?:diagnosis|dx|impression|assessment)\s*[:\-]?\s*(.*)",
    re.IGNORECASE,
)
_DOCTOR_LABEL = re.compile(
    r"(?:physician|doctor\s*(?:name)?|attending|prescribed\s*by|prescriber)\s*[:\-\.]?\s*(.*)",
    re.IGNORECASE,
)
_DR_PREFIX = re.compile(r"Dr\.?\s+[A-Z][a-zA-Z \-,\.]+(?:M\.?D\.?)?")


def _fix_ocr_digits(text: str) -> str:
    """Fix common OCR misreads in dosage context: I→1, O→0, l→1."""
    # Only apply near dosage units to avoid corrupting names
    def _fix_near_unit(m: re.Match) -> str:
        s = m.group(0)
        s = s.replace("O", "0").replace("I", "1").replace("l", "1")
        return s
    return re.sub(r"[A-Za-z0-9]{1,6}\s*(?:mg|mcg|ml|mL|g)\b", _fix_near_unit, text, flags=re.IGNORECASE)


def _is_noise(value: str) -> bool:
    """Check if a captured value is likely noise rather than real data."""
    stripped = value.strip()
    if len(stripped) < 2:
        return True
    # If the value is mostly label words, it's noise
    words = stripped.lower().split()
    label_words = sum(1 for w in words if any(w.startswith(lbl) for lbl in _KNOWN_LABELS))
    # Contains special chars typical of OCR garbage
    garbage_chars = sum(1 for c in stripped if c in "*&$^~`|{}<>")
    if garbage_chars > len(stripped) * 0.3:
        return True
    if label_words >= len(words) * 0.5 and len(words) <= 4:
        return True
    return False


def extract_fields(raw_text: str) -> dict:
    lines = raw_text.strip().split("\n") if raw_text.strip() else []
    return {
        "patient_name": _extract_patient_name(lines),
        "date": _extract_date(lines),
        "diagnosis": _extract_diagnosis(lines),
        "medications": _extract_medications(lines),
        "doctor_name": _extract_doctor_name(lines),
    }


def _extract_patient_name(lines: list[str]) -> str:
    for i, line in enumerate(lines):
        match = _PATIENT_LABEL.search(line)
        if match:
            value = match.group(1).strip()
            # If value is noise or empty, try next line
            if _is_noise(value) and i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if not _is_noise(next_line):
                    return next_line
            if value and not _is_noise(value):
                return value
    return ""


def _extract_date(lines: list[str]) -> str:
    # First try: find a date pattern anywhere in the text
    text = "\n".join(lines)
    # Normalize OCR digits before searching for dates
    normalized = _fix_ocr_digits(text)

    # ISO format: YYYY-MM-DD
    match = re.search(r"\d{4}-\d{2}-\d{2}", normalized)
    if match:
        return match.group()
    # US format: MM/DD/YYYY or DD/MM/YYYY
    match = re.search(r"\d{1,2}/\d{1,2}/\d{4}", normalized)
    if match:
        return match.group()
    # Dashed: DD-MM-YYYY or MM-DD-YYYY
    match = re.search(r"\d{1,2}-\d{1,2}-\d{4}", normalized)
    if match:
        return match.group()
    # Text format: Month DD, YYYY (allow OCR noise in digits)
    match = re.search(
        r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\w{1,2}\s*,?\s+\d{4}",
        normalized, re.IGNORECASE,
    )
    if match:
        return match.group()
    # Text format: DD Month YYYY
    match = re.search(
        r"\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}",
        normalized, re.IGNORECASE,
    )
    if match:
        return match.group()
    return ""


def _extract_diagnosis(lines: list[str]) -> str:
    for i, line in enumerate(lines):
        match = _DIAGNOSIS_LABEL.search(line)
        if match:
            value = match.group(1).strip()
            if value and not _is_noise(value):
                return value
            # Next-line fallback
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if not _is_noise(next_line):
                    return next_line
    return ""


def _extract_doctor_name(lines: list[str]) -> str:
    text = "\n".join(lines)
    for i, line in enumerate(lines):
        match = _DOCTOR_LABEL.search(line)
        if match:
            value = match.group(1).strip()
            if value and not _is_noise(value):
                return value
            # Next-line fallback
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if not _is_noise(next_line):
                    return next_line
    # Look for Dr. prefix anywhere
    match = _DR_PREFIX.search(text)
    if match:
        return match.group().strip()
    return ""


def _extract_medications(lines: list[str]) -> list[dict]:
    meds = []
    for line in lines:
        # Normalize OCR digit misreads before matching dosage
        fixed_line = _fix_ocr_digits(line)
        dosage_match = re.search(_DOSAGE_PATTERN, fixed_line, re.IGNORECASE)
        if not dosage_match:
            continue
        line_lower = fixed_line.lower().strip()
        if any(line_lower.startswith(label) for label in
               ["patient", "name", "date", "diagnosis", "dx", "doctor",
                "physician", "attending", "age", "sex", "address", "medication"]):
            continue
        dosage = dosage_match.group(0)
        name_part = fixed_line[:dosage_match.start()].strip().rstrip(":-")
        if not name_part:
            continue
        frequency = ""
        for freq in _FREQUENCY_WORDS:
            if freq in line_lower:
                frequency = freq
                break
        meds.append({"name": name_part, "dosage": dosage, "frequency": frequency})
    return meds
