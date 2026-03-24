from ocr.normalizer import normalize_medication, normalize_diagnosis, normalize_fields


def test_exact_medication_match():
    assert normalize_medication("Losartan") == "Losartan"


def test_fuzzy_medication_match():
    assert normalize_medication("Losrtan") == "Losartan"


def test_medication_below_threshold():
    result = normalize_medication("xyzabc123", threshold=80)
    assert result == "xyzabc123"


def test_exact_diagnosis_match():
    assert normalize_diagnosis("Hypertension") == "Hypertension"


def test_normalize_fields_wires_correctly():
    fields = {
        "diagnosis": "Hypertension",
        "medications": [{"name": "Losrtan", "dosage": "50mg", "frequency": "daily"}],
    }
    result = normalize_fields(fields)
    assert result["diagnosis"] == "Hypertension"
    assert result["medications"][0]["name"] == "Losartan"
