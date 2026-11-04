#!/usr/bin/env python3
"""
DGVC LMS demo - sample Previous Year Question (PYQ) paper generator.

Generates SAMPLE / AI-GENERATED DEMO question papers as PDFs using ReportLab,
from the deterministic question banks in question_banks.py. No AI APIs or
external services are used: questions are chosen with a seeded random number
generator, so the same seed always produces the same papers.

Outputs (paths relative to the project root):
  public/demo-pdfs/<subject>-<mon>-<year>-sample.pdf   the papers
  src/data/generated/pyq-resources.json               demo resource records (used by the app)
  supabase/seed/pyq_resources.sql                     the same records as SQL inserts

Usage:
  python3 scripts/pyq/generate_pyq_papers.py [--seed 2026] [--per-subject 2]

These papers are NOT actual DG Vaishnav College examination papers.
"""
from __future__ import annotations

import argparse
import calendar
import datetime as dt
import json
import random
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from question_banks import SUBJECTS  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PDF_DIR = ROOT / "public" / "demo-pdfs"
JSON_OUT = ROOT / "src" / "data" / "generated" / "pyq-resources.json"
SQL_OUT = ROOT / "supabase" / "seed" / "pyq_resources.sql"

DEMO_LABEL = "SAMPLE / AI-GENERATED DEMO QUESTION PAPER"
NAMESPACE = uuid.UUID("6f1c2a52-3c1e-4b0e-9a57-0d6c5e1d7a10")  # fixed: stable resource IDs
BRAND = colors.HexColor("#0F766E")
WARN = colors.HexColor("#B91C1C")

# Marks schemes. "answer" = how many questions the candidate must answer.
# The maximum marks always equal sum(answer * marks_each) across parts.
SCHEMES = {
    "75": {
        "max": 75,
        "time": "3 Hours",
        "parts": [
            {"part": "A", "title": "Short Answer Questions", "count": 10, "answer": 10, "marks": 2},
            {"part": "B", "title": "Descriptive Questions", "count": 7, "answer": 5, "marks": 5},
            {"part": "C", "title": "Long Answer Questions", "count": 5, "answer": 3, "marks": 10},
        ],
    },
    "100": {
        "max": 100,
        "time": "3 Hours",
        "parts": [
            {"part": "A", "title": "Short Answer Questions", "count": 10, "answer": 10, "marks": 2},
            {"part": "B", "title": "Descriptive Questions", "count": 8, "answer": 5, "marks": 8},
            {"part": "C", "title": "Long Answer Questions", "count": 4, "answer": 2, "marks": 20},
        ],
    },
}
for _s in SCHEMES.values():
    assert sum(p["answer"] * p["marks"] for p in _s["parts"]) == _s["max"], "scheme marks mismatch"

# Papers that the demo script references explicitly (subject key, month, year).
# All other papers are picked at random.
REQUIRED = [
    ("python-programming", 11, 2025),
    ("java-programming", 4, 2025),
    ("statistics", 11, 2024),
    ("mathematics", 4, 2024),
    ("mathematics", 4, 2025),
    ("english", 4, 2024),
]
YEAR_RANGE = (2022, 2026)  # inclusive; Nov 2026 is excluded below as it has not happened yet
EXAM_MONTHS = (4, 11)  # April / November cycle
ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI"}


@dataclass
class Paper:
    key: str
    month: int
    year: int
    scheme: str
    exam_date: dt.date
    session: str
    questions: dict  # part -> list[str]

    @property
    def meta(self):
        return SUBJECTS[self.key]["meta"]

    @property
    def exam_type(self) -> str:
        # Odd semesters normally sit in November, even semesters in April.
        # A paper in the "other" cycle is presented as a supplementary/arrear exam.
        regular = 11 if self.meta["semester"] % 2 == 1 else 4
        return "End Semester Examination" if self.month == regular else "Supplementary Examination"

    @property
    def filename(self) -> str:
        mon = calendar.month_abbr[self.month].lower()
        return f"{self.key}-{mon}-{self.year}-sample.pdf"

    @property
    def month_name(self) -> str:
        return calendar.month_name[self.month]


# ----------------------------------------------------------------------------
# Selection
# ----------------------------------------------------------------------------

def pick(rng: random.Random, bank: list[str], n: int, used: set[str]) -> list[str]:
    """Pick n distinct questions, preferring ones not used in earlier papers of
    the same subject, then shuffle the final order."""
    fresh = [q for q in bank if q not in used]
    stale = [q for q in bank if q in used]
    rng.shuffle(fresh)
    rng.shuffle(stale)
    chosen = (fresh + stale)[:n]
    if len(set(chosen)) != n:
        raise ValueError(f"question bank too small: need {n}, have {len(bank)}")
    rng.shuffle(chosen)
    used.update(chosen)
    return chosen


def exam_date(rng: random.Random, year: int, month: int) -> dt.date:
    # Exams run in the second half of the month on weekdays.
    days = [d for d in range(8, 29) if dt.date(year, month, d).weekday() < 5]
    return dt.date(year, month, rng.choice(days))


def plan_papers(rng: random.Random, per_subject: int) -> list[Paper]:
    slots: dict[str, list[tuple[int, int]]] = {k: [] for k in SUBJECTS}
    for key, month, year in REQUIRED:
        slots[key].append((month, year))
    all_slots = [
        (m, y)
        for y in range(YEAR_RANGE[0], YEAR_RANGE[1] + 1)
        for m in EXAM_MONTHS
        if not (y == 2026 and m == 11)
    ]
    for key in SUBJECTS:
        regular = 11 if SUBJECTS[key]["meta"]["semester"] % 2 == 1 else 4
        options = [s for s in all_slots if s not in slots[key]]
        rng.shuffle(options)
        # Prefer the subject's regular exam cycle; fall back to supplementary sittings.
        options.sort(key=lambda s: s[0] == regular)  # stable: regular-cycle slots end up last
        while len(slots[key]) < per_subject:
            slots[key].append(options.pop())

    papers: list[Paper] = []
    for key in SUBJECTS:
        used: dict[str, set[str]] = {"A": set(), "B": set(), "C": set()}
        bank = SUBJECTS[key]
        for month, year in sorted(slots[key], key=lambda s: (s[1], s[0])):
            scheme = rng.choice(list(SCHEMES))
            qs = {
                p["part"]: pick(rng, bank[p["part"]], p["count"], used[p["part"]])
                for p in SCHEMES[scheme]["parts"]
            }
            papers.append(
                Paper(key, month, year, scheme, exam_date(rng, year, month), rng.choice(["FN", "AN"]), qs)
            )
    names = [p.filename for p in papers]
    assert len(names) == len(set(names)), "duplicate filenames"
    return papers


# ----------------------------------------------------------------------------
# PDF rendering
# ----------------------------------------------------------------------------

def register_fonts():
    base = Path("/usr/share/fonts/truetype/dejavu")
    pdfmetrics.registerFont(TTFont("Serif", str(base / "DejaVuSerif.ttf")))
    pdfmetrics.registerFont(TTFont("Serif-Bold", str(base / "DejaVuSerif-Bold.ttf")))
    pdfmetrics.registerFont(TTFont("Sans", str(base / "DejaVuSans.ttf")))
    pdfmetrics.registerFont(TTFont("Sans-Bold", str(base / "DejaVuSans-Bold.ttf")))
    from reportlab.pdfbase.pdfmetrics import registerFontFamily

    registerFontFamily("Serif", normal="Serif", bold="Serif-Bold", italic="Serif", boldItalic="Serif-Bold")


STYLES = {
    "college": ParagraphStyle("college", fontName="Serif-Bold", fontSize=15, leading=19, alignment=TA_CENTER),
    "center": ParagraphStyle("center", fontName="Serif", fontSize=10.5, leading=14, alignment=TA_CENTER),
    "center_b": ParagraphStyle("center_b", fontName="Serif-Bold", fontSize=11.5, leading=15, alignment=TA_CENTER),
    "part": ParagraphStyle("part", fontName="Serif-Bold", fontSize=11.5, leading=15, alignment=TA_CENTER, spaceBefore=10),
    "part_sub": ParagraphStyle("part_sub", fontName="Serif", fontSize=10, leading=13, alignment=TA_CENTER, spaceAfter=4),
    "q": ParagraphStyle("q", fontName="Serif", fontSize=10.5, leading=14.5),
    "small": ParagraphStyle("small", fontName="Sans", fontSize=8.5, leading=11.5),
    "small_b": ParagraphStyle("small_b", fontName="Sans-Bold", fontSize=8.5, leading=11.5),
    "banner": ParagraphStyle("banner", fontName="Sans-Bold", fontSize=9, leading=12, alignment=TA_CENTER, textColor=colors.white),
}


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def decorate(canvas, doc):
    """Watermark, top demo banner and footer on every page."""
    w, h = A4
    canvas.saveState()
    # Diagonal watermark
    canvas.setFillColor(colors.Color(0.06, 0.46, 0.43, alpha=0.08))
    canvas.setFont("Sans-Bold", 44)
    canvas.translate(w / 2, h / 2)
    canvas.rotate(38)
    canvas.drawCentredString(0, 22, "DGVC LMS DEMO")
    canvas.setFont("Sans-Bold", 34)
    canvas.drawCentredString(0, -26, "SAMPLE · NOT OFFICIAL")
    canvas.restoreState()

    canvas.saveState()
    # Top banner
    canvas.setFillColor(WARN)
    canvas.rect(0, h - 11 * mm, w, 11 * mm, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont("Sans-Bold", 9.5)
    canvas.drawCentredString(w / 2, h - 7.2 * mm, f"{DEMO_LABEL} — NOT AN ACTUAL DGVC EXAMINATION PAPER")
    # Footer
    canvas.setStrokeColor(colors.HexColor("#E2E8F0"))
    canvas.line(18 * mm, 14 * mm, w - 18 * mm, 14 * mm)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.setFont("Sans", 7.5)
    canvas.drawString(18 * mm, 9.5 * mm, "DGVC LMS demo content · Sample for demonstration only")
    canvas.drawRightString(w - 18 * mm, 9.5 * mm, f"{doc.paper_code}  ·  Page {doc.page}")
    canvas.restoreState()


def header_block(p: Paper) -> list:
    m = p.meta
    sch = SCHEMES[p.scheme]
    flow = [
        Paragraph("DG Vaishnav College", STYLES["college"]),
        Paragraph("(demo content only — not an official college document)", STYLES["center"]),
        Spacer(1, 3 * mm),
        Paragraph(esc(m["department"]), STYLES["center_b"]),
        Paragraph(f"{esc(m['programme'])} — Semester {ROMAN[m['semester']]}", STYLES["center"]),
        Paragraph(f"{p.exam_type.upper()} — {p.month_name.upper()} {p.year}", STYLES["center_b"]),
        Spacer(1, 3 * mm),
    ]
    info = [
        [Paragraph("<b>Subject</b>", STYLES["small"]), Paragraph(esc(m["subject"]), STYLES["small"]),
         Paragraph("<b>Subject Code</b>", STYLES["small"]), Paragraph(m["code"], STYLES["small"])],
        [Paragraph("<b>Date / Session</b>", STYLES["small"]), Paragraph(f"{p.exam_date:%d-%m-%Y} / {p.session}", STYLES["small"]),
         Paragraph("<b>Register No.</b>", STYLES["small"]), Paragraph("________________", STYLES["small"])],
        [Paragraph("<b>Time Allowed</b>", STYLES["small"]), Paragraph(sch["time"], STYLES["small"]),
         Paragraph("<b>Maximum Marks</b>", STYLES["small"]), Paragraph(str(sch["max"]), STYLES["small_b"])],
    ]
    t = Table(info, colWidths=[30 * mm, 60 * mm, 30 * mm, 54 * mm])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F1F5F9")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    flow.append(t)
    flow.append(Spacer(1, 3 * mm))

    # Sample notice box
    notice = Table([[Paragraph(
        f"<b>{DEMO_LABEL}.</b> Generated automatically for the DGVC LMS demonstration from generic "
        "question banks. It does not reproduce, and must not be presented as, any actual previous-year "
        "examination paper of DG Vaishnav College.", STYLES["small"])]], colWidths=[174 * mm])
    notice.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, WARN),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF2F2")),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    flow.append(notice)
    flow.append(Spacer(1, 3 * mm))

    parts_desc = "; ".join(
        f"Part {x['part']}: answer {'ALL' if x['answer'] == x['count'] else 'any ' + str(x['answer'])} "
        f"of {x['count']} questions"
        for x in sch["parts"]
    )
    instructions = [
        "Write your register number on the answer booklet before you begin. Do not write anything on this question paper.",
        f"This paper has three parts. {parts_desc}.",
        "Marks for each question are shown in square brackets on the right.",
        "Draw neat diagrams and write programs or derivations wherever necessary.",
        "Use of non-programmable scientific calculators is permitted unless stated otherwise.",
        "Electronic devices other than permitted calculators are not allowed in the examination hall.",
    ]
    flow.append(Paragraph("<b>General Instructions</b>", STYLES["small"]))
    for i, ins in enumerate(instructions, 1):
        flow.append(Paragraph(f"{i}. {esc(ins)}", STYLES["small"]))
    return flow


def part_block(p: Paper, part: dict, start_no: int) -> list:
    qs = p.questions[part["part"]]
    total = part["answer"] * part["marks"]
    rule = "Answer ALL questions." if part["answer"] == part["count"] else f"Answer any {_word(part['answer'])} questions."
    head = [
        Paragraph(f"PART {part['part']} — {part['title']}", STYLES["part"]),
        Paragraph(f"({part['answer']} × {part['marks']} = {total} Marks)  ·  {rule}", STYLES["part_sub"]),
    ]
    rows = [[Paragraph(f"{start_no + i}.", STYLES["q"]), Paragraph(esc(q), STYLES["q"]),
             Paragraph(f"[{part['marks']}]", STYLES["q"])] for i, q in enumerate(qs)]
    t = Table(rows, colWidths=[11 * mm, 150 * mm, 13 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#E2E8F0")),
    ]))
    # Keep short parts together on one page; long parts may split across pages.
    return [KeepTogether(head + [t])] if len(rows) <= 6 else head + [t]


def _word(n: int) -> str:
    return {2: "TWO", 3: "THREE", 4: "FOUR", 5: "FIVE", 6: "SIX"}.get(n, str(n))


def render(p: Paper, out: Path) -> None:
    sch = SCHEMES[p.scheme]
    doc = SimpleDocTemplate(
        str(out), pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=20 * mm,
        title=f"{p.meta['subject']} — {p.month_name} {p.year} (SAMPLE)",
        author="DGVC LMS Demo Generator",
        subject=f"{DEMO_LABEL} — {p.meta['code']}",
        keywords="SAMPLE, DEMO, DGVC LMS, question paper",
        creator="scripts/pyq/generate_pyq_papers.py (ReportLab)",
    )
    doc.paper_code = f"{p.meta['code']} · {calendar.month_abbr[p.month]} {p.year} · SAMPLE"
    story = header_block(p)
    n = 1
    for part in sch["parts"]:
        story += part_block(p, part, n)
        n += part["count"]
    story.append(Spacer(1, 5 * mm))
    summary = " + ".join(f"Part {x['part']} {x['answer'] * x['marks']}" for x in sch["parts"])
    story.append(Paragraph(f"Marks summary: {summary} = {sch['max']}", STYLES["center"]))
    story.append(Paragraph("*** End of Sample Question Paper ***", STYLES["center_b"]))
    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)


# ----------------------------------------------------------------------------
# Records
# ----------------------------------------------------------------------------

def record(p: Paper, out: Path) -> dict:
    from pypdf import PdfReader

    m = p.meta
    sch = SCHEMES[p.scheme]
    mon = calendar.month_abbr[p.month]
    return {
        "id": str(uuid.uuid5(NAMESPACE, p.filename)),
        "title": f"{m['subject']} — {p.month_name} {p.year} (Sample)",
        "description": f"{p.exam_type} sample paper for {m['subject']} ({m['code']}), "
                       f"{m['programme']} Semester {m['semester']}. Max {sch['max']} marks, {sch['time']}.",
        "subject": m["subject"],
        "subject_key": p.key,
        "subject_code": m["code"],
        "department": m["department"],
        "programme": m["programme"],
        "semester": m["semester"],
        "exam_year": p.year,
        "exam_month": mon,
        "exam_type": p.exam_type,
        "exam_date": p.exam_date.isoformat(),
        "max_marks": sch["max"],
        "duration": sch["time"],
        "sections": [
            {"part": x["part"], "title": x["title"], "questions": x["count"], "answer": x["answer"],
             "marks_each": x["marks"], "total": x["answer"] * x["marks"]}
            for x in sch["parts"]
        ],
        "file_url": f"/demo-pdfs/{p.filename}",
        "file_name": p.filename,
        "file_size": out.stat().st_size,
        "page_count": len(PdfReader(str(out)).pages),
        "mime_type": "application/pdf",
        "resource_type": "question_paper",
        "status": "published",
        "demo_label": DEMO_LABEL,
        "is_demo": True,
        "created_at": f"{p.exam_date + dt.timedelta(days=45)}T09:00:00+05:30",
    }


def sql_literal(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (list, dict)):
        v = json.dumps(v, ensure_ascii=False)
        return "'" + v.replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def write_sql(records: list[dict]) -> None:
    cols = ["id", "title", "description", "subject", "subject_code", "department", "programme", "semester",
            "exam_year", "exam_month", "exam_type", "exam_date", "max_marks", "sections", "file_url",
            "file_size", "page_count", "resource_type", "status", "demo_label"]
    lines = [
        "-- AUTO-GENERATED by scripts/pyq/generate_pyq_papers.py. Do not edit by hand.",
        "-- SAMPLE / AI-GENERATED DEMO QUESTION PAPERS - not actual DGVC examination papers.",
        "-- PDFs live in public/demo-pdfs/ (or upload them to the 'demo-pdfs' storage bucket).",
        "insert into public.pyq_demo_resources (" + ", ".join(cols) + ") values",
    ]
    vals = ["  (" + ", ".join(sql_literal(r[c]) for c in cols) + ")" for r in records]
    lines.append(",\n".join(vals))
    lines.append("on conflict (id) do update set title = excluded.title, file_url = excluded.file_url,")
    lines.append("  file_size = excluded.file_size, page_count = excluded.page_count, sections = excluded.sections;")
    SQL_OUT.parent.mkdir(parents=True, exist_ok=True)
    SQL_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", type=int, default=2026, help="random seed (default 2026)")
    ap.add_argument("--per-subject", type=int, default=2, help="papers per subject (default 2)")
    args = ap.parse_args()

    register_fonts()
    rng = random.Random(args.seed)
    papers = plan_papers(rng, args.per_subject)

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    for old in PDF_DIR.glob("*-sample.pdf"):
        old.unlink()
    records = []
    for p in papers:
        out = PDF_DIR / p.filename
        render(p, out)
        records.append(record(p, out))
        print(f"  ✓ {p.filename:48s} {records[-1]['file_size'] / 1024:6.1f} KB  {p.exam_type}")

    records.sort(key=lambda r: (r["subject"], -r["exam_year"], r["exam_month"]))
    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    JSON_OUT.write_text(json.dumps({
        "generated_by": "scripts/pyq/generate_pyq_papers.py",
        "seed": args.seed,
        "demo_label": DEMO_LABEL,
        "count": len(records),
        "resources": records,
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_sql(records)
    print(f"\nGenerated {len(records)} sample papers → {PDF_DIR.relative_to(ROOT)}/")
    print(f"Records → {JSON_OUT.relative_to(ROOT)} and {SQL_OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
