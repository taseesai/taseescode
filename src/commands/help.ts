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

${g("  Skills / المهارات")}
  ${w("/skills list")}      List installed skills — ${d("عرض المهارات")}
  ${w("/skills install")}   Install a skill — ${d("تثبيت مهارة")}
  ${w("/skills remove")}    Remove a skill — ${d("إزالة مهارة")}

${g("  API / الاتصالات")}
  ${w("/api add [name] [url] [key?]")}  Connect any API — ${d("ربط API")}
  ${w("/api list")}         List connected APIs — ${d("عرض الاتصالات")}
  ${w("/api test [name]")}  Test API connection — ${d("اختبار الاتصال")}
  ${w("/api remove [name]")} Remove API — ${d("إزالة API")}

${g("  Memory / الذاكرة")}
  ${w("/memory")}           Show project memory — ${d("عرض الذاكرة")}
  ${w("/memory reset")}     Clear project memory — ${d("مسح الذاكرة")}

${g("  Images / الصور")}
  Drop any image path or URL into your message — ${d("أرسل مسار صورة أو رابط")}
  ${w("/Users/me/photo.png")}  or  ${w("https://example.com/img.jpg")}
  Vision models: ${c("claude-sonnet")}, ${c("gpt-4o")}, ${c("llama-3.2-vision")} ${d("(free)")}
  Auto-switches to vision model if needed — ${d("تبديل تلقائي لنموذج الرؤية")}

${g("  Free Models / نماذج مجانية")}
  ${c("llama-3.3-70b")}     Free via Groq (needs free key)
  ${c("llama-3.1-8b")}      Free via Groq
  ${c("mixtral-8x7b")}      Free via Groq
  ${c("gemma2-9b")}         Free via Groq
  ${c("deepseek-v3")}       Low cost (0.054 SAR/M)
`;
}
