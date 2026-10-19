(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.LabCore = factory(root.LabData);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Data) {
  'use strict';
  function digits(value) { return String(value == null ? '' : value).replace(/[۰-۹٠-٩]/g, function (c) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c) >= 0 ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(c) : '٠١٢٣٤٥٦٧٨٩'.indexOf(c)); }).trim(); }
  function median(values) { if (!values.length) return null; var s = values.slice().sort(function (a,b) { return a-b; }); var m = Math.floor(s.length/2); return s.length%2 ? s[m] : (s[m-1]+s[m])/2; }
  function cleanParticipant(p) { return { name: String(p.name || '').trim(), studentId: digits(p.studentId), code: digits(p.code).toUpperCase(), read: p.read }; }
  function validateParticipant(input, live) {
    var p = cleanParticipant(input || {});
    if (p.name.length < 2 || p.name.length > 100) return 'نام و نام خانوادگی را وارد کنید (۲ تا ۱۰۰ نویسه).';
    if (!/^\d{9}$/.test(p.studentId)) return 'شمارهٔ دانشجویی باید دقیقاً ۹ رقم باشد.';
    if (live && !/^[A-Z0-9-]{8,64}$/.test(p.code)) return 'کد اختصاصی شرکت در فعالیت را وارد کنید.';
    if (['yes','no'].indexOf(p.read) === -1) return 'مشخص کنید جزوه را قبلاً خوانده‌اید یا نه.';
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
  var lessons={
    saving:{concept:'ارزیابی نسبی و حسابداری ذهنی',title:'برای همان ۵۰ هزار تومان، چقدر راه می‌روی؟',problem:'اقتصاد رفتاری به این تفاوت «ارزیابی نسبی» می‌گوید: ذهن، تخفیف را نسبت به قیمت کالا می‌سنجد. مسئله اینجاست که پولِ ذخیره‌شده و زمانِ پیاده‌روی در دو خرید دقیقاً یکسان‌اند.',expected:'تمایل به پیاده‌روی برای ماگ بیشتر از لپ‌تاپ باشد؛ چون ۵۰ هزار تومان کنار قیمت ماگ بزرگ‌تر به چشم می‌آید.',targetKeys:['relative'],targetLabel:'تمایل بیشتر برای ماگ',more:'در نگاه هزینه‌ـ‌فایده، هر دو انتخاب مبادلهٔ ۵ دقیقه با ۵۰ هزار تومان‌اند. حساب ذهنیِ «خرید ارزان» و «خرید گران» می‌تواند ارزش همین صرفه‌جویی را جابه‌جا کند.'},
    subscription:{concept:'اثر طعمه',title:'گزینهٔ سوم، انتخاب بین دو گزینهٔ دیگر را عوض می‌کند.',problem:'این «اثر طعمه» است: گزینهٔ فقط چاپی، هم‌قیمتِ بستهٔ چاپی و اینترنتی است و امتیاز کمتری دارد. در انتخاب متعارف، افزودن گزینه‌ای ضعیف‌تر نباید ترجیح بین دو پیشنهاد اصلی را برگرداند.',expected:'با وجود گزینهٔ فقط چاپی، بسته را انتخاب کنی؛ با حذف آن، سراغ اشتراک اینترنتی بروی.',targetKeys:['decoy'],targetLabel:'تغییر انتخاب به سمت بسته با حضور طعمه',more:'نکتهٔ اصلی، عوض‌شدنِ قیمت‌ها نیست؛ قیمت دو پیشنهاد اصلی ثابت است. فقط یک گزینهٔ کم‌جاذبه به فهرست اضافه می‌شود و معیار مقایسه را تغییر می‌دهد.'},
    fairness:{concept:'بازی اولتیماتوم و ترجیحات اجتماعی',title:'برای اعتراض به بی‌انصافی، چقدر پول را رد می‌کنی؟',problem:'در بازی اولتیماتوم، رد پیشنهاد یعنی هر دو نفر هیچ می‌گیرند. مسئلهٔ اقتصاد رفتاری این است: اگر فقط پول خودت مهم باشد، چرا یک سهم مثبت را رد کنی؟ پاسخِ «ترجیحات اجتماعی» این است که انصاف هم برای ما ارزش دارد.',expected:'برای پذیرش، یک حداقل سهم مثبت تعیین کنی؛ یعنی حاضر باشی برای تنبیه تقسیم ناعادلانه، از پول خودت بگذری.',targetKeys:['threshold'],targetLabel:'تعیین حداقل سهم مثبت',more:'آستانهٔ پذیرش، قیمتِ اعتراض توست: هر پیشنهادی پایین‌تر از آن، رد می‌شود. نمودار کلاس نشان می‌دهد دانشجویان کجا خط قرمز می‌کشند؛ میانه هم آستانهٔ نفرِ وسط کلاس را نشان می‌دهد.'},
    reflection:{concept:'اثر بازتاب؛ سود و زیان',title:'در سود، قطعیت؛ در زیان، راه فرار.',problem:'اقتصاد رفتاری این جابه‌جایی را «اثر بازتاب» می‌نامد: برای به‌دست‌آوردن سود، قطعیت جذاب می‌شود؛ برای فرار از زیان، ریسک. در هر سؤال، دو گزینه ارزش پولیِ مورد انتظار یکسانی دارند.',expected:'۱۰ میلیون سود قطعی را بگیری، اما در زیان، شانسِ ۵۰٪ بدون زیان را به ۱۰ میلیون زیان قطعی ترجیح بدهی.',targetKeys:['reflection'],targetLabel:'سود قطعی + زیان احتمالی',more:'این الگو از نظریهٔ چشم‌انداز می‌آید: حساسیت به تغییرات پول در ناحیهٔ سود و زیان یکسان نیست. «اثر بازتاب» دربارهٔ تغییر ریسک‌پذیری است؛ «زیان‌گریزی» به وزن بیشتر زیان نسبت به سودِ هم‌اندازه اشاره دارد.'},
    time:{concept:'سوگیری حال',title:'همان یک سال صبر، این بار بدون «همین حالا».',problem:'در تنزیل متعارف، عقب‌بردنِ هر دو تاریخ نباید ترجیح را عوض کند. «سوگیری حال» به دریافتِ فوری وزن ویژه می‌دهد. در دو سؤال، فاصلهٔ دریافت‌ها یک سال و پاداش صبر ۳۰ دلار است؛ تنها تفاوت، حضور یا نبودِ زمان حال است.',expected:'وقتی دریافتِ فوری روی میز است، ۱۰۰ دلار را انتخاب کنی؛ وقتی هر دو دریافت در آینده‌اند، برای ۱۳۰ دلار یک سال بیشتر صبر کنی.',targetKeys:['present'],targetLabel:'دریافت فوری اکنون + صبر در آینده',more:'نقطهٔ مسئله، صرفاً زودتر خواستن پول نیست؛ تغییرِ الگوی صبر است. اگر در هر دو سؤال زودتر یا در هر دو دیرتر را بخواهی، ترجیح زمانی‌ات در این مقایسه ثابت مانده است.'},
    certainty:{concept:'اثر قطعیت',title:'۱۰۰٪ برای ذهن، یک عدد معمولی نیست.',problem:'«اثر قطعیت» می‌گوید عبور از احتمال به اطمینان، وزن ویژه‌ای دارد. در سؤال دوم، احتمال هر دو پیشنهاد ۱۰ واحد درصد کم شده؛ با این حال تضمینِ سؤال اول می‌تواند ترتیب انتخاب‌ها را عوض کند.',expected:'در سؤال اول ۱۰۰ میلیون قطعی را بگیری؛ در سؤال دوم، شانسِ دریافت ۱۱۰ میلیون را انتخاب کنی.',targetKeys:['certainty'],targetLabel:'۱۰۰ میلیون قطعی + شانس ۱۱۰ میلیون در سؤال دوم',more:'چالش برای مطلوبیت انتظاری این است: اگر مطلوبیتِ پول ثابت باشد، کم‌کردن احتمالِ یک پیامد مشترک نباید این ترکیب خاص از ترجیح‌ها را بسازد. اینجا «امتیاز قطعیت» را از خودِ مبلغ جدا می‌کنیم.'},
    consistency:{concept:'تعدی و چرخهٔ ترجیحات',title:'آیا می‌شود انتخاب‌هایت را از بهترین تا بدترین چید؟',problem:'اقتصاد خرد متعارف ترجیحات را سازگار و متعدی فرض می‌کند: اگر A بهتر از B و B بهتر از C باشد، A باید بهتر از C باشد. اقتصاد رفتاری نشان می‌دهد انتخاب‌های دوتایی گاهی دور می‌سازند: A بهتر از B، B بهتر از C و C بهتر از A.',expected:'سه انتخاب، یک رتبه‌بندی ثابت بسازند و چرخه‌ای مثل A ← B ← C ← A شکل نگیرد.',targetKeys:['transitive'],targetLabel:'انتخاب‌های بدون چرخه',more:'A برابر ۵ میلیون قطعی، B شانس ۵٪ صد میلیون و C شانس ۵۰٪ ده میلیون است. هر سه امید ریاضیِ ۵ میلیون دارند؛ اما توزیع ریسکشان فرق می‌کند. نمودار، سهم رتبه‌بندی‌های سازگار و چرخه‌ها را جدا می‌کند.'},
    ticket:{concept:'حسابداری ذهنی',title:'گم‌شدن پول، با گم‌شدن بلیت یک حساب نیست؟',problem:'اقتصاد رفتاری به این جداسازی «حسابداری ذهنی» می‌گوید. در هر دو وضعیت، ۱۰۰ هزار تومان از دست رفته و دیدن فیلم یک پرداخت تازه می‌خواهد؛ اما بلیت گم‌شده مستقیم وارد حساب «هزینهٔ سینما» می‌شود.',expected:'پس از گم‌کردن اسکناس بلیت بخری، اما پس از گم‌کردن بلیت، خرید دوباره را رد کنی.',targetKeys:['mental'],targetLabel:'خرید پس از گم‌شدن پول؛ انصراف پس از گم‌شدن بلیت',more:'پرسش این است که چرا دو زیان مالی هم‌اندازه، تصمیم بعدی را متفاوت می‌کنند. اگر بودجهٔ ذهنیِ سینما قبلاً خرج شده باشد، خرید تازه «دوبار پول دادن برای یک فیلم» احساس می‌شود.'},
    anchor:{concept:'لنگراندازی',title:'یک عدد بی‌ربط، قیمت را به کدام سمت می‌کشد؟',problem:'این «لنگراندازی» است: عددی که اول می‌بینی، نقطهٔ شروع ارزش‌گذاری می‌شود. دو رقم شمارهٔ دانشجویی ربطی به کیفیت شیرکاکائو ندارد؛ مسئله این است که آیا با این عدد، قیمت پیشنهادی هم بالا و پایین می‌رود؟',expected:'کسانی که عدد اولیهٔ بالاتری دیده‌اند، به‌طور متوسط قیمت بالاتری پیشنهاد بدهند؛ یعنی رابطهٔ عدد اولیه و قیمت، هم‌جهت باشد.',targetKeys:[],targetLabel:'رابطهٔ مثبتِ عدد اولیه و قیمت',more:'هر نقطه یک پاسخ است: محور افقی عدد اولیه و محور عمودی حداکثر قیمت پیشنهادی. نقطهٔ سبز پاسخ توست و خط روند جهت رابطه را نشان می‌دهد. ضریب r رابطهٔ خطی را خلاصه می‌کند: مثبت یعنی هم‌جهت، منفی یعنی خلاف‌جهت و نزدیک صفر یعنی رابطهٔ خطی کم‌رنگ. نمودار از ۵ پاسخ کلاس نمایش داده می‌شود.'},
    framing:{concept:'اثر چارچوب‌بندی',title:'۲۰۰ نفر نجات پیدا می‌کنند؛ یا ۴۰۰ نفر می‌میرند؟',problem:'این «اثر چارچوب‌بندی» است: بیانِ یک پیامد، انتخاب را عوض می‌کند. در هر دو سؤال، گزینهٔ قطعی یعنی ۲۰۰ زنده و ۴۰۰ مرده؛ گزینه‌های احتمالی هم دقیقاً معادل‌اند.',expected:'در بیانِ «نجات»، گزینهٔ قطعی را بگیری؛ در بیانِ «مرگ»، برای شانسِ نجات همه، سراغ گزینهٔ احتمالی بروی.',targetKeys:['typical'],targetLabel:'نجات قطعی + ریسک در بیان مرگ',more:'این آزمایش یک پیامد را با دو قاب نشان می‌دهد: دستاورد در برابر ازدست‌دادن. نقطهٔ اصلی، تغییر انتخاب بدون تغییر پیامدهاست. نمودار، سهم انتخابِ قطعی در دو قاب را مستقیم کنار هم می‌گذارد.'}
  };
  function num(v){return String(Math.round(v*10)/10).replace(/[0-9]/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'[Number(d)];}).replace('.', '٫');}
  function analyze(id,a){
    switch(id){
      case 'saving':{
        var d=a.saving_mug-a.saving_laptop;
        return d>0?result('relative','تخفیفِ ماگ برایت بیشتر می‌ارزید','برای ماگ '+num(a.saving_mug)+' و برای لپ‌تاپ '+num(a.saving_laptop)+' از ۱۰۰ ثبت کردی؛ '+num(d)+' واحد فاصله برای صرفه‌جویی و زمانِ یکسان. پاسخ تو دقیقاً در جهت ارزیابی نسبی است.','observed'):d<0?result('reverse','برعکسِ پیش‌بینی: برای لپ‌تاپ مشتاق‌تری','تمایل تو برای لپ‌تاپ '+num(-d)+' واحد بیشتر است. پس تغییرِ پاسخ داری، اما در جهتِ مخالفِ پیش‌بینی تخفیف نسبی.','observed'):result('equal','صرفه‌جویی یکسان، تمایل یکسان','در هر دو خرید '+num(a.saving_mug)+' از ۱۰۰ ثبت کردی. برای تو، تفاوت قیمت کالا ارزشِ ۵۰ هزار تومان صرفه‌جویی را عوض نکرد.','stable');
      }
      case 'subscription':
        if(a.subscription_three==='print')return result('dominated','فقط چاپی را به بستهٔ هم‌قیمت ترجیح دادی','فقط چاپی و چاپی‌ـ‌اینترنتی هر دو ۱۲۵ هزار تومان‌اند. انتخاب تو «گزینهٔ مغلوب» است: همان قیمت، با یک امکان کمتر.','observed');
        if(a.subscription_three==='bundle'&&a.subscription_two==='online')return result('decoy','طعمه، بسته را برایت جذاب کرد','با وجود فقط چاپی، بسته را گرفتی؛ با حذفش، اینترنتی را انتخاب کردی. قیمت دو پیشنهاد اصلی ثابت بود، اما حضور گزینهٔ سوم انتخاب تو را عوض کرد: همان اثر طعمه.','observed');
        if(a.subscription_three===a.subscription_two)return result('same','با حذف طعمه، انتخابت عوض نشد','در هر دو فهرست '+(a.subscription_two==='online'?'فقط اینترنتی':'بستهٔ چاپی و اینترنتی')+' را خواستی. گزینهٔ سوم، برندهٔ مقایسهٔ تو را تغییر نداد.','stable');
        return result('reverse','انتخابت در جهت مخالف طعمه جابه‌جا شد','با حضور فقط چاپی، اینترنتی را خواستی؛ بدون آن، بسته را گرفتی. تغییر رخ داد، اما حضور طعمه بسته را برای تو جذاب‌تر نکرد.','observed');
      case 'fairness':return a.fairness_min===0?result('any','هیچ حداقل سهمی تعیین نکردی','آستانهٔ تو صفر است؛ یعنی هیچ پیشنهادی را به‌خاطر کم‌بودن سهم رد نمی‌کنی. در انتخاب تو، پولِ قابل‌دریافت بر تنبیهِ تقسیم‌کننده مقدم است.','stable'):result('threshold','خط قرمز تو: '+num(a.fairness_min)+' هزار تومان','پیشنهادهای کمتر از '+num(a.fairness_min)+' هزار تومان را رد می‌کنی، حتی اگر سهم هر دو صفر شود. برای تو، پذیرفتنی‌بودنِ تقسیم بخشی از تصمیم است؛ همان شهودِ ترجیحات اجتماعی.','observed');
      case 'reflection':
        if(a.gain==='sure'&&a.loss==='risky')return result('reflection','در سود محتاطی؛ برای فرار از زیان ریسک می‌کنی','۱۰ میلیون سود قطعی را گرفتی، اما در زیان گزینهٔ ۵۰ـ۵۰ را خواستی. علامتِ پول عوض شد و جهت ریسک‌پذیری تو هم چرخید: اثر بازتاب.','observed');
        if(a.gain==='risky'&&a.loss==='sure')return result('reverse','در سود ریسک کردی؛ در زیان قطعیت خواستی','پاسخ تو دقیقاً برعکسِ الگوی بازتاب است: برای سود سراغ احتمال رفتی و برای زیان، مبلغ قطعی را انتخاب کردی.','observed');
        return a.gain==='sure'?result('both_sure','قطعیت را در هر دو طرف ترجیح دادی','هم سود قطعی را خواستی، هم زیان قطعی را. عبور از سود به زیان، جهت انتخاب تو را عوض نکرد.','stable'):result('both_risky','احتمال را در هر دو طرف انتخاب کردی','هم در سود و هم در زیان، گزینهٔ ۵۰ـ۵۰ را خواستی. ترجیح تو برای ریسک، با عوض‌شدن علامت پول ثابت ماند.','stable');
      case 'time':
        if(a.time_now==='early'&&a.time_future==='late')return result('present','برای آینده صبوری؛ برای حال نه','حالا ۱۰۰ دلار را به انتظار ترجیح دادی؛ ولی در آینده، برای ۱۳۰ دلار یک سال بیشتر صبر می‌کنی. تفاوتِ تصمیم تو، امتیازی است که به «همین حالا» دادی.','observed');
        if(a.time_now==='late'&&a.time_future==='early')return result('reverse','حالا صبر می‌کنی؛ در آینده عجله داری','امروز برای ۱۳۰ دلار منتظر می‌مانی، اما در آینده ۱۰۰ دلارِ زودتر را می‌گیری. ترجیح تو تغییر کرد، در جهت مخالف سوگیری حال.','observed');
        return result(a.time_now==='early'?'early':'late','الگوی صبر تو ثابت ماند',a.time_now==='early'?'در هر دو سؤال، ۱۰۰ دلارِ زودتر را انتخاب کردی. «همین حالا» در این مقایسه الگوی تصمیم تو را عوض نکرد.':'در هر دو سؤال، برای ۱۳۰ دلار یک سال بیشتر صبر کردی. پاداشِ صبر، چه نزدیک و چه دور، برای تو جذاب‌تر بود.','stable');
      case 'certainty':{
        var k=a.certainty_high+'_'+a.certainty_low;
        if(k==='small_large')return result('certainty','برای اطمینان، از مبلغ بیشتر گذشتی','ابتدا ۱۰۰ میلیون قطعی را گرفتی؛ اما بعد از کم‌شدن ۱۰ واحد درصد از هر دو احتمال، شانس ۱۱۰ میلیون را خواستی. این تغییر، همان امتیازِ ویژهٔ قطعیت است.','observed');
        if(k==='small_small')return result(k,'در هر دو سؤال، پیشنهاد ۱۰۰ میلیون را خواستی','با ازبین‌رفتن قطعیت هم انتخابت عوض نشد. اولویت تو در هر دو موقعیت، مبلغ کمتر با احتمال بیشتر بود.','stable');
        if(k==='large_large')return result(k,'در هر دو سؤال، دنبال ۱۱۰ میلیون رفتی','حتی در برابر ۱۰۰ میلیون قطعی، شانسِ مبلغ بزرگ‌تر را خواستی. تضمین، انتخابت را از ۱۱۰ میلیون برنگرداند.','stable');
        return result(k,'تغییر دادی؛ در جهت مخالف اثر قطعیت','در اولی شانس ۱۱۰ میلیون و در دومی شانس ۱۰۰ میلیون را خواستی. حذف تضمین، تو را به مبلغ بزرگ‌تر متمایل نکرد.','observed');
      }
      case 'consistency':{
        var forward=a.cycle_ab==='a'&&a.cycle_bc==='b'&&a.cycle_ac==='c',reverse=a.cycle_ab==='b'&&a.cycle_bc==='c'&&a.cycle_ac==='a';
        if(forward||reverse)return result('cycle','انتخاب‌هایت یک حلقه ساختند',forward?'A را به B، B را به C و C را به A ترجیح دادی. هر بار یک برنده داری، اما یک گزینه نمی‌تواند بالاتر از همه بایستد.':'B را به A، C را به B و A را به C ترجیح دادی. این جهتِ معکوس هم یک چرخه است؛ رتبه‌بندی از بهترین تا بدترین ساخته نمی‌شود.','observed');
        var wins={a:0,b:0,c:0};wins[a.cycle_ab]++;wins[a.cycle_bc]++;wins[a.cycle_ac]++;var order=Object.keys(wins).sort(function(x,y){return wins[y]-wins[x];}).map(function(x){return x.toUpperCase();}).join('، سپس ');
        return result('transitive','انتخاب‌هایت یک رتبه‌بندی ساختند','از بهترین به بدترین: '+order+'. سه مقایسهٔ تو با هم جمع می‌شوند؛ چرخه‌ای نداریم و شرط تعدی برقرار است.','stable');
      }
      case 'ticket':
        if(a.ticket_cash==='yes'&&a.ticket_lost==='no')return result('mental','پول را از حساب سینما جدا کردی','بعد از گم‌شدن پول بلیت می‌خری؛ بعد از گم‌شدن بلیت، نه. زیان مالی یکسان است، اما برای تو هزینهٔ سینما در حالت دوم قبلاً پرداخت شده: حسابداری ذهنی.','observed');
        if(a.ticket_cash==='no'&&a.ticket_lost==='yes')return result('reverse','دو حساب متفاوت؛ در جهت مخالف','بعد از گم‌کردن اسکناس منصرف شدی، اما بلیت گم‌شده را دوباره می‌خری. دو شکل زیان تصمیم تو را عوض کردند، با جهت مخالفِ الگوی این آزمایش.','observed');
        return result(a.ticket_cash==='yes'?'both_yes':'both_no','شکلِ زیان، تصمیم تو را عوض نکرد',a.ticket_cash==='yes'?'در هر دو وضعیت بلیت می‌خری. برای تو، گم‌شدن پول یا بلیت مانعِ یک پرداخت تازه برای فیلم نمی‌شود.':'در هر دو وضعیت از خرید منصرف می‌شوی. برای تو، نامِ حسابی که زیان در آن رخ داده تفاوتی در تصمیم نساخت.','stable');
      case 'anchor':{var diff=a.anchor_wtp-a.anchor_value;return result('group','قیمت تو '+num(a.anchor_wtp)+'؛ عدد اولیه '+num(a.anchor_value),'حداکثر قیمتت '+(diff===0?'دقیقاً روی عدد اولیه نشست.':num(Math.abs(diff))+' هزار تومان '+(diff>0?'بالاتر':'پایین‌تر')+' از عدد اولیه است.')+' در نمودار، جای پاسخ تو کنار میانگین گروه‌های کلاس مشخص است. انتظار لنگراندازی این است که با بالا رفتن عدد اولیه، قیمت‌های پیشنهادی هم بالا بروند.','neutral');}
      case 'framing':
        if(a.frame_saved==='sure'&&a.frame_died==='risky')return result('typical','با قابِ نجات، محتاط؛ با قابِ مرگ، ریسک‌پذیر','در بیان نجات، ۲۰۰ نفر قطعی را خواستی؛ در بیان مرگ، گزینهٔ احتمالی را گرفتی. پیامدها عوض نشدند، اما انتخاب تو عوض شد: الگوی مورد انتظارِ چارچوب‌بندی.','observed');
        if(a.frame_saved==='risky'&&a.frame_died==='sure')return result('reverse','قاب روی تو اثر گذاشت؛ در جهت معکوس','در نجات ریسک کردی و در مرگ قطعیت خواستی. پس بیان مسئله انتخابت را تغییر داد، اما برخلاف جهتِ نجاتِ قطعی و مرگِ احتمالی.','observed');
        return a.frame_saved==='sure'?result('both_sure','در هر دو بیان، ۲۰۰ زنده و ۴۰۰ مرده را خواستی','چه نجات بگوییم چه مرگ، گزینهٔ قطعی را گرفتی. قاب عوض شد، انتخاب تو ثابت ماند.','stable'):result('both_risky','در هر دو بیان، همان شانسِ نجات همه را خواستی','در هر دو قاب، گزینهٔ احتمالی را گرفتی. نامِ پیامد از نجات به مرگ عوض شد، اما انتخاب تو عوض نشد.','stable');
      default:throw new Error('Unknown experiment: '+id);
    }
  }
  var patternLabels={
    saving:{relative:'تمایل بیشتر برای ماگ',equal:'تمایل یکسان',reverse:'تمایل بیشتر برای لپ‌تاپ'},
    subscription:{decoy:'بسته با طعمه؛ اینترنتی بدون طعمه',same:'انتخاب ثابت',reverse:'اینترنتی با طعمه؛ بسته بدون طعمه',dominated:'انتخاب فقط چاپی'},
    fairness:{threshold:'حداقل سهم مثبت',any:'بدون حداقل سهم'},
    reflection:{reflection:'سود قطعی؛ زیان احتمالی',reverse:'سود احتمالی؛ زیان قطعی',both_sure:'قطعیت در هر دو',both_risky:'احتمال در هر دو'},
    time:{present:'دریافت فوری؛ صبر در آینده',reverse:'صبر اکنون؛ دریافت زودتر در آینده',early:'دریافت زودتر در هر دو',late:'دریافت دیرتر در هر دو'},
    certainty:{certainty:'قطعیت در اول؛ مبلغ بیشتر در دوم',small_small:'۱۰۰ میلیون در هر دو',large_large:'۱۱۰ میلیون در هر دو',large_small:'مبلغ بیشتر در اول؛ کمتر در دوم'},
    consistency:{transitive:'رتبه‌بندی سازگار',cycle:'چرخهٔ ترجیحات'},
    ticket:{mental:'خرید پس از گم‌شدن پول؛ انصراف پس از بلیت',reverse:'انصراف پس از پول؛ خرید پس از بلیت',both_yes:'خرید در هر دو',both_no:'انصراف در هر دو'},
    anchor:{group:'قیمت‌گذاری پس از عدد اولیه'},
    framing:{typical:'نجات قطعی؛ مرگ احتمالی',reverse:'نجات احتمالی؛ مرگ قطعی',both_sure:'قطعیت در هر دو قاب',both_risky:'احتمال در هر دو قاب'}
  };
  function patternLabel(id,key){return patternLabels[id][key]||key;}
  function targetMatch(id,answers){var lesson=lessons[id];return (id==='anchor'||id==='consistency')?null:lesson.targetKeys.indexOf(analyze(id,answers).key)!==-1;}
  function correlation(pairs){
    if(pairs.length<2)return null;
    var mx=pairs.reduce(function(s,p){return s+p[0];},0)/pairs.length,my=pairs.reduce(function(s,p){return s+p[1];},0)/pairs.length,xx=0,yy=0,xy=0;
    pairs.forEach(function(p){var x=p[0]-mx,y=p[1]-my;xx+=x*x;yy+=y*y;xy+=x*y;});
    return xx===0||yy===0?null:Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy)));
  }
  function withAnchor(record) { var a=Object.assign({},record.answers); a.anchor_value=Math.max(10,Number(digits(record.participant.studentId).slice(-2))); return a; }
  function summarize(records, minPublish) {
    minPublish=minPublish==null?5:minPublish;
    var summary={ reportVersion:3, version:Data.version, n:records.length, minPublish:minPublish, withheld:records.length<minPublish, generatedAt:new Date().toISOString(), questions:{}, experiments:{}, anchorGroups:[] };
    if(summary.withheld) return summary;
    Data.questions.forEach(function(q) {
      if(q.type==='choice') { var counts={};q.options.forEach(function(o){counts[o.value]=0;});records.forEach(function(r){counts[r.answers[q.id]]++;});summary.questions[q.id]={type:'choice',n:records.length,counts:counts}; }
      else { var values=records.map(function(r){return r.answers[q.id];}); summary.questions[q.id]={type:'number',n:values.length,mean:values.reduce(function(s,v){return s+v;},0)/values.length,median:median(values),histogram:Array.from({length:5},function(_,i){var width=Math.ceil((q.max+1)/5),lo=i*width,hi=Math.min(q.max,(i+1)*width-1);return {range:[lo,hi],n:values.filter(function(v){return v>=lo&&v<=hi;}).length};})}; }
    });
    Data.experiments.forEach(function(e) { var patterns={};records.forEach(function(r){ var p=analyze(e.id,withAnchor(r));if(!patterns[p.key])patterns[p.key]={label:patternLabel(e.id,p.key),n:0};patterns[p.key].n++; });summary.experiments[e.id]={n:records.length,patterns:patterns}; });
    [[10,39],[40,69],[70,99]].forEach(function(range){ var group=records.filter(function(r){var v=withAnchor(r).anchor_value;return v>=range[0]&&v<=range[1];}); summary.anchorGroups.push({range:range,n:group.length,mean:group.length>=minPublish?group.reduce(function(s,r){return s+r.answers.anchor_wtp;},0)/group.length:null}); });
    var points=records.map(function(r){return [withAnchor(r).anchor_value,r.answers.anchor_wtp];}).sort(function(a,b){return a[0]-b[0]||a[1]-b[1];});
    var mx=points.reduce(function(s,p){return s+p[0];},0)/points.length,my=points.reduce(function(s,p){return s+p[1];},0)/points.length;
    var xx=points.reduce(function(s,p){return s+Math.pow(p[0]-mx,2);},0),xy=points.reduce(function(s,p){return s+(p[0]-mx)*(p[1]-my);},0);
    summary.anchor={n:records.length,r:correlation(points),points:points,trend:xx?{slope:xy/xx,intercept:my-xy/xx*mx}:null};
    summary.fairnessBins=[[0,0],[1,199],[200,399],[400,599],[600,1000]].map(function(range){return {range:range,n:records.filter(function(r){return r.answers.fairness_min>=range[0]&&r.answers.fairness_min<=range[1];}).length};});
    Data.experiments.forEach(function(e){var g=summary.experiments[e.id];g.targetN=(e.id==='anchor'||e.id==='consistency')?null:records.filter(function(r){return targetMatch(e.id,withAnchor(r));}).length;});
    return summary;
  }
  return { lessons:lessons,patternLabel:patternLabel,targetMatch:targetMatch,correlation:correlation,digits:digits,median:median,cleanParticipant:cleanParticipant,validateParticipant:validateParticipant,validAnswer:validAnswer,validateSubmission:validateSubmission,makeOrder:makeOrder,analyze:analyze,withAnchor:withAnchor,summarize:summarize };
});
