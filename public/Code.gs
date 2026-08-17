/**
 * ============================================================================
 * KALIMA 2K26 MEELAD FEST - GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * ============================================================================
 * 
 * CORE FEATURES & ARCHITECTURE:
 * 1. LockService Atomic Concurrency Guard: Prevents race conditions and blank sheet overwrite bugs.
 * 2. Strict Vertical Section Stack Architecture: Stores and organizes multi-level hierarchy:
 *    [Competition (e.g. 1134 - മിനിക്കഥ മലയാളം)] -> [Category] -> [Gender] -> [1st, 2nd, 3rd Winners]
 * 3. Exact Category-Gender Ordering:
 *    - Junior - Boys
 *    - Junior - Girls
 *    - Senior - Boys
 *    - Senior - Girls
 *    - Super Senior - Boys
 *    - Super Senior - Girls
 *    (Plus Kids & General sections if published)
 * 4. Multi-Tab Structured Google Sheet Output:
 *    - Scoreboard (Live Team Standings, Totals, Ranks)
 *    - Program Results (Vertical Stack of Published Competition Results)
 *    - Winners List (Comprehensive Roster with Student, Team, Points & Position)
 *    - System Backup (Safe JSON persistence preventing data loss)
 * 
 * ============================================================================
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Open your Google Sheet.
 * 2. Click "Extensions" > "Apps Script".
 * 3. Replace all code in Code.gs with this entire script.
 * 4. Click "Save" (Floppy Disk icon).
 * 5. Click "Deploy" > "New deployment" > Select type "Web app" (Gear icon).
 * 6. Configuration:
 *    - Description: "KALIMA 2K26 Live Sync Engine"
 *    - Execute as: "Me (your email)"
 *    - Who has access: "Anyone" (CRITICAL: enables seamless read/write without Google login prompts)
 * 7. Click "Deploy", approve authorization prompts, and copy your "Web app URL".
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
    
    // Parse incoming payload
    var postData = null;
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
        if (postData.action) action = postData.action;
      } catch (err) {
        // Fallback for url-encoded/raw text
      }
    }
    
    // 1. ACTION: HEALTH CHECK / PING
    if (action === 'ping') {
      return createJsonResponse({ 
        status: 'ok', 
        message: 'KALIMA 2K26 Backend Online & Ready', 
        timestamp: new Date().toISOString() 
      }, callback);
    }
    
    // 2. ACTION: WRITE / SYNC (PROTECTED WITH LOCKSERVICE TO PREVENT OVERWRITES)
    if (action === 'write' || action === 'sync' || action === 'update') {
      // 30 seconds atomic lock to ensure concurrency safety
      hasLock = lock.tryLock(30000);
      if (!hasLock) {
        return createJsonResponse({ 
          status: 'error', 
          message: 'Server busy: Another write operation is actively writing. Please retry.' 
        }, callback);
      }
      
      var db = (postData && postData.db) || (postData && postData.data) || postData;
      if (!db || typeof db !== 'object') {
        return createJsonResponse({ 
          status: 'error', 
          message: 'Invalid payload: No database object provided.' 
        }, callback);
      }
      
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      
      // SAFEGUARD: Guard against blank sheet overwrite bug
      var backupSheet = getOrCreateSheet(ss, 'System Backup');
      var existingBackup = backupSheet.getRange('A2').getValue();
      var hasTeams = db.teams && Array.isArray(db.teams) && db.teams.length > 0;
      var hasResults = db.results && Array.isArray(db.results) && db.results.length > 0;
      var hasPrograms = db.programs && Array.isArray(db.programs) && db.programs.length > 0;
      
      if (!hasTeams && !hasResults && !hasPrograms && !db.isExplicitReset && existingBackup) {
        return createJsonResponse({ 
          status: 'warning', 
          message: 'Write rejected by safety safeguard: Incoming payload is empty.' 
        }, callback);
      }
      
      var result = writeDatabaseToSheets(ss, db);
      return createJsonResponse({ 
        status: 'success', 
        message: 'KALIMA 2K26 Google Sheets successfully updated with LockService.', 
        updatedTabs: result.updatedTabs,
        timestamp: new Date().toISOString() 
      }, callback);
    }
    
    // 3. ACTION: READ / FETCH (SERVES PUBLIC INDEX.HTML)
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
 * Creates sheet if missing or retrieves existing
 */
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * Write structured data to Google Sheets with atomic consistency
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
  var scoreRows = [['RANK', 'TEAM CODE', 'TEAM NAME', 'CAPTAIN', 'TOTAL POINTS']];
  
  var sortedTeams = (db.teams && Array.isArray(db.teams)) ? db.teams.slice().sort(function(a, b) {
    return (b.points || 0) - (a.points || 0);
  }) : [];
  
  for (var k = 0; k < sortedTeams.length; k++) {
    var tm = sortedTeams[k];
    scoreRows.push([k + 1, tm.id || '', tm.name || '', tm.captain || '-', tm.points || 0]);
  }
  if (scoreRows.length > 0) {
    scoreSheet.getRange(1, 1, scoreRows.length, scoreRows[0].length).setValues(scoreRows);
    formatHeaderRow(scoreSheet, 1, scoreRows[0].length, '#15803d');
  }
  
  // 2. Tab: Program Results (Strict Vertical Stack Roster)
  var resSheet = getOrCreateSheet(ss, 'Program Results');
  resSheet.clearContents();
  var resRows = [['COMPETITION CODE', 'COMPETITION NAME', 'CATEGORY', 'GENDER', '1ST PLACE (NAME & TEAM)', '2ND PLACE (NAME & TEAM)', '3RD PLACE (NAME & TEAM)', 'PUBLISHED TIME']];
  
  if (db.results && Array.isArray(db.results)) {
    for (var rx = 0; rx < db.results.length; rx++) {
      var rEntry = db.results[rx];
      var prObj = progMap[rEntry.programId] || { code: '-', name: 'Competition' };
      var wObj = rEntry.winners || {};
      
      var formatWinnerStr = function(arr) {
        if (!arr || !arr.length) return '-';
        var names = [];
        for (var n = 0; n < arr.length; n++) {
          var item = arr[n];
          var teamTag = item.teamId ? (' [' + (teamNameMap[item.teamId] || item.teamId) + ']') : '';
          var ptsTag = item.points ? (' (' + item.points + ' PTS)') : '';
          names.push((item.name || 'Unknown') + teamTag + ptsTag);
        }
        return names.join(', ');
      };
      
      resRows.push([
        prObj.code || '-',
        prObj.name || 'Competition',
        rEntry.age || 'Junior',
        rEntry.gender || 'Boys',
        formatWinnerStr(wObj.first),
        formatWinnerStr(wObj.second),
        formatWinnerStr(wObj.third),
        rEntry.datetime || new Date().toISOString()
      ]);
    }
  }
  if (resRows.length > 0) {
    resSheet.getRange(1, 1, resRows.length, resRows[0].length).setValues(resRows);
    formatHeaderRow(resSheet, 1, resRows[0].length, '#0f766e');
  }
  
  // 3. Tab: Winners List (Individual Itemized Registry)
  var winSheet = getOrCreateSheet(ss, 'Winners List');
  winSheet.clearContents();
  var winRows = [['STUDENT NAME', 'COMPETITION', 'CATEGORY', 'GENDER', 'POSITION', 'TEAM NAME', 'POINTS AWARDED']];
  var ptsConfig = (db.settings && db.settings.points) || { first: 10, second: 7, third: 5, generalFirst: 15, generalSecond: 10, generalThird: 7 };
  
  if (db.results && Array.isArray(db.results)) {
    for (var rIdx = 0; rIdx < db.results.length; rIdx++) {
      var res = db.results[rIdx];
      var prItem = progMap[res.programId] || { code: '', name: 'Competition' };
      var compTitle = prItem.code ? (prItem.code + ' - ' + prItem.name) : prItem.name;
      var isGeneral = (res.gender === 'General' || res.age === 'General' || res.age === 'All');
      var wObj2 = res.winners || {};
      
      var addWinnersToRows = function(list, positionTitle, defaultPoints) {
        if (!list || !Array.isArray(list)) return;
        for (var idx = 0; idx < list.length; idx++) {
          var winner = list[idx];
          var teamName = winner.teamId ? (teamNameMap[winner.teamId] || winner.teamId) : '-';
          var pts = winner.points !== undefined ? winner.points : defaultPoints;
          winRows.push([winner.name || 'Unknown', compTitle, res.age || 'Junior', res.gender || 'Boys', positionTitle, teamName, pts]);
        }
      };
      
      addWinnersToRows(wObj2.first, '1st Place (First)', isGeneral ? (ptsConfig.generalFirst || 15) : (ptsConfig.first || 10));
      addWinnersToRows(wObj2.second, '2nd Place (Second)', isGeneral ? (ptsConfig.generalSecond || 10) : (ptsConfig.second || 7));
      addWinnersToRows(wObj2.third, '3rd Place (Third)', isGeneral ? (ptsConfig.generalThird || 7) : (ptsConfig.third || 5));
    }
  }
  if (winRows.length > 0) {
    winSheet.getRange(1, 1, winRows.length, winRows[0].length).setValues(winRows);
    formatHeaderRow(winSheet, 1, winRows[0].length, '#b45309');
  }
  
  // 4. Tab: System Backup (Atomic JSON chunks)
  var sysSheet = getOrCreateSheet(ss, 'System Backup');
  sysSheet.clearContents();
  var jsonPayloadStr = JSON.stringify(db);
  var CHUNK_MAX = 30000;
  var backupRows = [['JSON_CHUNK_DATA', 'LAST_MODIFIED', 'BACKUP_TIMESTAMP']];
  
  for (var pos = 0; pos < jsonPayloadStr.length; pos += CHUNK_MAX) {
    var chunk = jsonPayloadStr.substring(pos, pos + CHUNK_MAX);
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
