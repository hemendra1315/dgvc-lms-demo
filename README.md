# DGVC LMS: sample PYQ papers module (demo)

**Learn. Explore. Excel.**

This module covers Previous Year Question Papers for the DGVC LMS demo. It has three parts:

1. A **Python/ReportLab generator** that builds 20 sample question-paper PDFs from subject question banks.
2. A **student app** for browsing those papers. Students can filter them, read them in the app, download them and bookmark them.
3. An **admin Resource Management** dashboard. Admins can preview, publish, unpublish, edit metadata, archive and delete papers.

> ⚠️ Every paper is a **SAMPLE / AI-GENERATED DEMO QUESTION PAPER**. The questions come from generic,
> hand-written question banks. They are *not* actual DG Vaishnav College examination papers, and every PDF says so.
> The banner, the diagonal watermark, the notice box and the footer all carry this label.
> Subject codes, programmes and semesters are illustrative and must be checked against the official curriculum.

## Quick start

```bash
npm install                 # React, pdf.js, esbuild, Tailwind, Playwright…
npm run generate:pyq        # (optional) regenerate the PDFs; requires: pip install reportlab pypdf
npm run dev                 # http://localhost:5173
```

The PDFs and their records are already committed in `public/demo-pdfs/` and `src/data/generated/`.
The PYQ section is therefore fully populated on first launch, and nothing has to be uploaded by hand.

### Demo accounts (local demo only, not production authentication)

| Role | Email | Password |
|---|---|---|
| Student (Hemu, B.Sc Data Science, Sem I) | `student@demo.dgvc.in` | `Demo@2026` |
| Faculty (Python Programming, Statistics) | `faculty@demo.dgvc.in` | `Demo@2026` |
| Department Admin (Data Science) | `deptadmin@demo.dgvc.in` | `Demo@2026` |
| Super Admin | `admin@demo.dgvc.in` | `Demo@2026` |

You can also sign in in one click from the account picker on the login screen.

## Scripts

| Command | What it does |
|---|---|
| `npm run generate:pyq` | Generates the PDFs, `src/data/generated/pyq-resources.json` and `supabase/seed/pyq_resources.sql`. Uses `--seed 2026` by default, so output is deterministic. |
| `npm run verify:pyq` | Checks every paper using only the PDF's own text (see below). |
| `npm test` | Unit tests for the data adapter: permissions, filters, marks and seed integrity. |
| `npm run build` | Production build into `dist/` (esbuild + Tailwind v4 compiler). |
| `npm run preview` | Builds and serves `dist/` with SPA fallback. |
| `npm run e2e` | 22 Playwright browser checks for the full student and admin journeys. |
| `npm run verify` | Runs all of the above. |

## The generator (`scripts/pyq/`)

- `question_banks.py` has 10 subjects. Each subject has 20 short-answer, 14 descriptive and 9 long-answer questions.
  The subjects are Python, Java, Mathematics, Statistics, Data Science Fundamentals, Operating Systems, Computer Networks, English, Tamil and DBMS.
- `generate_pyq_papers.py` uses seeded `random` and no AI or network services. It does the following:
  - It makes 2 papers per subject, 20 in total, with April/November sittings between 2022 and Apr 2026.
    Papers that `REQUIRED` names are always generated, for example `python-programming-nov-2025-sample.pdf`.
  - It prefers questions that the subject's earlier paper did not use, never repeats a question within a paper, and shuffles the order.
  - It uses two marks schemes and asserts that the marks add up:
    - **75 marks**: A 10×2 (all), B 5 of 7 ×5, C 3 of 5 ×10.
    - **100 marks**: A 10×2, B 5 of 8 ×8, C 2 of 4 ×20.
  - An exam in the subject's normal cycle is an *End Semester Examination*. A sitting in the other cycle is labelled *Supplementary*.
  - Each PDF includes the college (demo-only), department, programme, semester, subject and code, exam month and year, date/session, time, maximum marks, instructions, and Parts A, B and C.
- `verify_pyq_papers.py` re-reads each PDF with pypdf and checks the following:
  - the file exists, is a valid PDF, and its size and page count match the record
  - the text is extractable
  - the SAMPLE banner and watermark are on **every page**
  - all required headings are present
  - the marks add up: the per-part `[n]` marks and the "Answer any N" rules are recomputed from the text and compared with the printed Maximum Marks
  - there are no duplicate questions
  - the catalogue is consistent: unique IDs and filenames, and no unregistered PDFs

## Resource records

Each record in `pyq-resources.json` has these fields: `id` (stable UUIDv5), `title`, `subject`, `subject_code`, `department`, `programme`,
`semester`, `exam_year`, `exam_month`, `exam_type`, `exam_date`, `max_marks`, `sections`, `file_url`, `file_size`,
`page_count`, `resource_type: "question_paper"`, `status: "published"`, `demo_label`.

## App architecture

- **React 19 + TypeScript**. The bundler is esbuild, called from `scripts/build.mjs`. Styling uses Tailwind CSS v4 through its compiler API.
  Icons are Lucide (via `react-icons/lu`), validation uses zod, and the PDF viewer uses pdf.js.
- **Demo data adapter** (`src/data/adapter.ts`): pure functions over a persisted store (localStorage).
  Every mutation checks permissions in the same way the production RLS policies do:
  - Students see only published papers.
  - Faculty manage only their assigned subjects.
  - Department admins manage only their own department.
  - Super admins manage everything.
  These checks run in the browser, **so they are not a security boundary**.
- **Routes**:
  - Student: `/home`, `/pyq` (filters are kept in the query string), `/pyq/:id` (viewer), `/saved`, `/profile`.
  - Admin: `/admin`, `/admin/resources`, `/admin/resources/:id/preview`, `/admin/audit`.
- **PDF viewer**: page navigation, keyboard arrows, zoom, fit-width, full screen, download, bookmark and back.
  It has explicit loading, missing-file (404), failed, offline and not-permitted states.
- **Reset demo data** (in the admin Resources page or the student Profile page) restores the original 20 papers.

## Supabase (production path)

`supabase/migrations/0001_pyq_demo_resources.sql` creates the following:

- the `pyq_demo_resources` table
- a minimal `profiles` table
- server-side permission helpers
- RLS policies
- a private `demo-pdfs` storage bucket, with an object policy that follows the table's visibility

`supabase/seed/pyq_resources.sql` inserts the generated records.
To use them, upload `public/demo-pdfs/*.pdf` to the bucket and serve them through signed URLs.
Demo users must be created through Supabase Auth (Admin API or dashboard). Inserting rows into `profiles` alone does not create a working account.
**The SQL has not been run against a live project yet.** Apply it to a staging project first.

## Known limitations

- **Tamil paper**: it is English-medium. The PDF build environment had no Tamil font or complex-script shaping library (HarfBuzz),
  and ReportLab cannot render Tamil script correctly without them. The subject is labelled "General Tamil I (English-medium demo)".
  For a real Tamil paper, install `uharfbuzz` and Noto Sans Tamil and register the font.
- **Scope**: this module covers the PYQ requirement plus the student and admin shells it needs.
  It does not include the wider master spec: registration and OTP flows, departments and academic-structure CRUD, notes, videos and uploads.
- **Type checking and linting**: `tsc --noEmit` and lint were not run, because `@types/react` was not available offline when this was built.
  The code builds cleanly and is covered by unit tests and e2e tests. Run `npx tsc --noEmit` after `npm install`.
- **Deleting a paper** removes its record. The static PDF stays in `public/demo-pdfs/` until the next generator run.
- **Downloads** are tracked per browser. The Downloads list cannot delete files from the device; the browser manages those.
