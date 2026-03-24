import copy
import json
from pathlib import Path

from rapidfuzz import process, fuzz

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_MEDICATION_VOCAB: list[str] = []
_DIAGNOSIS_VOCAB: list[str] = []


def _load_vocab():
    global _MEDICATION_VOCAB, _DIAGNOSIS_VOCAB
    if not _MEDICATION_VOCAB:
        with open(_DATA_DIR / "medications.json") as f:
            _MEDICATION_VOCAB = json.load(f)["medications"]
    if not _DIAGNOSIS_VOCAB:
        with open(_DATA_DIR / "diagnoses.json") as f:
            _DIAGNOSIS_VOCAB = json.load(f)["diagnoses"]


def normalize_medication(name: str, threshold: int = 80) -> str:
    _load_vocab()
    if not name or not _MEDICATION_VOCAB:
        return name
    result = process.extractOne(name, _MEDICATION_VOCAB, scorer=fuzz.WRatio)
    if result and result[1] >= threshold:
        return result[0]
    return name


def normalize_diagnosis(diagnosis: str, threshold: int = 80) -> str:
    _load_vocab()
    if not diagnosis or not _DIAGNOSIS_VOCAB:
        return diagnosis
    result = process.extractOne(diagnosis, _DIAGNOSIS_VOCAB, scorer=fuzz.WRatio)
    if result and result[1] >= threshold:
        return result[0]
    return diagnosis


def normalize_fields(fields: dict) -> dict:
    _load_vocab()
    fields = copy.deepcopy(fields)
    if fields.get("diagnosis"):
        fields["diagnosis"] = normalize_diagnosis(fields["diagnosis"])
    for med in fields.get("medications", []):
        if med.get("name"):
            med["name"] = normalize_medication(med["name"])
    return fields
