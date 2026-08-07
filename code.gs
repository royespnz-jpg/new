/**
 * THE CONSONANT LAB — results & recordings collector
 * ---------------------------------------------------------------------------
 * SETUP (about three minutes)
 *
 *  1. Go to sheets.new and name the spreadsheet, e.g. "Consonant Lab — 2026".
 *  2. Extensions ▸ Apps Script. Delete whatever is there and paste this file.
 *  3. Save (disk icon), then in the function dropdown choose `setup` and press
 *     Run. Approve the permissions Google asks for — they are for YOUR own
 *     spreadsheet and Drive folder.
 *  4. Deploy ▸ New deployment ▸ gear icon ▸ Web app.
 *        Description:      Consonant Lab
 *        Execute as:       Me
 *        Who has access:   Anyone            ← must be "Anyone", not "Anyone with Google account"
 *     Press Deploy and copy the Web app URL (it ends in /exec).
 *  5. Open script.js and paste that URL into CONFIG.endpoint:
 *        endpoint: 'https://script.google.com/macros/s/AKfy..../exec',
 *
 * Students never sign in. Their name comes from the Settings panel in the app.
 *
 * IMPORTANT: every time you edit this file you must redeploy
 * (Deploy ▸ Manage deployments ▸ pencil ▸ Version: New version ▸ Deploy),
 * otherwise the old code keeps running.
 * ---------------------------------------------------------------------------
 */

const FOLDER_NAME    = 'Consonant Lab — Recordings';
const SHEET_SCORES   = 'Scores';
const SHEET_CLIPS    = 'Recordings';

/* ===========================================================================
   Run this once from the editor
   =========================================================================== */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const scores = sheet_(ss, SHEET_SCORES,
    ['Received', 'Student', 'Group', 'Unit', 'Activity', 'Score %', 'Correct', 'Total', 'Device time']);
  const clips = sheet_(ss, SHEET_CLIPS,
    ['Received', 'Student', 'Group', 'Unit', 'Task', 'Listen', 'File', 'Device time']);

  scores.setColumnWidth(2, 190).setColumnWidth(4, 190).setColumnWidth(5, 170);
  clips.setColumnWidth(2, 190).setColumnWidth(4, 190).setColumnWidth(5, 260).setColumnWidth(6, 110);

  folder_();
  SpreadsheetApp.getUi().alert(
    'Consonant Lab is ready.\n\n' +
    'Sheets "' + SHEET_SCORES + '" and "' + SHEET_CLIPS + '" are set up, and the Drive folder "' +
    FOLDER_NAME + '" has been created.\n\nNow do step 4: Deploy ▸ New deployment ▸ Web app.'
  );
}

function sheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  sh.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1C1713')
    .setFontColor('#F4EDE1');
  sh.setFrozenRows(1);
  return sh;
}

function folder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

/* ===========================================================================
   Web app endpoints
   =========================================================================== */

function doGet() {
  return json_({ ok: true, service: 'consonant-lab', time: new Date().toISOString() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (!e || !e.postData || !e.postData.contents) throw new Error('empty request');

    const p = JSON.parse(e.postData.contents);
    if (p.kind === 'score')     return json_(saveScore_(p));
    if (p.kind === 'recording') return json_(saveClip_(p));
    throw new Error('unknown kind: ' + p.kind);

  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ===========================================================================
   Handlers
   =========================================================================== */

function saveScore_(p) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_SCORES) ||
             sheet_(ss, SHEET_SCORES, ['Received', 'Student', 'Group', 'Unit', 'Activity', 'Score %', 'Correct', 'Total', 'Device time']);

  sh.appendRow([
    new Date(),
    String(p.student || 'anonymous'),
    String(p.section || ''),
    String(p.unit || ''),
    String(p.activity || ''),
    Number(p.score) || 0,
    Number(p.correct) || 0,
    Number(p.total) || 0,
    String(p.at || ''),
  ]);
  return { ok: true, saved: 'score' };
}

function saveClip_(p) {
  if (!p.data) throw new Error('no audio attached');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_CLIPS) ||
             sheet_(ss, SHEET_CLIPS, ['Received', 'Student', 'Group', 'Unit', 'Task', 'Listen', 'File', 'Device time']);

  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');
  const name  = stamp + '_' + (p.filename || 'clip.webm');
  const blob  = Utilities.newBlob(Utilities.base64Decode(p.data), p.mime || 'audio/webm', name);
  const file  = folder_().createFile(blob);

  // Anyone holding the link can play it — needed so the link works from the
  // sheet on any device. Delete this line to keep the clips owner-only.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  sh.appendRow([
    new Date(),
    String(p.student || 'anonymous'),
    String(p.section || ''),
    String(p.unit || ''),
    String(p.task || ''),
    '=HYPERLINK("' + file.getUrl() + '";"▶ play")',
    name,
    String(p.at || ''),
  ]);
  return { ok: true, saved: 'recording', file: file.getUrl() };
}

/* ===========================================================================
   Optional: a teacher menu inside the spreadsheet
   =========================================================================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Consonant Lab')
    .addItem('Set up sheets', 'setup')
    .addItem('Class summary', 'summary')
    .addToUi();
}

/** Builds a per-student average from the Scores sheet. */
function summary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const src = ss.getSheetByName(SHEET_SCORES);
  if (!src || src.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert('No scores have arrived yet.');
    return;
  }

  const rows = src.getRange(2, 1, src.getLastRow() - 1, 8).getValues();
  const byStudent = {};

  rows.forEach(function (r) {
    const who = r[1] + ' — ' + r[2];
    if (!byStudent[who]) byStudent[who] = { n: 0, sum: 0, best: {} };
    const rec = byStudent[who];
    rec.n++;
    rec.sum += Number(r[5]) || 0;
    const key = r[3] + ' · ' + r[4];
    rec.best[key] = Math.max(rec.best[key] || 0, Number(r[5]) || 0);
  });

  const out = sheet_(ss, 'Summary', ['Student', 'Attempts', 'Average %', 'Activities cleared (≥80%)']);
  const data = Object.keys(byStudent).sort().map(function (who) {
    const r = byStudent[who];
    const cleared = Object.keys(r.best).filter(function (k) { return r.best[k] >= 80; }).length;
    return [who, r.n, Math.round(r.sum / r.n), cleared];
  });

  if (data.length) out.getRange(2, 1, data.length, 4).setValues(data);
  out.autoResizeColumns(1, 4);
  ss.setActiveSheet(out);
}
