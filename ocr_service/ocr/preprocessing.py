import cv2
import numpy as np


def preprocess_image(img: np.ndarray) -> np.ndarray:
    """
    Gentle preprocessing that preserves text in varied document types.
    Pipeline: grayscale → light denoise → CLAHE contrast enhancement.
    Skips binary threshold and deskew to avoid destroying handwritten/faint text.
    """
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()

    # Light denoising — preserve text edges
    denoised = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)

    # CLAHE for contrast enhancement (gentle)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)

    return enhanced
