"""Consolidate UPCO suppliers from historical retention PDFs.

Read-only input; repeatable output. The newest dated evidence wins for each
field, while older certificates fill only fields missing from newer ones.
"""

from __future__ import annotations

import csv
import json
import logging
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path

from pypdf import PdfReader

SOURCE = Path(
    r"C:\Users\Elio\Documents\MEGA\UPCO DE VENEZUELA\RETENCIONES\RETENCIONES PDF"
)
OUTPUT = Path(__file__).resolve().parent
AGENT_RIF = "J308175390"
RIF_RE = re.compile(r"(?<![A-Z0-9])([VEJPG])[-\s]?([0-9]{9})(?![0-9])", re.I)
DATE_RE = re.compile(r"\b([0-3]?\d)/([01]?\d)/(20\d{2})\b")
CERT_RE = re.compile(r"\b(20\d{12})\b")
MONTHS = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5,
    "junio": 6, "julio": 7, "agosto": 8, "septiembre": 9,
    "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}
logger = logging.getLogger("pypdf")
logger.setLevel(logging.ERROR)


def ascii_fold(value: str) -> str:
    return "".join(
        char for char in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(char)
    ).upper()


def clean(value: str) -> str:
    value = value.replace("\x00", "").replace("\ufffd", "")
    value = re.sub(r"\s+", " ", value).strip(" .:,;\t")
    return value


def valid_date(day: str, month: str, year: str) -> str | None:
    try:
        return date(int(year), int(month), int(day)).isoformat()
    except ValueError:
        return None


def date_from_text(text: str, kind: str, path: Path) -> str:
    if kind == "iva":
        for label in (r"Fecha de Entrega\s*:", r"Fecha de Emisi.n\s*:"):
            match = re.search(label + r"\s*([0-3]?\d)/([01]?\d)/(20\d{2})", text, re.I)
            if match:
                parsed = valid_date(*match.groups())
                if parsed:
                    return parsed
        match = re.search(r"Ano\s*:\s*(20\d{2})\s*/\s*Mes\s*:\s*([01]?\d)", text, re.I)
        if match:
            return f"{int(match.group(1)):04d}-{int(match.group(2)):02d}-01"
    if kind == "islr":
        folded = ascii_fold(text)
        month_names = "|".join(MONTHS)
        match = re.search(rf"\b([0-3]?\d)\s+DE\s+({month_names})\s+(20\d{{2}})\b", folded, re.I)
        if match:
            return valid_date(match.group(1), str(MONTHS[match.group(2).lower()]), match.group(3)) or ""
    # Filename carries period in many legacy certificates.
    match = re.search(r"(20\d{2})[-_](0[1-9]|1[0-2])", path.name)
    if match:
        return f"{match.group(1)}-{match.group(2)}-01"
    # Retention rows usually begin with an operation date. Use the latest valid
    # date in the document only as a fallback.
    dates = [valid_date(*match.groups()) for match in DATE_RE.finditer(text)]
    dates = [value for value in dates if value]
    if dates:
        return max(dates)
    relative = path.relative_to(SOURCE)
    folder_parts = [ascii_fold(part) for part in relative.parts[:-1]]
    year = next((int(part) for part in folder_parts if re.fullmatch(r"20\d{2}", part)), None)
    if "2024" in folder_parts:
        year = 2024
    if year is None:
        year = 2026
    month = None
    for part in reversed(folder_parts):
        prefix = re.match(r"^(0[1-9]|1[0-2])(?:[-\s]|$)", part)
        if prefix:
            month = int(prefix.group(1))
            break
        for name, number in MONTHS.items():
            if name.upper() in part:
                month = number
                break
        if month:
            break
    return f"{year:04d}-{(month or 1):02d}-01"


def rif_candidates(text: str) -> list[str]:
    return [
        f"{letter.upper()}{digits}" for letter, digits in RIF_RE.findall(text)
        if f"{letter.upper()}{digits}" != AGENT_RIF
    ]


def supplier_rif(text: str, kind: str) -> str | None:
    upper = ascii_fold(text)
    marker = "SUJETO RETENIDO (RIF)" if kind == "iva" else "DATOS DEL BENEFICIARIO"
    position = upper.find(marker)
    if position >= 0:
        candidates = rif_candidates(text[position:position + 1700])
        if candidates:
            return candidates[0]
    candidates = rif_candidates(text)
    counts = Counter(candidates)
    return counts.most_common(1)[0][0] if candidates else None


def supplier_name(text: str, kind: str) -> str:
    if kind == "iva":
        match = re.search(r"DATOS DEL PROVEEDOR\s*\n([^\n]+)", text, re.I)
        if match:
            return clean(match.group(1))
    else:
        # New and old ISLR layouts place the beneficiary RIF immediately before
        # the name, even when the surrounding blocks are reordered.
        match = re.search(r"DATOS DEL BENEFICIARIO(?:(?!CONSTANCIA).){0,600}?\b[VEJPG][-\s]?[0-9]{9}\s*\n([^\n]+)", text, re.I | re.S)
        if match:
            return clean(match.group(1))
    return ""


def supplier_address(text: str, kind: str) -> str:
    lines = [clean(line) for line in text.splitlines()]
    folded = [ascii_fold(line) for line in lines]
    if kind == "iva":
        for index, line in enumerate(folded):
            if "DIRECCION" in line and "SUJETO RETENIDO" in line:
                previous = [part for part in lines[max(0, index - 4):index] if part]
                if previous:
                    return previous[-1]
    else:
        for index, line in enumerate(folded):
            if "DETALLE DE LA FACTURA" in line:
                after = lines[index + 1:index + 8]
                candidates = [
                    part for part in after if part and
                    "CONCEPTO DE RETENCION" not in ascii_fold(part) and
                    "PERIODO" not in ascii_fold(part)
                ]
                if candidates:
                    return max(candidates, key=len)
    return ""


def beneficiary_class(text: str, kind: str) -> tuple[str | None, str | None]:
    if kind != "islr":
        return None, None
    folded = ascii_fold(text)
    marker = folded.find("DATOS DEL BENEFICIARIO")
    scope = folded[marker:marker + 500] if marker >= 0 else folded
    if re.search(r"PERSONA\s+NATURAL", scope):
        return "natural", "no_residente" if "NO RESIDENT" in scope else "residente"
    if re.search(r"PERSONA\s+JURIDIC", scope):
        return "juridica", "no_domiciliada" if "NO DOMICILIAD" in scope else "domiciliada"
    return None, None


def iva_rate(text: str, kind: str) -> int | None:
    if kind != "iva":
        return None
    head = text.split("Total a Pagar", 1)[0]
    rates = re.findall(r"(?:^|\s)(75|100),00\s+[0-9][0-9.,]*", head)
    if rates:
        return int(Counter(rates).most_common(1)[0][0])
    return None


def certificate_numbers(text: str, kind: str, document_date: str) -> list[str]:
    period = document_date[:7].replace("-", "")
    numbers = [value for value in CERT_RE.findall(text) if value.startswith(period)]
    if not numbers:
        numbers = CERT_RE.findall(text)
    return sorted(set(numbers))


def extract(path: Path) -> dict:
    result = {"sourcePdf": str(path), "relativePdf": str(path.relative_to(SOURCE))}
    try:
        reader = PdfReader(path, strict=False)
        if reader.is_encrypted:
            reader.decrypt("")
        text = "\n".join(page.extract_text() or "" for page in reader.pages[:2])
    except Exception as exc:
        return {**result, "error": f"{type(exc).__name__}: {exc}"[:240]}
    folded = ascii_fold(text)
    if "DATOS DEL PROVEEDOR" in folded and "SUJETO RETENIDO" in folded:
        kind = "iva"
    elif "DATOS DEL BENEFICIARIO" in folded and "RETENCION" in folded:
        kind = "islr"
    else:
        return {**result, "error": "No recognizable retention form", "textLength": len(text)}
    rif = supplier_rif(text, kind)
    if not rif:
        return {**result, "error": "No supplier RIF", "kind": kind, "textLength": len(text)}
    name = supplier_name(text, kind)
    address = supplier_address(text, kind)
    person_type, residency = beneficiary_class(text, kind)
    document_date = date_from_text(text, kind, path)
    rate = iva_rate(text, kind)
    certificates = certificate_numbers(text, kind, document_date)
    score = sum((bool(name) * 2, bool(address), bool(person_type), bool(rate)))
    return {
        **result,
        "rif": rif, "name": name, "address": address, "kind": kind,
        "personType": person_type, "residency": residency,
        "ivaRetentionRate": rate, "sourceDate": document_date,
        "certificateNumbers": certificates, "confidence": "high" if score >= 4 else "medium" if score >= 2 else "low",
    }


def pick(records: list[dict], field: str):
    for record in records:
        value = record.get(field)
        if value not in (None, ""):
            return value, record
    return None, None


def consolidate(records: list[dict]) -> tuple[list[dict], list[dict]]:
    by_rif = defaultdict(list)
    for record in records:
        by_rif[record["rif"]].append(record)
    suppliers = []
    conflicts = []
    for rif, history in by_rif.items():
        history.sort(
            key=lambda item: (item["sourceDate"], max(item["certificateNumbers"], default=""), item["sourcePdf"]),
            reverse=True,
        )
        name, name_source = pick(history, "name")
        address, address_source = pick(history, "address")
        person_type, person_source = pick(history, "personType")
        residency, residency_source = pick(history, "residency")
        rate, rate_source = pick(history, "ivaRetentionRate")
        person_type_inferred = not bool(person_type)
        if not person_type:
            person_type = "natural" if rif.startswith(("V", "E")) else "juridica"
        if not residency:
            residency = "residente" if person_type == "natural" else "domiciliada"
        if rate is None:
            rate = 75
        chosen = name_source or address_source or history[0]
        unique_names = {ascii_fold(clean(item["name"])) for item in history if item.get("name")}
        unique_addresses = {ascii_fold(clean(item["address"])) for item in history if item.get("address")}
        if len(unique_names) > 1 or len(unique_addresses) > 1:
            conflicts.append({
                "rif": rif, "nameVariants": len(unique_names), "addressVariants": len(unique_addresses),
                "chosenName": name or "", "chosenAddress": address or "",
                "latestPdf": chosen["relativePdf"], "latestDate": chosen["sourceDate"],
                "certificates": len(history),
            })
        suppliers.append({
            "rif": rif,
            "name": name or "",
            "address": address or "",
            "taxpayerType": "ordinario",
            "personType": person_type,
            "residency": residency,
            "ivaRetentionRate": rate,
            "email": "",
            "phone": "",
            "active": True,
            "sourceDate": chosen["sourceDate"],
            "sourcePdf": chosen["relativePdf"],
            "sourceKind": chosen["kind"],
            "confidence": chosen["confidence"] if name and address else "low",
            "review": {
                "taxpayerType": "No consta en comprobantes; valor inicial por revisar",
                **({"personType": "Inferido por primera letra del RIF"} if person_type_inferred else {}),
                **({"ivaRetentionRate": "No consta en IVA; 75 % inicial por revisar"} if not rate_source else {}),
                **({"name": "No se extrajo razón social"} if not name else {}),
                **({"address": "No se extrajo dirección fiscal"} if not address else {}),
            },
            "fieldSources": {
                field: source["relativePdf"] if source else None
                for field, source in {
                    "name": name_source, "address": address_source,
                    "personType": person_source, "residency": residency_source,
                    "ivaRetentionRate": rate_source,
                }.items()
            },
            "certificates": len(history),
        })
    suppliers.sort(key=lambda item: (item["name"].casefold(), item["rif"]))
    conflicts.sort(key=lambda item: item["rif"])
    return suppliers, conflicts


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    if not SOURCE.is_dir():
        raise SystemExit(f"Source directory missing: {SOURCE}")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    paths = list(SOURCE.rglob("*.pdf"))
    records = []
    errors = []
    for index, path in enumerate(paths, start=1):
        record = extract(path)
        if "error" in record:
            errors.append(record)
        else:
            records.append(record)
        if index % 250 == 0:
            print(f"Scanned {index}/{len(paths)} PDFs", flush=True)
    suppliers, conflicts = consolidate(records)
    (OUTPUT / "suppliers.json").write_text(
        json.dumps(suppliers, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    write_csv(
        OUTPUT / "suppliers.csv", suppliers,
        ["rif", "name", "address", "taxpayerType", "personType", "residency",
         "ivaRetentionRate", "confidence", "sourceDate", "sourcePdf", "certificates"],
    )
    write_csv(
        OUTPUT / "conflicts.csv", conflicts,
        ["rif", "nameVariants", "addressVariants", "chosenName", "chosenAddress",
         "latestDate", "latestPdf", "certificates"],
    )
    write_csv(
        OUTPUT / "unreadable.csv", errors,
        ["relativePdf", "sourcePdf", "kind", "error", "textLength"],
    )
    maxima: dict[str, dict[str, dict]] = defaultdict(lambda: defaultdict(dict))
    for record in records:
        for number in record["certificateNumbers"]:
            period = number[:6]
            kind = record["kind"]
            current = maxima[period].get(kind)
            if not current or number > current["maxCertificate"]:
                maxima[period][kind] = {
                    "maxCertificate": number,
                    "sourcePdf": record["relativePdf"],
                    "sourceDate": record["sourceDate"],
                }
    (OUTPUT / "certificate_maxima.json").write_text(
        json.dumps(dict(maxima), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    stats = {
        "pdfs": len(paths), "recognized": len(records), "unreadable": len(errors),
        "suppliers": len(suppliers), "conflictingSuppliers": len(conflicts),
        "noName": sum(not item["name"] for item in suppliers),
        "noAddress": sum(not item["address"] for item in suppliers),
        "rateInferred": sum("ivaRetentionRate" in item["review"] for item in suppliers),
        "kindCounts": Counter(item["kind"] for item in records),
        "latestMaxima": dict(sorted(maxima.items(), reverse=True)[:3]),
    }
    (OUTPUT / "summary.json").write_text(
        json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
