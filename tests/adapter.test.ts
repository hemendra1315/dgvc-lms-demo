import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  activityResources, canManage, canView, deleteResource, facets, filterResources, PermissionError,
  recordDownload, setStatus, sortResources, toggleBookmark, updateResource, visibleResources,
} from '../src/data/adapter';
import { DEMO_USERS } from '../src/data/demoUsers';
import { initialState, SEED_RESOURCES } from '../src/data/seed';

const [student, faculty, deptAdmin, superAdmin] = DEMO_USERS;
const ROOT = path.resolve(import.meta.dirname, '..');

test('seed: 15–20+ question papers, all published, every file exists', () => {
  assert.ok(SEED_RESOURCES.length >= 15);
  for (const r of SEED_RESOURCES) {
    assert.equal(r.resource_type, 'question_paper');
    assert.equal(r.status, 'published');
    assert.match(r.demo_label, /SAMPLE/);
    const file = path.join(ROOT, 'public', r.file_url);
    assert.ok(fs.existsSync(file), `missing ${file}`);
    assert.equal(fs.statSync(file).size, r.file_size);
  }
  assert.equal(new Set(SEED_RESOURCES.map((r) => r.id)).size, SEED_RESOURCES.length);
});

test('seed: section marks add up to the maximum for every paper', () => {
  for (const r of SEED_RESOURCES) {
    const total = r.sections.reduce((n, s) => n + s.answer * s.marks_each, 0);
    assert.equal(total, r.max_marks, r.title);
    for (const s of r.sections) assert.ok(s.answer <= s.questions);
  }
});

test('seed: covers the required subjects and sample records', () => {
  const keys = new Set(SEED_RESOURCES.map((r) => r.subject_key));
  for (const k of ['python-programming', 'java-programming', 'mathematics', 'statistics', 'data-science-fundamentals',
    'operating-systems', 'computer-networks', 'english', 'tamil', 'dbms']) assert.ok(keys.has(k), k);
  for (const f of ['python-programming-nov-2025', 'java-programming-apr-2025', 'statistics-nov-2024', 'mathematics-apr-2024', 'mathematics-apr-2025', 'english-apr-2024'])
    assert.ok(SEED_RESOURCES.some((r) => r.file_name.startsWith(f)), f);
});

test('students see only published papers', () => {
  let s = initialState();
  const target = s.resources[0];
  s = setStatus(s, superAdmin, target.id, 'unpublished');
  const visible = visibleResources(s, student);
  assert.equal(visible.length, SEED_RESOURCES.length - 1);
  assert.ok(!visible.some((r) => r.id === target.id));
  assert.equal(canView(student, s.resources.find((r) => r.id === target.id)!), false);
  assert.equal(canView(superAdmin, s.resources.find((r) => r.id === target.id)!), true);
});

test('students cannot manage resources', () => {
  const s = initialState();
  assert.throws(() => setStatus(s, student, s.resources[0].id, 'archived'), PermissionError);
  assert.throws(() => deleteResource(s, student, s.resources[0].id), PermissionError);
  assert.throws(() => updateResource(s, student, s.resources[0].id, { title: 'Hacked' }), PermissionError);
});

test('faculty only manage assigned subjects; department admins only their department', () => {
  const s = initialState();
  const py = s.resources.find((r) => r.subject_key === 'python-programming')!;
  const java = s.resources.find((r) => r.subject_key === 'java-programming')!;
  const maths = s.resources.find((r) => r.subject_key === 'mathematics')!;
  assert.ok(canManage(faculty, py));
  assert.ok(!canManage(faculty, maths));
  assert.throws(() => setStatus(s, faculty, java.id, 'unpublished'), PermissionError);
  assert.ok(canManage(deptAdmin, maths));
  assert.ok(!canManage(deptAdmin, java));
  assert.throws(() => updateResource(s, deptAdmin, maths.id, { department: 'Department of Computer Applications' }), PermissionError);
  assert.ok(visibleResources(s, faculty).every((r) => faculty.assignedSubjects!.includes(r.subject_key)));
});

test('publish / unpublish / archive / edit / delete update state and audit log', () => {
  let s = initialState();
  const r = s.resources[3];
  s = setStatus(s, superAdmin, r.id, 'unpublished');
  s = setStatus(s, superAdmin, r.id, 'published');
  s = setStatus(s, superAdmin, r.id, 'archived');
  s = updateResource(s, superAdmin, r.id, { title: 'Renamed paper', exam_year: 2023 });
  const updated = s.resources.find((x) => x.id === r.id)!;
  assert.equal(updated.title, 'Renamed paper');
  assert.equal(updated.file_url, r.file_url, 'file identity preserved');
  s = toggleBookmark(setStatus(s, superAdmin, r.id, 'published'), student, r.id);
  s = recordDownload(s, student, r.id);
  s = deleteResource(s, superAdmin, r.id);
  assert.ok(!s.resources.some((x) => x.id === r.id));
  assert.deepEqual(s.bookmarks[student.id], []);
  assert.equal(activityResources(s, student, s.downloads[student.id]).length, 0);
  assert.ok(s.audit.length >= 7);
});

test('filters by subject, semester, year, type and search (case-insensitive)', () => {
  const all = initialState().resources;
  const py = filterResources(all, { subject: 'python-programming' });
  assert.ok(py.length >= 1 && py.every((r) => r.subject_key === 'python-programming'));
  assert.ok(filterResources(all, { semester: 1 }).every((r) => r.semester === 1));
  assert.ok(filterResources(all, { year: 2025 }).every((r) => r.exam_year === 2025));
  assert.equal(filterResources(all, { q: 'PYTHON nov 2025' }).length, 1);
  assert.equal(filterResources(all, { q: 'no such paper' }).length, 0);
  const f = facets(all);
  assert.ok(f.subjects.length === 10 && f.years.length >= 3);
  const sorted = sortResources(all, 'latest');
  assert.ok(sorted[0].exam_year >= sorted[sorted.length - 1].exam_year);
});

test('bookmarks toggle and are per-user', () => {
  let s = initialState();
  const id = s.resources[0].id;
  s = toggleBookmark(s, student, id);
  assert.deepEqual(s.bookmarks[student.id], [id]);
  assert.equal(s.bookmarks[faculty.id], undefined);
  s = toggleBookmark(s, student, id);
  assert.deepEqual(s.bookmarks[student.id], []);
});
