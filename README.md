# TaseesCode — تأسيس كود

Arabic-first AI coding assistant built by [TaseesAI](https://taseesai.com) in Jeddah, Saudi Arabia.

Multi-model support (DeepSeek V3, Claude Sonnet, GPT-4o) with an extensible skills system.

## Install

```bash
npm install -g taseescode
```

## Setup

Set your API key for the model you want to use:

```bash
# DeepSeek (default, cheapest)
taseescode
# Then type: /config apiKeys.deepseek YOUR_DEEPSEEK_API_KEY

# Claude
# /config apiKeys.anthropic YOUR_ANTHROPIC_API_KEY

# GPT-4o
# /config apiKeys.openai YOUR_OPENAI_API_KEY
```

## Usage

```bash
taseescode
```

Then type your message. TaseesCode auto-detects Arabic or English and responds in the same language.

```
❯ اعمل لي API بالنود
❯ fix the bug in auth.ts
❯ /model list
❯ /cost
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/clear` | Clear conversation history |
| `/model` | Show current model |
| `/model list` | List all models with SAR pricing |
| `/model [name]` | Switch model |
| `/cost` | Show session cost in SAR |
| `/config show` | Show current config |
| `/config [key] [value]` | Set config value |
| `/memory` | Show TASEESCODE.md |
| `/memory reset` | Clear project memory |
| `/skills list` | List installed skills |
| `/skills install [name]` | Install skill from registry |
| `/skills remove [name]` | Remove installed skill |
| `/exit` | Exit TaseesCode |

## Skills

TaseesCode supports an extensible skills system. Place skill definitions in `~/.taseescode/skills/[name]/skill.json`:

```json
{
  "name": "react-expert",
  "version": "1.0.0",
  "description": "Deep React/Next.js expertise",
  "commands": ["/react", "/component"],
  "systemPromptAddition": "You are also a React/Next.js expert...",
  "author": "taseesai"
}
```

## Models & Pricing (SAR)

| Model | Input (SAR/M tokens) | Output (SAR/M tokens) |
|-------|---------------------|----------------------|
| DeepSeek V3 | 0.054 | 0.216 |
| Claude Sonnet | 5.62 | 16.87 |
| GPT-4o | 9.37 | 28.12 |

## TASEESCODE.md

Create a `TASEESCODE.md` file in your project root to give TaseesCode persistent context about your project. It reads this file on every startup.

## Built by TaseesAI

Jeddah, Saudi Arabia — Vision 2030
