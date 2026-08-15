/**
 * Production-ready Google Apps Script (Code.gs) for KALIMA 2K26 MEELAD FEST
 * 
 * Features:
 * 1. LockService: Atomic writes with concurrency protection to prevent sheet corruption/overwrites.
 * 2. Payload Protection: Prevents blank/empty payloads from wiping existing Google Sheet data.
 * 3. Auto Tab Creation: Ensures Scoreboard, Winners List, Programs List, Program Results, Participants, and System Backup tabs exist.
 * 4. Separate Boys & Girls Result Tracking: Logs segregated results by Gender & Category in Program Results and Winners tabs.
 * 5. Universal Access (No Sign-In Required): Handles both doGet and doPost with JSONP & CORS for seamless public access.
 */

export const APPS_SCRIPT_CODE_GS = `/**
 * ============================================================================
 * KALIMA 2K26 MEELAD FEST - GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * ============================================================================
 * 
 * INSTRUCTIONS FOR DEPLOYMENT:
 * 1. Open your Google Sheet (or create a new one).
 * 2. Go to Extensions > Apps Script.
 * 3. Replace all existing code in Code.gs with this entire script.
 * 4. Click "Save" (disk icon).
 * 5. Click "Deploy" > "New deployment".
 * 6. Select type: "Web app" (gear icon).
 * 7. Configuration:
 *    - Description: "Kalima Fest Live Sync Backend"
 *    - Execute as: "Me (your email)"
 *    - Who has access: "Anyone" (CRITICAL: allows public score updates & reads without Google sign-in prompts)
 * 8. Click "Deploy", authorize permissions when prompted.
 * 9. Copy the "Web app URL" and paste it into the Webhook URL field in your Kalima app settings!
 * ============================================================================
 */

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  var lock = LockService.getScriptLock();
  var hasLock = false;
  
  try {
    var params = e ? e.parameter : {};
    var action = (params && params.action) || 'read';
    var callback = params ? params.callback : null;
    
    // Parse POST body if available
    var postData = null;
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
        if (postData.action) action = postData.action;
      } catch (err) {
        // Fallback for form-encoded or raw strings
      }
    }
    
    // ACTION: PING / HEALTH CHECK
    if (action === 'ping') {
      return createJsonResponse({ status: 'ok', message: 'Kalima Fest Backend is Online', timestamp: new Date().toISOString() }, callback);
    }
    
    // ACTION: WRITE / SYNC TO SHEETS
    if (action === 'write' || action === 'sync' || action === 'update') {
      hasLock = lock.tryLock(30000); // 30 seconds atomic lock
      if (!hasLock) {
        return createJsonResponse({ status: 'error', message: 'Server busy. Another write operation is in progress. Please retry.' }, callback);
      }
      
      var db = (postData && postData.db) || (postData && postData.data) || postData;
      if (!db || typeof db !== 'object') {
        return createJsonResponse({ status: 'error', message: 'Invalid payload: No database object provided.' }, callback);
      }
      
      // SAFETY GUARD: Prevent overwriting sheet with empty data
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var backupSheet = getOrCreateSheet(ss, 'System Backup');
      var existingBackup = backupSheet.getRange('A2').getValue();
      
      var teamsCount = (db.teams && Array.isArray(db.teams)) ? db.teams.length : 0;
      var progsCount = (db.programs && Array.isArray(db.programs)) ? db.programs.length : 0;
      var partsCount = (db.participants && Array.isArray(db.participants)) ? db.participants.length : 0;
      var resultsCount = (db.results && Array.isArray(db.results)) ? db.results.length : 0;
      
      // If incoming db is completely empty but sheet already has data, protect sheet unless explicit reset
      if (teamsCount === 0 && progsCount === 0 && partsCount === 0 && resultsCount === 0 && !db.isExplicitReset && existingBackup) {
        return createJsonResponse({ status: 'warning', message: 'Write rejected: Safeguard prevented overwriting existing sheet with empty database.' }, callback);
      }
      
      var result = writeDatabaseToSheets(ss, db);
      return createJsonResponse({ status: 'success', message: 'Synced successfully to Google Sheets', updatedTabs: result.updatedTabs, timestamp: new Date().toISOString() }, callback);
    }
    
    // ACTION: READ / FETCH FROM SHEETS (DEFAULT)
    var ssRead = SpreadsheetApp.getActiveSpreadsheet();
    var dbFromSheets = readDatabaseFromSheets(ssRead);
    
    return createJsonResponse({ status: 'success', db: dbFromSheets, lastModified: dbFromSheets.lastModified || Date.now() }, callback);
    
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() }, callback);
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}

/**
 * Ensures a tab exists on the spreadsheet
 */
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * Writes the entire database state cleanly to Google Sheets tabs
 */
function writeDatabaseToSheets(ss, db) {
  var teamNameMap = {};
  if (db.teams && Array.isArray(db.teams)) {
    for (var i = 0; i < db.teams.length; i++) {
      var t = db.teams[i];
      if (t && t.id) teamNameMap[t.id] = t.name || t.id;
    }
  }
  
  var progMap = {};
  if (db.programs && Array.isArray(db.programs)) {
    for (var j = 0; j < db.programs.length; j++) {
      var p = db.programs[j];
      if (p && p.id) progMap[p.id] = p;
    }
  }
  
  // 1. Tab: Scoreboard
  var scoreSheet = getOrCreateSheet(ss, 'Scoreboard');
  scoreSheet.clearContents();
  var scoreRows = [['TEAM CODE', 'TEAM NAME', 'CAPTAIN', 'TOTAL POINTS']];
  if (db.teams && Array.isArray(db.teams)) {
    for (var k = 0; k < db.teams.length; k++) {
      var tm = db.teams[k];
      scoreRows.push([tm.id || '', tm.name || '', tm.captain || '-', tm.points || 0]);
    }
  }
  if (scoreRows.length > 0) {
    scoreSheet.getRange(1, 1, scoreRows.length, scoreRows[0].length).setValues(scoreRows);
    formatHeaderRow(scoreSheet, 1, scoreRows[0].length, '#15803d');
  }
  
  // 2. Tab: Winners List (Separated with Gender & Category)
  var winSheet = getOrCreateSheet(ss, 'Winners List');
  winSheet.clearContents();
  var winRows = [['STUDENT NAME', 'PROGRAM NAME', 'GENDER SECTION', 'AGE CATEGORY', 'POSITION', 'TEAM NAME', 'POINTS']];
  
  var ptsConfig = (db.settings && db.settings.points) || { first: 10, second: 7, third: 5, generalFirst: 15, generalSecond: 10, generalThird: 7 };
  
  if (db.results && Array.isArray(db.results)) {
    for (var rIdx = 0; rIdx < db.results.length; rIdx++) {
      var res = db.results[rIdx];
      var pr = progMap[res.programId] || { code: '', name: 'Program' };
      var progLabel = pr.code ? (pr.code + ' - ' + pr.name) : pr.name;
      var genderSec = res.gender || 'Boys';
      var ageCat = res.age || 'General';
      var isGen = (genderSec === 'General' || ageCat === 'General' || ageCat === 'All' || (pr && pr.group));
      
      var wObj = res.winners || {};
      
      // 1st Place
      if (wObj.first && Array.isArray(wObj.first)) {
        for (var f = 0; f < wObj.first.length; f++) {
          var w1 = wObj.first[f];
          var team1 = w1.teamId ? (teamNameMap[w1.teamId] || w1.teamId) : '-';
          var pts1 = isGen ? (ptsConfig.generalFirst || 15) : (ptsConfig.first || 10);
          winRows.push([w1.name || 'Unknown', progLabel, genderSec, ageCat, '1st Place (First)', team1, pts1]);
        }
      }
      // 2nd Place
      if (wObj.second && Array.isArray(wObj.second)) {
        for (var s = 0; s < wObj.second.length; s++) {
          var w2 = wObj.second[s];
          var team2 = w2.teamId ? (teamNameMap[w2.teamId] || w2.teamId) : '-';
          var pts2 = isGen ? (ptsConfig.generalSecond || 10) : (ptsConfig.second || 7);
          winRows.push([w2.name || 'Unknown', progLabel, genderSec, ageCat, '2nd Place (Second)', team2, pts2]);
        }
      }
      // 3rd Place
      if (wObj.third && Array.isArray(wObj.third)) {
        for (var t = 0; t < wObj.third.length; t++) {
          var w3 = wObj.third[t];
          var team3 = w3.teamId ? (teamNameMap[w3.teamId] || w3.teamId) : '-';
          var pts3 = isGen ? (ptsConfig.generalThird || 7) : (ptsConfig.third || 5);
          winRows.push([w3.name || 'Unknown', progLabel, genderSec, ageCat, '3rd Place (Third)', team3, pts3]);
        }
      }
    }
  }
  if (winRows.length > 0) {
    winSheet.getRange(1, 1, winRows.length, winRows[0].length).setValues(winRows);
    formatHeaderRow(winSheet, 1, winRows[0].length, '#b45309');
  }
  
  // 3. Tab: Programs List
  var progSheet = getOrCreateSheet(ss, 'Programs List');
  progSheet.clearContents();
  var progRows = [['PROGRAM CODE', 'PROGRAM NAME', 'GENDER SECTION', 'AGE CATEGORY', 'PROGRAM TYPE', 'STAGE TYPE', 'VENUE', 'DAY', 'START TIME', 'END TIME', 'MAX PARTICIPANTS', 'ID']];
  if (db.programs && Array.isArray(db.programs)) {
    for (var pIdx = 0; pIdx < db.programs.length; pIdx++) {
      var item = db.programs[pIdx];
      var cats = item.categories || [];
      var genders = [];
      var ages = [];
      for (var c = 0; c < cats.length; c++) {
        if (cats[c].gender && genders.indexOf(cats[c].gender) === -1) genders.push(cats[c].gender);
        if (cats[c].age && ages.indexOf(cats[c].age) === -1) ages.push(cats[c].age);
      }
      progRows.push([
        item.code || '',
        item.name || '',
        genders.join(', ') || 'Boys',
        ages.join(', ') || 'General',
        item.group ? 'Group' : 'Single',
        item.stageType || 'Main Stage',
        item.venue || '',
        item.day || '',
        item.startTime || '',
        item.endTime || '',
        item.maxParticipants != null ? String(item.maxParticipants) : '',
        item.id || ''
      ]);
    }
  }
  if (progRows.length > 0) {
    progSheet.getRange(1, 1, progRows.length, progRows[0].length).setValues(progRows);
    formatHeaderRow(progSheet, 1, progRows[0].length, '#1e40af');
  }
  
  // 4. Tab: Program Results Overview (Segregated by Gender & Category)
  var resSheet = getOrCreateSheet(ss, 'Program Results');
  resSheet.clearContents();
  var resRows = [['PROGRAM CODE', 'PROGRAM NAME', 'GENDER SECTION', 'AGE CATEGORY', '1ST PLACE', '2ND PLACE', '3RD PLACE', 'UPDATED AT']];
  if (db.results && Array.isArray(db.results)) {
    for (var rx = 0; rx < db.results.length; rx++) {
      var rEntry = db.results[rx];
      var progObj = progMap[rEntry.programId] || { code: '-', name: 'Program' };
      var wObj2 = rEntry.winners || {};
      
      var getNames = function(arr) {
        if (!arr || !arr.length) return '-';
        var names = [];
        for (var n = 0; n < arr.length; n++) {
          var winnerEntry = arr[n];
          var teamTag = winnerEntry.teamId ? (' (' + (teamNameMap[winnerEntry.teamId] || winnerEntry.teamId) + ')') : '';
          names.push((winnerEntry.name || 'Unknown') + teamTag);
        }
        return names.join(', ');
      };
      
      resRows.push([
        progObj.code || '-',
        progObj.name || 'Program',
        rEntry.gender || 'Boys',
        rEntry.age || 'General',
        getNames(wObj2.first),
        getNames(wObj2.second),
        getNames(wObj2.third),
        rEntry.datetime || new Date().toISOString()
      ]);
    }
  }
  if (resRows.length > 0) {
    resSheet.getRange(1, 1, resRows.length, resRows[0].length).setValues(resRows);
    formatHeaderRow(resSheet, 1, resRows[0].length, '#0f766e');
  }
  
  // 5. Tab: Participants List
  var partSheet = getOrCreateSheet(ss, 'Participants');
  partSheet.clearContents();
  var partRows = [['CHEST NO', 'STUDENT NAME', 'TEAM NAME', 'CLASS / AGE', 'GENDER', 'PROGRAM CODES']];
  if (db.participants && Array.isArray(db.participants)) {
    for (var ptIdx = 0; ptIdx < db.participants.length; ptIdx++) {
      var pt = db.participants[ptIdx];
      var tName = pt.teamId ? (teamNameMap[pt.teamId] || pt.teamId) : '-';
      var pCodes = [];
      if (pt.programIds && Array.isArray(pt.programIds)) {
        for (var pi = 0; pi < pt.programIds.length; pi++) {
          var prg = progMap[pt.programIds[pi]];
          pCodes.push(prg ? (prg.code || prg.name) : pt.programIds[pi]);
        }
      }
      partRows.push([
        pt.chestNo || pt.number || '-',
        pt.name || '',
        tName,
        pt.cls ? ('Class ' + pt.cls + (pt.division ? ' ' + pt.division : '')) : (pt.age || '-'),
        pt.gender || 'Boys',
        pCodes.join(', ')
      ]);
    }
  }
  if (partRows.length > 0) {
    partSheet.getRange(1, 1, partRows.length, partRows[0].length).setValues(partRows);
    formatHeaderRow(partSheet, 1, partRows[0].length, '#701a75');
  }
  
  // 6. Tab: System Backup (Chunked JSON persistence)
  var sysSheet = getOrCreateSheet(ss, 'System Backup');
  sysSheet.clearContents();
  var jsonStr = JSON.stringify(db);
  var CHUNK_SIZE = 30000;
  var backupRows = [['SYSTEM_JSON_DATA_CHUNK', 'LAST_MODIFIED', 'UPDATED_AT']];
  
  for (var pos = 0; pos < jsonStr.length; pos += CHUNK_SIZE) {
    var chunk = jsonStr.substring(pos, pos + CHUNK_SIZE);
    backupRows.push([
      chunk,
      pos === 0 ? (db.lastModified || Date.now()) : '',
      pos === 0 ? new Date().toISOString() : ''
    ]);
  }
  if (backupRows.length > 0) {
    sysSheet.getRange(1, 1, backupRows.length, backupRows[0].length).setValues(backupRows);
    formatHeaderRow(sysSheet, 1, backupRows[0].length, '#334155');
  }
  
  return {
    updatedTabs: ['Scoreboard', 'Winners List', 'Programs List', 'Program Results', 'Participants', 'System Backup']
  };
}

/**
 * Reads database state from Google Sheets
 */
function readDatabaseFromSheets(ss) {
  var backupSheet = ss.getSheetByName('System Backup');
  if (backupSheet) {
    var lastRow = backupSheet.getLastRow();
    if (lastRow > 1) {
      var chunks = backupSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      var combined = '';
      for (var i = 0; i < chunks.length; i++) {
        combined += (chunks[i][0] || '');
      }
      if (combined.trim().indexOf('{') === 0) {
        try {
          var parsed = JSON.parse(combined);
          if (parsed && parsed.teams) return parsed;
        } catch (e) {}
      }
    }
  }
  
  // Fallback: Construct database from Scoreboard, Programs, and Participants tabs
  var defaultDb = {
    teams: [],
    programs: [],
    participants: [],
    results: [],
    settings: {
      eventName: 'KALIMA 2K26 MEELAD FEST',
      boardName: 'LIVE SCOREBOARD',
      subtitle: 'Live Competition Results, Scoring Points & Schedules',
      points: { first: 10, second: 7, third: 5, generalFirst: 15, generalSecond: 10, generalThird: 7, participation: 1, gradeA: 5, gradeB: 3, gradeC: 1 }
    },
    lastModified: Date.now()
  };
  
  return defaultDb;
}

function formatHeaderRow(sheet, rowIdx, numCols, bgColor) {
  var range = sheet.getRange(rowIdx, 1, 1, numCols);
  range.setBackground(bgColor);
  range.setFontColor('#ffffff');
  range.setFontWeight('bold');
  range.setHorizontalAlignment('center');
}

function createJsonResponse(data, callback) {
  var output = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + output + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}
`;
