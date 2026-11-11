"""Build a human review queue for certificates lacking a valid supplier RIF."""

from pathlib import Path
from difflib import SequenceMatcher
import csv
import json
import re

from pypdf import PdfReader
from extract_suppliers import (
    SOURCE, ascii_fold, clean, date_from_text, supplier_address, supplier_name
)

OUTPUT = Path(__file__).resolve().parent
suppliers = json.loads((OUTPUT / "suppliers.json").read_text(encoding="utf-8"))
errors = list(csv.DictReader((OUTPUT / "unreadable.csv").open(encoding="utf-8-sig")))
by_name = {ascii_fold(clean(item["name"])): item for item in suppliers}
pending = {}

for row in errors:
    if row["error"] != "No supplier RIF":
        continue
    path = SOURCE / row["relativePdf"]
    try:
        text = "\n".join(page.extract_text() or "" for page in PdfReader(path).pages[:2])
    except Exception:
        continue
    kind = row["kind"]
    name = supplier_name(text, kind)
    if not name and kind == "islr":
        lines = [clean(line) for line in text.splitlines()]
        folded = [ascii_fold(line) for line in lines]
        for index, line in enumerate(folded):
            if "DATOS DEL BENEFICIARIO" in line:
                for candidate in lines[index + 1:index + 12]:
                    upper = ascii_fold(candidate)
                    if not candidate or upper.startswith(("RAZON SOCIAL", "RIF", "TIPO DE PERSONA")):
                        continue
                    if re.fullmatch(r"[VEJPG][-\s]?[0-9]{7,11}", candidate, re.I):
                        continue
                    name = candidate
                    break
                break
    if not name:
        name = path.stem
    key = ascii_fold(clean(name))
    previous = pending.get(key)
    record_date = date_from_text(text, kind, path)
    if previous and previous["sourceDate"] >= record_date:
        continue
    nearby = sorted(
        (
            (SequenceMatcher(None, key, ascii_fold(clean(item["name"]))).ratio(), item)
            for item in suppliers
        ),
        key=lambda value: value[0],
        reverse=True,
    )[0]
    possible_match = nearby[1]["rif"] if nearby[0] >= 0.92 else ""
    invalid_tokens = [
        token for token in re.findall(r"\b[VEJPG][-\s]?[0-9]{7,11}\b", text, re.I)
        if token.replace("-", "").replace(" ", "").upper() != "J308175390"
    ]
    pending[key] = {
        "name": name,
        "address": supplier_address(text, kind),
        "sourceDate": record_date,
        "sourcePdf": row["relativePdf"],
        "invalidRifPrinted": invalid_tokens[0] if invalid_tokens else "",
        "possibleExistingRif": possible_match,
        "action": "Verificar RIF en ficha fiscal antes de importar",
    }

rows = sorted(pending.values(), key=lambda item: item["sourceDate"], reverse=True)
with (OUTPUT / "needs_rif.csv").open("w", encoding="utf-8-sig", newline="") as stream:
    writer = csv.DictWriter(stream, fieldnames=[
        "name", "address", "sourceDate", "sourcePdf", "invalidRifPrinted",
        "possibleExistingRif", "action",
    ])
    writer.writeheader()
    writer.writerows(rows)
review_stats = {
    "documentsLackingValidRif": sum(row["error"] == "No supplier RIF" for row in errors),
    "distinctNamesToReview": len(rows),
    "likelyAlreadyImported": sum(bool(row["possibleExistingRif"]) for row in rows),
    "newNamesWithoutRif": sum(not row["possibleExistingRif"] for row in rows),
}
summary_path = OUTPUT / "summary.json"
summary = json.loads(summary_path.read_text(encoding="utf-8"))
summary["missingRifReview"] = review_stats
summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(review_stats, ensure_ascii=False))
