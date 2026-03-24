from unittest.mock import patch, MagicMock
from ocr.easyocr_engine import extract_text, OcrResult


@patch("ocr.easyocr_engine._get_reader")
def test_extract_text_returns_joined_text(mock_reader):
    reader = MagicMock()
    reader.readtext.return_value = [
        ([[0, 0], [50, 0], [50, 10], [0, 10]], "Hello", 0.95),
        ([[60, 0], [110, 0], [110, 10], [60, 10]], "World", 0.88),
    ]
    mock_reader.return_value = reader
    result = extract_text(None)
    assert isinstance(result, OcrResult)
    assert result.raw_text == "Hello World"
    assert result.confidences == [0.95, 0.88]


@patch("ocr.easyocr_engine._get_reader")
def test_extract_text_empty_results(mock_reader):
    reader = MagicMock()
    reader.readtext.return_value = []
    mock_reader.return_value = reader
    result = extract_text(None)
    assert result.raw_text == ""
    assert result.confidences == []


@patch("ocr.easyocr_engine._get_reader")
def test_extract_text_preserves_line_breaks(mock_reader):
    """Text blocks on different Y-positions should be separated by newlines."""
    reader = MagicMock()
    # Two words on row y~10, one word on row y~50
    reader.readtext.return_value = [
        ([[0, 10], [100, 10], [100, 30], [0, 30]], "Patient Name", 0.95),
        ([[120, 10], [250, 10], [250, 30], [120, 30]], "John Miller", 0.90),
        ([[0, 50], [100, 50], [100, 70], [0, 70]], "Date", 0.92),
        ([[120, 50], [250, 50], [250, 70], [120, 70]], "Oct 26, 2023", 0.88),
    ]
    mock_reader.return_value = reader
    result = extract_text(None)
    assert "Patient Name John Miller" in result.raw_text
    assert "Date Oct 26, 2023" in result.raw_text
    # Lines should be separated by newlines
    lines = result.raw_text.strip().split("\n")
    assert len(lines) == 2
