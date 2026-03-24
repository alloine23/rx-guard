import io
from unittest.mock import patch, MagicMock

import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _make_png_bytes() -> bytes:
    """Create a minimal valid PNG image."""
    img = Image.fromarray(np.ones((50, 50, 3), dtype=np.uint8) * 200)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_rejects_non_image_content_type():
    resp = client.post(
        "/ocr/process",
        files={"file": ("test.txt", b"hello", "text/plain")},
    )
    assert resp.status_code == 400
    assert "Invalid image format" in resp.json()["detail"]


@patch("main.extract_text")
@patch("main.preprocess_image")
def test_happy_path_returns_200(mock_preprocess, mock_extract):
    mock_preprocess.return_value = np.ones((50, 50), dtype=np.uint8)
    mock_extract.return_value = MagicMock(
        raw_text="Patient Name: Test\nDiagnosis: Flu",
        confidences=[0.9, 0.85],
    )

    png = _make_png_bytes()
    resp = client.post(
        "/ocr/process",
        files={"file": ("record.png", png, "image/png")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "fields" in data
    assert "confidence" in data
    assert data["engine"] == "traditional"


@patch("main.preprocess_image", side_effect=RuntimeError("GPU exploded"))
def test_internal_error_returns_500(mock_preprocess):
    png = _make_png_bytes()
    resp = client.post(
        "/ocr/process",
        files={"file": ("record.png", png, "image/png")},
    )
    assert resp.status_code == 500
    assert "OCR processing failed" in resp.json()["detail"]


def test_corrupt_image_data_returns_400():
    resp = client.post(
        "/ocr/process",
        files={"file": ("record.png", b"not-a-real-image", "image/png")},
    )
    assert resp.status_code == 400
    assert "Invalid image format" in resp.json()["detail"]
