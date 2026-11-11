"""Add RIF-less PDF suppliers only when a named local workbook confirms the RIF."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

from openpyxl import load_workbook
from pypdf import PdfReader

from extract_suppliers import SOURCE, ascii_fold, clean, iva_rate, supplier_address

OUTPUT = Path(__file__).resolve().parent
ROOT = Path(r"C:\Users\Elio\Documents\MEGA\UPCO DE VENEZUELA")
mapping = json.loads((OUTPUT / "supplemental_rifs.json").read_text(encoding="utf-8"))
suppliers = json.loads((OUTPUT / "suppliers.json").read_text(encoding="utf-8"))
review_rows = list(csv.DictReader((OUTPUT / "needs_rif.csv").open(encoding="utf-8-sig")))


def key(value: object) -> str:
    return re.sub(r"[^A-Z0-9]", "", ascii_fold(clean(str(value or ""))))


def normalize_rif(value: object) -> str:
    return re.sub(r"[^A-Z0-9]", "", ascii_fold(str(value or "")))


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


existing_rifs = {item["rif"] for item in suppliers}
existing_names = {key(item["name"]): item["rif"] for item in suppliers}
review_by_name = {key(item["name"]): item for item in review_rows}
resolved = []
added = 0
for item in mapping:
    rif = item["rif"]
    if not re.fullmatch(r"[VEJPG][0-9]{9}", rif):
        raise ValueError(f"Invalid mapped RIF for {item['name']}")
    source_name = item["name"]
    source_key = key(source_name)
    if source_key not in review_by_name:
        raise ValueError(f"Name absent from unresolved PDF queue: {source_name}")
    workbook_path = ROOT / item["sourceWorkbook"]
    workbook = load_workbook(workbook_path, read_only=True, data_only=True, keep_links=False)
    try:
        sheet = workbook[item["sheet"]]
        workbook_name = sheet.cell(item["row"], item["nameColumn"]).value
        workbook_rif = sheet.cell(item["row"], item["rifColumn"]).value
    finally:
        workbook.close()
    if key(workbook_name) != source_key or normalize_rif(workbook_rif) != rif:
        raise ValueError(f"Workbook evidence changed for {source_name}: {workbook_path}")
    if source_key in existing_names and existing_names[source_key] != rif:
        raise ValueError(f"Existing name has another RIF: {source_name}")
    if rif in existing_rifs:
        resolved.append({**review_by_name[source_key], "rif": rif, "sourceWorkbook": item["sourceWorkbook"]})
        continue
    review = review_by_name[source_key]
    pdf_path = SOURCE / review["sourcePdf"]
    reader = PdfReader(pdf_path, strict=False)
    text = "\n".join(page.extract_text() or "" for page in reader.pages[:2])
    kind = "iva" if "DATOS DEL PROVEEDOR" in ascii_fold(text) else "islr"
    rate = iva_rate(text, kind)
    person_type = "natural" if rif.startswith(("V", "E")) else "juridica"
    workbook_evidence = f"{item['sourceWorkbook']} / {item['sheet']} / fila {item['row']}"
    notes = {
        "taxpayerType": "No consta en comprobantes; valor inicial por revisar",
        "rif": f"RIF confirmado en libro o ficha local: {workbook_evidence}",
    }
    if rate is None:
        rate = 75
        notes["ivaRetentionRate"] = "No consta en IVA; 75 % inicial por revisar"
    supplier = {
        "rif": rif, "name": clean(source_name),
        "address": review["address"] or supplier_address(text, kind),
        "taxpayerType": "ordinario",
        "personType": person_type,
        "residency": "residente" if person_type == "natural" else "domiciliada",
        "ivaRetentionRate": rate,
        "email": "", "phone": "", "active": True,
        "sourceDate": review["sourceDate"],
        "sourcePdf": review["sourcePdf"],
        "sourceKind": kind,
        "confidence": "high",
        "review": notes,
        "fieldSources": {
            "name": review["sourcePdf"],
            "address": review["sourcePdf"],
            "personType": workbook_evidence,
            "residency": None,
            "ivaRetentionRate": review["sourcePdf"] if rate != 75 or "ivaRetentionRate" not in notes else None,
            "rif": workbook_evidence,
        },
        "certificates": 1,
    }
    suppliers.append(supplier)
    existing_rifs.add(rif)
    existing_names[source_key] = rif
    added += 1
    resolved.append({**review, "rif": rif, "sourceWorkbook": workbook_evidence})

suppliers.sort(key=lambda item: (item["name"].casefold(), item["rif"]))
(OUTPUT / "suppliers.json").write_text(json.dumps(suppliers, ensure_ascii=False, indent=2), encoding="utf-8")
write_csv(
    OUTPUT / "suppliers.csv", suppliers,
    ["rif", "name", "address", "taxpayerType", "personType", "residency",
     "ivaRetentionRate", "confidence", "sourceDate", "sourcePdf", "certificates"],
)
write_csv(
    OUTPUT / "resolved_missing_rif.csv", resolved,
    ["name", "rif", "address", "sourceDate", "sourcePdf", "sourceWorkbook"],
)
remaining = [
    row for row in review_rows
    if key(row["name"]) not in {key(item["name"]) for item in resolved}
    and not row["possibleExistingRif"]
]
write_csv(
    OUTPUT / "remaining_missing_rif.csv", remaining,
    ["name", "address", "sourceDate", "sourcePdf", "invalidRifPrinted", "action"],
)
summary_path = OUTPUT / "summary.json"
summary = json.loads(summary_path.read_text(encoding="utf-8"))
summary["suppliers"] = len(suppliers)
summary["rateInferred"] = sum("ivaRetentionRate" in item.get("review", {}) for item in suppliers)
summary["supplementalRifConfirmed"] = len(resolved)
summary["stillMissingRif"] = len(remaining)
summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"added": added, "totalSuppliers": len(suppliers), "stillMissingRif": len(remaining)}))
