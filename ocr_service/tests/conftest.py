import sys
from pathlib import Path

# Add ocr_service root to sys.path so tests can import `ocr.*` and `models`
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
