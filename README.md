# آزمایشگاه انتخاب

وب‌سایت استاتیک فارسی برای فعالیت اقتصاد رفتاری درس اقتصاد خرد دورهٔ ماینر دانشگاه صنعتی شریف.

**۱۰ آزمایش، ۲۰ پرسش؛ مسئلهٔ راکت و توپ حذف شده است.**

سایت به build، پایگاه دادهٔ محلی، سرویس Node.js، کلید API یا نصب وابستگی برای اجرا نیاز ندارد. HTML/CSS/JavaScript روی GitHub Pages میزبانی می‌شود. Google Apps Script فقط ثبت و آمار را انجام می‌دهد و Google Sheet خصوصی، محل نگهداری داده‌هاست.

## وضعیت فعلی

- رابط فارسی و راست‌به‌چپ، مناسب موبایل و دسکتاپ، با فونت محلی Vazirmatn.
- پرسش‌نامه، ذخیرهٔ خودکار، مرور و ویرایش پیش از ثبت، گزارش فردی و خروجی JSON/چاپ.
- تحلیل جفت‌پاسخ‌ها، بررسی چرخهٔ ترجیحات، مقایسهٔ میانگین/میانه و توزیع الگوهای کلاس.
- منبع و محدودیت تفسیر برای هر آزمایش؛ بدون نمرهٔ کلی عقلانیت یا برچسب شخصیتی.
- کد Apps Script با تأیید واقعی ثبت، کنترل تکرار، قفل نوشتن، کد شرکت‌کننده و آمار تجمیعی.
- گردش کار GitHub Actions برای انتشار فایل‌های عمومی سایت.
- تا وقتی `endpoint` در `config.js` خالی است، سایت **آزمایشی** است. هیچ پاسخی به مدرس ارسال نمی‌شود و آمار کلاس ساختگی نمایش داده نمی‌شود.

## دیدن نسخهٔ محلی

Node.js نسخهٔ ۲۰ یا بالاتر فقط برای پیش‌نمایش و آزمون‌های توسعه لازم است:

```powershell
cd D:\Behavioral\behavioral-lab
npm run preview
```

سپس `http://127.0.0.1:4173/behavioral-lab/` را باز کنید. نیازی به `npm install` نیست. فایل را با `file://` باز نکنید؛ ذخیرهٔ مرورگر و برخی APIها به HTTP/HTTPS نیاز دارند.

## انتشار روی GitHub Pages

اگر تغییرات هنوز روی GitHub نیستند، آن‌ها را با ابزار Git خودتان commit و push کنید:

```powershell
git add .
git commit -m "Build Persian behavioral economics lab"
git push origin main
```

در ریپوی `JavazAli/behavioral-lab`:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions** را انتخاب کنید.
2. وارد **Actions → Deploy static lab to GitHub Pages** شوید.
3. اگر workflow با آخرین push اجرا نشده، **Run workflow** را بزنید.
4. پس از موفقیت، نشانی مورد انتظار: `https://javazali.github.io/behavioral-lab/`.

این نشانی تنها بعد از اجرای موفق Pages فعال می‌شود. انتشار اولیه در حالت آزمایشی برای بررسی رابط است؛ هنوز لینک جمع‌آوری پاسخ دانشجویان نیست.

Workflow فقط `index.html`، `config.js`، `.nojekyll`، `assets/` و `materials/` را در خروجی Pages قرار می‌دهد. اسکریپت‌ها و راهنماها در سایت منتشر نمی‌شوند. در ریپوی عمومی، کد Apps Script قابل خواندن است؛ هیچ رمز، فهرست کد دانشجویان یا دادهٔ خامی نباید در ریپو قرار بگیرد.

## اتصال Google Sheets و Apps Script

راهنمای کامل: [docs/SETUP.fa.md](docs/SETUP.fa.md).

1. یک Google Sheet **خصوصی** ایجاد کنید.
2. از **Extensions → Apps Script** پروژهٔ متصل را باز کنید.
3. فایل‌های `Code.gs`، `Shared.gs`، `Bridge.html` و manifest را از `apps-script/` وارد کنید.
4. Script Properties را تنظیم و `setupLab_` و سپس `createParticipantCodes_` را اجرا کنید.
5. وب‌اپ را با حساب مالک و دسترسی `Anyone` منتشر کنید.
6. نشانی `/exec` را در `config.js` بگذارید و تغییر را push کنید.
7. قبل از دعوت دانشجویان، اجرای واقعی روی گوشی انجام دهید.

**تغییر به حالت متصل، دادهٔ آزمایشی قبلی را خودکار ارسال نمی‌کند.** حافظهٔ محلی دو حالت جداست.

## ساختار فایل‌ها

```text
index.html                 پوستهٔ سایت
config.js                  تنظیمات عمومی و نشانی وب‌اپ
assets/styles.css          رابط و چاپ
assets/app.js              جریان تجربه، ذخیرهٔ محلی و گزارش
assets/data.js             پرسش‌ها، منابع و متن تحلیل
assets/core.js             اعتبارسنجی، ترتیب، قواعد تحلیل و آمار
assets/transport.js        ارتباط iframe/postMessage با گوگل
assets/fonts/              فونت محلی و مجوز OFL
materials/pamphlet.pdf      جزوهٔ پیش از جلسه
apps-script/Code.gs        ثبت و دریافت آمار، فقط سمت گوگل
apps-script/Shared.gs      نسخهٔ تولیدشدهٔ data.js + core.js
apps-script/Bridge.html    پل ارتباطی google.script.run
docs/SETUP.fa.md           راه‌اندازی و بهره‌برداری
docs/EXPERIMENTS.fa.md     طرح آزمایش و منطق تحلیل
tests/                    آزمون‌های منطق و سرویس شبیه‌سازی‌شده
.github/workflows/pages.yml انتشار GitHub Pages
```

## بررسی و تغییر کد

```powershell
npm run check
npm test
npm run package
```

پس از ویرایش `assets/data.js` یا `assets/core.js`، ابتدا `npm run sync:backend` و سپس بررسی‌ها را اجرا کنید. `Shared.gs` جدید را هم به Apps Script منتقل و **نسخهٔ جدید همان deployment** را منتشر کنید.

آزمون ۱۲۰ رکورد، شبیه‌سازی منطق ذخیره است؛ آزمون بار سرویس واقعی Google نیست. محدودیت هم‌زمانی و دسترسی شبکه باید پس از انتشار واقعی سنجیده شود.

## مرزهای عملیاتی

- کد اختصاصی، احراز هویت دانشگاهی نیست و قابل اشتراک‌گذاری است.
- کنترل‌های مرورگر قابل دورزدن‌اند؛ قواعد ثبت در Apps Script نیز بررسی می‌شوند.
- جلوگیری از ثبت تکراری و ظرفیت محدود، خطر آلودگی داده را کاهش می‌دهند؛ Apps Script به‌تنهایی محافظ DDoS نیست.
- کد و متن تحلیل در سایت استاتیک قابل بازرسی است؛ برای آزمون محرمانه یا نمره‌دهی طراحی نشده است.
- زمان‌های تعامل، دادهٔ تقریبی مرورگر و قابل دستکاری‌اند؛ معیار قطعی توجه یا صداقت دانشجو نیستند.
- تعویض دستگاه یا پاک‌کردن دادهٔ مرورگر، بازیابی خودکار ندارد.
- آمار کلاس از حداقل ۵ ثبت معتبر نمایش داده می‌شود؛ گروه‌های لنگر با کمتر از ۵ نفر پنهان می‌مانند.
- مجوز فونت در `assets/fonts/OFL.txt` است. جزوه همان فایل ارائه‌شده توسط مدرس است.

## مستندات سرویس‌ها

- [GitHub Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web)
- [google.script.run](https://developers.google.com/apps-script/guides/html/communication)
- [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
- [clasp](https://developers.google.com/apps-script/guides/clasp)
