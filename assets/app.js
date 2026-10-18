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
  try{var stored=JSON.parse(localStorage.getItem(storageKey)||'null');if(stored&&stored.record&&stored.record.studyId===config.studyId&&stored.record.version===D.version){var knownOrder=stored.record.order;if(Array.isArray(knownOrder)&&knownOrder.length===D.questions.length&&new Set(knownOrder).size===D.questions.length&&knownOrder.every(function(id){return !!questionMap[id];})&&stored.record.answers&&typeof stored.record.answers==='object'){state=stored;if(state.confirmed&&!C.validateSubmission(state.record,live,config.studyId))aggregate=state.aggregate||null;else state.confirmed=false;}}}catch(_){storageOK=false;}
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
    setPage('<section class="landing">'+art()+'<h1>آزمایشگاه انتخاب</h1><a class="btn btn-primary" href="#/start">'+(state?(state.confirmed?'دیدن تحلیل':'ادامهٔ تجربه'):'شروع')+' <span aria-hidden="true">←</span></a><span class="landing-meta">۱۰ آزمایش · ۲۰ انتخاب</span></section>');
  }

  function start(){
    if(state){navigate(state.confirmed?'/results':'/question/'+(state.index||0));return;}
    setPage('<section class="entry container"><a class="back-link" href="#/">→ برگشت</a><div class="eyebrow">قبل از اولین انتخاب</div><h1>فقط خودت باش.</h1><p class="muted">موقعیت‌ها فرضی‌اند. هر شمارهٔ دانشجویی فقط یک بار ثبت می‌شود.</p>'+modeNotice()+'<form id="participant-form" novalidate><div class="form-grid"><div class="field"><label for="full-name">نام و نام خانوادگی</label><input id="full-name" name="name" autocomplete="name" maxlength="100" required></div><div class="field"><label for="student-id">شمارهٔ دانشجویی</label><input id="student-id" name="studentId" inputmode="numeric" dir="ltr" maxlength="12" required></div>'+'<fieldset class="field full"><legend>جزوه را قبلاً خوانده‌ای؟</legend><div class="radio-inline"><label><input type="radio" name="read" value="no"> نه</label><label><input type="radio" name="read" value="yes"> بله</label></div></fieldset><label class="check-label full"><input type="checkbox" name="consent"><span>با استفادهٔ آموزشی از پاسخ‌ها و نمایش آمار بدون نام موافقم. '+(live?'نام و پاسخ‌ها در شیت خصوصی مدرس ثبت می‌شود.':'پاسخ‌ها فقط روی این دستگاه می‌ماند.')+'</span></label></div><p id="form-error" class="form-error" role="alert"></p><button class="btn btn-primary" type="submit">بریم ←</button></form></section>');
    document.getElementById('participant-form').addEventListener('submit',function(event){event.preventDefault();var f=event.currentTarget;var values=new FormData(f);var participant=C.cleanParticipant({name:values.get('name'),studentId:values.get('studentId'),code:live?browserToken():'DEMO-'+crypto.randomUUID(),read:values.get('read'),consent:values.get('consent')==='on'});var error=C.validateParticipant(participant,live);if(error){document.getElementById('form-error').textContent=error;return;}state={record:{id:crypto.randomUUID(),studyId:config.studyId,version:D.version,participant:participant,startedAt:new Date().toISOString(),order:D.questions.map(function(q){return q.id;}),answers:{},timings:{}},index:0,flowVersion:2,confirmed:false,mode:live?'live':'demo'};save();navigate('/question/0');});
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
    if(submitting)return;var error=C.validateSubmission(state.record,live,config.studyId);if(error){toast(error);return;}
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
  function groupHtml(e,answers){
    if(!live)return '<div class="group-block"><h4>مقایسه با کلاس</h4><p>این نسخه هنوز به کلاس متصل نشده است. پس از اتصال Google Sheets، توزیع واقعی پاسخ‌ها اینجا نمایش داده می‌شود.</p></div>';
    if(!aggregate)return '<div class="group-block"><h4>مقایسه با کلاس</h4><p>آمار فعلاً دریافت نشده است. از بالای صفحه دوباره تلاش کنید.</p></div>';
    if(aggregate.withheld)return '<div class="group-block"><h4>مقایسه با کلاس</h4><p>تا این لحظه '+n(aggregate.n)+' پاسخ ثبت شده است. برای حفظ حریم خصوصی، نمودارها پس از ثبت حداقل '+n(aggregate.minPublish)+' پاسخ نمایش داده می‌شوند.</p></div>';
    var group=aggregate.experiments&&aggregate.experiments[e.id];if(!group)return '';
    var mine=C.analyze(e.id,answers).key;
    var patterns=Object.entries(group.patterns).sort(function(a,b){return b[1].n-a[1].n;});
    var html='<div class="group-block"><h4>در میان '+n(group.n)+' پاسخ کلاس</h4>';
    if(e.id!=='anchor'&&e.id!=='fairness')html+=patterns.map(function(entry){var key=entry[0],p=entry[1],pct=p.n/group.n*100;return '<div class="compare-bar '+(key===mine?'mine':'')+'"><div class="bar-label"><span>'+esc(p.label)+(key===mine?' · الگوی شما':'')+'</span><span>'+n(p.n)+' نفر · '+n(pct)+'٪</span></div><div class="bar-track"><div class="bar-fill" style="width:'+pct+'%"></div></div></div>';}).join('');
    e.questions.filter(function(q){return q.type==='number';}).forEach(function(q){var stat=aggregate.questions[q.id];if(!stat)return;html+='<p style="margin-top:14px">'+esc(q.id==='fairness_min'?'آستانهٔ پذیرش':q.id==='anchor_wtp'?'حداکثر تمایل به پرداخت':q.id==='saving_mug'?'خرید ماگ':'خرید لپ‌تاپ')+'</p><div class="number-comparison"><div class="number-stat">پاسخ شما<strong>'+n(answers[q.id])+'</strong>'+esc(q.unit)+'</div><div class="number-stat">میانگین کلاس<strong>'+n(stat.mean)+'</strong>'+esc(q.unit)+'</div><div class="number-stat">میانهٔ کلاس<strong>'+n(stat.median)+'</strong>'+esc(q.unit)+'</div></div>';});
    if(e.id==='anchor'){html+='<p style="margin-top:16px">میانگین تمایل به پرداخت بر اساس عدد پیشنهادی اولیه:</p>'+(aggregate.anchorGroups||[]).map(function(g){return '<div class="anchor-group-row"><span>لنگر '+n(g.range[0])+' تا '+n(g.range[1])+' · '+n(g.n)+' نفر</span><strong>'+(g.mean==null?'نمونهٔ ناکافی':n(g.mean)+' هزار تومان')+'</strong></div>';}).join('')+'<p style="margin-top:10px">گروه‌های کوچک‌تر از '+n(aggregate.minPublish)+' نفر نمایش داده نمی‌شوند. این مقایسه توصیفی است و اثر علّی را اثبات نمی‌کند.</p>';}
    html+='<details class="history-details"><summary>توزیع پاسخ هر سؤال</summary>'+e.questions.filter(function(q){return q.type==='choice';}).map(function(q){var stat=aggregate.questions[q.id];if(!stat)return '';return '<p>'+esc(q.prompt)+'</p>'+q.options.map(function(o){var count=stat.counts[o.value]||0;return '<div class="compare-bar"><div class="bar-label"><span>'+esc(o.label)+'</span><span>'+n(count)+' نفر · '+n(count/stat.n*100)+'٪</span></div><div class="bar-track"><div class="bar-fill" style="width:'+count/stat.n*100+'%"></div></div></div>';}).join('');}).join('')+'</details></div>';return html;
  }
  var insights={
    saving:['۵۰ هزار تومان، همان ۵۰ هزار تومان است.','برای ماگ تخفیف بزرگی است؛ برای لپ‌تاپ ناچیز به نظر می‌رسد. ذهن گاهی درصدِ تخفیف را می‌بیند، نه پولی که واقعاً در جیب می‌ماند.'],
    subscription:['یک گزینهٔ بد، یک گزینهٔ دیگر را خوب جلوه می‌دهد.','چاپیِ تنها و بستهٔ کامل هم‌قیمت‌اند. چاپی می‌تواند نقش «طعمه» را بازی کند: قرار نیست خریده شود؛ قرار است بسته جذاب‌تر شود.'],
    fairness:['گاهی پول کمتر، از بی‌انصافی بهتر است.','رد کردن یعنی هر دو دست خالی بمانید. اگر انصاف برایت ارزش دارد، ممکن است برای اعتراض، از سهم خودت هم بگذری.'],
    reflection:['همان ریسک؛ دو حس متفاوت.','برای سود، قطعیت دل‌چسب است؛ برای زیان، قمار شاید راه فرار باشد. این «اثر بازتاب» است؛ این دو سؤال به‌تنهایی زیان‌گریزی را اندازه نمی‌گیرند.'],
    time:['یک سال صبر؛ از کی شروع شود؟','فاصلهٔ دو دریافت همیشه یک سال است. اگر فقط با ورود «همین حالا» انتخابت عوض شود، پای سوگیری حال در میان است. تورم و نیاز به پول هم مهم‌اند.'],
    certainty:['قطعیت، فقط یک درصد بیشتر نیست.','از ۹۹٪ به ۱۰۰٪ ممکن است جهشی احساسی باشد. انتخاب قطعی در اول و مبلغ بزرگ‌تر در دوم، الگوی هدفِ اثر قطعیت در این جفت است.'],
    consistency:['انتخاب‌هایت یک حلقه می‌سازند؟','A بهتر از B، و B بهتر از C؛ پس A بهتر از C؟ اگر برعکس انتخاب کنی، یک چرخه ساخته‌ای. امید ریاضی هر سه ۵ میلیون است؛ ریسکشان یکسان نیست.'],
    ticket:['پول گم شد یا «بودجهٔ سینما»؟','در هر دو حالت ۱۰۰ هزار تومان از دست رفته و دیدن فیلم یک بلیت تازه می‌خواهد. حسابداری ذهنی ممکن است فقط در حالت بلیت بگوید: دوبار پول سینما نمی‌دهم.'],
    anchor:['یک عدد بی‌ربط، نقطهٔ شروع قیمت می‌شود.','دو رقم شمارهٔ دانشجویی ربطی به ارزش شیرکاکائو ندارد. آیا پیشنهادهای بالاتر، قیمت‌های بالاتری هم ساخته‌اند؟ این را باید میان گروه‌های کلاس دید، نه از یک نفر.'],
    framing:['۲۰۰ نفر زنده‌اند. ۴۰۰ نفر مرده‌اند.','دو بیان از یک پیامد. گزینه‌های احتمالی هم معادل‌اند. اگر انتخاب عوض شود، قابِ مسئله روی تصمیم اثر گذاشته است: چارچوب‌بندی.']
  };
  function results(){
    if(!state||!state.confirmed){setPage('<section class="entry container"><h1>اول انتخاب، بعد کشف.</h1><a class="btn btn-primary" href="#/start">شروع ←</a></section>');return;}
    var answers=C.withAnchor(state.record);
    var cards=D.experiments.map(function(e,i){var r=C.analyze(e.id,answers),s=D.sources[e.source],tip=insights[e.id];return '<article class="result-card" id="result-'+e.id+'"><div class="result-card-header"><span class="concept">'+esc(e.concept)+'</span><span class="result-number">'+n(i+1)+' / ۱۰</span></div><h2>'+esc(tip[0])+'</h2><p class="insight">'+esc(tip[1])+'</p><div class="result-split"><section class="personal-result"><h3>انتخاب تو</h3><strong class="finding-title">'+esc(r.title)+'</strong><p>'+esc(r.text)+'</p><div class="your-answers">'+e.questions.map(function(q,j){return '<div class="answer-tile"><small>موقعیت '+n(j+1)+'</small><strong>'+esc(answerLabel(q,answers[q.id]))+'</strong></div>';}).join('')+'</div></section>'+groupHtml(e,answers)+'</div><details class="history-details"><summary>پژوهش و نکتهٔ تفسیر</summary><p>'+esc(e.history)+'</p><p>'+esc(e.defense)+'</p><a class="source-link" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer" lang="en">'+esc(s.title)+' ↗</a></details></article>';}).join('');
    setPage('<section class="container results"><div class="eyebrow">پشت صحنهٔ انتخاب‌ها</div><h1>تو چه انتخاب کردی؛ کلاس چطور؟</h1><p class="muted">یک قاب عوض می‌شود؛ گاهی یک تصمیم هم. این‌ها الگوی همین پاسخ‌هاست، نه برچسب شخصیت.</p>'+modeNotice()+'<div class="results-toolbar"><span>'+(live?'✓ ثبت تأیید شد':'گزارش آزمایشی')+' · '+(aggregate?n(aggregate.n)+' پاسخ کلاس':'آمار کلاس هنوز دریافت نشده')+'</span>'+(live?'<button id="refresh-aggregate" class="quiet-button">تازه‌سازی آمار ↻</button>':'')+'</div><nav class="result-tabs" aria-label="تحلیل آزمایش‌ها">'+D.experiments.map(function(e,i){return '<a href="#result-'+e.id+'" data-scroll="result-'+e.id+'">'+n(i+1)+' · '+esc(e.concept)+'</a>';}).join('')+'</nav>'+cards+'<div class="end-actions"><a href="materials/pamphlet.pdf" target="_blank" rel="noopener">جزوهٔ کلاس ↗</a><button id="download-results" class="quiet-button">دریافت پاسخ‌ها ↓</button><button id="print-results" class="quiet-button">چاپ</button></div></section>');
    document.querySelectorAll('[data-scroll]').forEach(function(a){a.addEventListener('click',function(ev){ev.preventDefault();document.getElementById(a.dataset.scroll).scrollIntoView({behavior:'smooth'});});});
    document.getElementById('download-results').addEventListener('click',function(){var blob=new Blob([JSON.stringify({receipt:state.receipt,record:state.record},null,2)],{type:'application/json;charset=utf-8'});var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='my-choices.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);});
    document.getElementById('print-results').addEventListener('click',function(){window.print();});var refresh=document.getElementById('refresh-aggregate');if(refresh)refresh.addEventListener('click',refreshAggregate);
  }

  async function refreshAggregate(){
    if(Date.now()<refreshAt){toast('برای تازه‌سازی بعدی '+n(Math.ceil((refreshAt-Date.now())/1000))+' ثانیه صبر کنید.');return;}
    refreshAt=Date.now()+config.refreshSeconds*1000;var b=document.getElementById('refresh-aggregate');if(b){b.disabled=true;b.textContent='در حال دریافت…';}
    try{var result=await transport.call('aggregate',{studyId:config.studyId,id:state.record.id,code:state.record.participant.code});aggregate=result.aggregate;state.aggregate=aggregate;save();results();toast('آمار کلاس به‌روز شد.');}catch(error){toast(error.message);if(b&&b.isConnected){b.disabled=false;b.textContent='تازه‌سازی آمار ↻';}}
  }
  function guide(){setPage('<div class="container guide-wrap"><div class="page-head"><a class="back-link" href="#/">→ بازگشت به معرفی</a><div class="eyebrow">دربارهٔ تجربه</div><h1>برای یک گفت‌وگوی دقیق‌تر.</h1><p>این فعالیت، تجربه‌ای آموزشی برای آشنایی با انتخاب فردی، اقتصاد رفتاری و فرض‌های اقتصاد خرد است.</p></div><section class="panel"><h2>چه چیزی انجام می‌دهیم؟</h2><p>۱۰ آزمایش و ۲۰ پرسش کوتاه را پاسخ می‌دهید. موقعیت‌ها فرضی‌اند و هیچ سود، زیان یا پرداخت واقعی ایجاد نمی‌کنند. پرسش‌های مکمل در یک مرحله کنار هم نمایش داده می‌شوند؛ ترتیب واقعی برای تحلیل ذخیره می‌شود. این چیدمان می‌تواند مقایسهٔ مستقیم و اثر ترتیب ایجاد کند.</p><p>ابتدا آزمایش‌ها، بعد گزارش و مطالعهٔ جزوه، و سپس یادداشت و مناظرهٔ کلاسی. اگر جزوه را از قبل خوانده‌اید، در فرم شروع اعلام کنید.</p></section><section class="panel"><h2>این گزارش چه معنایی دارد؟</h2><p>برای پاسخ‌ها نمرهٔ هوش، سلامت روان یا عقلانیت محاسبه نمی‌شود. گزارش فقط ترکیب انتخاب‌های مشاهده‌شده را با الگوهای نظری مقایسه می‌کند. نبود یک الگو در این سؤال‌ها، نبود آن در تمام تصمیم‌های زندگی را نشان نمی‌دهد.</p><p>خوداظهاری، موقعیت فرضی، آشنایی قبلی، ترتیب سؤال‌ها و نبود پرداخت واقعی بر تفسیر اثر دارند. مقایسه با مقاله‌ها، تکرار دقیق آن پژوهش‌ها نیست.</p></section><section class="panel"><h2>چه اطلاعاتی نگه داشته می‌شود؟</h2><p>'+(live?'نام، شمارهٔ دانشجویی، کد فعالیت، پاسخ‌ها، ترتیب سؤال‌ها، وضعیت مطالعهٔ جزوه، زمان شروع و ثبت، و زمان تقریبی تعامل با هر سؤال در Google Sheet خصوصی مدرس ذخیره می‌شوند. کدها در شیت پاسخ‌ها به‌صورت هش نگهداری می‌شوند.':'در حالت فعلی، اطلاعات و پاسخ‌ها فقط در حافظهٔ محلی همین مرورگر ذخیره می‌شوند. هنوز هیچ داده‌ای به Google Sheets ارسال نمی‌شود.')+'</p><p>در حالت متصل، فقط آمار تجمیعی بدون نام برای شرکت‌کنندگانِ دارای ثبت نهایی نمایش داده می‌شود. ورود به کد مدرس نیاز ندارد؛ یک شناسهٔ تصادفی در همین مرورگر و کنترل شمارهٔ دانشجویی، ثبت تکراری را محدود می‌کنند. با مرورگر تازه یا پاک‌کردن داده‌ها، شناسهٔ مرورگر قابل تغییر است. نمایش نمودارها از حداقل ۵ پاسخ شروع می‌شود؛ مقادیر گروه‌های کوچک‌تر نیز ممکن است پنهان بمانند. این آستانه خطر شناسایی را کاهش می‌دهد و تضمین ناشناس‌بودن مطلق نیست.</p><p>در دستگاه مشترک، بعد از دریافت گزارش، داده‌های سایت را از تنظیمات مرورگر پاک کنید. برای پیگیری یا حذف پاسخ ذخیره‌شده در شیت، به مدرس مراجعه کنید. زمان نگهداری داده‌ها را مدرس مشخص می‌کند.</p></section><section class="panel"><h2>اگر اینترنت قطع شد چه؟</h2><p>تا زمانی که حافظهٔ محلی مرورگر در دسترس باشد، پاسخ‌های واردشده روی همین دستگاه حفظ می‌شوند. پس از برگشت اینترنت، ثبت را دوباره انجام دهید. در حالت متصل، تنها بعد از تأیید سرویس، پیام ثبت موفق می‌بینید. ارسال مجدد با همان شناسه، پاسخ دیگری ایجاد نمی‌کند.</p><p>این وب‌سایت از کوکی تبلیغاتی، ردیاب تحلیلی و فونتِ وابسته به سرویس خارجی استفاده نمی‌کند.</p></section><section class="panel"><h2>منابع و جزوه</h2><p>منبع هر آزمایش و توضیح تفاوت اجرای کلاس با مطالعهٔ مرجع، پس از پایان تجربه در همان گزارش آمده است. برای جلوگیری از اثر توضیحات بر پاسخ‌ها، پیشنهاد می‌کنیم جزوه را پس از آزمایش بخوانید.</p><p><a class="inline-link" href="materials/pamphlet.pdf" target="_blank" rel="noopener">دریافت جزوهٔ کارگاه اقتصاد خرد ↗</a></p></section><a class="btn btn-primary" href="#/start">'+(state?'بازگشت به تجربهٔ من':'آماده‌ام، شروع کنیم')+' ←</a></div>','guide');}
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
