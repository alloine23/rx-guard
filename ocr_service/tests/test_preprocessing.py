import numpy as np
from ocr.preprocessing import preprocess_image


def test_preprocess_returns_numpy_array():
    """Preprocessing should return a uint8 numpy array."""
    img = np.ones((100, 100, 3), dtype=np.uint8) * 255
    img[30:35, 20:80] = 0
    img[50:55, 20:80] = 0
    result = preprocess_image(img)
    assert isinstance(result, np.ndarray)
    assert result.dtype == np.uint8


def test_preprocess_converts_to_grayscale():
    """Output should be single-channel (grayscale)."""
    img = np.ones((100, 100, 3), dtype=np.uint8) * 200
    result = preprocess_image(img)
    assert len(result.shape) == 2


def test_preprocess_handles_already_grayscale():
    """Should handle grayscale input without crashing."""
    img = np.ones((100, 100), dtype=np.uint8) * 200
    result = preprocess_image(img)
    assert isinstance(result, np.ndarray)
    assert len(result.shape) == 2


def test_preprocess_preserves_dimensions():
    """Output dimensions should be close to input (no drastic resize)."""
    img = np.ones((200, 300, 3), dtype=np.uint8) * 128
    result = preprocess_image(img)
    h, w = result.shape[:2]
    assert 100 < h < 400
    assert 100 < w < 600
