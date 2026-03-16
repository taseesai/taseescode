import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import chalk from "chalk";
import { getConfig } from "../utils/config";

interface PromptProps {
  onSubmit: (value: string) => void;
  isLoading: boolean;
}

interface SlashCommand {
  cmd: string;
  syntax: string;
  desc: string;
  descAr: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: "/help",           syntax: "/help",                  desc: "Show all commands",          descAr: "عرض جميع الأوامر" },
  { cmd: "/clear",          syntax: "/clear",                 desc: "Clear conversation",         descAr: "مسح المحادثة" },
  { cmd: "/model",          syntax: "/model [name]",          desc: "Switch or list models",      descAr: "تغيير النموذج أو عرض القائمة" },
  { cmd: "/model list",     syntax: "/model list",            desc: "All models + SAR pricing",   descAr: "كل النماذج مع الأسعار" },
  { cmd: "/cost",           syntax: "/cost",                  desc: "Session cost in SAR",        descAr: "تكلفة الجلسة بالريال" },
  { cmd: "/config",         syntax: "/config [key] [value]",  desc: "Get or set config",          descAr: "عرض أو تغيير الإعدادات" },
  { cmd: "/config show",    syntax: "/config show",           desc: "Show all settings",          descAr: "عرض جميع الإعدادات" },
  { cmd: "/memory",         syntax: "/memory",                desc: "View TASEESCODE.md",         descAr: "عرض ذاكرة المشروع" },
  { cmd: "/memory reset",   syntax: "/memory reset",          desc: "Clear project memory",       descAr: "مسح ذاكرة المشروع" },
  { cmd: "/skills",         syntax: "/skills list",           desc: "List installed skills",      descAr: "عرض المهارات المثبّتة" },
  { cmd: "/skills install", syntax: "/skills install [name]", desc: "Install a skill",            descAr: "تثبيت مهارة" },
  { cmd: "/skills remove",  syntax: "/skills remove [name]",  desc: "Remove a skill",             descAr: "حذف مهارة" },
  { cmd: "/review",         syntax: "/review [file?]",        desc: "AI code review",             descAr: "مراجعة الكود بالذكاء الاصطناعي" },
  { cmd: "/explain",        syntax: "/explain",               desc: "Explain selected code",      descAr: "شرح الكود المحدد" },
  { cmd: "/fix",            syntax: "/fix [error]",           desc: "Fix an error instantly",     descAr: "إصلاح خطأ فوراً" },
  { cmd: "/standup",        syntax: "/standup",               desc: "Generate standup from git",  descAr: "توليد تقرير الستاند أب" },
  { cmd: "/deploy",         syntax: "/deploy [vercel|netlify|railway]", desc: "One-command deploy + preview URL", descAr: "نشر بأمر واحد مع رابط معاينة" },
  { cmd: "/deploy status",  syntax: "/deploy status",          desc: "Check deployment status",    descAr: "حالة النشر" },
  { cmd: "/git diff",       syntax: "/git diff",              desc: "Show git diff",              descAr: "عرض الفروقات" },
  { cmd: "/git commit",     syntax: "/git commit",            desc: "AI commit message + commit", descAr: "رسالة commit ذكية" },
  { cmd: "/git pr",         syntax: "/git pr",                desc: "Generate PR description",    descAr: "توليد وصف الـ PR" },
  { cmd: "/health",         syntax: "/health",                desc: "Codebase health report",     descAr: "تقرير صحة الكود" },
  { cmd: "/audit",          syntax: "/audit",                 desc: "Security audit scan",        descAr: "فحص أمني للمشروع" },
  { cmd: "/audit secrets",  syntax: "/audit secrets",         desc: "Scan for hardcoded secrets", descAr: "كشف الأسرار المكشوفة" },
  { cmd: "/audit deps",     syntax: "/audit deps",            desc: "Check dependency vulns",     descAr: "فحص ثغرات التبعيات" },
  { cmd: "/n8n",            syntax: "/n8n [description]",     desc: "Generate n8n workflow",      descAr: "توليد workflow لـ n8n" },
  { cmd: "/template",       syntax: "/template [name]",       desc: "Scaffold from template",     descAr: "بناء مشروع من قالب" },
  { cmd: "/history",        syntax: "/history",               desc: "Browse past sessions",       descAr: "تصفح الجلسات السابقة" },
  { cmd: "/compact",        syntax: "/compact",               desc: "Compact conversation",       descAr: "ضغط المحادثة" },
  { cmd: "/permissions",    syntax: "/permissions",            desc: "View permissions",           descAr: "عرض الصلاحيات" },
  { cmd: "/api add",        syntax: "/api add [name] [url]",  desc: "Connect any API",            descAr: "ربط API خارجي" },
  { cmd: "/api list",       syntax: "/api list",              desc: "List connected APIs",        descAr: "عرض الاتصالات" },
  { cmd: "/api test",       syntax: "/api test [name]",       desc: "Test API connection",        descAr: "اختبار الاتصال" },
  { cmd: "/budget",          syntax: "/budget",                 desc: "Budget dashboard — track SAR spend with limits", descAr: "لوحة الميزانية — تتبع إنفاقك بالريال مع حدود" },
  { cmd: "/budget daily",    syntax: "/budget daily [amount]",  desc: "Set daily SAR limit — auto-warns when approaching", descAr: "حد يومي بالريال — تنبيه تلقائي عند الاقتراب" },
  { cmd: "/budget weekly",   syntax: "/budget weekly [amount]", desc: "Set weekly SAR limit", descAr: "حد أسبوعي بالريال" },
  { cmd: "/budget monthly",  syntax: "/budget monthly [amount]",desc: "Set monthly SAR limit with spend prediction", descAr: "حد شهري مع توقع الإنفاق" },
  { cmd: "/budget clear",    syntax: "/budget clear",           desc: "Remove all budget limits", descAr: "إزالة جميع حدود الميزانية" },
  { cmd: "/scrape",          syntax: "/scrape <url or topic>",  desc: "Scrape a URL or search any topic on the web", descAr: "استخراج صفحة أو بحث عن أي موضوع" },
  { cmd: "/scrape --full",   syntax: "/scrape <url> --full",    desc: "Scrape JS-rendered pages with headless browser", descAr: "استخراج صفحات ديناميكية بمتصفح" },
  { cmd: "/scrape --screenshot", syntax: "/scrape <url> --screenshot", desc: "Capture full-page screenshot", descAr: "لقطة شاشة كاملة للصفحة" },
  { cmd: "/scrape --links",  syntax: "/scrape <url> --links",   desc: "Extract all internal & external links", descAr: "استخراج جميع الروابط" },
  { cmd: "/scrape --crawl",  syntax: "/scrape <url> --crawl",   desc: "Crawl entire website (follow links)", descAr: "زحف الموقع بالكامل" },
  { cmd: "/scrape --api",    syntax: "/scrape <url> --api",     desc: "Discover API/XHR endpoints from page", descAr: "اكتشاف نقاط API من الصفحة" },
  { cmd: "/voice",          syntax: "/voice",                  desc: "Speak to code — words appear as you talk (free)", descAr: "تكلم للبرمجة — الكلمات تظهر أثناء حديثك (مجاني)" },
  { cmd: "/multiagent",     syntax: "/multiagent [task]",      desc: "Split task into parallel AI agents — each works independently", descAr: "تقسيم المهمة لوكلاء ذكاء اصطناعي يعملون بالتوازي" },
  { cmd: "/offline",         syntax: "/offline",                desc: "Check offline status & local models", descAr: "حالة الاتصال والنماذج المحلية" },
  { cmd: "/offline on",      syntax: "/offline on",             desc: "Enable auto-fallback to local Ollama models", descAr: "تفعيل النموذج المحلي تلقائياً" },
  { cmd: "/offline off",     syntax: "/offline off",            desc: "Disable local model fallback", descAr: "تعطيل النموذج المحلي" },
  { cmd: "/offline models",  syntax: "/offline models",         desc: "List installed Ollama models", descAr: "عرض النماذج المحلية المثبتة" },
  { cmd: "/offline setup",   syntax: "/offline setup",          desc: "Ollama installation guide", descAr: "دليل تثبيت Ollama" },
  { cmd: "/trust",          syntax: "/trust",                 desc: "Show confidence score (0-100%) for last AI response", descAr: "درجة الثقة بالرد الأخير (0-100%)" },
  { cmd: "/trust auto on",  syntax: "/trust auto on",         desc: "Auto-verify low-confidence responses with second pass", descAr: "تحقق تلقائي من الردود منخفضة الثقة" },
  { cmd: "/trust auto off", syntax: "/trust auto off",        desc: "Disable auto-verification", descAr: "إيقاف التحقق التلقائي" },
  { cmd: "/audit",          syntax: "/audit",                 desc: "Security scan — find secrets, XSS, SQL injection, vuln deps", descAr: "فحص أمني — كشف الأسرار والثغرات" },
  { cmd: "/audit secrets",  syntax: "/audit secrets",         desc: "Scan for hardcoded API keys, passwords, tokens", descAr: "فحص المفاتيح وكلمات المرور المشفرة" },
  { cmd: "/audit deps",     syntax: "/audit deps",            desc: "Check dependency vulnerabilities (npm audit)", descAr: "فحص ثغرات المكتبات" },
  { cmd: "/test-gen",        syntax: "/test-gen <file>",       desc: "Generate tests for a file (auto-detects framework)", descAr: "توليد اختبارات لملف (كشف تلقائي للإطار)" },
  { cmd: "/test-gen --run",  syntax: "/test-gen <file> --run", desc: "Generate and run tests immediately", descAr: "توليد وتشغيل الاختبارات فوراً" },
  { cmd: "/learn",          syntax: "/learn",                 desc: "Analyze codebase DNA — learn your naming, style, stack", descAr: "تحليل الحمض النووي للمشروع — تعلم أسلوبك" },
  { cmd: "/learn show",     syntax: "/learn show",            desc: "Show learned coding style profile", descAr: "عرض ملف أسلوب البرمجة المتعلم" },
  { cmd: "/learn reset",    syntax: "/learn reset",           desc: "Delete learned profile", descAr: "حذف الملف المتعلم" },
  { cmd: "/debt",           syntax: "/debt",                  desc: "Technical debt scan with score (0-100)", descAr: "فحص الديون التقنية مع درجة" },
  { cmd: "/debt report",    syntax: "/debt report",           desc: "Detailed debt report by category", descAr: "تقرير ديون مفصل حسب الفئة" },
  { cmd: "/debt score",     syntax: "/debt score",            desc: "Quick debt score only", descAr: "درجة الديون التقنية فقط" },
  { cmd: "/pipeline",        syntax: "/pipeline",              desc: "AI-generated CI/CD pipelines",              descAr: "أنابيب CI/CD بالذكاء الاصطناعي" },
  { cmd: "/pipeline github", syntax: "/pipeline github",       desc: "Generate GitHub Actions workflow",          descAr: "توليد GitHub Actions" },
  { cmd: "/pipeline gitlab", syntax: "/pipeline gitlab",       desc: "Generate GitLab CI config",                 descAr: "توليد GitLab CI" },
  { cmd: "/pipeline docker", syntax: "/pipeline docker",       desc: "Generate production Dockerfile",            descAr: "توليد Dockerfile" },
  { cmd: "/pipeline all",    syntax: "/pipeline all",          desc: "Generate all CI/CD configs",                descAr: "توليد جميع إعدادات CI/CD" },
  { cmd: "/collab",          syntax: "/collab",                 desc: "Real-time pair programming sessions",       descAr: "جلسات برمجة مشتركة بالوقت الحقيقي" },
  { cmd: "/collab start",    syntax: "/collab start",           desc: "Host a pair programming session",           descAr: "بدء جلسة برمجة مشتركة" },
  { cmd: "/collab join",     syntax: "/collab join <host:port>",desc: "Join a session on local network",           descAr: "الانضمام لجلسة على الشبكة المحلية" },
  { cmd: "/collab stop",     syntax: "/collab stop",            desc: "End the current collab session",            descAr: "إنهاء الجلسة الحالية" },
  { cmd: "/collab status",   syntax: "/collab status",          desc: "Check collab session status",               descAr: "حالة جلسة التعاون" },
  { cmd: "/gamify",          syntax: "/gamify",                 desc: "Show XP, level & coding streak",          descAr: "عرض المستوى والنقاط وسلسلة البرمجة" },
  { cmd: "/gamify achievements", syntax: "/gamify achievements", desc: "List all achievements",                  descAr: "عرض جميع الإنجازات" },
  { cmd: "/gamify reset",   syntax: "/gamify reset",            desc: "Reset all gamify stats",                 descAr: "إعادة تعيين إحصائيات التلعيب" },
  { cmd: "/gamify help",    syntax: "/gamify help",             desc: "XP system guide",                        descAr: "دليل نظام النقاط" },
  { cmd: "/gov",             syntax: "/gov",                   desc: "Saudi compliance scan (PDPL, NCA, NDMO)",  descAr: "فحص الامتثال السعودي" },
  { cmd: "/gov pdpl",        syntax: "/gov pdpl",              desc: "PDPL data protection checks",              descAr: "فحص حماية البيانات الشخصية" },
  { cmd: "/gov nca",         syntax: "/gov nca",               desc: "NCA cybersecurity checks",                 descAr: "فحص الأمن السيبراني" },
  { cmd: "/gov data",        syntax: "/gov data",              desc: "Data sovereignty checks (NDMO)",           descAr: "فحص سيادة البيانات" },
  { cmd: "/gov report",      syntax: "/gov report",            desc: "Generate compliance report file",          descAr: "توليد تقرير الامتثال" },
  { cmd: "/exit",           syntax: "/exit",                  desc: "Exit TaseesCode — saves memory & session", descAr: "الخروج — يحفظ الذاكرة والجلسة" },
  { cmd: "/replay",          syntax: "/replay",                desc: "Session recording & playback",             descAr: "تسجيل وتشغيل الجلسات" },
  { cmd: "/replay start",    syntax: "/replay start [name]",   desc: "Start recording this session",             descAr: "بدء تسجيل الجلسة" },
  { cmd: "/replay stop",     syntax: "/replay stop",           desc: "Stop recording and save",                  descAr: "إيقاف التسجيل وحفظه" },
  { cmd: "/replay list",     syntax: "/replay list",           desc: "List saved recordings",                    descAr: "عرض التسجيلات المحفوظة" },
  { cmd: "/replay play",     syntax: "/replay play <name>",    desc: "Play back a saved recording",              descAr: "تشغيل تسجيل محفوظ" },
  { cmd: "/replay export",   syntax: "/replay export <name>",  desc: "Export recording to Markdown",             descAr: "تصدير التسجيل لـ Markdown" },
  { cmd: "/replay delete",   syntax: "/replay delete <name>",  desc: "Delete a saved recording",                 descAr: "حذف تسجيل محفوظ" },
  { cmd: "/diff-explain",    syntax: "/diff-explain",          desc: "AI-narrated explanation of git diff",      descAr: "شرح ذكي لتغييرات Git" },
  { cmd: "/diff-explain staged", syntax: "/diff-explain staged", desc: "Explain staged changes with AI",        descAr: "شرح التغييرات المرحلة بالذكاء الاصطناعي" },
  { cmd: "/explain-ar",      syntax: "/explain-ar <file|concept>", desc: "Explain code/concepts in Arabic",     descAr: "شرح الكود والمفاهيم بالعربي" },
];

export const Prompt: React.FC<PromptProps> = ({ onSubmit, isLoading }) => {
  const [value, setValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands based on what user typed after /
  // Only show menu for /word commands, not file paths like /var/folders/... or /Users/...
  const isFilePath = /^\/[a-zA-Z].*\//.test(value) || /^~\//.test(value);
  const showMenu = value.startsWith("/") && !isFilePath && value.length >= 1;
  const query = value.toLowerCase();
  const filtered = showMenu
    ? SLASH_COMMANDS.filter(
        (c) =>
          c.cmd.startsWith(query) ||
          c.syntax.toLowerCase().startsWith(query)
      ).slice(0, 12) // max 12 visible
    : [];

  const safeIndex = Math.min(selectedIndex, Math.max(filtered.length - 1, 0));

  useInput((input, key) => {
    if (!showMenu || filtered.length === 0) return;

    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }

    if (key.tab) {
      // Tab fills in the full syntax for editing
      if (filtered[safeIndex]) {
        setValue(filtered[safeIndex].syntax);
        setSelectedIndex(0);
      }
      return;
    }

    if (key.return) {
      if (filtered[safeIndex]) {
        const selected = filtered[safeIndex];
        const hasArgs = selected.syntax.includes("[") || selected.syntax.includes("<");
        if (hasArgs) {
          // Has required args — fill in template so user can complete it
          setValue(selected.syntax);
          setSelectedIndex(0);
        } else {
          // No args — submit immediately
          onSubmit(selected.syntax);
          setValue("");
          setSelectedIndex(0);
        }
      }
      return;
    }
  }, { isActive: showMenu });

  const handleChange = (val: string) => {
    setValue(val);
    setSelectedIndex(0);
  };

  const handleSubmit = (input: string) => {
    if (input.trim()) {
      onSubmit(input.trim());
      setValue("");
      setSelectedIndex(0);
    }
  };

  if (isLoading) {
    return (
      <Box>
        <Text color="gray">{"  ⏳ "}</Text>
        <Text color="gray">Thinking...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Slash command menu — appears above the prompt */}
      {showMenu && filtered.length > 0 && (() => {
        const lang = getConfig().language || "auto";
        const isAr = lang === "ar";
        return (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="#3A3A3A"
          marginBottom={0}
          paddingX={1}
        >
          <Text color="#4A4A4A">{isAr ? `  الأوامر — Tab للإكمال، ↑↓ للتنقل` : `  Commands — Tab to complete, ↑↓ to navigate`}</Text>
          <Box flexDirection="column" marginTop={0}>
            {filtered.map((cmd, i) => {
              const isSelected = i === safeIndex;
              const desc = isAr ? cmd.descAr : cmd.desc;
              const altDesc = isAr ? cmd.desc : cmd.descAr;
              return (
                <Box key={cmd.cmd + i} flexDirection="row" marginRight={1}>
                  <Text>
                    {isSelected
                      ? chalk.hex("#E8E8E8").bold(`❯ ${cmd.syntax.padEnd(34)}`)
                      : chalk.hex("#555555")(`  ${cmd.syntax.padEnd(34)}`)}
                  </Text>
                  <Text>
                    {isSelected
                      ? chalk.hex("#ABABAB")(desc) + chalk.hex("#3A3A3A")(` — ${altDesc}`)
                      : chalk.hex("#4A4A4A")(desc)}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>
      );
      })()}

      {/* Input prompt */}
      <Box>
        <Text>{chalk.hex("#E8E8E8")("❯ ")}</Text>
        <TextInput
          value={value}
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder="Type a message or / for commands..."
        />
      </Box>
    </Box>
  );
};
