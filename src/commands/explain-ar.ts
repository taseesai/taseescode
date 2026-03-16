import chalk from "chalk";
import path from "path";
import fs from "fs-extra";
import { Agent } from "../core/agent";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  red: chalk.hex("#C75050"),
};

export async function handleExplainAr(args: string, agent: Agent): Promise<string> {
  const subCmd = args.trim();

  if (!subCmd || subCmd === "help") {
    return [
      "",
      p.white.bold("Arabic Code Education"),
      p.gray("\u2501".repeat(40)),
      "",
      "  /explain-ar <file>           Explain a file in Arabic",
      "  /explain-ar <concept>        Explain a programming concept in Arabic",
      "",
      "  Examples:",
      "  /explain-ar src/app.tsx",
      "  /explain-ar React hooks",
      "  /explain-ar async await",
      "  /explain-ar REST API",
      "  /explain-ar SQL injection",
      "",
      p.dim("  Explains code and concepts in Arabic with Saudi cultural examples"),
      p.dim("  Designed for beginner and intermediate Arab developers"),
      "",
    ].join("\n");
  }

  // Check if it's a file path
  const fullPath = path.resolve(process.cwd(), subCmd.split(/\s+/)[0]);
  const isFile = await fs.pathExists(fullPath);

  if (isFile) {
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      const truncated = content.slice(0, 6000);

      await agent.processMessage(
        `اشرح هذا الملف بالعربي بالكامل (${subCmd}). اشرح كل جزء بطريقة بسيطة ومفهومة:\n\n` +
        `١. ما هو هذا الملف؟ (وصف عام)\n` +
        `٢. كيف يعمل؟ (خطوة بخطوة)\n` +
        `٣. ما هي الدوال/الكلاسات الرئيسية؟\n` +
        `٤. كيف يتصل بباقي المشروع؟\n\n` +
        `استخدم تشبيهات من الحياة اليومية السعودية لتوضيح المفاهيم.\n` +
        `مثال: "هذا الملف مثل الكاشير في المحل — يستقبل الطلبات ويوزعها"\n\n` +
        `\`\`\`\n${truncated}\n\`\`\``
      );
      return "";
    } catch (e: any) {
      return p.red(`Error reading file: ${e.message}`).toString();
    }
  }

  // It's a concept — explain it in Arabic
  await agent.processMessage(
    `اشرح المفهوم التالي بالعربي بطريقة بسيطة وممتعة: "${subCmd}"\n\n` +
    `١. ما هو؟ (تعريف بسيط)\n` +
    `٢. ليش مهم؟ (لماذا يحتاجه المبرمج)\n` +
    `٣. مثال عملي بسيط (كود)\n` +
    `٤. أخطاء شائعة يقع فيها المبتدئين\n` +
    `٥. تشبيه من الحياة اليومية\n\n` +
    `استخدم لهجة سعودية ودية. مثال: "فكر فيه كأنه..."` +
    `\nالهدف: مبرمج عربي مبتدئ يفهم المفهوم بالكامل بعد قراءة شرحك.`
  );
  return "";
}
