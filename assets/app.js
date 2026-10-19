(function () {
  'use strict';
  var D=window.LabData,C=window.LabCore,config=window.LAB_CONFIG;
  var main=document.getElementById('main'),live=!!config.endpoint,storageKey='behavioral-lab:'+config.studyId+':'+(live?'live':'demo');
  var state=null,storageOK=true,submitting=false,aggregate=null,refreshAt=0,toastTimer;
  var transport=live?new window.LabTransport(config.endpoint):null;
  var fa=new Intl.NumberFormat('fa-IR',{maximumFractionDigits:1});
  var questionMap=Object.fromEntries(D.questions.map(function(q){return [q.id,q];}));
  var experimentMap=Object.fromEntries(D.experiments.map(function(e){return [e.id,e];}));
  function n(v){return fa.format(v);}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch(_){storageOK=false;showStorageWarning();}}
  function showStorageWarning(){if(!document.getElementById('storage-warning'))main.insertAdjacentHTML('afterbegin','<div id="storage-warning" class="container notice error storage-warning" role="alert">ذخیرهٔ محلی مرورگر در دسترس نیست. تا پایان و دریافت تأیید ثبت، این صفحه را نبندید.</div>');}
  try{var stored=JSON.parse(localStorage.getItem(storageKey)||'null');if(stored&&stored.record&&stored.record.studyId===config.studyId&&stored.record.version===D.version){var knownOrder=stored.record.order;if(Array.isArray(knownOrder)&&knownOrder.length===D.questions.length&&new Set(knownOrder).size===D.questions.length&&knownOrder.every(function(id){return !!questionMap[id];})&&stored.record.answers&&typeof stored.record.answers==='object'){state=stored;if(state.confirmed&&D.questions.every(function(q){return C.validAnswer(q,state.record.answers[q.id]);}))aggregate=state.aggregate||null;else state.confirmed=false;}}}catch(_){storageOK=false;}
  // A random browser token replaces instructor-issued codes. It is not a fingerprint.
  function browserToken(){
    var key='behavioral-lab:'+config.studyId+':browser-token',token;
    try{token=localStorage.getItem(key);}catch(_){}
    if(!/^[A-Z0-9-]{8,64}$/.test(token||'')){
      token=state&&state.record.participant.code;
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
    if(state&&(state.confirmed||/^\d{9}$/.test(state.record.participant.studentId))){navigate(state.confirmed?'/results':'/question/'+(state.index||0));return;}
    setPage('<section class="entry container"><a class="back-link" href="#/">→ برگشت</a><div class="eyebrow">قبل از اولین انتخاب</div><h1>فقط خودت باش.</h1><p class="muted">موقعیت‌ها فرضی‌اند. هر شمارهٔ دانشجویی فقط یک بار ثبت می‌شود.</p>'+modeNotice()+'<form id="participant-form" novalidate><div class="form-grid"><div class="field"><label for="full-name">نام و نام خانوادگی</label><input id="full-name" name="name" autocomplete="name" maxlength="100" required></div><div class="field"><label for="student-id">شمارهٔ دانشجویی</label><input id="student-id" name="studentId" inputmode="numeric" dir="ltr" minlength="9" maxlength="9" required aria-describedby="student-id-help"><small id="student-id-help">دقیقاً ۹ رقم؛ ارقام فارسی هم پذیرفته می‌شوند.</small></div>'+'<fieldset class="field full"><legend>جزوه را قبلاً خوانده‌ای؟</legend><div class="radio-inline"><label><input type="radio" name="read" value="no"> نه</label><label><input type="radio" name="read" value="yes"> بله</label></div></fieldset></div><p id="form-error" class="form-error" role="alert"></p><button class="btn btn-primary" type="submit">بریم ←</button></form></section>');
    if(state){document.getElementById('full-name').value=state.record.participant.name;document.getElementById('student-id').value=state.record.participant.studentId;}
    document.getElementById('participant-form').addEventListener('submit',function(event){event.preventDefault();var f=event.currentTarget;var values=new FormData(f);var participant=C.cleanParticipant({name:values.get('name'),studentId:values.get('studentId'),code:live?browserToken():'DEMO-'+crypto.randomUUID(),read:values.get('read')});var error=C.validateParticipant(participant,live);if(error){document.getElementById('form-error').textContent=error;return;}if(state){state.record.participant=participant;}else state={record:{id:crypto.randomUUID(),studyId:config.studyId,version:D.version,participant:participant,startedAt:new Date().toISOString(),order:D.questions.map(function(q){return q.id;}),answers:{},timings:{}},index:0,flowVersion:2,confirmed:false,mode:live?'live':'demo'};save();navigate('/question/'+(state.index||0));});
  }
  // A UI-only grouping: question IDs and the server's submission schema stay compatible.
  if(state&&!state.confirmed&&state.flowVersion!==2){
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
    if(!/^\d{9}$/.test(state.record.participant.studentId)){navigate('/start');return;}
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
    setPage('<section class="container review-layout"><div class="eyebrow">آخرین نگاه</div><h1>همین‌ها انتخاب توست؟</h1><p class="muted">می‌توانی قبل از ثبت، تغییرشان بدهی.</p>'+modeNotice()+'<div class="review-list">'+D.experiments.map(function(e,i){return '<div class="review-row"><span class="review-num">'+n(i+1)+'</span><div>'+e.questions.map(function(q){return '<p>'+esc(C.validAnswer(q,state.record.answers[q.id])?answerLabel(q,state.record.answers[q.id]):'بدون پاسخ')+'</p>';}).join('')+'</div><button class="quiet-button" data-edit="'+i+'">ویرایش</button></div>';}).join('')+'</div><div class="submit-area"><p class="muted">'+n(answeredCount())+' از ۲۰ انتخاب</p><button id="submit-all" class="btn btn-primary" '+(answeredCount()<20?'disabled':'')+'>ثبت و کشف ماجرا ←</button><div id="submit-status" role="status" aria-live="polite"></div></div></section>');
    document.querySelectorAll('[data-edit]').forEach(function(b){b.addEventListener('click',function(){navigate('/question/'+b.dataset.edit);});});document.getElementById('submit-all').addEventListener('click',submit);
  }

  async function submit(){
    if(submitting)return;if(!/^\d{9}$/.test(state.record.participant.studentId)){navigate('/start');return;}var error=C.validateSubmission(state.record,live,config.studyId);if(error){toast(error);return;}
    submitting=true;var button=document.getElementById('submit-all'),status=document.getElementById('submit-status');document.querySelectorAll('[data-edit]').forEach(function(b){b.disabled=true;});button.disabled=true;button.innerHTML='<span class="spinner" aria-hidden="true"></span> '+(live?'در حال دریافت تأیید ثبت…':'در حال آماده‌سازی گزارش…');
    state.record.completedAt=state.record.completedAt||new Date().toISOString();save();
    try{
      var result;
      if(live){
        await new Promise(function(resolve){setTimeout(resolve,Math.random()*2500);});
        for(var attempt=0;attempt<5;attempt++){
          try{result=await transport.call('submit',state.record);break;}catch(err){if(!err.retryable||attempt===4)throw err;status.className='submit-status notice';status.textContent='سرویس شلوغ یا ارتباط ناپایدار است. تلاش مجدد '+n(attempt+1)+' از ۴؛ پاسخ‌ها حفظ شده‌اند.';await new Promise(function(resolve){setTimeout(resolve,2000*Math.pow(2,attempt)+Math.random()*3000);});}
        }
        aggregate=result.aggregate;state.receipt={receivedAt:result.receivedAt,id:result.id};
      }else{aggregate=null;state.receipt={receivedAt:new Date().toISOString(),id:state.record.id};}
      state.confirmed=true;state.aggregate=aggregate;save();navigate('/results');
    }catch(err){if(status&&status.isConnected){status.className='submit-status notice error';status.textContent=err.message;button.disabled=false;button.textContent='تلاش دوباره برای ثبت';document.querySelectorAll('[data-edit]').forEach(function(b){b.disabled=false;});}else toast(err.message);}
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
    var groups=aggregate.anchorGroups||[],r=aggregate.anchor&&aggregate.anchor.r;
    var html='<div class="chart-caption">میانگین قیمت پیشنهادی بر حسب عدد اولیه · هزار تومان</div>';
    var max=Math.max(20,answers.anchor_wtp,...groups.map(function(g){return g.mean===null?0:g.mean;}));
    var scale=Math.ceil(max/20)*20;
    html+='<div class="anchor-bars" dir="rtl">';
    groups.forEach(function(g){
      var own=answers.anchor_value>=g.range[0]&&answers.anchor_value<=g.range[1];
      html+='<div class="anchor-row"><div class="anchor-row-label"><span>عدد '+n(g.range[0])+' تا '+n(g.range[1])+'</span><small>'+n(g.n)+' نفر</small></div><div class="anchor-track" dir="ltr">'+(g.mean===null?'':'<span class="anchor-mean" style="width:'+(g.mean/scale*100)+'%"></span>')+(own?'<span class="anchor-mine" style="left:'+Math.min(99,answers.anchor_wtp/scale*100)+'%" title="قیمت تو: '+n(answers.anchor_wtp)+' هزار تومان"></span>':'')+'</div><strong class="anchor-value">'+(g.mean===null?'—':n(g.mean))+'</strong></div>';
    });
    html+='<div class="anchor-scale" dir="ltr"><span>۰</span><span>'+n(scale/2)+'</span><span>'+n(scale)+'</span></div></div><div class="chart-legend"><span>▬ میانگین کلاس</span><span class="mine-key">┃ قیمت تو: '+n(answers.anchor_wtp)+'</span></div>';
    if(groups.some(function(g){return g.mean===null;}))html+='<p class="chart-footnote">میانگین هر گروه از ۵ پاسخ نمایش داده می‌شود.</p>';
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
    var html='<section class="group-block"><h3>کلاس چه کرد؟ <span>'+n(group.n)+' نفر</span></h3>';
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
  var effectNames={saving:'Relative Thinking',subscription:'Decoy Effect',fairness:'Ultimatum Game / Social Preferences',reflection:'Reflection Effect',time:'Present Bias',certainty:'Certainty Effect',consistency:'Transitivity of Preferences',ticket:'Mental Accounting',anchor:'Anchoring Effect',framing:'Framing Effect'};
  function results(){
    if(!state||!state.confirmed){setPage('<section class="entry container"><h1>اول انتخاب، بعد کشف.</h1><a class="btn btn-primary" href="#/start">شروع ←</a></section>');return;}
    var answers=C.withAnchor(state.record);
    var cards=D.experiments.map(function(e,i){var r=C.analyze(e.id,answers),source=D.sources[e.source],lesson=C.lessons[e.id],match=C.targetMatch(e.id,answers);return '<article class="result-card" id="result-'+e.id+'"><div class="result-card-header"><span class="concept">'+esc(lesson.concept)+'</span><span class="result-number">'+n(i+1)+' / ۱۰</span></div><h2>'+esc(lesson.title)+'</h2><p class="insight">'+esc(lesson.problem)+' <span class="effect-english" lang="en" dir="ltr">('+effectNames[e.id]+')</span></p>'+(e.id==='consistency'?'':'<div class="expected-box"><h3>در این آزمایش، انتظار چیست؟</h3><p>'+esc(lesson.expected)+'</p></div>')+'<div class="result-split"><section class="personal-result"><h3>انتخاب تو چه می‌گوید؟</h3><span class="match-chip '+(match===true?'matched':match===false?'different':'')+'">'+(e.id==='consistency'?(r.key==='cycle'?'چرخهٔ ترجیحات':'بدون چرخه'):match===null?'قیمت تو در کنار لنگر':match?'همسو با انتظار آزمایش':'متفاوت از انتظار آزمایش')+'</span><h4 class="finding-title">'+esc(r.title)+'</h4><p>'+esc(r.text)+'</p><details class="answer-details"><summary>انتخاب‌هایت را ببین</summary><div class="your-answers">'+e.questions.map(function(q,j){return '<div class="answer-tile"><small>موقعیت '+n(j+1)+'</small><strong>'+esc(answerLabel(q,answers[q.id]))+'</strong></div>';}).join('')+'</div></details></section>'+groupHtml(e,answers)+'</div><details class="history-details"><summary>ایده را بیشتر باز کن +</summary><p>'+esc(lesson.more)+'</p><a class="source-link" href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer" lang="en">'+esc(source.title)+' ↗</a></details></article>';}).join('');
    setPage('<section class="container results"><div class="eyebrow">پشت صحنهٔ انتخاب‌ها</div><h1>انتظارِ نظریه، انتخاب تو، رفتار کلاس.</h1><p class="muted">ببین کدام تغییر کوچک تصمیم‌ها را جابه‌جا کرده و تو کجای الگوی کلاس ایستاده‌ای.</p>'+modeNotice()+'<div class="results-toolbar"><span>'+(live?'✓ ثبت تأیید شد':'گزارش آزمایشی')+' · '+(aggregate?n(aggregate.n)+' پاسخ کلاس':'آمار کلاس هنوز دریافت نشده')+'</span>'+(live?'<button id="refresh-aggregate" class="quiet-button">تازه‌سازی آمار ↻</button>':'')+'</div><nav class="result-tabs" aria-label="تحلیل آزمایش‌ها">'+D.experiments.map(function(e,i){return '<a href="#result-'+e.id+'" data-scroll="result-'+e.id+'">'+n(i+1)+' · '+esc(C.lessons[e.id].concept)+'</a>';}).join('')+'</nav>'+cards+'<div class="end-actions"><button id="download-results" class="quiet-button">دریافت پاسخ‌ها ↓</button><button id="print-results" class="quiet-button">چاپ</button></div></section>');
    document.querySelectorAll('[data-scroll]').forEach(function(a){a.addEventListener('click',function(ev){ev.preventDefault();document.getElementById(a.dataset.scroll).scrollIntoView({behavior:'smooth'});});});
    document.getElementById('download-results').addEventListener('click',function(){var blob=new Blob([JSON.stringify({receipt:state.receipt,record:state.record},null,2)],{type:'application/json;charset=utf-8'});var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='my-choices.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);});
    document.getElementById('print-results').addEventListener('click',function(){window.print();});var refresh=document.getElementById('refresh-aggregate');if(refresh)refresh.addEventListener('click',refreshAggregate);
    if(live&&aggregate&&aggregate.reportVersion!==2&&refreshAt===0)refreshAggregate();
  }

  async function refreshAggregate(){
    if(Date.now()<refreshAt){toast('برای تازه‌سازی بعدی '+n(Math.ceil((refreshAt-Date.now())/1000))+' ثانیه صبر کنید.');return;}
    refreshAt=Date.now()+config.refreshSeconds*1000;var b=document.getElementById('refresh-aggregate');if(b){b.disabled=true;b.textContent='در حال دریافت…';}
    try{var result=await transport.call('aggregate',{studyId:config.studyId,id:state.record.id,code:state.record.participant.code});aggregate=result.aggregate;state.aggregate=aggregate;save();results();toast('آمار کلاس به‌روز شد.');}catch(error){toast(error.message);if(b&&b.isConnected){b.disabled=false;b.textContent='تازه‌سازی آمار ↻';}}
  }
  function guide(){setPage('<section class="container guide-wrap"><a class="back-link" href="#/">→ برگشت</a><h1>از انتخاب تا تحلیل</h1><p>۲۰ پرسش در ۱۰ آزمایش. اول انتخاب کن؛ بعد پیش‌بینی هر ایده، پاسخ خودت و الگوی کلاس را کنار هم ببین.</p><p>پاسخ‌ها در شیت خصوصی مدرس ثبت می‌شوند؛ در گزارش، آمار کلاس بدون نام نمایش داده می‌شود. هر شمارهٔ دانشجویی یک ثبت نهایی دارد.</p><p>پیشرفت روی همین مرورگر ذخیره می‌شود. اگر ارتباط قطع شد، با همان پاسخ‌ها دوباره ثبت را بزن.</p><a class="btn btn-primary" href="#/start">ادامه ←</a></section>');}
  function render(){
    document.body.dataset.page='experience';var hash=location.hash||'#/',route=hash.slice(1);
    if(route==='/')home();else if(route==='how'){home();return;}else if(route==='/start')start();else if(/^\/question\/\d+$/.test(route))question(Number(route.split('/')[2]));else if(route==='/review')review();else if(route==='/results')results();else if(route==='/guide')guide();else{navigate('/');return;}
    focusMain();
  }
  window.addEventListener('hashchange',function(){if(submitting){if(location.hash!=='#/review')location.hash='/review';return;}render();});
  document.querySelector('.skip').addEventListener('click',function(event){event.preventDefault();main.focus();});
  window.addEventListener('beforeunload',function(event){if(submitting){event.preventDefault();event.returnValue='';}});
  window.addEventListener('storage',function(event){if(event.key===storageKey){toast('این تجربه در تب دیگری تغییر کرده است. برای جلوگیری از تداخل، فقط در یک تب ادامه دهید.');}});
  render();
})();
