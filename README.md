<div align="center">
  <img src="apps/web/public/logo.png" alt="OpenLoaf Logo" width="120" />
  <h1>OpenLoaf</h1>
  <p><strong>🍞 Open-Source AI Workspace with Multi-Project Team Collaboration</strong></p>
  <p>Local-first, privacy-focused AI workspace — organize AI teams by project, cross-project collaboration, multi-model agents. Your data never leaves your device.</p>

  <p>🤖 AI Teams &nbsp;|&nbsp; 📚 Knowledge Base &nbsp;|&nbsp; 💻 Code Repo &nbsp;|&nbsp; 📊 Data Analysis &nbsp;|&nbsp; 🎨 Content Creation &nbsp;|&nbsp; 📧 Email &nbsp;|&nbsp; 📅 Calendar &nbsp;|&nbsp; 📋 Tasks</p>

  <blockquote><strong>One app to orchestrate AI teams across projects — like departments in a company, each with its own agents, skills, and data. 100% local.</strong></blockquote>

  <a href="https://github.com/OpenLoaf/OpenLoaf/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPLv3-blue.svg" alt="License" /></a>
  <a href="https://github.com/OpenLoaf/OpenLoaf/releases"><img src="https://img.shields.io/github/v/release/OpenLoaf/OpenLoaf?label=latest" alt="Release" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-brightgreen" alt="Platform" />

  <br /><br />
  <a href="https://github.com/OpenLoaf/OpenLoaf/releases/latest">📥 Download for macOS / Windows / Linux</a>
  <br /><br />
  <strong>English</strong> | <a href="docs/README_en.md">English (mirror)</a>
</div>

---

> **⚠️ Note: This project is still in early development. Features and APIs may change at any time — use in production with caution.** If you encounter bugs or have suggestions, feel free to submit feedback via the "Feedback & Suggestions" button in the bottom-left corner of the app. We take every piece of feedback seriously.

---

## 🧐 About

OpenLoaf is a modern full-stack AI workspace that organizes work around **projects as teams**. Each project is a self-contained unit with its own **AI agent team**, internal data, private skills, and task board — like a department in a company.

Create different types of projects to match your needs: **AI Teams** for multi-agent task automation, **Knowledge Bases** for document management and Q&A, **Code Repos** for development, **Data Analysis** for reports and dashboards, **Content Creation** for writing and design, or **Custom Projects** to build your own setup.

Projects collaborate through **cross-project communication**: @ reference another project to query its data, delegate tasks between projects, or broadcast notifications through **groups** — shared chat spaces where multiple project agents coordinate in real time. An **AI Assistant** sits at the top level as your management hub, with full visibility across all projects.

<div align="center">
  <img src="docs/screenshots/overview.png" alt="OpenLoaf Overview" width="800" />
  <br />
  <sub>Workspace: clock, calendar, task board, and quick actions at a glance</sub>
</div>

---

## ✨ Features

### 🤖 AI Agent Teams

More than a chatbot — OpenLoaf's AI can **actually get things done**. Each project has its own team of specialized agents: Document Assistant, Terminal Assistant, Browser Assistant, Email Assistant, Calendar Assistant, and more. The Master Agent understands your intent, breaks down tasks, invokes tool chains, and orchestrates sub-agents to complete multi-step workflows autonomously. Add custom skills and agents per project to tailor the team to your domain.

<div align="center">
  <img src="docs/screenshots/ai-agent.png" alt="AI Agents" width="800" />
  <br />
  <sub>AI automatically invokes the Terminal Assistant to organize files and reports results</sub>
</div>

### 🏢 Multi-Project Organization

Organize your work like a company organizes departments. Each project type comes pre-configured with the right agents, tools, and views:

| Type | Purpose | Pre-configured with |
|------|---------|-------------------|
| 🤖 **AI Team** | Multi-agent collaboration + automation | Full agent team, scheduler, email/calendar/browser |
| 📚 **Knowledge Base** | Document management & Q&A | File indexing, RAG, note editor |
| 💻 **Code Repo** | Development & debugging | Terminal, Git, Coder Agent |
| 📊 **Data Analysis** | Tables & reports | Data import, Python/SQL, visualization |
| 🎨 **Content Creation** | Writing & design | Editor, board, image/video generation |
| ⚙️ **Custom Project** | Build your own | Minimal config, fully customizable |

All project types have AI capabilities — templates just set sensible defaults. You can add any tool or agent to any project at any time.

### 🔗 Cross-Project Collaboration

Projects don't work in isolation. Use **@ references** in conversations to query another project's data, delegate tasks across projects, or coordinate through **groups** — shared chat spaces with automatic event notifications. Each project's Master Agent acts as a gateway, controlling what information is shared externally.

### 💬 AI Chat

Built-in multi-model AI chat supporting **OpenAI**, **Anthropic Claude**, **Google Gemini**, **DeepSeek**, **Qwen**, **xAI Grok**, and local models via **Ollama**. AI is aware of your current project's full context — file structure, document content, conversation history — truly "understanding your project". Built-in **memory system** lets AI retain knowledge across conversations. Supports file attachments, web search, custom system prompts, and one-click model switching.

### 🎨 Infinite Board

A ReactFlow-based infinite canvas — not just a whiteboard, it's your **visual thinking space**. Supports free-form drag-and-drop layout, sticky notes, image/video nodes, freehand drawing, AI image generation (text-to-image), AI video generation, and image content understanding. Mind maps, flowcharts, and inspiration walls can all be freely combined on a single canvas.

<div align="center">
  <img src="docs/screenshots/board.png" alt="Infinite Board" width="800" />
  <br />
  <sub>Board with integrated AI image generation, video generation, freehand drawing, and sticky notes</sub>
</div>

### 🖼️ AI Image & Video Generation

Turn ideas into visual creations instantly. OpenLoaf integrates **AI text-to-image** and **AI video generation** in both the board and chat. Describe what you want to generate illustrations, concept art, or marketing materials, then drag them onto the canvas for further editing. AI can also **understand image content** — describe scenes in photos, extract text, and answer questions about visual assets. All generation runs through your own API keys with no third-party services storing your creative work.

### 📝 Rich Text Editor

A powerful block editor built on [Plate.js](https://platejs.org/). Supports headings, lists, blockquotes, code blocks, LaTeX formulas, tables, multimedia embeds, bi-directional links, and more. WYSIWYG editing with a rich toolbar and keyboard shortcuts makes writing and document organization effortless. Organize notes, project docs, and research materials with infinitely nested page structures.

### 📋 Kanban Task Management

A Trello-like board view managing the task lifecycle through **📥 To Do → 🔄 In Progress → 👀 Review → ✅ Done** columns. Supports drag-and-drop sorting, priority labels (🔴 Urgent / 🟠 High / 🟡 Medium / 🟢 Low), trigger modes (manual/scheduled/conditional), and due date reminders. AI can automatically create tasks and submit them for review — just approve or send back with one click, and let AI do the work for you.

### 🧰 All-in-One Productivity Toolkit

No more switching between apps — everything you need is built in:

- 🖥️ **Terminal** — A full terminal emulator embedded right in the app. AI agents can operate the terminal directly — create directories, move files, run scripts — using natural language commands, always asking for your confirmation before execution.
- 📧 **Email** — Multi-account email management with IMAP sync, rich-text composing and replies. AI assists with drafting emails, summarizing long threads, and extracting key information.
- 📅 **Calendar** — Schedule management with **native system calendar sync** (macOS Calendar / Google Calendar). Day/week/month views, AI-powered scheduling, and smart reminders.
- 📂 **File Manager** — Grid/list/column views, drag-and-drop upload and download, file preview (images, PDFs, Office documents, code). AI can directly read and operate on your project files.
- 🧩 **Workspace Widgets** — A customizable dashboard: live clock, calendar, task summary, quick actions, Agent settings — your mission control center with everything at a glance.
- 🧠 **Skills & Memory** — Each project can have private **skills** (reusable AI capabilities) and **memory** (persistent knowledge across conversations). AI learns your project's patterns and remembers key decisions.

---

## 🎯 Use Cases

- 📚 **Research & Writing** — Collect references, write structured notes, discuss materials with AI, and generate polished documents — all within a single project folder.
- 💻 **Software Development** — Manage requirement docs and design specs, generate code snippets with AI, execute commands in the terminal, and track task progress with the kanban board.
- 🎨 **Creative Design** — Brainstorm on the infinite board, generate images and videos with AI, organize visual assets in the file manager, and iterate with AI feedback.
- 📊 **Project Management** — Create separate project spaces for each client or initiative, manage task workflows with the kanban board, schedule meetings on the calendar, and coordinate via email — all without leaving OpenLoaf.
- 🏢 **Team & Department Simulation** — Model your org structure with projects: a "Sales AI Team" that delegates data requests to a "Data Analysis" project, a "Marketing" team that pulls product info from "Code Repo" — all orchestrated by an AI Assistant with global oversight.
- 🧠 **Personal Knowledge Base** — Build your second brain: save web content, journal, link ideas with bi-directional links, and let AI discover connections across your knowledge.

---

## 💡 Why OpenLoaf

The AI era is here, but our daily collaboration with AI is still full of friction and fragmentation.

### 😤 Pain Points with Existing Tools

**🔒 Closed-source + No data control** — Mainstream knowledge bases like Notion are closed-source. Your documents, notes, and data are stored on their servers. You can't freely choose AI models or control where your data goes.

**⚙️ High barrier for open-source alternatives** — Open-source alternatives exist but are complex to configure, have poor UX, and are daunting for non-technical users.

**🔀 Fragmented AI workflows** — Getting one thing done requires jumping between four or five windows. AI is powerful, but workflows are broken up by tools.

**🔄 Re-feeding context every conversation** — Real work is organized by **projects**. AI should always understand the full context of your current project.

**🧍 Single-project silos** — Existing tools treat each project as isolated. In reality, projects need to communicate — sales needs data from analytics, marketing needs specs from engineering. No AI tool supports this natively.

### 🎯 OpenLoaf's Approach

- **📦 Ready out of the box** — Download the installer, double-click, and go. No servers, databases, or Docker to configure.
- **🏢 Projects as teams** — Each project is a self-contained department with its own AI agent team, data, skills, and workflows. Choose from 6 project types or build your own.
- **🔗 Cross-project collaboration** — Projects communicate through @ references, task delegation, and group notifications — like departments in a company coordinating through meetings and memos.
- **🧠 AI with memory and skills** — AI retains knowledge across conversations and learns project-specific skills. The AI Assistant provides a management-level global view across all projects.
- **🔓 Open-source + local-first** — Fully open-source code, 100% local data storage, freedom to use any AI model.

### 🛋️ Loaf = Bread + Lounging

OpenLoaf's logo is a bread-shaped sofa. **Loaf** means both "bread" and "to lounge around" — our goal is to let you efficiently "loaf": hand off tedious, repetitive work to AI while you sit back and make the important decisions. 🍞

---

## 🔒 Privacy & Security

OpenLoaf follows a **local-first, privacy-first** design philosophy. Your data always stays on your device.

- 💾 **100% Local Storage** — All documents, conversations, files, and databases are stored on your local filesystem (`~/.openloaf/`). Nothing is uploaded to cloud servers.
- 🔑 **Bring Your Own Key (BYOK)** — You configure your own AI model API keys (OpenAI, Claude, Gemini, etc.). OpenLoaf does not proxy your requests through any intermediary server — API calls go directly from your device to the model provider.
- 📴 **Works Offline** — Core features (editor, file manager, task board) work fully offline. Connect local models via Ollama for a completely air-gapped AI experience.
- 🚫 **No Telemetry, No Tracking** — OpenLoaf collects no analytics, usage data, or telemetry. What happens on your device stays on your device.
- 🔍 **Open-Source & Auditable** — The full codebase is open-source under AGPLv3. You can inspect and verify every line of code that touches your data.

> **In a nutshell** — Unlike cloud-based AI tools, OpenLoaf ensures your knowledge assets, API keys, and personal data remain entirely under your control.

---

## 🚀 Quick Start

### 📋 Prerequisites

- **Node.js** >= 20
- **pnpm** >= 10 (`corepack enable`)

### 📦 Installation & Running

```bash
# Clone the repository
git clone https://github.com/OpenLoaf/OpenLoaf.git
cd OpenLoaf

# Install dependencies
pnpm install

# Initialize the database
pnpm run db:push

# Start the development environment (Web + Server)
pnpm run dev
```

Open your browser at [http://localhost:3001](http://localhost:3001). To launch the desktop app: `pnpm run desktop`.

---

## 🏗️ Project Structure

```
apps/
  web/          — 🌐 Next.js 16 frontend (static export, React 19)
  server/       — ⚙️ Hono backend, tRPC API
  desktop/      — 🖥️ Electron 40 desktop shell
packages/
  api/          — 📡 tRPC router types & shared API logic
  db/           — 🗄️ Prisma 7 database schema (SQLite)
  ui/           — 🎨 shadcn/ui style component library
  config/       — ⚙️ Shared env utilities & path resolution
```

## 🛠️ Tech Stack

| Area | Technology |
|------|------------|
| 🌐 Frontend | Next.js 16 / React 19 / Tailwind CSS 4 |
| ⚙️ Backend | Hono + tRPC / Prisma + SQLite |
| 🖥️ Desktop | Electron 40 |
| 📝 Editor | Plate.js |
| 🤖 AI | Vercel AI SDK (OpenAI / Claude / Gemini / DeepSeek / Qwen / Grok / Ollama) |
| 🔄 Collaboration | Yjs |
| 🎨 Board | ReactFlow |
| 📦 Tooling | Turborepo + pnpm monorepo |

---

## 🗺️ Roadmap

- [ ] 🏢 **Multi-Project Type System** — Create projects as AI Teams, Knowledge Bases, Code Repos, Data Analysis, Content Creation, or Custom — each pre-configured with the right agents and tools
- [ ] 🔗 **Cross-Project Communication** — @ reference other projects in conversations, delegate tasks across projects, query data from any project through the Master Agent gateway
- [ ] 💬 **Groups** — Shared chat spaces for multi-project coordination with automatic event notifications (task completion, version releases, report generation)
- [ ] ✨ **AI Assistant (Management Layer)** — Global oversight across all projects, cross-project task dispatch, unified status dashboard
- [ ] 🌐 **Full Web Browser Access** — Use OpenLoaf directly in your browser without installing the desktop app (partially available, actively in development)
- [ ] 🌍 **Internationalization (i18n)** — Full multi-language support (in progress)
- [ ] 📦 **Project Template Marketplace** — Expert-crafted templates, one-click import
- [ ] 📄 **WPS / Microsoft Office Integration** — Support for invoking WPS, Word, Excel, and PowerPoint
- [ ] 🔮 More features coming soon...

---

## 🤝 Contributing

We warmly welcome community contributions!

1. 🍴 **Fork** this repository
2. 🌿 Create your feature branch: `git checkout -b feature/my-feature`
3. ✅ Commit your changes (follow [Conventional Commits](https://www.conventionalcommits.org/)):
   ```bash
   git commit -m "feat(web): add dark mode toggle"
   ```
4. 🚀 Push to remote: `git push origin feature/my-feature`
5. 📬 Open a **Pull Request**

> 📖 Before submitting a PR, please read the [Contributing Guide](.github/CONTRIBUTING.md) and [Development Guide](docs/DEVELOPMENT.md), and sign the [CLA (Contributor License Agreement)](.github/CLA.md).

---

## 📄 License

OpenLoaf uses a dual-licensing model:

- 🆓 **Open Source** — [GNU AGPLv3](./LICENSE): Free to use, modify, and distribute, but derivative works must remain open-source under the same license.
- 💼 **Commercial** — For closed-source commercial use or to waive AGPL restrictions, please contact us for a commercial license.

---

<div align="center">
  <a href="https://github.com/OpenLoaf/OpenLoaf/issues">🐛 Bug Reports & 💡 Feature Requests</a>
  <br /><br />
  <sub>🍞 OpenLoaf — Redefine your AI collaboration space.</sub>
</div>
