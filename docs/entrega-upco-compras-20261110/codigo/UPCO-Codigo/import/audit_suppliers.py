"""Read-only audit of imported supplier evidence and the local staging DB."""
from __future__ import annotations

import csv
import json
import re
import sqlite3
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
PDF_ROOT = Path(r"C:\Users\Elio\Documents\MEGA\UPCO DE VENEZUELA\RETENCIONES\RETENCIONES PDF")
OUT = ROOT / "reports" / "supplier-audit-20261109"
SOURCE = json.loads((ROOT / "import" / "suppliers.json").read_text(encoding="utf-8"))


def compact(value: str) -> str:
    folded = "".join(c for c in unicodedata.normalize("NFKD", str(value).upper()) if not unicodedata.combining(c))
    return re.sub(r"[^A-Z0-9]", "", folded)


def pdf_path(relative: str) -> Path:
    return PDF_ROOT.joinpath(*str(relative).replace("/", "\\").split("\\"))


cache: dict[str, tuple[str, str]] = {}


def pdf_text(relative: str) -> tuple[str, str]:
    if relative in cache:
        return cache[relative]
    path = pdf_path(relative)
    if not path.is_file():
        cache[relative] = ("missing", "")
    else:
        try:
            reader = PdfReader(path, strict=False)
            text = " ".join(page.extract_text() or "" for page in reader.pages[:3])
            cache[relative] = ("ok" if text.strip() else "no_text", compact(text))
        except Exception:
            cache[relative] = ("read_error", "")
    return cache[relative]


db = sqlite3.connect(f"file:{ROOT / 'data' / 'upco.sqlite'}?mode=ro", uri=True)
db.row_factory = sqlite3.Row
db_rows = {row["rif"]: dict(row) for row in db.execute(
    "SELECT id,rif,name,address,taxpayer_type,person_type,residency,iva_retention_rate,"
    "needs_review,import_confidence,source_date,source_pdf FROM vendors"
)}
db.close()
source_by_rif = {row["rif"]: row for row in SOURCE}
names = defaultdict(list)
for row in SOURCE:
    names[compact(row["name"])].append(row["rif"])
conflicts = {row["rif"] for row in csv.DictReader((ROOT / "import" / "conflicts.csv").open(encoding="utf-8-sig", newline=""))}
rows = []
issue_counts = Counter()
person_expected = {"J": "juridica", "G": "juridica", "V": "natural", "E": "natural", "P": "natural"}
for item in SOURCE:
    rif = item["rif"]
    issues = []
    db_item = db_rows.get(rif)
    if not re.fullmatch(r"[JGVEP][0-9]{9}", rif):
        issues.append("rif_format")
    expected = person_expected.get(rif[:1])
    if expected and item.get("personType") != expected:
        issues.append("person_type_vs_rif")
    if not item.get("name", "").strip():
        issues.append("name_missing")
    if not item.get("address", "").strip():
        issues.append("address_missing")
    if len(names[compact(item.get("name", ""))]) > 1:
        issues.append("same_name_multiple_rifs")
    if rif in conflicts:
        issues.append("historical_name_or_address_conflict")
    if not db_item:
        issues.append("missing_from_local_db")
    else:
        for source_key, db_key in (("name", "name"), ("address", "address"), ("taxpayerType", "taxpayer_type"),
                                   ("personType", "person_type"), ("residency", "residency"),
                                   ("ivaRetentionRate", "iva_retention_rate"), ("sourceDate", "source_date"),
                                   ("sourcePdf", "source_pdf")):
            if str(item.get(source_key, "")) != str(db_item.get(db_key, "")):
                issues.append(f"db_diff_{source_key}")
        if not db_item["needs_review"]:
            issues.append("local_db_review_flag_off")
    source_status, source_text = pdf_text(item.get("sourcePdf", ""))
    if source_status != "ok":
        issues.append("source_pdf_" + source_status)
    elif rif not in source_text:
        issues.append("rif_not_found_in_source_text")
    field_sources = item.get("fieldSources") or {}
    for field in ("name", "address", "ivaRetentionRate"):
        path = field_sources.get(field)
        if path:
            status, text = pdf_text(path)
            if status != "ok":
                issues.append(f"{field}_evidence_{status}")
            elif rif not in text:
                issues.append(f"{field}_evidence_rif_not_found")
        else:
            issues.append(f"{field}_evidence_missing")
    review = item.get("review") or {}
    if "taxpayerType" in review:
        issues.append("taxpayer_type_unverified")
    if field_sources.get("personType") is None:
        issues.append("person_type_inferred")
    if field_sources.get("residency") is None:
        issues.append("residency_inferred")
    if "ivaRetentionRate" in review:
        issues.append("iva_rate_inferred")
    for issue in set(issues):
        issue_counts[issue] += 1
    rows.append({
        "db_id": db_item["id"] if db_item else "", "rif": rif, "name": item.get("name", ""),
        "address": item.get("address", ""), "person_type": item.get("personType", ""),
        "residency": item.get("residency", ""), "taxpayer_type": item.get("taxpayerType", ""),
        "iva_retention_rate": item.get("ivaRetentionRate", ""), "source_date": item.get("sourceDate", ""),
        "source_pdf": item.get("sourcePdf", ""), "source_pdf_status": source_status,
        "confidence": item.get("confidence", ""), "certificates": item.get("certificates", 0),
        "needs_review_local": db_item["needs_review"] if db_item else "", "issues": ";".join(sorted(set(issues))),
    })

for rif in db_rows.keys() - source_by_rif.keys():
    issue_counts["local_db_not_in_import"] += 1

OUT.mkdir(parents=True, exist_ok=True)
with (OUT / "supplier-review.csv").open("w", encoding="utf-8-sig", newline="") as file:
    writer = csv.DictWriter(file, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(sorted(rows, key=lambda row: (-len(row["issues"].split(";")), row["rif"])))
summary = {
    "source_suppliers": len(SOURCE), "local_db_suppliers": len(db_rows),
    "unique_rifs": len(source_by_rif), "pdfs_opened": len(cache),
    "source_pdfs_existing": sum(1 for x in SOURCE if pdf_path(x.get("sourcePdf", "")).is_file()),
    "issue_counts": dict(issue_counts.most_common()),
    "unmatched_db_rifs": sorted(db_rows.keys() - source_by_rif.keys()),
}
(OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(summary, ensure_ascii=False))
