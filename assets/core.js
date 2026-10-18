(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.LabCore = factory(root.LabData);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Data) {
  'use strict';
  function digits(value) { return String(value == null ? '' : value).replace(/[۰-۹٠-٩]/g, function (c) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c) >= 0 ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(c) : '٠١٢٣٤٥٦٧٨٩'.indexOf(c)); }).trim(); }
  function median(values) { if (!values.length) return null; var s = values.slice().sort(function (a,b) { return a-b; }); var m = Math.floor(s.length/2); return s.length%2 ? s[m] : (s[m-1]+s[m])/2; }
  function cleanParticipant(p) { return { name: String(p.name || '').trim(), studentId: digits(p.studentId), code: digits(p.code).toUpperCase(), read: p.read, consent: p.consent === true }; }
  function validateParticipant(input, live) {
    var p = cleanParticipant(input || {});
    if (p.name.length < 2 || p.name.length > 100) return 'نام و نام خانوادگی را وارد کنید (۲ تا ۱۰۰ نویسه).';
    if (!/^\d{5,12}$/.test(p.studentId)) return 'شمارهٔ دانشجویی باید بین ۵ تا ۱۲ رقم باشد.';
    if (live && !/^[A-Z0-9-]{8,64}$/.test(p.code)) return 'کد اختصاصی شرکت در فعالیت را وارد کنید.';
    if (['yes','no'].indexOf(p.read) === -1) return 'مشخص کنید جزوه را قبلاً خوانده‌اید یا نه.';
    if (!p.consent) return 'برای شروع، موافقت با شیوهٔ استفاده از پاسخ‌ها لازم است.';
    return '';
  }
  function validAnswer(q, answer) {
    if (q.type === 'choice') return q.options.some(function (o) { return o.value === answer; });
    return typeof answer === 'number' && Number.isFinite(answer) && Number.isInteger(answer) && answer >= q.min && answer <= q.max;
  }
  function validateSubmission(record, live, studyId) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return 'ساختار پاسخ نامعتبر است.';
    var pError = validateParticipant(record.participant, live); if (pError) return pError;
    if (record.studyId !== studyId || record.version !== Data.version) return 'نسخهٔ این فعالیت تغییر کرده است. با مدرس هماهنگ کنید.';
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(record.id || '')) return 'شناسهٔ ثبت نامعتبر است.';
    if (!record.answers || Object.keys(record.answers).length !== Data.questions.length) return 'همهٔ سؤال‌ها باید پاسخ داشته باشند.';
    if (Data.questions.some(function (q) { return !validAnswer(q, record.answers[q.id]); })) return 'یک یا چند پاسخ خارج از محدوده است.';
    if (!Array.isArray(record.order) || record.order.length !== Data.questions.length || new Set(record.order).size !== Data.questions.length || record.order.some(function (id) { return !Data.questions.some(function (q) { return q.id === id; }); })) return 'ترتیب سؤال‌ها نامعتبر است.';
    if (record.order.indexOf('anchor_accept') > record.order.indexOf('anchor_wtp')) return 'ترتیب سؤال‌های ارزش‌گذاری نامعتبر است.';
    if (typeof record.startedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(record.startedAt) || !Number.isFinite(Date.parse(record.startedAt))) return 'زمان شروع نامعتبر است.';
    if (record.completedAt != null && (typeof record.completedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(record.completedAt) || !Number.isFinite(Date.parse(record.completedAt)))) return 'زمان پایان نامعتبر است.';
    return '';
  }
  function shuffle(a, random) { for (var i=a.length-1;i>0;i--) { var j=Math.floor(random()*(i+1)); var t=a[i];a[i]=a[j];a[j]=t; } return a; }
  function makeOrder(random) {
    random = random || Math.random;
    var blocks = [[],[],[]];
    Data.experiments.forEach(function (e) {
      var qs=e.questions.map(function (q) { return q.id; });
      if (qs.length === 2 && e.id !== 'anchor' && random() > 0.5) qs.reverse();
      qs.forEach(function (id,i) { blocks[i].push(id); });
    });
    return blocks.reduce(function (all,b) { return all.concat(shuffle(b,random)); },[]);
  }
  function result(key, title, text, flag) { return { key:key, title:title, text:text, flag:flag || 'neutral' }; }
  function analyze(id, a) {
    switch (id) {
      case 'saving': {
        var diff=a.saving_mug-a.saving_laptop;
        return diff===0 ? result('equal','تمایل یکسان برای صرفه‌جویی یکسان','در هر دو خرید، تمایل شما برای ۵ دقیقه پیاده‌روی یکسان بود. در این مقایسه تفاوتی مشاهده نشد.','stable') : result(diff>0?'relative':'reverse',diff>0?'برای ماگ، تمایل بیشتری داشتید':'برای لپ‌تاپ، تمایل بیشتری داشتید','تمایل شما '+Math.abs(diff)+' واحد از ۱۰۰ تفاوت داشت؛ در حالی که صرفه‌جویی و زمان هر دو یکسان بودند. این تفاوت، توصیف پاسخ شماست و علت آن را به‌تنهایی مشخص نمی‌کند.','observed');
      }
      case 'subscription':
        if(a.subscription_three==='bundle' && a.subscription_two==='online') return result('decoy','الگویی سازگار با اثر طعمه','وقتی گزینهٔ «فقط چاپی» وجود داشت، بسته را انتخاب کردید؛ بدون آن، اینترنتی را ترجیح دادید.','observed');
        if(a.subscription_three==='print') return result('dominated','گزینهٔ فقط چاپی را انتخاب کردید','در مجموعهٔ سه‌گزینه‌ای، فقط چاپی و بستهٔ کامل یک قیمت دارند. انتخاب شما فرصتی برای بحث دربارهٔ ارزش نسخهٔ اینترنتی، بی‌تفاوتی یا برداشت از متن است.','observed');
        if(a.subscription_three===a.subscription_two) return result('same','انتخابتان ثابت ماند','با حذف گزینهٔ فقط چاپی، انتخاب شما بین دو گزینهٔ دیگر تغییر نکرد.','stable');
        return result('reverse','تغییر انتخاب در جهت دیگر','با حذف گزینهٔ چاپی، از اینترنتی به بسته تغییر انتخاب دادید. این جهت، الگوی معمولِ مورد انتظار از طعمه در این مثال نیست.','observed');
      case 'fairness': return a.fairness_min===0 ? result('any','پذیرش هر سهم پیشنهادی','آستانهٔ شما صفر بود؛ یعنی حتی سهم صفر را هم می‌پذیرید. این پاسخ با تمرکز بر منفعت پولی خود سازگار است، اما انگیزهٔ شما را مشخص نمی‌کند.','neutral') : result('threshold','برای پذیرش، حداقل سهم تعیین کردید','آستانهٔ پذیرش شما '+a.fairness_min+' هزار تومان بود. اهمیت انصاف یا اعتراض به تقسیم، می‌تواند بخشی از توضیح باشد؛ این پاسخ به معنای غیرعقلانی‌بودن شما نیست.','neutral');
      case 'reflection':
        if(a.gain==='sure' && a.loss==='risky') return result('reflection','در سود محتاط، در زیان ریسک‌پذیر','سود قطعی را انتخاب کردید، اما برای زیان سراغ گزینهٔ احتمالی رفتید. این الگو با اثر بازتاب سازگار است؛ سنجش مستقل زیان‌گریزی نیست.','observed');
        if(a.gain==='risky' && a.loss==='sure') return result('reverse','ریسک در سود، قطعیت در زیان','در سود گزینهٔ احتمالی و در زیان گزینهٔ قطعی را ترجیح دادید. الگوی بازتاب رایج در این دو پاسخ دیده نشد.','neutral');
        return a.gain==='sure' ? result('both_sure','قطعیت در هر دو موقعیت','چه برای سود و چه برای زیان، گزینهٔ قطعی را انتخاب کردید.','stable') : result('both_risky','گزینهٔ احتمالی در هر دو موقعیت','چه برای سود و چه برای زیان، گزینهٔ احتمالی را انتخاب کردید.','stable');
      case 'time':
        if(a.time_now==='early' && a.time_future==='late') return result('present','صبر برای آینده، عجله برای حال','برای اکنون، دریافت زودتر و برای آینده، دریافت دیرتر را برگزیدید. این الگو با سوگیری حال سازگار است؛ تورم، نقدینگی و اعتماد هم می‌توانند مؤثر باشند.','observed');
        if(a.time_now==='late' && a.time_future==='early') return result('reverse','ترجیحتان در جهت معکوس تغییر کرد','برای زمان نزدیک منتظر مبلغ بیشتر می‌مانید، اما برای زمان دور مبلغ کمتر و زودتر را انتخاب کردید.','observed');
        return result(a.time_now==='early'?'early':'late','ترجیح زمانی شما ثابت بود',a.time_now==='early'?'در هر دو سؤال مبلغ کمتر و زودتر را انتخاب کردید.':'در هر دو سؤال مبلغ بیشتر و دیرتر را انتخاب کردید.','stable');
      case 'certainty':
        if(a.certainty_high==='small' && a.certainty_low==='large') return result('certainty','الگویی سازگار با اثر قطعیت','در سؤال اول ۱۰۰ میلیون قطعی و در سؤال دوم شانس مبلغ ۱۱۰ میلیون را برگزیدید. با فرض ترجیحات سخت و مطلوبیت صعودی، این ترکیب با یک تابع مطلوبیت انتظاری ثابت سازگار نیست.','observed');
        return result(a.certainty_high+'_'+a.certainty_low,'الگوی هدفِ اثر قطعیت دیده نشد','ترکیب پاسخ شما، الگوی خاص مورد بررسی در این جفت نیست. این نتیجه آزمون جامع عقلانیت یا مطلوبیت انتظاری محسوب نمی‌شود.','neutral');
      case 'consistency': {
        var cycle=(a.cycle_ab==='a' && a.cycle_bc==='b' && a.cycle_ac==='c') || (a.cycle_ab==='b' && a.cycle_bc==='c' && a.cycle_ac==='a');
        return cycle ? result('cycle','در سه انتخاب، یک چرخه دیده شد','ترکیب پاسخ‌ها یک رتبه‌بندی خطی نمی‌سازد. بی‌تفاوتی، خطای پاسخ یا ناپایداری انتخاب هم می‌تواند چنین الگویی بسازد.','observed') : result('transitive','در این سه انتخاب، چرخه‌ای دیده نشد','انتخاب‌های شما در این سه مقایسه با یک رتبه‌بندی سازگارند؛ این نتیجه دربارهٔ تمام ترجیحات شما حکم نمی‌دهد.','stable');
      }
      case 'ticket':
        if(a.ticket_cash==='yes' && a.ticket_lost==='no') return result('mental','دو حساب ذهنی متفاوت','بعد از گم‌کردن پول بلیت می‌خرید، اما بعد از گم‌کردن بلیت دوباره خرید نمی‌کنید. این الگو با حسابداری ذهنی سازگار است.','observed');
        if(a.ticket_cash==='no' && a.ticket_lost==='yes') return result('reverse','تفاوت در جهت معکوس','بعد از گم‌کردن پول خرید نمی‌کنید، اما بعد از گم‌کردن بلیت دوباره می‌خرید. تفاوت پاسخ وجود دارد، با جهت متفاوت از الگوی رایج این مثال.','observed');
        return result(a.ticket_cash==='yes'?'both_yes':'both_no','تصمیم یکسان در هر دو وضعیت',a.ticket_cash==='yes'?'در هر دو وضعیت بلیت می‌خرید.':'در هر دو وضعیت از خرید بلیت منصرف می‌شوید.','stable');
      case 'anchor': return result('group','اثر لنگر را باید در جمع بررسی کنیم','پیشنهاد اولیهٔ شما '+a.anchor_value+' هزار تومان و حداکثر تمایل به پرداخت شما '+a.anchor_wtp+' هزار تومان بود. از نزدیکی یا فاصلهٔ این دو عدد، نمی‌توان اثر لنگر بر یک فرد را تشخیص داد.','neutral');
      case 'framing': return a.frame_saved!==a.frame_died ? result(a.frame_saved==='sure'?'typical':'reverse','با تغییر بیان، انتخابتان عوض شد','گزینه‌های دو سؤال پیامدهای یکسانی دارند. تغییر انتخاب شما با حساسیت به چارچوب‌بندی سازگار است؛ دلیل قطعی این تغییر از همین دو پاسخ معلوم نمی‌شود.','observed') : result(a.frame_saved==='sure'?'both_sure':'both_risky','با تغییر بیان، انتخابتان ثابت ماند','در هر دو بیانِ نجات و مرگ، همان نوع گزینه را انتخاب کردید. در این جفت پاسخ، تغییر انتخاب دیده نشد.','stable');
      default: throw new Error('Unknown experiment: '+id);
    }
  }
  function withAnchor(record) { var a=Object.assign({},record.answers); a.anchor_value=Math.max(10,Number(digits(record.participant.studentId).slice(-2))); return a; }
  function summarize(records, minPublish) {
    minPublish=minPublish==null?5:minPublish;
    var summary={ version:Data.version, n:records.length, minPublish:minPublish, withheld:records.length<minPublish, generatedAt:new Date().toISOString(), questions:{}, experiments:{}, anchorGroups:[] };
    if(summary.withheld) return summary;
    Data.questions.forEach(function(q) {
      if(q.type==='choice') { var counts={};q.options.forEach(function(o){counts[o.value]=0;});records.forEach(function(r){counts[r.answers[q.id]]++;});summary.questions[q.id]={type:'choice',n:records.length,counts:counts}; }
      else { var values=records.map(function(r){return r.answers[q.id];}); summary.questions[q.id]={type:'number',n:values.length,mean:values.reduce(function(s,v){return s+v;},0)/values.length,median:median(values)}; }
    });
    Data.experiments.forEach(function(e) { var patterns={};records.forEach(function(r){ var p=analyze(e.id,withAnchor(r));if(!patterns[p.key])patterns[p.key]={label:p.title,n:0};patterns[p.key].n++; });summary.experiments[e.id]={n:records.length,patterns:patterns}; });
    [[10,39],[40,69],[70,99]].forEach(function(range){ var group=records.filter(function(r){var v=withAnchor(r).anchor_value;return v>=range[0]&&v<=range[1];}); summary.anchorGroups.push({range:range,n:group.length,mean:group.length>=minPublish?group.reduce(function(s,r){return s+r.answers.anchor_wtp;},0)/group.length:null}); });
    return summary;
  }
  return { digits:digits,median:median,cleanParticipant:cleanParticipant,validateParticipant:validateParticipant,validAnswer:validAnswer,validateSubmission:validateSubmission,makeOrder:makeOrder,analyze:analyze,withAnchor:withAnchor,summarize:summarize };
});
