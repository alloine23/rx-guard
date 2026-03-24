from pydantic import BaseModel


class Medication(BaseModel):
    name: str
    dosage: str
    frequency: str


class OcrFields(BaseModel):
    patient_name: str = ""
    date: str = ""
    diagnosis: str = ""
    medications: list[Medication] = []
    doctor_name: str = ""


class OcrResponse(BaseModel):
    fields: OcrFields
    confidence: float
    raw_text: str
    engine: str = "traditional"
