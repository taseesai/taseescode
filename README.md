# TaseesCode -- Your Arabic-First AI Coding Assistant

> مساعدك الذكي للبرمجة — Built in Jeddah, Saudi Arabia

[![npm version](https://img.shields.io/npm/v/taseescode.svg)](https://www.npmjs.com/package/taseescode)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Made in Saudi Arabia](https://img.shields.io/badge/Made%20in-Saudi%20Arabia%20%F0%9F%87%B8%F0%9F%87%A6-green.svg)](https://taseescode.com)
[![Node 18+](https://img.shields.io/badge/Node-18%2B-brightgreen.svg)](https://nodejs.org)

---

## What is TaseesCode?

TaseesCode is a terminal-based AI coding assistant built from the ground up with Arabic language support. Unlike other AI coding tools that treat Arabic as an afterthought, TaseesCode was designed in Jeddah, Saudi Arabia by TaseesAI with first-class Arabic support baked into every interaction. You type in Arabic, English, or a mix of both -- and TaseesCode responds naturally, writes your code, edits your files, runs your commands, and tracks your costs in Saudi Riyals.

Think of it as having a senior developer sitting next to you in your terminal. It reads your project files, understands your codebase, creates and edits files, runs shell commands, searches code with regex, manages git commits, analyzes images and videos, and connects to 13+ AI models ranging from free open-source models to the most capable commercial ones. Whether you are a student in Riyadh learning to code, a startup founder in Jeddah shipping fast, or an enterprise team in Dammam building at scale -- TaseesCode meets you where you are.

---

## Quick Start (60 Seconds)

```bash
# 1. Install globally
npm install -g taseescode

# 2. Launch
taseescode

# 3. Complete the onboarding wizard (takes 30 seconds)
# 4. Start coding!
> اكتب لي API بسيط بـ Express.js مع endpoint واحد
```

That is it. The onboarding wizard walks you through language, model, API key, permissions, and theme. You will be writing code with AI assistance in under a minute.

---

## Installation

### Requirements

- **Node.js 18+** (check with `node --version`)
- **npm** (comes with Node.js)
- **ffmpeg** (optional, required only for video analysis)

### Install via npm

```bash
npm install -g taseescode
```

### Verify installation

```bash
taseescode --version
# taseescode v0.1.0
```

### Update to latest

```bash
npm update -g taseescode
```

### Uninstall

```bash
npm uninstall -g taseescode
```

All configuration is stored in `~/.taseescode/config.json`. Removing TaseesCode does not delete your config -- you can manually remove `~/.taseescode/` if you want a clean slate.

---

## First Run -- The Onboarding Wizard

When you run `taseescode` for the first time, a 6-step onboarding wizard guides you through setup:

```
┌──────────────────────────────────────────┐
│                                          │
│   TaseesCode                             │
│   مساعدك الذكي للبرمجة                   │
│                                          │
│   Built in Jeddah, Saudi Arabia          │
│   by TaseesAI                            │
│                                          │
└──────────────────────────────────────────┘
```

### Step 1: Welcome

A welcome screen introduces TaseesCode and what it can do. Press Enter to continue.

### Step 2: Language Selection

```
? Choose your language:
  > Auto-detect (recommended)
    العربية (Arabic)
    English
```

- **Auto-detect** analyzes each message and responds in the same language you type.
- **Arabic** forces all responses to Arabic.
- **English** forces all responses to English.

Auto-detect is recommended because most developers mix languages naturally: you might ask a question in Arabic but want code comments in English.

### Step 3: Model Selection

An interactive picker shows all available models with pricing. Free models (via Groq) are highlighted so you can get started without paying anything.

### Step 4: API Key

Based on your chosen model, the wizard asks for the relevant API key. For free Groq models, you need a Groq API key (free at [console.groq.com](https://console.groq.com)). For paid models, you enter the corresponding provider key.

### Step 5: Permissions

```
? File write permission:
  > Ask every time (recommended)
    Always allow
    Never allow

? Command run permission:
  > Ask every time (recommended)
    Always allow
    Never allow
```

These control whether TaseesCode can write files and run shell commands. "Ask every time" is the safest default -- you will see exactly what TaseesCode wants to do and approve or reject each action.

### Step 6: Theme

```
? Choose your theme:
  > Silver (default)
    Minimal
    Dark
```

Pick a visual theme for the TaseesCode interface. You can change this later with `/config set theme dark`.

After completing all steps, TaseesCode saves your configuration to `~/.taseescode/config.json` and drops you into the interactive prompt.

---

## Models

TaseesCode connects to 13 models across 6 providers. Here is every model available:

### Paid Models

| Model ID | Name | Provider | Input (SAR/M tokens) | Output (SAR/M tokens) | Context | Best For |
|---|---|---|---|---|---|---|
| `deepseek-v3` | DeepSeek V3 | DeepSeek | 0.054 | 0.216 | 128K | General coding, Arabic, best value |
| `claude-sonnet` | Claude Sonnet | Anthropic | 5.62 | 16.87 | 200K | Complex reasoning, large codebases, best quality |
| `gpt-4o` | GPT-4o | OpenAI | 9.37 | 28.12 | 128K | Multimodal, vision, broad knowledge |
| `qwen-2.5-coder` | Qwen 2.5 Coder | Qwen | 0 | 0 | 131K | Pure code generation, completions, refactoring |
| `kimi-k1.5` | Kimi K1.5 | Kimi | 0.21 | 0.63 | 128K | Long documents, deep analysis, 128K context |

### Free Models (via Groq)

All of these models are **completely free** and require only a single Groq API key. Get yours at [console.groq.com](https://console.groq.com).

| Model ID | Name | Context | Best For |
|---|---|---|---|
| `llama-3.3-70b` | Llama 3.3 70B | 128K | Arabic, fast, best free model overall |
| `llama-3.1-8b` | Llama 3.1 8B | 128K | Instant responses, quick questions |
| `llama-4-scout` | Llama 4 Scout | 131K | Latest Llama 4, fast, strong reasoning |
| `kimi-k2` | Kimi K2 | 131K | Agentic tasks, code, Arabic |
| `qwen3-32b` | Qwen 3 32B | 131K | Strong coder, multilingual, Arabic |
| `allam-2` | ALLAM 2 (Saudi) | 4K | Saudi Arabic specialist, KACST model |
| `compound` | Groq Compound | 131K | Groq agentic, compound reasoning |
| `llama-3.2-vision` | Llama 3.2 Vision | 128K | Image analysis, vision tasks, Arabic |

### Vision-Capable Models

Three models support image and vision analysis:

- **claude-sonnet** -- highest quality vision analysis (paid)
- **gpt-4o** -- strong multimodal capabilities (paid)
- **llama-3.2-vision** -- free vision model via Groq

### How to Unlock Models

Each provider requires its own API key. Add keys with `/config set`:

```bash
# Free models (Groq) -- one key unlocks 8 models
/config set apiKeys.groq gsk_your_groq_key_here

# DeepSeek -- best value paid model
/config set apiKeys.deepseek sk-your_deepseek_key_here

# Anthropic -- highest quality
/config set apiKeys.anthropic sk-ant-your_key_here

# OpenAI -- GPT-4o
/config set apiKeys.openai sk-your_openai_key_here

# Qwen -- free code generation
/config set apiKeys.qwen sk-your_qwen_key_here

# Kimi -- long document analysis
/config set apiKeys.kimi sk-your_kimi_key_here
```

**Recommendation for beginners:** Start with a free Groq key. It gives you access to 8 models including Llama 3.3 70B, which is excellent for most coding tasks and has strong Arabic support.

---

## Slash Commands -- Complete Reference

All commands start with `/`. Type `/` and use arrow keys to browse the interactive menu, or type the full command.

### General Commands

| Command | Description | Example |
|---|---|---|
| `/help` | Show help and list all commands | `/help` |
| `/clear` | Clear the current conversation | `/clear` |
| `/exit` | Exit TaseesCode | `/exit` |

### Model Commands

| Command | Description | Example |
|---|---|---|
| `/model` | Show the currently active model | `/model` |
| `/model list` | List all models with SAR pricing | `/model list` |
| `/model [id]` | Switch to a specific model | `/model deepseek-v3` |

### Configuration Commands

| Command | Description | Example |
|---|---|---|
| `/config show` | Display all current settings | `/config show` |
| `/config set [key] [value]` | Update a setting | `/config set theme dark` |

### Cost Commands

| Command | Description | Example |
|---|---|---|
| `/cost` | Show session cost breakdown in SAR | `/cost` |

### Skills Commands

| Command | Description | Example |
|---|---|---|
| `/skills list` | List installed skills | `/skills list` |
| `/skills available` | Browse the skill registry | `/skills available` |
| `/skills install [name]` | Install from registry | `/skills install laravel-helper` |
| `/skills install [user/repo]` | Install from GitHub | `/skills install ahmed/my-skill` |
| `/skills update [name]` | Update an installed skill | `/skills update laravel-helper` |
| `/skills remove [name]` | Remove a skill | `/skills remove laravel-helper` |

### API Commands

| Command | Description | Example |
|---|---|---|
| `/api add [name] [url] [key?]` | Connect a custom API | `/api add local http://localhost:11434` |
| `/api list` | List connected APIs | `/api list` |
| `/api test [name]` | Test a connection | `/api test local` |
| `/api remove [name]` | Remove a connection | `/api remove local` |

### Memory Commands

| Command | Description | Example |
|---|---|---|
| `/memory` | Show current project memory | `/memory` |
| `/memory reset` | Clear project memory | `/memory reset` |

---

## The Slash Command Menu

When you type `/` at the prompt, TaseesCode opens an interactive menu:

```
> /
  > /help        — Show help
    /clear       — Clear conversation
    /model       — Model settings
    /config      — Configuration
    /cost        — Session costs
    /skills      — Manage skills
    /api         — API connections
    /memory      — Project memory
    /exit        — Exit
```

Use the **up/down arrow keys** to navigate and **Enter** to select. You can also type ahead to filter -- for example, typing `/sk` narrows the list to `/skills`.

---

## Model Switching

### Quick Switch

```
/model llama-3.3-70b
```

Instantly switches to the specified model. Your conversation history is preserved.

### Interactive Picker

```
/model list
```

Displays all models in a formatted table:

```
  ID               Provider   Cost (SAR)      Context   Best For
  ─────────────────────────────────────────────────────────────────
  deepseek-v3      deepseek   0.054/0.216     128K      General coding · Arabic · Best value
  claude-sonnet    anthropic  5.62/16.87      200K      Complex reasoning · Large codebases
  gpt-4o           openai     9.37/28.12      128K      Multimodal · Vision · Broad knowledge
  llama-3.3-70b    groq       Free            128K      Arabic · Fast · Best free model
  ...
```

### When to Switch Models

- **Writing new code** -- `deepseek-v3` or `qwen-2.5-coder` for value, `claude-sonnet` for quality
- **Debugging complex issues** -- `claude-sonnet` (200K context handles huge codebases)
- **Quick questions** -- `llama-3.1-8b` (instant responses)
- **Image analysis** -- `llama-3.2-vision` (free) or `claude-sonnet` (best quality)
- **Arabic-heavy tasks** -- `llama-3.3-70b`, `allam-2`, or `deepseek-v3`
- **Free usage** -- any Groq model

---

## Tools -- What TaseesCode Can Do

TaseesCode has 9 built-in tools that let it interact with your filesystem, run commands, and manage git. Each tool action respects your permission settings.

### File Tools

#### `read_file`
Reads the contents of any file in your project. TaseesCode uses this to understand your existing code before making suggestions or edits.

```
> اقرأ ملف src/index.ts وشرح لي ايش يسوي

[TaseesCode reads src/index.ts and explains the code in Arabic]
```

#### `write_file`
Writes content to a file, overwriting existing content. Used when TaseesCode needs to update an existing file.

```
> عدل ملف package.json وأضف script جديد اسمه "lint"

[TaseesCode reads package.json, modifies it, asks permission, then writes]
```

#### `create_file`
Creates a new file. Used when TaseesCode generates new code for you.

```
> أنشئ ملف utils/helpers.ts فيه function تحول التاريخ الهجري

[TaseesCode creates the file after your approval]
```

#### `delete_file`
Deletes a file from your project. Always asks for confirmation.

```
> احذف ملف temp.log

[TaseesCode asks: Delete temp.log? (y/n)]
```

#### `list_files`
Lists files and directories. TaseesCode uses this to understand your project structure.

```
> ايش الملفات اللي في مجلد src؟

[TaseesCode lists the directory contents]
```

### Command Tools

#### `run_command`
Executes any shell command. This is powerful -- TaseesCode can install packages, run tests, start servers, and more.

```
> شغل الـ tests

[TaseesCode runs: npm test]
[Shows output in real-time]
```

#### `search_code`
Searches your codebase using regex patterns. Fast and thorough.

```
> وين استخدمت useState في المشروع؟

[TaseesCode searches with regex and shows all matches]
```

### Git Tools

#### `git_diff`
Shows the current git diff -- what has changed since the last commit.

```
> ايش التغييرات اللي سويتها؟

[TaseesCode shows the diff with context]
```

#### `git_commit`
Creates a git commit with a message. TaseesCode can write meaningful commit messages based on the actual changes.

```
> سوي commit للتغييرات

[TaseesCode reads the diff, writes a commit message, asks approval, commits]
```

### Permission Prompts

When TaseesCode wants to use a tool that modifies your system, you see a prompt:

```
TaseesCode wants to write to: src/utils/helpers.ts

  + export function toHijriDate(date: Date): string {
  +   // conversion logic
  + }

Allow? (y/n/always)
```

- **y** -- allow this one time
- **n** -- reject this action
- **always** -- allow all future actions of this type (same as `/config set permissions.allowFileWrite always`)

---

## Vision and Image Analysis

TaseesCode can analyze images directly in the terminal. There are two ways to provide images:

### Local Image File

Simply include the file path in your message:

```
> شرح لي هذا الـ screenshot /Users/me/Desktop/error.png

[TaseesCode auto-detects the image path, switches to a vision model, and analyzes it]
```

### Image URL

Paste any image URL:

```
> what does this diagram show? https://example.com/architecture.png

[TaseesCode fetches the image and analyzes it]
```

### Supported Formats

- **jpg / jpeg** -- photographs, screenshots
- **png** -- screenshots, diagrams, UI mockups
- **gif** -- animated images (first frame analyzed)
- **webp** -- modern web images
- **bmp** -- bitmap images

### Auto Model Routing

When TaseesCode detects an image in your message, it automatically routes to a vision-capable model:

1. **claude-sonnet** -- if you have an Anthropic API key (highest quality)
2. **gpt-4o** -- if you have an OpenAI API key
3. **llama-3.2-vision** -- if you have a Groq API key (free)

After the vision analysis, TaseesCode returns to your previously selected model. You do not need to manually switch models.

### Practical Uses

- **Debug UI issues** -- screenshot your broken layout, ask TaseesCode to fix it
- **Recreate designs** -- screenshot a design and ask TaseesCode to write the HTML/CSS
- **Read error messages** -- screenshot terminal errors when copy-paste is not available
- **Analyze diagrams** -- feed architecture diagrams and ask for implementation

---

## Video Analysis

TaseesCode can analyze video files by extracting frames and analyzing them with a vision model.

### Requirements

- **ffmpeg** must be installed and available in your PATH

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows
winget install FFmpeg
```

### How It Works

1. You include a video file path in your message
2. TaseesCode detects the video format
3. ffmpeg extracts up to **6 frames** evenly spaced throughout the video
4. Each frame is sent to a vision model for analysis
5. TaseesCode combines the visual analysis into a coherent response

### Usage

```
> اشرح لي ايش يصير في هذا الفيديو /path/to/demo.mp4

[TaseesCode extracts 6 frames, analyzes each, gives a summary]
```

### Supported Video Formats

| Format | Extension |
|---|---|
| MP4 | `.mp4` |
| QuickTime | `.mov` |
| AVI | `.avi` |
| Matroska | `.mkv` |
| WebM | `.webm` |
| MPEG-4 | `.m4v` |
| Windows Media | `.wmv` |
| Flash Video | `.flv` |
| 3GPP | `.3gp` |

### Practical Uses

- **Review demo videos** -- analyze screen recordings of bugs
- **Tutorial analysis** -- extract steps from coding tutorial videos
- **UI review** -- analyze app walkthrough recordings

---

## Skills System

Skills extend TaseesCode with specialized knowledge and commands. Think of them as plugins that teach TaseesCode new tricks.

### Browsing and Installing Skills

```bash
# See what is installed
/skills list

# Browse the registry
/skills available

# Install from the registry
/skills install laravel-helper

# Install from a GitHub repository
/skills install ahmed/react-patterns

# Update a skill
/skills update laravel-helper

# Remove a skill
/skills remove laravel-helper
```

### What Skills Can Do

A skill can:
- Add new slash commands
- Inject system prompt context (so TaseesCode knows domain-specific information)
- Provide specialized behavior for frameworks, languages, or workflows

### Skill Storage

Skills are stored in `~/.taseescode/skills/[name]/skill.json`.

### skill.json Format

Every skill has a `skill.json` manifest:

```json
{
  "name": "laravel-helper",
  "version": "1.0.0",
  "description": "Laravel development patterns and Artisan command help",
  "author": "ahmed",
  "commands": [
    {
      "name": "/laravel migrate",
      "description": "Generate and run migrations"
    },
    {
      "name": "/laravel model",
      "description": "Scaffold an Eloquent model with relationships"
    }
  ],
  "systemPromptAddition": "You are an expert Laravel developer. When the user asks about Laravel, use these patterns and best practices: ..."
}
```

### Writing Your Own Skill

See the [Building a Skill](#building-a-skill) section below for a step-by-step guide.

---

## Connect Any API

TaseesCode can connect to any OpenAI-compatible API endpoint. This means you can use local models via Ollama, LM Studio, or any custom deployment.

### Adding a Connection

```bash
# Ollama (local, no key needed)
/api add ollama http://localhost:11434

# LM Studio (local, no key needed)
/api add lmstudio http://localhost:1234

# Custom deployment with API key
/api add myserver https://api.mycompany.com sk-my-secret-key
```

### Managing Connections

```bash
# List all connections
/api list

# Test that a connection works
/api test ollama

# Remove a connection
/api remove ollama
```

### How It Works

1. `/api add` connects to the endpoint and auto-detects available models
2. Each detected model gets a `custom:[name]` model ID
3. Switch to a custom model with `/model custom:ollama`
4. All standard features (tools, streaming, etc.) work if the endpoint supports them

### Example: Using Ollama

```bash
# 1. Install and run Ollama
ollama serve

# 2. Pull a model
ollama pull codellama

# 3. Connect in TaseesCode
/api add ollama http://localhost:11434

# 4. Switch to it
/model custom:ollama

# 5. Start coding with a local model
> refactor this function to use async/await
```

### Example: LM Studio

```bash
# 1. Open LM Studio, load a model, start the server
# 2. Connect in TaseesCode
/api add lmstudio http://localhost:1234

# 3. Use it
/model custom:lmstudio
```

---

## TASEESCODE.md -- Project Memory

`TASEESCODE.md` is a special file you place in your project root. When TaseesCode starts a session, it reads this file to understand your project context. Think of it as a briefing document for your AI assistant.

### Creating a TASEESCODE.md

Create a file named `TASEESCODE.md` in your project root:

```markdown
# Project: My E-Commerce API

## Tech Stack
- Node.js + Express
- PostgreSQL + Prisma ORM
- TypeScript
- Jest for testing

## Architecture
- /src/routes -- API route handlers
- /src/services -- Business logic
- /src/models -- Prisma models
- /src/middleware -- Auth, validation, error handling

## Conventions
- All responses use the ApiResponse wrapper from src/utils/response.ts
- Error codes follow the pattern: MODULE_ACTION_ERROR (e.g., AUTH_LOGIN_INVALID)
- All prices stored in halalas (smallest unit), converted to SAR in response
- Arabic strings stored as UTF-8, no transliteration

## Current Sprint
- Building the product review system
- Need to add image upload to reviews
- Performance optimization on search endpoint

## Important Notes
- Never modify the migration files directly
- The auth middleware expects JWT in Bearer format
- Rate limiting is set to 100 req/min per IP
```

### What to Include

- **Tech stack** -- languages, frameworks, databases
- **Project structure** -- where things live in your codebase
- **Conventions** -- naming patterns, coding standards, architectural decisions
- **Current context** -- what you are working on right now
- **Gotchas** -- things the AI should know to avoid mistakes

### Managing Project Memory

```bash
# View the current TASEESCODE.md content
/memory

# Reset (clear) the project memory
/memory reset
```

The `/memory reset` command clears the in-memory context. To permanently change the memory, edit the `TASEESCODE.md` file directly.

---

## Configuration Reference

All configuration is stored in `~/.taseescode/config.json`. You can edit it directly or use `/config set`.

### Complete Configuration Schema

| Key | Type | Default | Description |
|---|---|---|---|
| `defaultModel` | string | `llama-3.3-70b` | The model used when TaseesCode starts |
| `language` | string | `auto` | Language mode: `auto`, `ar`, or `en` |
| `theme` | string | `silver` | UI theme: `silver`, `minimal`, or `dark` |
| `costCurrency` | string | `SAR` | Currency for cost display |
| `costWarningThreshold` | number | `10` | Warn when session cost exceeds this (in SAR) |
| `autoCompact` | boolean | `true` | Automatically compact long conversations |
| `contextLimit` | number | `80000` | Max context tokens before compaction |
| `permissions.allowFileWrite` | string | `ask` | File write permission: `ask`, `always`, or `never` |
| `permissions.allowCommandRun` | string | `ask` | Command run permission: `ask`, `always`, or `never` |
| `apiKeys.deepseek` | string | `""` | DeepSeek API key |
| `apiKeys.anthropic` | string | `""` | Anthropic API key |
| `apiKeys.openai` | string | `""` | OpenAI API key |
| `apiKeys.qwen` | string | `""` | Qwen API key |
| `apiKeys.kimi` | string | `""` | Kimi API key |
| `apiKeys.groq` | string | `""` | Groq API key (unlocks 8 free models) |

### Configuration Examples

```bash
# Switch default model
/config set defaultModel deepseek-v3

# Set language to Arabic
/config set language ar

# Change theme
/config set theme dark

# Set cost warning to 50 SAR
/config set costWarningThreshold 50

# Allow all file writes without asking
/config set permissions.allowFileWrite always

# Add a Groq API key
/config set apiKeys.groq gsk_your_key_here

# Show all current settings
/config show
```

### Config File Location

```
~/.taseescode/config.json
```

You can view this file directly with any editor, but using `/config set` ensures proper validation.

---

## Arabic Language Support

TaseesCode was built with Arabic as a first-class language, not a translation layer on top of English.

### Auto-Detection

When `language` is set to `auto` (the default), TaseesCode analyzes each message:

- If you write in Arabic, it responds in Arabic
- If you write in English, it responds in English
- If you mix both, it matches the dominant language

### How It Works in Practice

```
> أنشئ API endpoint يرجع قائمة المستخدمين

TaseesCode: حاضر، بأنشئ لك endpoint GET /users يرجع قائمة المستخدمين:

[creates the code with English code + Arabic comments where appropriate]
```

```
> Create a User model with name and email

TaseesCode: Here's a User model with name and email fields:

[creates the code with English throughout]
```

### Code and Comments

TaseesCode follows a practical approach:
- **Code** is always in English (variable names, function names, syntax)
- **Comments** follow your language preference
- **Commit messages** follow your language preference
- **Explanations** follow your language preference

### Arabic-Optimized Models

These models have the strongest Arabic capabilities:

1. **ALLAM 2** -- purpose-built for Saudi Arabic by KACST (free via Groq)
2. **DeepSeek V3** -- excellent Arabic at the lowest cost
3. **Llama 3.3 70B** -- strong Arabic, free via Groq
4. **Kimi K2** -- good Arabic support, free via Groq
5. **Qwen 3 32B** -- multilingual including Arabic, free via Groq

---

## Cost Tracking

TaseesCode tracks your spending in Saudi Riyals (SAR) throughout each session.

### Viewing Costs

```
/cost
```

Output:

```
Session Cost Breakdown
──────────────────────────────────
Model              Tokens In    Tokens Out    Cost (SAR)
deepseek-v3        12,450       3,200         0.0014
claude-sonnet      8,100        1,500         0.071
──────────────────────────────────
Total                                         0.072 SAR
```

### How Pricing Works

Each model has an input cost (what you send) and an output cost (what the model generates), measured per million tokens. One million tokens is roughly 750,000 words.

**Real-world cost examples:**

| Task | Model | Approximate Cost |
|---|---|---|
| Quick question | deepseek-v3 | < 0.001 SAR |
| Generate a full component | deepseek-v3 | ~0.002 SAR |
| Analyze a large codebase | claude-sonnet | ~0.10 SAR |
| Full day of heavy usage | deepseek-v3 | ~0.50 SAR |
| Full day of heavy usage | claude-sonnet | ~5-15 SAR |
| Any amount of usage | Groq models | 0 SAR (free) |

### Cost Warning

When your session cost exceeds the `costWarningThreshold` (default: 10 SAR), TaseesCode displays a warning:

```
Warning: Session cost has exceeded 10.00 SAR
```

Adjust the threshold:

```bash
/config set costWarningThreshold 50
```

Set to `0` to disable warnings.

---

## Advanced Usage

### Combining Vision + Code Generation

```
> here's the Figma design /screenshots/login-page.png
> recreate this exactly in React + Tailwind CSS
```

TaseesCode analyzes the image, then generates the complete component.

### Multi-File Project Generation

```
> أنشئ مشروع Express.js كامل مع:
> - authentication بـ JWT
> - CRUD endpoints لـ products
> - Prisma مع PostgreSQL
> - validation بـ Zod
> - error handling middleware
```

TaseesCode creates all files, sets up the project structure, installs dependencies, and configures everything.

### Git Workflow

```
> شوف التغييرات اللي سويتها وسوي commit بـ message مناسب
```

TaseesCode runs `git diff`, reads the changes, writes a descriptive commit message, and commits after your approval.

### Debugging with Context

```
> أنا أحصل error في الـ API، هذا الـ error:
> TypeError: Cannot read properties of undefined (reading 'map')
> الملف هو src/routes/products.ts
```

TaseesCode reads the file, identifies the bug, explains it, and proposes a fix.

### Working with Large Codebases

For large projects, TaseesCode's `search_code` tool is invaluable:

```
> وين أقدر ألاقي الـ authentication logic في المشروع؟
```

TaseesCode searches for auth-related patterns across all files and summarizes the architecture.

### Switching Models Mid-Conversation

```
> /model llama-3.1-8b
> ايش هو الفرق بين let و const؟

> /model claude-sonnet
> حلل لي هذا الـ codebase وقترح refactoring
```

Use cheap or free models for simple questions, switch to powerful models for complex analysis.

---

## Building a Skill

Skills let you package domain expertise and share it with the TaseesCode community. Here is a step-by-step guide.

### Step 1: Create the Skill Directory

```bash
mkdir -p ~/.taseescode/skills/my-skill
```

### Step 2: Create skill.json

```bash
cat > ~/.taseescode/skills/my-skill/skill.json << 'EOF'
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "A brief description of what this skill does",
  "author": "your-github-username",
  "commands": [
    {
      "name": "/my-skill help",
      "description": "Show skill help"
    },
    {
      "name": "/my-skill generate",
      "description": "Generate boilerplate code"
    }
  ],
  "systemPromptAddition": "You are an expert in [domain]. When the user asks about [topic], follow these guidelines:\n\n1. Always use [pattern]\n2. Prefer [approach] over [other approach]\n3. Follow the [standard] conventions\n\nCommon patterns:\n- Pattern A: [description]\n- Pattern B: [description]"
}
EOF
```

### Step 3: Test Locally

Restart TaseesCode and run:

```bash
/skills list
```

Your skill should appear. Try using the commands defined in your skill.

### Step 4: Refine the System Prompt

The `systemPromptAddition` is where the real value lives. Write it as if you are briefing an expert developer. Include:

- **Domain knowledge** -- frameworks, libraries, APIs
- **Best practices** -- patterns to follow, anti-patterns to avoid
- **Code templates** -- common boilerplate that should follow a specific format
- **Project conventions** -- naming, structure, architecture decisions

### Step 5: Share on GitHub

```bash
# Create a repo with just the skill.json
mkdir my-skill && cd my-skill
cp ~/.taseescode/skills/my-skill/skill.json .
git init && git add . && git commit -m "Initial skill release"
# Push to GitHub
```

Other users can install it with:

```bash
/skills install your-username/my-skill
```

### Skill Ideas

- **Framework helpers** -- Next.js, Laravel, Django, Spring Boot
- **API integration** -- Stripe, Firebase, Supabase, AWS
- **Language patterns** -- Rust best practices, Go idioms, Python packaging
- **Team conventions** -- your team's coding standards as a skill
- **Domain knowledge** -- healthcare, fintech, e-commerce patterns

---

## Roadmap

TaseesCode is actively developed. Here is what is coming:

- **Team collaboration** -- shared skills and configurations across teams
- **Conversation history** -- persistent chat history across sessions
- **Plugin marketplace** -- a web-based skill registry with ratings and reviews
- **Streaming file edits** -- see file changes in real-time as they are generated
- **Multi-file context** -- automatically include related files in context
- **Voice input** -- speak your coding requests in Arabic or English
- **IDE extensions** -- VS Code and JetBrains integrations
- **More providers** -- Mistral, Cohere, local GGUF models
- **Fine-tuned Arabic model** -- a model specifically trained for Arabic coding assistance

---

## Contributing

TaseesCode is open source and contributions are welcome.

### Repository

[github.com/taseesai/taseescode](https://github.com/taseesai/taseescode)

### How to Contribute

1. **Report bugs** -- open an issue on GitHub
2. **Suggest features** -- open an issue with the `enhancement` label
3. **Submit PRs** -- fork, branch, code, test, PR
4. **Share skills** -- build and publish skills for the community
5. **Improve translations** -- help improve Arabic language support

### Development Setup

```bash
git clone https://github.com/taseesai/taseescode.git
cd taseescode
npm install
npm run dev
```

### Code Style

- TypeScript throughout
- Functional patterns preferred
- All user-facing strings support Arabic

---

## Troubleshooting

### "Command not found: taseescode"

Make sure your npm global bin directory is in your PATH:

```bash
npm config get prefix
# Add the /bin subdirectory to your PATH
```

### "API key not configured"

Add the key for the model's provider:

```bash
/config set apiKeys.groq gsk_your_key_here
```

### "ffmpeg not found" (video analysis)

Install ffmpeg:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

### Models not responding

```bash
# Test your API connection
/api test [name]

# Switch to a different model
/model llama-3.3-70b
```

### Reset everything

```bash
rm -rf ~/.taseescode
taseescode  # Re-runs the onboarding wizard
```

---

## License

MIT License -- see [LICENSE](LICENSE) for details.

Built with purpose in Jeddah, Saudi Arabia by [TaseesAI](https://taseesai.com).

---

<p align="center">
  <strong>TaseesCode</strong> -- مساعدك الذكي للبرمجة<br>
  <a href="https://taseescode.com">taseescode.com</a> &middot; <a href="https://github.com/taseesai/taseescode">GitHub</a> &middot; <a href="https://www.npmjs.com/package/taseescode">npm</a>
</p>
