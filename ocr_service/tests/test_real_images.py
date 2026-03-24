"""
Integration tests that run the full OCR pipeline on real images.

Drop any .png/.jpg/.jpeg into tests/fixtures/ and run:
    cd ocr_service && python3 -m pytest tests/test_real_images.py -v -s

Tests are skipped automatically when no images are present.
Each image is run through: preprocessing → EasyOCR → field extraction → normalization.
The test asserts that at least ONE field was extracted (not all blank).
"""

import cv2
import pytest
from pathlib import Path

from ocr.preprocessing import preprocess_image
from ocr.easyocr_engine import extract_text
from ocr.field_extractor import extract_fields
from ocr.normalizer import normalize_fields
from ocr.confidence import compute_confidence

FIXTURES_DIR = Path(__file__).parent / "fixtures"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}


def _find_images():
    if not FIXTURES_DIR.exists():
        return []
    return [
        p for p in sorted(FIXTURES_DIR.iterdir())
        if p.suffix.lower() in IMAGE_EXTENSIONS
    ]


images = _find_images()


@pytest.mark.skipif(not images, reason="No test images in tests/fixtures/")
@pytest.mark.parametrize("image_path", images, ids=[p.name for p in images])
def test_ocr_extracts_fields_from_image(image_path):
    """Full pipeline: image → preprocess → OCR → extract → normalize."""
    img = cv2.imread(str(image_path))
    assert img is not None, f"Failed to load image: {image_path}"

    preprocessed = preprocess_image(img)
    ocr_result = extract_text(preprocessed)

    print(f"\n{'='*60}")
    print(f"Image: {image_path.name}")
    print(f"{'='*60}")
    print(f"Raw OCR text:\n{ocr_result.raw_text}")
    print(f"Confidence scores: {ocr_result.confidences}")

    raw_fields = extract_fields(ocr_result.raw_text)
    normalized = normalize_fields(raw_fields)
    confidence = compute_confidence(ocr_result.confidences)

    print(f"\n--- Extracted Fields ---")
    print(f"  Patient Name : {normalized.get('patient_name', '')!r}")
    print(f"  Date         : {normalized.get('date', '')!r}")
    print(f"  Diagnosis    : {normalized.get('diagnosis', '')!r}")
    print(f"  Doctor Name  : {normalized.get('doctor_name', '')!r}")
    print(f"  Medications  : {normalized.get('medications', [])}")
    print(f"  Confidence   : {confidence:.2%}")
    print(f"{'='*60}")

    # At least one field should have been extracted
    has_any = (
        bool(normalized.get("patient_name"))
        or bool(normalized.get("date"))
        or bool(normalized.get("diagnosis"))
        or bool(normalized.get("doctor_name"))
        or bool(normalized.get("medications"))
    )
    assert has_any, (
        f"OCR extracted nothing from {image_path.name}. "
        f"Raw text was: {ocr_result.raw_text!r}"
    )
