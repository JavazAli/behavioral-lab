(function () {
  'use strict';
  var D=window.LabData,C=window.LabCore,config=window.LAB_CONFIG;
  var main=document.getElementById('main'),live=!!config.endpoint,storageKey='behavioral-lab:'+config.studyId+':'+(live?'live':'demo');
  var state=null,storageOK=true,submitting=false,aggregate=null,refreshAt=0,toastTimer,recoveryIssue='',storedRaw=null;
  var transport=live?new window.LabTransport(config.endpoint):null;
  var fa=new Intl.NumberFormat('fa-IR',{maximumFractionDigits:1});
  var questionMap=Object.fromEntries(D.questions.map(function(q){return [q.id,q];}));
  var experimentMap=Object.fromEntries(D.experiments.map(function(e){return [e.id,e];}));
  function n(v){return fa.format(v);}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch(_){storageOK=false;showStorageWarning();}}
  function showStorageWarning(){if(!document.getElementById('storage-warning'))main.insertAdjacentHTML('afterbegin','<div id="storage-warning" class="container notice error storage-warning" role="alert">ذخیرهٔ محلی مرورگر در دسترس نیست. تا پایان و دریافت تأیید ثبت، این صفحه را نبندید.</div>');}
  function isObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
  function validTime(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(value)&&Number.isFinite(Date.parse(value));}
  function validReceipt(receipt,record){return isObject(receipt)&&receipt.id===record.id&&validTime(receipt.receivedAt);}
  function confirmed(){return !!state&&state.confirmed===true;}
  // completedAt is already persisted before the first request. Until acknowledged,
  // it also marks an immutable request that may already have reached Sheets.
  function pendingSubmission(){return !!state&&!confirmed()&&state.record.completedAt!=null;}
  function usableAggregate(value){return isObject(value)&&Number.isInteger(value.n)&&value.n>=0&&typeof value.withheld==='boolean'&&(value.withheld||(isObject(value.questions)&&isObject(value.experiments)&&D.questions.every(function(q){return isObject(value.questions[q.id]);})&&D.experiments.every(function(e){return isObject(value.experiments[e.id]);})));}
  function restore(raw){
    if(raw==null||raw==='null')return null;
    var value=JSON.parse(raw),record=value&&value.record;
    if(!isObject(value)||!isObject(record)||record.studyId!==config.studyId||record.version!==D.version||!isObject(record.participant)||!isObject(record.answers)||Object.keys(record.answers).some(function(id){return !Object.prototype.hasOwnProperty.call(questionMap,id);})||!Array.isArray(record.order)||record.order.length!==D.questions.length||new Set(record.order).size!==D.questions.length||record.order.some(function(id){return typeof id!=='string'||!Object.prototype.hasOwnProperty.call(questionMap,id);})||!/^[a-zA-Z0-9-]{16,80}$/.test(record.id||'')||!validTime(record.startedAt))throw new Error('saved-state');
    var complete=!C.validateSubmission(record,live,config.studyId);
    if(value.confirmed===true&&complete&&validReceipt(value.receipt,record))return value;
    if(value.confirmed===true||value.receipt!=null||record.completedAt!=null){
      // A missing/corrupt receipt is not an acknowledgement. Retry the same complete
      // snapshot instead of creating another record or reopening its answers.
      if(!complete||!validTime(record.completedAt))throw new Error('saved-submission');
      value.confirmed=false;return value;
    }
    if(value.confirmed!=null&&value.confirmed!==false)throw new Error('saved-confirmation');
    value.confirmed=false;
    record.participant=C.cleanParticipant(record.participant);
    if(!isObject(record.timings))record.timings={};
    value.index=Number.isInteger(value.index)?Math.max(0,Math.min(value.flowVersion===2?9:D.questions.length-1,value.index)):0;
    return value;
  }
  try{storedRaw=localStorage.getItem(storageKey);}catch(_){storageOK=false;}
  if(storedRaw!=null){try{state=restore(storedRaw);if(confirmed()&&usableAggregate(state.aggregate))aggregate=state.aggregate;}catch(_){recoveryIssue='اطلاعات ذخیره‌شدهٔ این مرورگر کامل یا سازگار نیست. نسخهٔ ذخیره‌شده را دریافت کن و برای بازیابی با مدرس هماهنگ کن؛ داده‌ها پاک نشده‌اند.';}}
  function downloadSaved(){var blob=new Blob([storedRaw||JSON.stringify(state,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='saved-choices.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);}
  function recovery(){setPage('<section class="entry container"><h1>بازیابی اطلاعات</h1><p role="alert">'+esc(recoveryIssue)+'</p><button id="download-saved" class="btn btn-primary">دریافت اطلاعات ذخیره‌شده ↓</button><button id="retry-restore" class="quiet-button">بارگذاری دوباره</button></section>');document.getElementById('download-saved').addEventListener('click',downloadSaved);document.getElementById('retry-restore').addEventListener('click',function(){location.reload();});}
  // A random browser token replaces instructor-issued codes. It is not a fingerprint.
  function browserToken(){
    var key='behavioral-lab:'+config.studyId+':browser-token',token;
    try{token=localStorage.getItem(key);}catch(_){}
    if(!/^[A-Z0-9-]{8,64}$/.test(token||'')){
      token=state&&state.record.participant&&state.record.participant.code;
      if(!/^[A-Z0-9-]{8,64}$/.test(token||'')||token.indexOf('DEMO-')===0)token='OPEN-'+crypto.randomUUID().toUpperCase();
      try{localStorage.setItem(key,token);}catch(_){}
    }
    return token;
  }
  browserToken();
  function answeredCount(){return state?D.questions.filter(function(q){return C.validAnswer(q,state.record.answers[q.id]);}).length:0;}
  function modeNotice(){return live?'':'<div class="notice demo"><strong>نسخهٔ آزمایشی</strong> — پاسخ‌ها فقط روی همین دستگاه ذخیره می‌شوند و به مدرس ارسال نمی‌شوند. آمار ساختگی به‌عنوان نتیجهٔ کلاس نمایش داده نمی‌شود.</div>';}
  function modeLine(){return '<div class="mode-note"><span class="mode-dot '+(live?'live':'')+'"></span>'+(live?'ثبت پاسخ در سامانهٔ کلاس':'حالت آزمایشی · ذخیره فقط روی این دستگاه')+'</div>';}
  function toast(message){var box=document.getElementById('toast');box.textContent=message;box.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){box.classList.remove('show');},3500);}
  function navigate(route){if(location.hash==='#'+route)render();else location.hash=route;}
  function setPage(html,nav){main.innerHTML=html;document.querySelectorAll('[data-nav]').forEach(function(a){a.classList.toggle('active',a.dataset.nav===nav);});if(!storageOK)showStorageWarning();}
  function focusMain(){main.focus({preventScroll:true});window.scrollTo(0,0);}
  function art(){return '<svg class="choice-icon" viewBox="0 0 80 80" aria-hidden="true"><g transform="rotate(-12 40 40)"><rect x="14" y="14" width="22" height="22" rx="4" fill="#183f35"/><rect x="44" y="14" width="22" height="22" rx="4" fill="#183f35"/><rect x="44" y="44" width="22" height="22" rx="4" fill="#cf683d"/></g></svg>';}
  function home(){
    document.body.dataset.page='home';
    setPage('<section class="landing">'+art()+'<h1>آزمایشگاه انتخاب</h1><a class="btn btn-primary" href="#/start">'+(state?(state.confirmed?'دیدن تحلیل':'ادامهٔ تجربه'):'شروع')+' <span aria-hidden="true">←</span></a><span class="landing-meta">آزمایش‌های اقتصاد رفتاری</span></section>');
  }

  function start(){
    if(state&&(state.confirmed||!C.validateParticipant(state.record.participant,live))){navigate(state.confirmed?'/results':'/question/'+(state.index||0));return;}
    setPage('<section class="entry container"><a class="back-link" href="#/">→ برگشت</a><div class="eyebrow">قبل از اولین انتخاب</div><h1>اطلاعات دانشجو</h1><p class="muted">موقعیت‌ها فرضی‌اند. هر شمارهٔ دانشجویی فقط یک بار ثبت می‌شود.</p>'+modeNotice()+'<form id="participant-form" novalidate><div class="form-grid"><div class="field"><label for="full-name">نام و نام خانوادگی</label><input id="full-name" name="name" autocomplete="name" maxlength="100" required></div><div class="field"><label for="student-id">شمارهٔ دانشجویی</label><input id="student-id" name="studentId" inputmode="numeric" dir="ltr" minlength="9" maxlength="9" required aria-describedby="student-id-help"><small id="student-id-help">دقیقاً ۹ رقم؛ ارقام فارسی هم پذیرفته می‌شوند.</small></div>'+'<fieldset class="field full"><legend>جزوه را قبلاً خوانده‌ای؟</legend><div class="radio-inline"><label><input type="radio" name="read" value="no"> نه</label><label><input type="radio" name="read" value="yes"> بله</label></div></fieldset></div><p id="form-error" class="form-error" role="alert"></p><button class="btn btn-primary" type="submit">بریم ←</button></form></section>');
    if(state){document.getElementById('full-name').value=state.record.participant.name;document.getElementById('student-id').value=state.record.participant.studentId;}
    document.getElementById('participant-form').addEventListener('submit',function(event){event.preventDefault();var f=event.currentTarget;var values=new FormData(f);var participant=C.cleanParticipant({name:values.get('name'),studentId:values.get('studentId'),code:live?browserToken():'DEMO-'+crypto.randomUUID(),read:values.get('read')});var error=C.validateParticipant(participant,live);if(error){document.getElementById('form-error').textContent=error;return;}if(state){state.record.participant=participant;}else state={record:{id:crypto.randomUUID(),studyId:config.studyId,version:D.version,participant:participant,startedAt:new Date().toISOString(),order:D.questions.map(function(q){return q.id;}),answers:{},timings:{}},index:0,flowVersion:2,confirmed:false,mode:live?'live':'demo'};save();navigate('/question/'+(state.index||0));});
  }
  // A UI-only grouping: question IDs and the server's submission schema stay compatible.
  if(state&&!state.confirmed&&!pendingSubmission()&&state.flowVersion!==2){
    var oldId=state.record.order[state.index||0];
    state.index=Math.max(0,D.experiments.findIndex(function(e){return e.questions.some(function(q){return q.id===oldId;});}));
    state.record.order=D.questions.map(function(q){return q.id;});state.flowVersion=2;save();
  }
  function inputHtml(q, i){
    var a=state.record.answers[q.id],valid=C.validAnswer(q,a);
    var control=q.type==='choice'?'<div class="options">'+q.options.map(function(o){return '<label class="option"><input type="radio" name="'+q.id+'" value="'+o.value+'" '+(a===o.value?'checked':'')+'><span class="option-circle"></span><span><strong>'+esc(o.label)+'</strong>'+(o.detail?'<small>'+esc(o.detail)+'</small>':'')+'</span><span class="tick" aria-hidden="true">✓</span></label>';}).join('')+'</div>':'<div class="number-wrap"><input id="'+q.id+'" name="'+q.id+'" type="text" inputmode="numeric" autocomplete="off" maxlength="4" value="'+(valid?esc(a):'')+'" placeholder="—" aria-label="پاسخ عددی به موقعیت '+n(i+1)+'" aria-describedby="help-'+q.id+'"><span>'+esc(q.unit)+'</span></div><small id="help-'+q.id+'" class="number-help">از '+n(q.min)+' تا '+n(q.max)+'</small>';
    return '<fieldset class="question-panel"><legend class="question-kicker">موقعیت '+n(i+1)+'</legend><h2>'+esc(q.prompt)+'</h2>'+(q.id==='anchor_accept'?'<p class="anchor-offer">پیشنهاد: <b>'+n(Math.max(10,Number(state.record.participant.studentId.slice(-2))))+' هزار تومان</b></p>':'')+(q.note?'<p class="question-note">'+esc(q.note)+'</p>':'')+control+'</fieldset>';
  }
  function question(index){
    if(!state){navigate('/start');return;}if(state.confirmed){navigate('/results');return;}
    if(C.validateParticipant(state.record.participant,live)){navigate('/start');return;}
    index=Math.max(0,Math.min(9,Number.isInteger(index)?index:0));state.index=index;save();
    var e=D.experiments[index],entered=Date.now();
    setPage('<section class="container experiment"><div class="step-top"><a href="#/" aria-label="ذخیره و خروج">→</a><span>آزمایش '+n(index+1)+' <span class="muted">/ ۱۰</span></span><span class="save-label" id="save-label">'+(storageOK?'ذخیرهٔ خودکار':'ذخیرهٔ محلی در دسترس نیست')+'</span></div><div class="lab-progress" role="progressbar" aria-label="تعداد پاسخ‌ها" aria-valuemin="0" aria-valuemax="20" aria-valuenow="'+answeredCount()+'"><span style="width:'+answeredCount()/20*100+'%"></span></div><h1 class="step-heading">انتخاب تو؟</h1><form id="question-form" novalidate><div class="question-pair '+(e.questions.length===1?'single':'')+'">'+e.questions.map(inputHtml).join('')+'</div><p id="question-error" class="form-error" role="alert"></p><div class="question-buttons"><button id="previous" class="quiet-button" type="button">→ قبلی</button><button class="btn btn-primary" type="submit">'+(index===9?'مرور و ثبت':'بعدی')+' ←</button></div></form><nav class="step-dots" aria-label="مراحل">'+D.experiments.map(function(ex,i){var done=ex.questions.every(function(q){return C.validAnswer(q,state.record.answers[q.id]);});return '<button type="button" data-go="'+i+'" aria-label="آزمایش '+n(i+1)+'" '+(index===i?'aria-current="step"':'')+' class="'+(done?'done':'')+'"></button>';}).join('')+'</nav></section>');
    var form=document.getElementById('question-form');
    form.addEventListener('input',function(ev){var q=questionMap[ev.target.name];if(!q)return;var raw=ev.target.value,value=q.type==='choice'?raw:(/^\d+$/.test(C.digits(raw))?Number(C.digits(raw)):null);if(C.validAnswer(q,value))state.record.answers[q.id]=value;else delete state.record.answers[q.id];save();document.getElementById('question-error').textContent='';document.getElementById('save-label').textContent=storageOK?'ذخیره شد':'ذخیرهٔ محلی در دسترس نیست';var p=document.querySelector('.lab-progress');p.setAttribute('aria-valuenow',answeredCount());p.firstElementChild.style.width=answeredCount()/20*100+'%';});
    function recordTime(){var elapsed=Math.min(3600000,Date.now()-entered);e.questions.forEach(function(q){state.record.timings[q.id]=(state.record.timings[q.id]||0)+elapsed;});save();}
    form.addEventListener('submit',function(ev){ev.preventDefault();var missing=e.questions.find(function(q){return !C.validAnswer(q,state.record.answers[q.id]);});if(missing){document.getElementById('question-error').textContent='همهٔ موقعیت‌های این مرحله را پاسخ بده؛ عددها باید صحیح و در محدوده باشند.';var input=form.querySelector('[name="'+missing.id+'"]');if(input)input.focus();return;}recordTime();navigate(index===9?'/review':'/question/'+(index+1));});
    document.getElementById('previous').addEventListener('click',function(){recordTime();navigate(index===0?'/':'/question/'+(index-1));});
    document.querySelectorAll('[data-go]').forEach(function(b){b.addEventListener('click',function(){recordTime();navigate('/question/'+b.dataset.go);});});
  }

  function answerLabel(q,a){if(q.type==='number')return n(a)+' '+q.unit;var o=q.options.find(function(o){return o.value===a;});return o?o.label:'بدون پاسخ';}
  function review(){
    if(!state){navigate('/start');return;}if(state.confirmed){navigate('/results');return;}
    setPage('<section class="container review-layout"><div class="eyebrow">آخرین نگاه</div><h1>همین‌ها انتخاب توست؟</h1><p class="muted">'+(pendingSubmission()?'تأیید ثبت هنوز دریافت نشده است. برای بازیابی تأیید، همین پاسخ‌های نهایی را دوباره ارسال کن؛ شناسه و داده‌ها ثابت می‌مانند.':'می‌توانی قبل از ثبت، تغییرشان بدهی.')+'</p>'+modeNotice()+'<div class="review-list">'+D.experiments.map(function(e,i){return '<div class="review-row"><span class="review-num">'+n(i+1)+'</span><div>'+e.questions.map(function(q){return '<p>'+esc(C.validAnswer(q,state.record.answers[q.id])?answerLabel(q,state.record.answers[q.id]):'بدون پاسخ')+'</p>';}).join('')+'</div><button class="quiet-button" data-edit="'+i+'" '+(pendingSubmission()?'disabled':'')+'>ویرایش</button></div>';}).join('')+'</div><div class="submit-area"><p class="muted">'+n(answeredCount())+' از ۲۰ انتخاب</p><button id="submit-all" class="btn btn-primary" '+(answeredCount()<20?'disabled':'')+'>'+(pendingSubmission()?'تلاش دوباره برای دریافت تأیید':'ثبت و کشف ماجرا ←')+'</button><div id="submit-status" role="status" aria-live="polite"></div></div></section>');
    document.querySelectorAll('[data-edit]').forEach(function(b){b.addEventListener('click',function(){if(!pendingSubmission()&&!submitting)navigate('/question/'+b.dataset.edit);});});document.getElementById('submit-all').addEventListener('click',submit);
  }

  async function submit(){
    if(confirmed()){render();return;}if(submitting)return;if(!state||recoveryIssue){render();return;}if(C.validateParticipant(state.record.participant,live)){navigate('/start');return;}var error=C.validateSubmission(state.record,live,config.studyId);if(error){toast(error);return;}
    submitting=true;var button=document.getElementById('submit-all'),status=document.getElementById('submit-status');document.querySelectorAll('[data-edit]').forEach(function(b){b.disabled=true;});button.disabled=true;button.innerHTML='<span class="spinner" aria-hidden="true"></span> '+(live?'در حال دریافت تأیید ثبت…':'در حال آماده‌سازی گزارش…');
    var wasPending=pendingSubmission();state.record.completedAt=state.record.completedAt||new Date().toISOString();save();
    var payload=JSON.parse(JSON.stringify(state.record));
    try{
      var result;
      if(live){
        await new Promise(function(resolve){setTimeout(resolve,Math.random()*2500);});
        for(var attempt=0;attempt<5;attempt++){
          try{result=await transport.call('submit',payload);if(result.ok!==true||!validReceipt(result,payload)){var ackError=new Error('تأیید معتبر ثبت دریافت نشد. با همین پاسخ‌ها دوباره تلاش کن.');ackError.retryable=true;throw ackError;}break;}catch(err){if(err.retryable!==false)wasPending=true;if(!err.retryable||attempt===4)throw err;status.className='submit-status notice';status.textContent='سرویس شلوغ یا ارتباط ناپایدار است. تلاش مجدد '+n(attempt+1)+' از ۴؛ پاسخ‌ها حفظ شده‌اند.';await new Promise(function(resolve){setTimeout(resolve,2000*Math.pow(2,attempt)+Math.random()*3000);});}
        }
        aggregate=usableAggregate(result.aggregate)?result.aggregate:null;state.receipt={receivedAt:result.receivedAt,id:result.id};
      }else{aggregate=null;state.receipt={receivedAt:new Date().toISOString(),id:state.record.id};}
      state.confirmed=true;state.aggregate=aggregate;save();navigate('/results');
    }catch(err){if(err.retryable===false&&!wasPending){delete state.record.completedAt;save();}submitting=false;render();var failure=document.getElementById('submit-status');if(failure){failure.className='submit-status notice error';failure.textContent=err.message;}else toast(err.message);}
    finally{submitting=false;}
  }
  function miniBars(rows,max,unit){
    max=max||100;unit=unit===undefined?'٪':unit;
    return '<div class="insight-bars">'+rows.map(function(row){var value=Number(row.value)||0;return '<div class="compare-bar"><div class="bar-label"><span>'+esc(row.label)+'</span><strong>'+n(value)+unit+'</strong></div><div class="bar-track"><div class="bar-fill" style="width:'+Math.max(0,Math.min(100,value/max*100))+'%"></div></div></div>';}).join('')+'</div>';
  }
  function pct(qid,value){var q=aggregate.questions[qid];return q&&q.n?(q.counts[value]||0)/q.n*100:0;}
  function comparisonText(diff,subject,unit){return subject+(Math.abs(diff)<0.00001?' برابر بود.':' '+n(Math.abs(diff))+' '+unit+' '+(diff>0?'بیشتر':'کمتر')+' بود.');}
  function pairChart(id){
    var rows,caption,diff,subject,unit='واحد درصد';
    switch(id){
      case 'saving':rows=[{label:'خرید ماگ',value:aggregate.questions.saving_mug.mean},{label:'خرید لپ‌تاپ',value:aggregate.questions.saving_laptop.mean}];caption='میانگین تمایل به پیاده‌روی · از ۱۰۰';diff=rows[0].value-rows[1].value;subject='تمایل کلاس برای ماگ نسبت به لپ‌تاپ';unit='واحد';break;
      case 'subscription':rows=[{label:'با طعمهٔ «فقط چاپی»',value:pct('subscription_three','bundle')},{label:'بدون طعمه',value:pct('subscription_two','bundle')}];caption='سهم انتخابِ بستهٔ چاپی + اینترنتی';diff=rows[0].value-rows[1].value;subject='سهم انتخاب بسته با حضور طعمه';break;
      case 'reflection':rows=[{label:'در سود',value:pct('gain','risky')},{label:'در زیان',value:pct('loss','risky')}];caption='سهم انتخاب گزینهٔ احتمالی';diff=rows[1].value-rows[0].value;subject='ریسک‌پذیری کلاس در زیان نسبت به سود';break;
      case 'time':rows=[{label:'بین امروز و یک سال بعد',value:pct('time_now','late')},{label:'بین سه و چهار سال بعد',value:pct('time_future','late')}];caption='سهم انتخابِ ۱۳۰ دلارِ دیرتر';diff=rows[1].value-rows[0].value;subject='تمایل کلاس به صبر در آینده نسبت به اکنون';break;
      case 'certainty':rows=[{label:'در برابر ۱۰۰ میلیون قطعی',value:pct('certainty_high','large')},{label:'پس از حذف قطعیت',value:pct('certainty_low','large')}];caption='سهم انتخابِ شانس ۱۱۰ میلیون';diff=rows[1].value-rows[0].value;subject='سهم انتخاب مبلغ بزرگ‌تر پس از حذف قطعیت';break;
      case 'ticket':rows=[{label:'اسکناس گم شده',value:pct('ticket_cash','yes')},{label:'بلیت گم شده',value:pct('ticket_lost','yes')}];caption='سهم خریدِ بلیت تازه';diff=rows[0].value-rows[1].value;subject='سهم خرید بلیت پس از گم‌شدن پول نسبت به بلیت';break;
      case 'framing':rows=[{label:'بیانِ نجات',value:pct('frame_saved','sure')},{label:'بیانِ مرگ',value:pct('frame_died','sure')}];caption='سهم انتخابِ گزینهٔ قطعی';diff=rows[0].value-rows[1].value;subject='سهم انتخاب قطعی در بیان نجات نسبت به مرگ';break;
      case 'consistency':var g=aggregate.experiments.consistency;rows=[{label:'رتبه‌بندی سازگار',value:(g.patterns.transitive?g.patterns.transitive.n:0)/g.n*100},{label:'چرخهٔ ترجیحات',value:(g.patterns.cycle?g.patterns.cycle.n:0)/g.n*100}];caption='سه انتخاب، یک رتبه‌بندی یا یک حلقه';return '<div class="chart-caption">'+caption+'</div>'+miniBars(rows)+'<p class="class-takeaway">'+n(rows[1].value)+'٪ کلاس با سه انتخاب، یک چرخه ساخته‌اند.</p>';
      default:return '';
    }
    return '<div class="chart-caption">'+caption+'</div>'+miniBars(rows,100,id==='saving'?'':'٪')+'<p class="class-takeaway">'+comparisonText(diff,subject,unit)+'</p>';
  }
  function fairnessChart(answers){
    var bins=aggregate.fairnessBins,stat=aggregate.questions.fairness_min;
    var html='<div class="chart-caption">حداقل سهمِ قابل‌قبول · هزار تومان</div>';
    if(bins){var top=Math.max(1,...bins.map(function(b){return b.n;}));html+='<div class="histogram" role="img" aria-label="توزیع آستانهٔ پذیرش کلاس">'+bins.map(function(b){var mine=answers.fairness_min>=b.range[0]&&answers.fairness_min<=b.range[1];return '<div class="hist-col '+(mine?'is-mine':'')+'"><span>'+n(b.n)+' نفر</span><div class="hist-plot"><i style="height:'+b.n/top*100+'%"></i></div><small>'+n(b.range[0])+(b.range[0]===b.range[1]?'':'–'+n(b.range[1]))+'</small>'+(mine?'<em>تو اینجایی</em>':'')+'</div>';}).join('')+'</div>';}
    return html+'<p class="class-takeaway">نصف کلاس، آستانه‌ای تا '+n(stat.median)+' هزار تومان دارد؛ آستانهٔ تو '+n(answers.fairness_min)+' هزار تومان است.</p>';
  }
  function anchorChart(answers){
    var stat=aggregate.anchor||{},r=stat.r,points=stat.points||[];
    var ymax=Math.max(20,Math.ceil(Math.max(answers.anchor_wtp,...points.map(function(p){return p[1];}))/20)*20);
    function x(v){return 54+(v-10)/89*330;}function y(v){return 228-v/ymax*188;}
    var html='<div class="chart-caption">عدد اولیه و قیمت پیشنهادی · هر نقطه یک پاسخ</div><svg class="anchor-chart" viewBox="0 0 420 292" role="img" aria-label="نمودار پراکنش عدد لنگر و قیمت پیشنهادی، خط روند کلاس و پاسخ سبز تو"><defs><clipPath id="anchor-plot-clip"><rect x="54" y="40" width="330" height="188"/></clipPath></defs>';
    [0,.5,1].forEach(function(t){var yy=y(ymax*t);html+='<path d="M54 '+yy+'H384" stroke="#dce3d2" stroke-dasharray="3 4"/><text x="44" y="'+(yy+4)+'" text-anchor="end" font-size="11" fill="#707b66">'+n(ymax*t)+'</text>';});
    html+='<path d="M54 40V228H384" fill="none" stroke="#a7b599"/><g font-size="11" fill="#707b66" text-anchor="middle">';
    [10,30,50,70,99].forEach(function(v){html+='<text x="'+x(v)+'" y="248">'+n(v)+'</text>';});
    html+='<text x="219" y="276">عدد اولیه</text><text x="54" y="21" text-anchor="start">قیمت پیشنهادی · هزار تومان</text></g><g clip-path="url(#anchor-plot-clip)">';
    if(stat.trend)html+='<line x1="'+x(10)+'" y1="'+y(stat.trend.intercept+stat.trend.slope*10)+'" x2="'+x(99)+'" y2="'+y(stat.trend.intercept+stat.trend.slope*99)+'" stroke="#cf683d" stroke-width="2" stroke-dasharray="6 4"/>';
    points.forEach(function(p){html+='<circle cx="'+x(p[0])+'" cy="'+y(p[1])+'" r="4" fill="#879b73" fill-opacity=".55"><title>عدد '+n(p[0])+'، قیمت '+n(p[1])+' هزار تومان</title></circle>';});
    html+='</g><circle cx="'+x(answers.anchor_value)+'" cy="'+y(answers.anchor_wtp)+'" r="6" fill="#315f26" stroke="#fff" stroke-width="2"><title>پاسخ تو</title></circle></svg><div class="chart-legend"><span>● پاسخ‌های کلاس</span><span style="color:#cf683d">– خط روند</span><span class="mine-key">● پاسخ تو</span></div>';
    if(!points.length)html+='<p class="chart-footnote">برای دریافت نقطه‌های کلاس، آمار را تازه‌سازی کن.</p>';
    if(aggregate.anchor)html+='<div class="correlation"><strong dir="ltr">r = '+(r==null?'—':new Intl.NumberFormat('fa-IR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(r))+'</strong><span>'+(r==null?'برای محاسبهٔ همبستگی، عددهای اولیه و قیمت‌ها باید متنوع باشند.':r>0.1?'در کلاس، عدد اولیهٔ بالاتر با قیمت بالاتر همراه است.':r<-.1?'در کلاس، عدد اولیهٔ بالاتر با قیمت پایین‌تر همراه است.':'قیمت‌های کلاس رابطهٔ خطی پررنگی با عدد اولیه ندارند.')+'</span></div>';
    return html;
  }
  function detailDistribution(e,group){
    var html='<details class="history-details"><summary>توزیع کامل پاسخ‌ها</summary><h4>الگوهای ترکیبی</h4>'+miniBars(Object.keys(group.patterns).map(function(k){return {label:C.patternLabel(e.id,k),value:group.patterns[k].n/group.n*100};}));
    e.questions.forEach(function(q){var stat=aggregate.questions[q.id];if(!stat)return;html+='<p>'+esc(q.prompt)+'</p>';if(q.type==='choice')html+=miniBars(q.options.map(function(o){return {label:o.label+(o.detail?' · '+o.detail:''),value:(stat.counts[o.value]||0)/stat.n*100};}));else {html+='<p>میانگین: '+n(stat.mean)+' · میانه: '+n(stat.median)+' '+esc(q.unit)+'</p>';if(stat.histogram)html+=miniBars(stat.histogram.map(function(b){return {label:n(b.range[0])+'–'+n(b.range[1]),value:b.n/stat.n*100};}));}});
    return html+'</details>';
  }
  function groupHtml(e,answers){
    if(!live)return '<section class="group-block"><h3>کلاس چه کرد؟</h3><p>این گزارش آزمایشی است. آمار کلاس پس از ثبت واقعی نمایش داده می‌شود.</p></section>';
    if(!aggregate)return '<section class="group-block"><h3>کلاس چه کرد؟</h3><p>آمار هنوز دریافت نشده؛ تازه‌سازی آمار را بزن.</p></section>';
    if(aggregate.withheld)return '<section class="group-block"><h3>کلاس چه کرد؟</h3><p>'+n(aggregate.n)+' پاسخ ثبت شده؛ نمودارها از '+n(aggregate.minPublish)+' پاسخ نمایش داده می‌شوند.</p></section>';
    var group=aggregate.experiments&&aggregate.experiments[e.id];if(!group)return '';
    var lesson=C.lessons[e.id],mine=C.analyze(e.id,answers),mineN=group.patterns[mine.key]?group.patterns[mine.key].n:0;
    var html='<section class="group-block"><h3>کلاس چه کرد؟ <span>'+n(group.n)+' پاسخ</span></h3>';
    if(e.id!=='anchor'&&e.id!=='consistency'){
      var targetN=lesson.targetKeys.reduce(function(sum,key){return sum+(group.patterns[key]?group.patterns[key].n:0);},0),targetPct=targetN/group.n*100;
      html+='<div class="signal-stat"><strong>'+n(targetPct)+'٪</strong><span>'+esc(lesson.targetLabel)+'</span></div><p class="class-verdict">'+(targetN>group.n/2?'اکثریت کلاس مطابق انتظار این آزمایش انتخاب کردند.':targetN===group.n/2?'کلاس دقیقاً دو نیم شده: نیمی مطابق انتظار این آزمایش.':'این الگوی پیش‌بینی‌شده، انتخاب اکثریت کلاس نبود.')+' '+(C.targetMatch(e.id,answers)?'تو در گروهِ همسو با انتظار هستی.':'انتخاب تو در گروهِ دیگر است.')+'</p>';
    }
    html+=e.id==='anchor'?anchorChart(answers):e.id==='fairness'?fairnessChart(answers):pairChart(e.id);
    if(e.id!=='anchor'){
      var entries=Object.entries(group.patterns).sort(function(a,b){return b[1].n-a[1].n;}),top=entries[0],tied=entries.filter(function(p){return p[1].n===top[1].n;});
      html+='<p class="class-position">'+n(mineN/group.n*100)+'٪ کلاس دقیقاً الگوی تو را داشتند.</p><p class="modal-pattern">'+(tied.length>1?'پرتکرارترین الگوها هم‌تعدادند: '+tied.map(function(p){return esc(C.patternLabel(e.id,p[0]));}).join(' / '):(top[1].n>group.n/2?'الگوی اکثریت: ':'پرتکرارترین الگو: ')+esc(C.patternLabel(e.id,top[0])))+' · '+n(top[1].n/group.n*100)+'٪</p>';
    }
    return html+detailDistribution(e,group)+'</section>';
  }
  function classHtml(e,answers){try{return groupHtml(e,answers);}catch(_){return '<section class="group-block"><h3>کلاس چه کرد؟</h3><p>آمار ذخیره‌شده قابل نمایش نیست؛ تازه‌سازی آمار را بزن. تحلیل فردی تو محفوظ است.</p></section>';}}
  var effectNames={saving:'Relative Thinking',subscription:'Decoy Effect',fairness:'Ultimatum Game / Social Preferences',reflection:'Reflection Effect',time:'Present Bias',certainty:'Certainty Effect',consistency:'Transitivity of Preferences',ticket:'Mental Accounting',anchor:'Anchoring Effect',framing:'Framing Effect'};
  function results(){
    if(!state||!state.confirmed){setPage('<section class="entry container"><h1>اول انتخاب، بعد کشف.</h1><a class="btn btn-primary" href="#/start">شروع ←</a></section>');return;}
    var answers=C.withAnchor(state.record);
    var cards=D.experiments.map(function(e,i){var r=C.analyze(e.id,answers),source=D.sources[e.source],lesson=C.lessons[e.id],match=C.targetMatch(e.id,answers);return '<article class="result-card" id="result-'+e.id+'"><div class="result-card-header"><span class="concept">'+esc(lesson.concept)+'</span><span class="result-number">'+n(i+1)+' / ۱۰</span></div><h2>'+esc(lesson.title)+'</h2><p class="insight">'+esc(lesson.problem)+' <span class="effect-english" lang="en" dir="ltr">('+effectNames[e.id]+')</span></p>'+(e.id==='consistency'?'':'<div class="expected-box"><h3>در این آزمایش، انتظار چیست؟</h3><p>'+esc(lesson.expected)+'</p></div>')+'<div class="result-split"><section class="personal-result"><h3>انتخاب تو چه می‌گوید؟</h3><span class="match-chip '+(match===true?'matched':match===false?'different':'')+'">'+(e.id==='consistency'?(r.key==='cycle'?'چرخهٔ ترجیحات':'بدون چرخه'):match===null?'قیمت تو در کنار لنگر':match?'همسو با انتظار آزمایش':'متفاوت از انتظار آزمایش')+'</span><h4 class="finding-title">'+esc(r.title)+'</h4><p>'+esc(r.text)+'</p><details class="answer-details"><summary>انتخاب‌هایت را ببین</summary><div class="your-answers">'+e.questions.map(function(q,j){return '<div class="answer-tile"><small>موقعیت '+n(j+1)+'</small><strong>'+esc(answerLabel(q,answers[q.id]))+'</strong></div>';}).join('')+'</div></details></section>'+classHtml(e,answers)+'</div><details class="history-details"><summary>ایده را بیشتر باز کن +</summary><p>'+esc(lesson.more)+'</p><a class="source-link" href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer" lang="en">'+esc(source.title)+' ↗</a></details></article>';}).join('');
    setPage('<section class="container results"><div class="eyebrow">پشت صحنهٔ انتخاب‌ها</div><h1>انتظارِ نظریه، انتخاب تو، رفتار کلاس.</h1><p class="muted">ببین کدام تغییر کوچک تصمیم‌ها را جابه‌جا کرده و تو کجای الگوی کلاس ایستاده‌ای.</p>'+modeNotice()+'<div class="results-toolbar"><span>'+(live?'✓ ثبت تأیید شد':'گزارش آزمایشی')+' · '+(aggregate?(aggregate.sampleCount?n(aggregate.realCount)+' پاسخ + '+n(aggregate.sampleCount)+' نمونهٔ اولیه':n(aggregate.n)+' پاسخ کلاس'):'آمار کلاس هنوز دریافت نشده')+'</span>'+(live?'<button id="refresh-aggregate" class="quiet-button">تازه‌سازی آمار ↻</button>':'')+'</div><nav class="result-tabs" aria-label="تحلیل آزمایش‌ها">'+D.experiments.map(function(e,i){return '<a href="#result-'+e.id+'" data-scroll="result-'+e.id+'">'+n(i+1)+' · '+esc(C.lessons[e.id].concept)+'</a>';}).join('')+'</nav>'+cards+'<div class="end-actions"><button class="contact-trigger contact-trigger-results" type="button" aria-label="دربارهٔ پروژه و ارتباط" data-contact aria-haspopup="dialog" aria-controls="contact-dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg></button><button id="download-results" class="quiet-button">دریافت پاسخ‌ها ↓</button><button id="print-results" class="quiet-button">چاپ</button></div></section>');
    document.querySelectorAll('[data-scroll]').forEach(function(a){a.addEventListener('click',function(ev){ev.preventDefault();document.getElementById(a.dataset.scroll).scrollIntoView({behavior:'smooth'});});});
    document.getElementById('download-results').addEventListener('click',function(){var blob=new Blob([JSON.stringify({receipt:state.receipt,record:state.record},null,2)],{type:'application/json;charset=utf-8'});var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='my-choices.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);});
    document.getElementById('print-results').addEventListener('click',function(){window.print();});var refresh=document.getElementById('refresh-aggregate');if(refresh)refresh.addEventListener('click',refreshAggregate);
    if(live&&aggregate&&aggregate.reportVersion!==4&&refreshAt===0)refreshAggregate();
  }

  async function refreshAggregate(){
    if(Date.now()<refreshAt){toast('برای تازه‌سازی بعدی '+n(Math.ceil((refreshAt-Date.now())/1000))+' ثانیه صبر کنید.');return;}
    refreshAt=Date.now()+config.refreshSeconds*1000;var b=document.getElementById('refresh-aggregate');if(b){b.disabled=true;b.textContent='در حال دریافت…';}
    try{var result=await transport.call('aggregate',{studyId:config.studyId,id:state.record.id,code:state.record.participant.code});if(!usableAggregate(result.aggregate))throw new Error('آمار معتبر دریافت نشد. تحلیل فردی و رسید ثبت تو محفوظ است.');aggregate=result.aggregate;state.aggregate=aggregate;save();results();toast('آمار کلاس به‌روز شد.');}catch(error){toast(error.message);if(b&&b.isConnected){b.disabled=false;b.textContent='تازه‌سازی آمار ↻';}}
  }
  function guide(){setPage('<section class="container guide-wrap"><a class="back-link" href="#/">→ برگشت</a><h1>از انتخاب تا تحلیل</h1><p>۲۰ پرسش در ۱۰ آزمایش. اول انتخاب کن؛ بعد پیش‌بینی هر ایده، پاسخ خودت و الگوی کلاس را کنار هم ببین.</p><p>پاسخ‌ها در شیت خصوصی مدرس ثبت می‌شوند؛ در گزارش، آمار کلاس بدون نام نمایش داده می‌شود. هر شمارهٔ دانشجویی یک ثبت نهایی دارد.</p><p>پیشرفت روی همین مرورگر ذخیره می‌شود. اگر ارتباط قطع شد، با همان پاسخ‌ها دوباره ثبت را بزن.</p><a class="btn btn-primary" href="#/start">ادامه ←</a></section>');}
  function render(){
    document.body.dataset.page='experience';var hash=location.hash||'#/',route=hash.slice(1);
    // One guard runs before any editable page is rendered, on startup and hashchange.
    if(recoveryIssue){recovery();focusMain();return;}
    if(confirmed()){if(route!=='/results')history.replaceState(null,'','#/results');results();focusMain();return;}
    if(submitting){if(route!=='/review')history.replaceState(null,'','#/review');return;}
    if(pendingSubmission()&&route!=='/review'){history.replaceState(null,'','#/review');route='/review';}
    if(route==='/')home();else if(route==='how'){home();return;}else if(route==='/start')start();else if(/^\/question\/\d+$/.test(route))question(Number(route.split('/')[2]));else if(route==='/review')review();else if(route==='/results')results();else if(route==='/guide')guide();else{navigate('/');return;}
    focusMain();
  }
  window.addEventListener('hashchange',render);
  document.querySelector('.skip').addEventListener('click',function(event){event.preventDefault();main.focus();});
  window.addEventListener('beforeunload',function(event){if(submitting){event.preventDefault();event.returnValue='';}});
  window.addEventListener('storage',function(event){if(event.key===storageKey){if(!submitting&&event.newValue){try{var other=restore(event.newValue);if(other&&other.confirmed===true){state=other;aggregate=usableAggregate(other.aggregate)?other.aggregate:null;recoveryIssue='';render();return;}}catch(_){}}toast('این تجربه در تب دیگری تغییر کرده است. برای جلوگیری از تداخل، فقط در یک تب ادامه دهید.');}});
  // One dialog serves static footer and dynamically rendered results controls.
  var contactDialog=document.getElementById('contact-dialog');
  if(contactDialog){
    window.addEventListener('click',function(event){
      if(event.target.closest('[data-contact]')&&!contactDialog.open)contactDialog.showModal();
    });
    contactDialog.addEventListener('click',function(event){
      if(event.target!==contactDialog)return;
      var bounds=contactDialog.getBoundingClientRect();
      if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)contactDialog.close();
    });
  }
  render();
})();
