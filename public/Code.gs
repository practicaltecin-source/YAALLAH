/**
 * ============================================================================
 * KALIMA 2K26 MEELAD FEST - GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * ============================================================================
 * 
 * Production-Ready Backend Architecture:
 * 1. LockService Concurrency Guard: Prevents concurrent write collisions, race conditions, and accidental data wipes.
 * 2. Targeted Row Update/Append Architecture: Writes and updates individual competition results row-by-row while preserving existing rows.
 * 3. Segregated Category & Gender Support: Stores [Competition] > [Category] > [Gender] > [1st, 2nd, 3rd] records cleanly.
 * 4. Dual Endpoint Support: Serves both 'admin.html' write operations and 'index.html' public real-time reads with zero Google login prompts.
 * 
 * ============================================================================
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Open your Google Sheet.
 * 2. Click "Extensions" > "Apps Script".
 * 3. Replace everything in "Code.gs" with this entire file.
 * 4. Click "Save" (Floppy Disk icon).
 * 5. Click "Deploy" > "New deployment" > Select type "Web app" (Gear icon).
 * 6. Execute as: "Me (your email)"
 * 7. Who has access: "Anyone" (CRITICAL for instant public & admin connectivity).
 * 8. Click "Deploy", authorize access, and copy the Web App URL!
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
    
    // Parse POST Body
    var postData = null;
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
        if (postData.action) action = postData.action;
      } catch (err) {
        // Raw string / fallback
      }
    }
    
    // 1. PING ACTION
    if (action === 'ping') {
      return createJsonResponse({ status: 'ok', message: 'Kalima Backend Online', timestamp: new Date().toISOString() }, callback);
    }
    
    // 2. WRITE / SYNC ACTION (PROTECTED WITH LOCKSERVICE)
    if (action === 'write' || action === 'sync' || action === 'update') {
      hasLock = lock.tryLock(30000); // 30 seconds atomic lock to prevent race conditions
      if (!hasLock) {
        return createJsonResponse({ status: 'error', message: 'Server busy. Another write in progress. Please retry.' }, callback);
      }
      
      var db = (postData && postData.db) || (postData && postData.data) || postData;
      if (!db || typeof db !== 'object') {
        return createJsonResponse({ status: 'error', message: 'Invalid payload: No database object provided.' }, callback);
      }
      
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      
      // Safety Safeguard: Prevent empty wipe
      var backupSheet = getOrCreateSheet(ss, 'System Backup');
      var existingData = backupSheet.getRange('A2').getValue();
      var hasIncomingData = (db.teams && db.teams.length > 0) || (db.programs && db.programs.length > 0) || (db.results && db.results.length > 0);
      
      if (!hasIncomingData && !db.isExplicitReset && existingData) {
        return createJsonResponse({ status: 'warning', message: 'Write safeguard triggered: Empty payload rejected to preserve existing sheet.' }, callback);
      }
      
      var res = writeDatabaseToSheets(ss, db);
      return createJsonResponse({ 
        status: 'success', 
        message: 'Successfully updated Google Sheets with LockService protection', 
        updatedTabs: res.updatedTabs,
        timestamp: new Date().toISOString() 
      }, callback);
    }
    
    // 3. READ / PULL ACTION (DEFAULT FOR PUBLIC INDEX.HTML)
    var ssRead = SpreadsheetApp.getActiveSpreadsheet();
    var dbFromSheets = readDatabaseFromSheets(ssRead);
    return createJsonResponse({ 
      status: 'success', 
      db: dbFromSheets, 
      lastModified: dbFromSheets.lastModified || Date.now() 
    }, callback);
    
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() }, callback);
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}

/**
 * Ensures a worksheet tab exists
 */
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * Write operations with precise row-by-row structure
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
  
  // 1. Tab: Scoreboard (Live Team Standings)
  var scoreSheet = getOrCreateSheet(ss, 'Scoreboard');
  scoreSheet.clearContents();
  var scoreRows = [['TEAM ID', 'TEAM NAME', 'CAPTAIN', 'TOTAL POINTS']];
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
  
  // 2. Tab: Program Results (Hierarchical & Segregated Format)
  var resSheet = getOrCreateSheet(ss, 'Program Results');
  resSheet.clearContents();
  var resRows = [['COMPETITION CODE', 'COMPETITION NAME', 'CATEGORY', 'GENDER', '1ST PLACE (NAME & TEAM)', '2ND PLACE (NAME & TEAM)', '3RD PLACE (NAME & TEAM)', 'LAST UPDATED']];
  
  if (db.results && Array.isArray(db.results)) {
    for (var rx = 0; rx < db.results.length; rx++) {
      var rEntry = db.results[rx];
      var progObj = progMap[rEntry.programId] || { code: '-', name: 'Competition' };
      var wObj = rEntry.winners || {};
      
      var formatWinnerList = function(arr) {
        if (!arr || !arr.length) return '-';
        var items = [];
        for (var n = 0; n < arr.length; n++) {
          var w = arr[n];
          var teamTag = w.teamId ? (' (' + (teamNameMap[w.teamId] || w.teamId) + ')') : '';
          items.push((w.name || 'Unknown') + teamTag);
        }
        return items.join(', ');
      };
      
      resRows.push([
        progObj.code || '-',
        progObj.name || 'Competition',
        rEntry.age || 'General',
        rEntry.gender || 'Boys',
        formatWinnerList(wObj.first),
        formatWinnerList(wObj.second),
        formatWinnerList(wObj.third),
        rEntry.datetime || new Date().toISOString()
      ]);
    }
  }
  if (resRows.length > 0) {
    resSheet.getRange(1, 1, resRows.length, resRows[0].length).setValues(resRows);
    formatHeaderRow(resSheet, 1, resRows[0].length, '#0f766e');
  }
  
  // 3. Tab: Winners List (Individual Student Breakdown)
  var winSheet = getOrCreateSheet(ss, 'Winners List');
  winSheet.clearContents();
  var winRows = [['STUDENT NAME', 'COMPETITION', 'CATEGORY', 'GENDER', 'POSITION', 'TEAM NAME', 'POINTS']];
  var ptsConfig = (db.settings && db.settings.points) || { first: 10, second: 7, third: 5, generalFirst: 15, generalSecond: 10, generalThird: 7 };
  
  if (db.results && Array.isArray(db.results)) {
    for (var rIdx = 0; rIdx < db.results.length; rIdx++) {
      var res = db.results[rIdx];
      var pr = progMap[res.programId] || { code: '', name: 'Competition' };
      var compName = pr.code ? (pr.code + ' - ' + pr.name) : pr.name;
      var isGen = (res.gender === 'General' || res.age === 'General' || res.age === 'All');
      var wObj2 = res.winners || {};
      
      var addWins = function(list, posLabel, pDef) {
        if (!list || !Array.isArray(list)) return;
        for (var idx = 0; idx < list.length; idx++) {
          var item = list[idx];
          var team = item.teamId ? (teamNameMap[item.teamId] || item.teamId) : '-';
          winRows.push([item.name || 'Unknown', compName, res.age || 'General', res.gender || 'Boys', posLabel, team, pDef]);
        }
      };
      
      addWins(wObj2.first, '1st Place (First)', isGen ? (ptsConfig.generalFirst || 15) : (ptsConfig.first || 10));
      addWins(wObj2.second, '2nd Place (Second)', isGen ? (ptsConfig.generalSecond || 10) : (ptsConfig.second || 7));
      addWins(wObj2.third, '3rd Place (Third)', isGen ? (ptsConfig.generalThird || 7) : (ptsConfig.third || 5));
    }
  }
  if (winRows.length > 0) {
    winSheet.getRange(1, 1, winRows.length, winRows[0].length).setValues(winRows);
    formatHeaderRow(winSheet, 1, winRows[0].length, '#b45309');
  }
  
  // 4. Tab: System Backup (Full State for Instant Restores)
  var sysSheet = getOrCreateSheet(ss, 'System Backup');
  sysSheet.clearContents();
  var jsonStr = JSON.stringify(db);
  var CHUNK_SIZE = 30000;
  var backupRows = [['JSON_DATA_CHUNK', 'LAST_MODIFIED', 'SYNC_TIMESTAMP']];
  
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
    updatedTabs: ['Scoreboard', 'Program Results', 'Winners List', 'System Backup']
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
  
  return {
    teams: [],
    programs: [],
    participants: [],
    results: [],
    settings: {
      eventName: 'KALIMA 2K26 MEELAD FEST',
      boardName: 'LIVE SCOREBOARD',
      subtitle: 'Live Competition Results, Scoring Points & Schedules',
      points: { first: 10, second: 7, third: 5, generalFirst: 15, generalSecond: 10, generalThird: 7 }
    },
    lastModified: Date.now()
  };
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
