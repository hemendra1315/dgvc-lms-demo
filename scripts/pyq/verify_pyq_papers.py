#!/usr/bin/env python3
"""
Verify the generated DGVC LMS sample PYQ papers.

Checks, for every record in src/data/generated/pyq-resources.json:
  1. the PDF file exists under public/ and its size matches the record
  2. the PDF opens (parsed by pypdf) and its page count matches the record
  3. the PDF has readable, extractable text
  4. the SAMPLE / demo label and watermark text are present on every page
  5. marks add up: re-derived from the PDF text alone (question marks in
     square brackets per Part, and how many must be answered) and compared
     with the "Maximum Marks" printed in the header
  6. Part A / B / C headings, subject code, time allowed and instructions are present
  7. no question is repeated within a paper
Also checks that filenames and IDs are unique and that every PDF in
public/demo-pdfs/ is registered.

Exit code 0 = all checks passed.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "src" / "data" / "generated" / "pyq-resources.json"
WORDS = {"ALL": None, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5, "SIX": 6}


def check_paper(rec: dict) -> list[str]:
    errs: list[str] = []
    path = ROOT / "public" / rec["file_url"].lstrip("/")
    if not path.is_file():
        return [f"missing file {path}"]
    if path.stat().st_size != rec["file_size"]:
        errs.append(f"file_size mismatch ({path.stat().st_size} != {rec['file_size']})")
    if path.read_bytes()[:5] != b"%PDF-":
        errs.append("not a PDF header")
    try:
        reader = PdfReader(str(path), strict=True)
        pages = [pg.extract_text() or "" for pg in reader.pages]
    except Exception as e:  # noqa: BLE001
        return errs + [f"PDF failed to open: {e}"]
    if len(pages) != rec["page_count"]:
        errs.append(f"page_count mismatch ({len(pages)} != {rec['page_count']})")

    text = "\n".join(pages)
    if len(re.findall(r"[A-Za-z]{3,}", text)) < 150:
        errs.append("too little readable text")
    for i, pg in enumerate(pages, 1):
        if "SAMPLE / AI-GENERATED DEMO QUESTION PAPER" not in pg:
            errs.append(f"page {i}: SAMPLE banner missing")
        if "DGVC LMS DEMO" not in pg:
            errs.append(f"page {i}: watermark text missing")

    for needle in ["DG Vaishnav College", "demo content only", rec["department"], rec["subject_code"],
                   "Time Allowed", "General Instructions", "PART A", "PART B", "PART C",
                   f"{rec['exam_month'].upper()}", str(rec["exam_year"])]:
        if needle.upper() not in text.upper():
            errs.append(f"missing text: {needle!r}")

    m = re.search(r"Maximum Marks\s*:?\s*(\d+)", text)
    if not m:
        return errs + ["could not read Maximum Marks"]
    stated_max = int(m.group(1))
    if stated_max != rec["max_marks"]:
        errs.append(f"stated max {stated_max} != record {rec['max_marks']}")

    # Split into parts and recompute marks from the PDF text alone.
    chunks = re.split(r"PART ([ABC]) —", text)
    parts = {chunks[i]: chunks[i + 1] for i in range(1, len(chunks) - 1, 2)}
    total = 0
    all_questions: list[str] = []
    for letter in "ABC":
        body = parts.get(letter, "")
        body = body.split("Marks summary")[0]
        marks = [int(x) for x in re.findall(r"\[(\d+)\]", body)]
        rule = re.search(r"Answer (ALL|any (\w+)) questions", body)
        if not marks or not rule:
            errs.append(f"Part {letter}: could not parse questions/rule")
            continue
        if len(set(marks)) != 1:
            errs.append(f"Part {letter}: inconsistent marks {set(marks)}")
        answer = len(marks) if rule.group(1) == "ALL" else WORDS.get(rule.group(2).upper())
        if not answer or answer > len(marks):
            errs.append(f"Part {letter}: answer count {answer} invalid for {len(marks)} questions")
            continue
        header = re.search(r"\((\d+) × (\d+) = (\d+) Marks\)", body)
        part_total = answer * marks[0]
        if not header or tuple(map(int, header.groups())) != (answer, marks[0], part_total):
            errs.append(f"Part {letter}: heading arithmetic does not match questions")
        sec = next(s for s in rec["sections"] if s["part"] == letter)
        if (sec["questions"], sec["answer"], sec["marks_each"]) != (len(marks), answer, marks[0]):
            errs.append(f"Part {letter}: record sections disagree with PDF")
        total += part_total
        qs = re.findall(r"^\s*\d+\.\s+(.+?)(?=\s*\[\d+\])", body, flags=re.M | re.S)
        all_questions += [" ".join(q.split()) for q in qs]
    if total != stated_max:
        errs.append(f"marks do not add up: parts total {total} != maximum {stated_max}")
    if len(all_questions) != len(set(all_questions)):
        errs.append("duplicate question within paper")
    return errs


def main() -> int:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    recs = data["resources"]
    failures = 0
    print(f"Verifying {len(recs)} sample papers from {MANIFEST.relative_to(ROOT)}\n")
    for rec in recs:
        errs = check_paper(rec)
        for k in ("id", "title", "subject", "department", "semester", "exam_year", "exam_type",
                  "file_url", "file_size", "resource_type", "status", "demo_label"):
            if rec.get(k) in (None, ""):
                errs.append(f"record missing {k}")
        if rec.get("resource_type") != "question_paper":
            errs.append("resource_type must be question_paper")
        mark = "PASS" if not errs else "FAIL"
        failures += bool(errs)
        print(f"  [{mark}] {rec['file_name']:48s} max {rec['max_marks']:>3}  {rec['page_count']} pp")
        for e in errs:
            print(f"         - {e}")

    ids = [r["id"] for r in recs]
    files = [r["file_name"] for r in recs]
    on_disk = sorted(p.name for p in (ROOT / "public" / "demo-pdfs").glob("*.pdf"))
    global_errs = []
    if len(set(ids)) != len(ids):
        global_errs.append("duplicate resource IDs")
    if len(set(files)) != len(files):
        global_errs.append("duplicate filenames")
    if sorted(files) != on_disk:
        global_errs.append(f"unregistered or missing PDFs: {set(on_disk) ^ set(files)}")
    if not 15 <= len(recs):
        global_errs.append("fewer than 15 papers")
    for e in global_errs:
        print(f"  [FAIL] {e}")
    print(f"\n{len(recs) - failures}/{len(recs)} papers passed; {len(global_errs)} catalogue issues.")
    return 1 if failures or global_errs else 0


if __name__ == "__main__":
    sys.exit(main())
