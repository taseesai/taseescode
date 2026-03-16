import chalk from "chalk";

const w = chalk.hex("#E8E8E8");
const g = chalk.hex("#8B8B8B");
const d = chalk.hex("#4A4A4A");
const c = chalk.hex("#7AC8C8");

export function helpCommand(): string {
  return `
${w.bold("TaseesCode Commands")} ${g("— أوامر تأسيس كود")}
${g("─".repeat(50))}

${g("  Navigation / التنقل")}
  ${w("/help")}             Show this help — ${d("عرض المساعدة")}
  ${w("/clear")}            Clear conversation — ${d("مسح المحادثة")}
  ${w("/exit")}             Exit TaseesCode — ${d("خروج")}

${g("  Models / النماذج")}
  ${w("/model")}            Show current model — ${d("عرض النموذج الحالي")}
  ${w("/model list")}       List all models with SAR pricing — ${d("عرض الكل")}
  ${w("/model [id]")}       Switch model — ${d("تبديل النموذج")}

${g("  Config / الإعدادات")}
  ${w("/config show")}      Show current config — ${d("عرض الإعدادات")}
  ${w("/config set [k] [v]")} Set config value — ${d("تعيين قيمة")}
  ${w("/cost")}             Show session cost in SAR — ${d("عرض التكلفة")}

${g("  Budget / الميزانية")}
  ${w("/budget")}            Show budget dashboard — ${d("لوحة الميزانية")}
  ${w("/budget daily [n]")}  Set daily limit in SAR — ${d("حد يومي")}
  ${w("/budget weekly [n]")} Set weekly limit in SAR — ${d("حد أسبوعي")}
  ${w("/budget monthly [n]")} Set monthly limit in SAR — ${d("حد شهري")}
  ${w("/budget clear")}      Remove all limits — ${d("إزالة الحدود")}

${g("  Skills / المهارات")}
  ${w("/skills list")}      List installed skills — ${d("عرض المهارات")}
  ${w("/skills install")}   Install a skill — ${d("تثبيت مهارة")}
  ${w("/skills remove")}    Remove a skill — ${d("إزالة مهارة")}

${g("  API / الاتصالات")}
  ${w("/api add [name] [url] [key?]")}  Connect any API — ${d("ربط API")}
  ${w("/api list")}         List connected APIs — ${d("عرض الاتصالات")}
  ${w("/api test [name]")}  Test API connection — ${d("اختبار الاتصال")}
  ${w("/api remove [name]")} Remove API — ${d("إزالة API")}

${g("  Scraping / الاستخراج")}
  ${w("/scrape [url]")}       Smart scrape any page — ${d("استخراج ذكي")}
  ${w("/scrape [url] --full")} JS-rendered pages — ${d("صفحات ديناميكية")}
  ${w("/scrape [url] --screenshot")} Capture screenshot — ${d("لقطة شاشة")}
  ${w("/scrape [url] --links")} Extract all links — ${d("استخراج الروابط")}
  ${w("/scrape [url] --crawl")} Crawl entire site — ${d("زحف الموقع")}
  ${w("/scrape [url] --api")}  Discover API endpoints — ${d("اكتشاف نقاط API")}

${g("  Multi-Agent / الوكلاء المتعددين")}
  ${w("/multiagent [task]")}  Split task into parallel agents — ${d("تقسيم المهمة لوكلاء")}

${g("  Code / الكود")}
  ${w("/review [file]")}    Review code or staged changes — ${d("مراجعة الكود")}
  ${w("/explain [file]")}   Explain what code does — ${d("شرح الكود")}
  ${w("/fix [error]")}      Analyze and fix an error — ${d("إصلاح الخطأ")}
  ${w("/standup")}           Generate standup from git — ${d("تقرير يومي")}
  ${w("/health")}            Codebase health report — ${d("صحة المشروع")}
  ${w("/learn")}             Learn codebase DNA (style, stack) — ${d("تعلم نمط الكود")}
  ${w("/learn show")}        Show learned DNA profile — ${d("عرض ملف DNA")}
  ${w("/learn reset")}       Reset learned profile — ${d("إعادة تعيين DNA")}
  ${w("/audit")}             Security audit scan — ${d("فحص أمني")}
  ${w("/audit secrets")}     Scan for hardcoded secrets — ${d("كشف الأسرار")}
  ${w("/audit deps")}        Check dependency vulns — ${d("ثغرات التبعيات")}

${g("  Trust / الثقة")}
  ${w("/trust")}             Show trust score for last response — ${d("درجة الثقة")}
  ${w("/trust auto on")}     Auto-verify low-confidence responses — ${d("تحقق تلقائي")}
  ${w("/trust auto off")}    Disable auto-verification — ${d("إيقاف التحقق")}

${g("  Memory & History / الذاكرة والسجل")}
  ${w("/memory")}           Show project memory — ${d("عرض الذاكرة")}
  ${w("/memory reset")}     Clear project memory — ${d("مسح الذاكرة")}
  ${w("/history")}           Browse past sessions — ${d("سجل الجلسات")}
  ${w("/compact")}           Compact conversation context — ${d("ضغط السياق")}
  ${w("/permissions")}       Show permission settings — ${d("الصلاحيات")}

${g("  Images / الصور")}
  Drop any image path or URL into your message — ${d("أرسل مسار صورة أو رابط")}
  ${w("/Users/me/photo.png")}  or  ${w("https://example.com/img.jpg")}
  Vision models: ${c("claude-sonnet")}, ${c("gpt-4o")}, ${c("llama-3.2-vision")} ${d("(free)")}
  Auto-switches to vision model if needed — ${d("تبديل تلقائي لنموذج الرؤية")}

${g("  Free Models / نماذج مجانية")}
  ${c("llama-3.3-70b")}     Free via Groq (needs free key)
  ${c("llama-3.1-8b")}      Free via Groq
  ${c("llama-4-scout")}     Free via Groq — Latest Llama 4
  ${c("kimi-k2")}           Free via Groq — Agentic + Arabic
  ${c("qwen3-32b")}         Free via Groq — Strong coder
  ${c("allam-2")}           Free via Groq — Saudi Arabic (KACST)
  ${c("compound")}          Free via Groq — Compound reasoning
  ${c("deepseek-v3")}       Low cost (0.054 SAR/M)
`;
}
