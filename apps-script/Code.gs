/* Deploy as: Web app / Execute as me / Who has access: Anyone.
 * Before deployment, set Script Properties described in README.md.
 * Helpers end in _ so google.script.run cannot invoke them.
 */
var RESPONSE_HEADERS_ = ['submission_id','received_at','study_id','version','code_hash','name','student_id','pamphlet_read','started_at','completed_at','order_json','answers_json','timings_json'];
var CODE_HEADERS_ = ['participant_code','code_hash','issued_at','note'];

function doGet(e) {
  var props=PropertiesService.getScriptProperties();
  var allowed=(props.getProperty('ALLOWED_ORIGINS')||'').split(',').map(function(s){return s.trim();});
  var origin=e&&e.parameter&&e.parameter.origin;
  var channel=e&&e.parameter&&e.parameter.channel;
  if(!origin||allowed.indexOf(origin)===-1||!/^https?:\/\/[^/]+$/.test(origin)||!/^[a-zA-Z0-9-]{16,80}$/.test(channel||'')) {
    return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><p>Open this service through the authorized Behavioral Lab website.</p>');
  }
  var t=HtmlService.createTemplateFromFile('Bridge');
  t.allowedOrigin=JSON.stringify(origin);t.channel=JSON.stringify(channel);
  return t.evaluate().setTitle('Behavioral Lab connection').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitRecord(record) {
  var props=PropertiesService.getScriptProperties(),studyId=props.getProperty('STUDY_ID');
  if(!studyId||!props.getProperty('SPREADSHEET_ID'))return fail_('تنظیمات سامانهٔ کلاس کامل نشده است.',false);
  // Limit payload before accessing Sheets. No raw personal data is logged.
  try {if(JSON.stringify(record).length>24000)return fail_('حجم درخواست بیشتر از حد مجاز است.',false);}catch(_){return fail_('درخواست نامعتبر است.',false);}
  var error=LabCore.validateSubmission(record,true,studyId);if(error)return fail_(error,false);
  var p=LabCore.cleanParticipant(record.participant);record.participant=p;
  var hash=hashCode_(p.code);
  if(!validCode_(hash))return fail_('کد فعالیت معتبر نیست. کد دریافتی از مدرس را بررسی کنید.',false);
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1500))return fail_('سامانه در حال ثبت پاسخ‌های دیگر است. کمی بعد دوباره تلاش کنید.',true);
  try {
    var ss=SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
    var sheet=ss.getSheetByName('Responses');if(!sheet)return fail_('شیت پاسخ‌ها آماده نشده است؛ به مدرس اطلاع دهید.',false);
    var rows=readRows_(sheet);
    var duplicate=rows.find(function(r){return r[0]===record.id||r[4]===hash;});
    if(duplicate) {
      if(duplicate[0]===record.id&&duplicate[4]===hash&&duplicate[2]===studyId&&duplicate[3]===LabData.version) {
        // The original snapshot is immutable; a retry must not alter it.
        if(duplicate[11]!==JSON.stringify(record.answers)||duplicate[6]!==p.studentId)return fail_('برای این شناسه، پاسخ متفاوتی قبلاً ثبت شده است.',false);
        return {ok:true,id:record.id,receivedAt:String(duplicate[1]),duplicate:true,aggregate:aggregate_(rows,studyId,true)};
      }
      return fail_('این کد قبلاً یک پاسخ نهایی دارد. برای بازیابی یا اصلاح، با مدرس هماهنگ کنید.',false);
    }
    // Idempotent retries remain possible after closure; new responses do not.
    if(props.getProperty('OPEN')!=='true')return fail_('زمان ثبت پاسخ‌ها پایان یافته است. با مدرس هماهنگ کنید.',false);
    var now=Date.now(),start=Date.parse(props.getProperty('START_AT')||''),end=Date.parse(props.getProperty('END_AT')||'');
    if(Number.isFinite(start)&&now<start)return fail_('فعالیت هنوز شروع نشده است.',false);
    if(Number.isFinite(end)&&now>end)return fail_('مهلت ثبت پاسخ‌ها پایان یافته است.',false);
    if(rows.filter(function(r){return r[2]===studyId;}).length>=Number(props.getProperty('MAX_RESPONSES')||150))return fail_('ظرفیت ثبت این فعالیت تکمیل شده است. با مدرس هماهنگ کنید.',false);
    if(rows.some(function(r){return r[2]===studyId&&r[6]===p.studentId;}))return fail_('برای این شمارهٔ دانشجویی قبلاً پاسخ ثبت شده است.',false);
    // Global server-side write budget; client controls are never trusted.
    var cache=CacheService.getScriptCache(),minute=Math.floor(now/60000),budgetKey='writes:'+studyId+':'+minute,count=Number(cache.get(budgetKey)||0);
    if(count>=180)return fail_('تعداد ثبت‌ها در این دقیقه زیاد است؛ کمی بعد دوباره تلاش کنید.',true);
    var receivedAt=new Date().toISOString();
    var timing={};LabData.questions.forEach(function(q){var t=record.timings&&record.timings[q.id];if(typeof t==='number'&&Number.isFinite(t))timing[q.id]=Math.max(0,Math.min(3600000,Math.round(t)));});
    var row=[record.id,receivedAt,studyId,LabData.version,hash,safeText_(p.name),p.studentId,p.read,record.startedAt,String(record.completedAt||''),JSON.stringify(record.order),JSON.stringify(record.answers),JSON.stringify(timing)];
    row=row.concat(LabData.questions.map(function(q){return record.answers[q.id];}),LabData.experiments.map(function(e){return LabCore.analyze(e.id,LabCore.withAnchor(record)).key;}));
    // All untrusted text cells are escaped against spreadsheet formula injection.
    sheet.getRange(sheet.getLastRow()+1,1,1,row.length).setValues([row]);SpreadsheetApp.flush();
    cache.put(budgetKey,String(count+1),120);rows.push(row);
    var summary=aggregate_(rows,studyId,true);
    return {ok:true,id:record.id,receivedAt:receivedAt,duplicate:false,aggregate:summary};
  }catch(error){return fail_('تأیید ثبت دریافت نشد. با همان پاسخ‌ها دوباره تلاش کنید؛ شناسهٔ یکسان از ثبت تکراری جلوگیری می‌کند.',true);}
  finally{lock.releaseLock();}
}

function readAggregate(request) {
  var props=PropertiesService.getScriptProperties(),studyId=props.getProperty('STUDY_ID');
  if(!request||request.studyId!==studyId||!/^[a-zA-Z0-9-]{16,80}$/.test(request.id||''))return fail_('درخواست آمار معتبر نیست.',false);
  var code=LabCore.digits(request.code).toUpperCase();if(!/^[A-Z0-9-]{8,64}$/.test(code))return fail_('کد فعالیت نامعتبر است.',false);
  var hash=hashCode_(code);if(!validCode_(hash))return fail_('کد فعالیت معتبر نیست.',false);
  var cache=CacheService.getScriptCache(),rateKey='read:'+hash;
  if(cache.get(rateKey))return fail_('برای دریافت دوبارهٔ آمار، یک دقیقه فاصله بگذارید.',false);
  // Check the receipt before returning a cached aggregate; no pre-test peeking.
  try{
    var sheet=SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID')).getSheetByName('Responses');
    var rows=readRows_(sheet);
    if(!rows.some(function(r){return r[0]===request.id&&r[4]===hash&&r[2]===studyId&&r[3]===LabData.version;}))return fail_('برای دیدن آمار، ابتدا پاسخ نهایی خود را ثبت کنید.',false);
    cache.put(rateKey,'1',55);
    return {ok:true,aggregate:aggregate_(rows,studyId,false)};
  }catch(_){return fail_('دریافت آمار ممکن نشد. کمی بعد دوباره تلاش کنید.',true);}
}

function fail_(message,retryable){return {ok:false,error:message,retryable:retryable};}
function hashCode_(code){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,code,Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
function validCode_(hash){
  var props=PropertiesService.getScriptProperties(),cache=CacheService.getScriptCache(),key='codes:'+props.getProperty('STUDY_ID'),known=cache.get(key);
  if(!known){var sheet=SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID')).getSheetByName('Participants');if(!sheet)return false;known=JSON.stringify(readRows_(sheet).map(function(r){return r[1];}));cache.put(key,known,300);}
  return JSON.parse(known).indexOf(hash)!==-1;
}
function readRows_(sheet){if(!sheet||sheet.getLastRow()<2)return [];return sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getDisplayValues();}
function safeText_(text){var s=String(text);return /^[\s]*[=+\-@\t\r\n]/.test(s)?"'"+s:s;}
function aggregate_(rows,studyId,fresh){
  var cache=CacheService.getScriptCache(),key='aggregate:'+studyId+':'+LabData.version;
  if(!fresh){var cached=cache.get(key);if(cached)return JSON.parse(cached);}
  var records=[];rows.forEach(function(r){if(r[2]!==studyId||r[3]!==LabData.version)return;try{var a=JSON.parse(r[11]);if(LabData.questions.every(function(q){return LabCore.validAnswer(q,a[q.id]);}))records.push({answers:a,participant:{studentId:r[6]}});}catch(_){} });
  var summary=LabCore.summarize(records,5);cache.put(key,JSON.stringify(summary),30);return summary;
}

// Run once from the Apps Script editor after setting Script Properties.
// It does not delete or replace existing data.
function setupLab_(){
  var p=PropertiesService.getScriptProperties();
  if(!p.getProperty('SPREADSHEET_ID')||!p.getProperty('STUDY_ID')||!p.getProperty('ALLOWED_ORIGINS'))throw new Error('Set SPREADSHEET_ID, STUDY_ID and ALLOWED_ORIGINS first.');
  var ss=SpreadsheetApp.openById(p.getProperty('SPREADSHEET_ID'));
  var responseHeaders=RESPONSE_HEADERS_.concat(LabData.questions.map(function(q){return q.id;}),LabData.experiments.map(function(e){return 'pattern_'+e.id;}));
  [['Responses',responseHeaders],['Participants',CODE_HEADERS_]].forEach(function(item){var s=ss.getSheetByName(item[0])||ss.insertSheet(item[0]);if(s.getMaxColumns()<item[1].length)s.insertColumnsAfter(s.getMaxColumns(),item[1].length-s.getMaxColumns());if(s.getLastRow()===0)s.appendRow(item[1]);s.setFrozenRows(1);s.getRange(1,1,1,item[1].length).setFontWeight('bold').setBackground('#e2edbf');});
  // Preserve IDs as strings, including leading zeros.
  ss.getSheetByName('Responses').getRange('G:G').setNumberFormat('@');
  if(!p.getProperty('OPEN'))p.setProperty('OPEN','false');
  if(!p.getProperty('MAX_RESPONSES'))p.setProperty('MAX_RESPONSES','150');
  console.log('Setup finished. Use createParticipantCodes_ to issue codes.');
}

// Run once to create 120 random, private codes. Existing code rows are preserved.
// Distribute one row to each student; never publish this Sheet or the code list.
function createParticipantCodes_(){
  var p=PropertiesService.getScriptProperties(),ss=SpreadsheetApp.openById(p.getProperty('SPREADSHEET_ID')),sheet=ss.getSheetByName('Participants');
  if(!sheet)throw new Error('Run setupLab_ first.');
  if(sheet.getLastRow()>1)throw new Error('Codes already exist. Existing codes have been preserved.');
  var rows=[];for(var i=0;i<120;i++){var code='LAB-'+Utilities.getUuid().replace(/-/g,'').slice(0,16).toUpperCase();rows.push([code,hashCode_(code),new Date().toISOString(),'']);}
  sheet.getRange(2,1,rows.length,4).setValues(rows);
  CacheService.getScriptCache().remove('codes:'+p.getProperty('STUDY_ID'));
}

// After manually deleting a response or changing private codes, run this helper.
function clearLabCache_(){var p=PropertiesService.getScriptProperties();CacheService.getScriptCache().removeAll(['codes:'+p.getProperty('STUDY_ID'),'aggregate:'+p.getProperty('STUDY_ID')+':'+LabData.version]);}
