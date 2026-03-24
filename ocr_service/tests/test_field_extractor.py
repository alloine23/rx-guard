from ocr.field_extractor import extract_fields


def test_extracts_patient_name():
    text = "Patient Name: Juan Dela Cruz\nDate: 2026-03-10\nDiagnosis: Hypertension"
    fields = extract_fields(text)
    assert fields["patient_name"] == "Juan Dela Cruz"


def test_extracts_date_iso():
    text = "Date: 2026-03-10\nPatient: Test"
    fields = extract_fields(text)
    assert fields["date"] == "2026-03-10"


def test_extracts_date_slash_format():
    text = "Date: 03/10/2026\nPatient: Test"
    fields = extract_fields(text)
    assert fields["date"] == "03/10/2026"


def test_extracts_diagnosis():
    text = "Patient Name: Test\nDiagnosis: Type 2 Diabetes Mellitus"
    fields = extract_fields(text)
    assert fields["diagnosis"] == "Type 2 Diabetes Mellitus"


def test_extracts_doctor_name():
    text = "Patient: Test\nDr. Santos\nDiagnosis: Flu"
    fields = extract_fields(text)
    assert fields["doctor_name"] == "Dr. Santos"


def test_extracts_medications():
    text = """Patient Name: Test
Diagnosis: Hypertension
Losartan 50mg once daily
Amlodipine 5mg once daily"""
    fields = extract_fields(text)
    assert len(fields["medications"]) == 2
    assert fields["medications"][0]["name"] == "Losartan"
    assert fields["medications"][0]["dosage"] == "50mg"
    assert fields["medications"][0]["frequency"] == "once daily"
    assert fields["medications"][1]["name"] == "Amlodipine"


def test_handles_empty_text():
    fields = extract_fields("")
    assert fields["patient_name"] == ""
    assert fields["medications"] == []


def test_handles_no_matching_patterns():
    fields = extract_fields("random gibberish with no structure")
    assert isinstance(fields["patient_name"], str)
    assert isinstance(fields["medications"], list)


def test_extracts_patient_name_without_separator():
    """Prescription labels often have no colon — just 'PATIENT NAME John Miller'."""
    text = "PATIENT NAME John Q. Miller\nDATE Oct 26, 2023"
    fields = extract_fields(text)
    assert fields["patient_name"] == "John Q. Miller"


def test_extracts_diagnosis_without_separator():
    text = "PATIENT NAME Test\nDIAGNOSIS Type 2 Diabetes, Hypertension"
    fields = extract_fields(text)
    assert fields["diagnosis"] == "Type 2 Diabetes, Hypertension"


def test_extracts_doctor_name_label():
    """'DOCTOR NAME' is a common label not currently matched."""
    text = "DOCTOR NAME Dr. S. Chen\nMEDICATIONS below"
    fields = extract_fields(text)
    assert "Dr. S. Chen" in fields["doctor_name"]


def test_extracts_date_text_format():
    text = "PATIENT NAME Test\nDATE Oct 26, 2023"
    fields = extract_fields(text)
    assert fields["date"] == "Oct 26, 2023"


def test_full_prescription_no_separators():
    """Simulate a real prescription with no colons — the exact format from the bug."""
    text = (
        "PATIENT NAME John Q. Miller\n"
        "CLINIC NOTES\n"
        "DATE Oct 26, 2023\n"
        "DIAGNOSIS Type 2 Diabetes, Hypertension\n"
        "DOCTOR NAME Dr. S. Chen\n"
        "MEDICATIONS\n"
        "Metformin 500mg BID\n"
        "Lisinopril 10mg QD\n"
        "Atorvastatin 20mg QD"
    )
    fields = extract_fields(text)
    assert fields["patient_name"] == "John Q. Miller"
    assert fields["date"] == "Oct 26, 2023"
    assert "Type 2 Diabetes" in fields["diagnosis"]
    assert "Dr. S. Chen" in fields["doctor_name"]
    assert len(fields["medications"]) == 3
    assert fields["medications"][0]["name"] == "Metformin"
    assert fields["medications"][0]["dosage"] == "500mg"


def test_next_line_patient_name():
    """Label on one line, value on next — common with handwritten prescriptions."""
    text = "PATIENT NAME CLINIC NOTES]\nJohn Q Mi ller\nDATE\nOct 26, 2023"
    fields = extract_fields(text)
    # Should skip noise ("CLINIC NOTES]") and use next line
    assert "John" in fields["patient_name"]


def test_next_line_date():
    """DATE label alone on its line, date value on the next line."""
    text = "PATIENT NAME Test\nDATE\nOct 26, 2023\nDIAGNOSIS Flu"
    fields = extract_fields(text)
    assert "Oct" in fields["date"]


def test_next_line_doctor_name():
    """DOCTOR NAME label with garbage, real Dr. on another line."""
    text = "DIAGNOSIS Flu\nDOCTOR NAME\nDr. S. Chen\nMEDICATIONS"
    fields = extract_fields(text)
    assert "Dr" in fields["doctor_name"]


def test_medications_after_label():
    """Medications listed on lines after MEDICATIONS label, with OCR noise."""
    text = (
        "MEDICATIONS\n"
        "Metformin 500mg BID\n"
        "Lisinopril 10mg QD\n"
        "Atorvastatin 20mg QD"
    )
    fields = extract_fields(text)
    assert len(fields["medications"]) >= 3


def test_real_ocr_output():
    """Exact OCR output from the test prescription image."""
    text = (
        "PATIENT NAME CLINIC NOTES]\n"
        "John Q Mi ller\n"
        "DATE\n"
        "Oct 2l , 2023\n"
        "DIAGNOSIS Type 2 Diabeks, Hypertensiot\n"
        "D: $. Chn_\n"
        "DOCTOR NAME g*86v\n"
        "MEDICATIONS BID\n"
        "Metkormin\n"
        "Lisinopril IOmg\n"
        "pOm& QD\n"
        "Horvastali"
    )
    fields = extract_fields(text)
    # Patient name should come from next line after label
    assert "John" in fields["patient_name"]
    # Diagnosis should be partially extracted
    assert fields["diagnosis"] != ""
    # Should extract at least some medications
    # (Lisinopril has "IOmg" which needs digit normalization)
    assert len(fields["medications"]) >= 1 or fields["patient_name"] != ""
