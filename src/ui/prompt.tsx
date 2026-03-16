import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import chalk from "chalk";

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
  { cmd: "/deploy",         syntax: "/deploy [vercel|railway]",desc: "Deploy project",            descAr: "نشر المشروع" },
  { cmd: "/git diff",       syntax: "/git diff",              desc: "Show git diff",              descAr: "عرض الفروقات" },
  { cmd: "/git commit",     syntax: "/git commit",            desc: "AI commit message + commit", descAr: "رسالة commit ذكية" },
  { cmd: "/git pr",         syntax: "/git pr",                desc: "Generate PR description",    descAr: "توليد وصف الـ PR" },
  { cmd: "/health",         syntax: "/health",                desc: "Codebase health report",     descAr: "تقرير صحة الكود" },
  { cmd: "/n8n",            syntax: "/n8n [description]",     desc: "Generate n8n workflow",      descAr: "توليد workflow لـ n8n" },
  { cmd: "/template",       syntax: "/template [name]",       desc: "Scaffold from template",     descAr: "بناء مشروع من قالب" },
  { cmd: "/history",        syntax: "/history",               desc: "Browse past sessions",       descAr: "تصفح الجلسات السابقة" },
  { cmd: "/compact",        syntax: "/compact",               desc: "Compact conversation",       descAr: "ضغط المحادثة" },
  { cmd: "/permissions",    syntax: "/permissions",            desc: "View permissions",           descAr: "عرض الصلاحيات" },
  { cmd: "/api add",        syntax: "/api add [name] [url]",  desc: "Connect any API",            descAr: "ربط API خارجي" },
  { cmd: "/api list",       syntax: "/api list",              desc: "List connected APIs",        descAr: "عرض الاتصالات" },
  { cmd: "/api test",       syntax: "/api test [name]",       desc: "Test API connection",        descAr: "اختبار الاتصال" },
  { cmd: "/multiagent",     syntax: "/multiagent [task]",      desc: "Split task into parallel agents", descAr: "تقسيم المهمة لوكلاء متعددين" },
  { cmd: "/exit",           syntax: "/exit",                  desc: "Exit TaseesCode",            descAr: "الخروج" },
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
      ).slice(0, 8) // max 8 visible
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
      {showMenu && filtered.length > 0 && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="#3A3A3A"
          marginBottom={0}
          paddingX={1}
        >
          <Text color="#4A4A4A">{`  Commands — Tab to complete, ↑↓ to navigate`}</Text>
          <Box flexDirection="column" marginTop={0}>
            {filtered.map((cmd, i) => {
              const isSelected = i === safeIndex;
              return (
                <Box key={cmd.cmd} flexDirection="row" marginRight={1}>
                  <Text>
                    {isSelected
                      ? chalk.hex("#E8E8E8").bold(`❯ ${cmd.syntax.padEnd(32)}`)
                      : chalk.hex("#707070")(`  ${cmd.syntax.padEnd(32)}`)}
                  </Text>
                  <Text>
                    {isSelected
                      ? chalk.hex("#ABABAB")(`${cmd.desc}  `) +
                        chalk.hex("#4A4A4A")(`— ${cmd.descAr}`)
                      : chalk.hex("#4A4A4A")(`${cmd.desc}`)}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

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
