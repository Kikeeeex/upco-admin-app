"""Find RIF evidence for names missing it in historical certificates."""

from pathlib import Path
import json
import re
import unicodedata
import warnings

from openpyxl import load_workbook

ROOT = Path(r"C:\Users\Elio\Documents\MEGA\UPCO DE VENEZUELA")
OUTPUT = Path(__file__).resolve().parent
TOKENS = [
    "JINCHENG", "FENG YUZHEN", "QUINCAMIGA", "PELAGIAS", "ZHENG",
    "ROSDANY", "JIELING", "HUANG WEBIN",
]
RIF_RE = re.compile(r"\b[VEJPG][\s-]?[0-9]{9}\b", re.I)
warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")


def folded(value: object) -> str:
    text = "" if value is None else str(value)
    return "".join(
        c for c in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(c)
    ).upper()


paths = list(ROOT.rglob("*.xlsx"))
results = []
errors = []
for index, path in enumerate(paths, start=1):
    try:
        workbook = load_workbook(path, read_only=True, data_only=True, keep_links=False)
        for sheet in workbook.worksheets:
            # Some administrative books declare 1,048,576 formatted rows;
            # cap the read to the actual operational area.
            max_row = min(sheet.max_row or 5_000, 5_000)
            max_col = min(sheet.max_column or 50, 50)
            for row_index, row in enumerate(
                sheet.iter_rows(max_row=max_row, max_col=max_col, values_only=True),
                start=1,
            ):
                cells = [folded(value).strip() for value in row]
                matches = [token for token in TOKENS if any(token in cell for cell in cells)]
                if not matches:
                    continue
                joined = " | ".join(cells)
                rifs = [item.replace(" ", "").replace("-", "") for item in RIF_RE.findall(joined)]
                record = {
                    "path": str(path), "sheet": sheet.title, "row": row_index,
                    "matches": matches, "rifs": sorted(set(rifs)),
                    "cells": [cell[:200] for cell in cells if cell][:12],
                }
                results.append(record)
        workbook.close()
    except Exception as exc:
        errors.append({"path": str(path), "error": f"{type(exc).__name__}: {exc}"[:200]})
    if index % 25 == 0:
        print(f"Scanned {index}/{len(paths)} workbooks; hits={len(results)}", flush=True)

(OUTPUT / "local_rif_evidence.json").write_text(
    json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8"
)
(OUTPUT / "local_rif_errors.json").write_text(
    json.dumps(errors, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(json.dumps({
    "workbooks": len(paths), "matches": len(results), "errors": len(errors),
    "withRifInSameRow": sum(bool(item["rifs"]) for item in results),
}, ensure_ascii=False))
for result in results:
    if result["rifs"]:
        print(result["matches"], result["rifs"], result["path"], result["sheet"], result["row"])
