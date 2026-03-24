from dataclasses import dataclass
import easyocr

_reader: easyocr.Reader | None = None


def _get_reader() -> easyocr.Reader:
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(["en"], gpu=False)
    return _reader


@dataclass
class OcrResult:
    raw_text: str
    confidences: list[float]


def extract_text(img) -> OcrResult:
    reader = _get_reader()
    results = reader.readtext(img)
    if not results:
        return OcrResult(raw_text="", confidences=[])

    # Sort by Y-coordinate (top of bounding box), then X
    entries = []
    for bbox, text, conf in results:
        # bbox is [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] — use top-left Y and X
        y = bbox[0][1]
        x = bbox[0][0]
        entries.append((y, x, text, float(conf)))
    entries.sort(key=lambda e: (e[0], e[1]))

    if len(entries) < 2:
        return OcrResult(raw_text=entries[0][2], confidences=[entries[0][3]])

    # Compute median text block height for adaptive line-gap threshold
    heights = []
    for bbox, _text, _conf in results:
        h = abs(bbox[2][1] - bbox[0][1])
        if h > 0:
            heights.append(h)
    median_h = sorted(heights)[len(heights) // 2] if heights else 20
    line_gap = median_h * 0.6  # 60% of median char height

    lines: list[list[tuple]] = [[entries[0]]]
    for entry in entries[1:]:
        prev_y = lines[-1][0][0]
        if abs(entry[0] - prev_y) <= line_gap:
            lines[-1].append(entry)
        else:
            lines.append([entry])

    # Sort each line by X, join words with spaces, join lines with newlines
    text_lines = []
    confidences = []
    for line in lines:
        line.sort(key=lambda e: e[1])
        text_lines.append(" ".join(e[2] for e in line))
        confidences.extend(e[3] for e in line)

    return OcrResult(raw_text="\n".join(text_lines), confidences=confidences)
