"""Focused search for two unresolved suppliers in payment support PDFs."""

from pathlib import Path
import json
import logging
import re
from pypdf import PdfReader

ROOT = Path(r"C:\Users\Elio\Documents\MEGA\UPCO DE VENEZUELA")
DIRECTORIES = [
    ROOT / "PAGOS" / "PAGOS AÑO 2026" / "03 MARZO 2026",
    ROOT / "PAGOS" / "PAGOS AÑO 2026" / "04 ABRIL 2026",
    ROOT / "IVA" / "2026",
]
TOKENS = ["PELAGIAS", "TODOS LOS DIAS ZHENG", "ZHENG"]
RIF_RE = re.compile(r"(?<![A-Z0-9])[VEJPG][-\s]?[0-9]{9}(?![0-9])", re.I)
logging.getLogger("pypdf").setLevel(logging.ERROR)

paths = sorted({p for directory in DIRECTORIES for p in directory.rglob("*.pdf")})
results = []
for index, path in enumerate(paths, start=1):
    try:
        reader = PdfReader(path, strict=False)
        text = "\n".join(page.extract_text() or "" for page in reader.pages[:2])
    except Exception:
        continue
    folded = text.upper()
    matches = [token for token in TOKENS if token in folded]
    if matches:
        results.append({
            "path": str(path),
            "matches": matches,
            "rifs": sorted(set(RIF_RE.findall(text.upper())) - {"J308175390"}),
            "textLength": len(text),
        })
    if index % 150 == 0:
        print(f"Scanned {index}/{len(paths)} PDFs", flush=True)
output = Path(__file__).parent / "other_pdf_evidence.json"
output.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"pdfs": len(paths), "matches": len(results), "withRif": sum(bool(x["rifs"]) for x in results)}))
for result in results:
    print(result)
