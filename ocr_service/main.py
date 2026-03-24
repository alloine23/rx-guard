import io
import traceback

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image

from dedup import compute_phash, compute_crop_resistant_hash
from models import OcrFields, OcrResponse
from ocr.preprocessing import preprocess_image
from ocr.easyocr_engine import extract_text
from ocr.field_extractor import extract_fields
from ocr.normalizer import normalize_fields
from ocr.confidence import compute_confidence

app = FastAPI(title="RxGuard OCR Service", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr/process", response_model=OcrResponse)
async def ocr_process(file: UploadFile = File(...)):
    """Process a medical record image and return structured OCR data."""
    if file.content_type not in ("image/png", "image/jpeg"):
        raise HTTPException(status_code=400, detail="Invalid image format")

    try:
        contents = await file.read()

        try:
            pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
            img = np.array(pil_image)
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image format")

        preprocessed = preprocess_image(img)
        ocr_result = extract_text(preprocessed)
        raw_fields = extract_fields(ocr_result.raw_text)
        normalized = normalize_fields(raw_fields)
        confidence = compute_confidence(ocr_result.confidences)

        medications = [
            {"name": m["name"], "dosage": m["dosage"], "frequency": m["frequency"]}
            for m in normalized.get("medications", [])
        ]

        fields = OcrFields(
            patient_name=normalized.get("patient_name", ""),
            date=normalized.get("date", ""),
            diagnosis=normalized.get("diagnosis", ""),
            medications=medications,
            doctor_name=normalized.get("doctor_name", ""),
        )

        return OcrResponse(
            fields=fields,
            confidence=round(confidence, 4),
            raw_text=ocr_result.raw_text,
            engine="traditional",
        )

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(e)}",
        )


@app.post("/dedup/hash")
async def compute_image_hash(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        phash = compute_phash(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to compute hash: {str(e)}")
    crhash = None
    try:
        crhash = compute_crop_resistant_hash(contents)
    except Exception:
        pass  # crop-resistant hash is best-effort
    return {"phash": phash, "crhash": crhash}
