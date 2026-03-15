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

${g("  Memory / الذاكرة")}
  ${w("/memory")}           Show project memory — ${d("عرض الذاكرة")}
  ${w("/memory reset")}     Clear project memory — ${d("مسح الذاكرة")}

${g("  Free Models / نماذج مجانية")}
  ${c("llama-3.3-70b")}     Free via Groq (needs free key)
  ${c("llama-3.1-8b")}      Free via Groq
  ${c("mixtral-8x7b")}      Free via Groq
  ${c("gemma2-9b")}         Free via Groq
  ${c("deepseek-v3")}       Low cost (0.054 SAR/M)
`;
}
