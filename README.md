# AI Technical Interview Agent

> Adaptive, multi-turn AI interview platform for evaluating 31-Day AI Engineering Cohort candidates — powered by Anthropic Claude and Next.js 14.

---

## What This Does

The **AI Technical Interview Agent** conducts intelligent, adaptive technical interviews calibrated to each candidate's actual course performance history:

- Loads **20 real cohort candidate profiles** (CAND-001 through CAND-020), each with their exact mission pass/fail/skip history and commit signals.
- Maps each candidate's activity to the **31-day AI Engineering curriculum** spanning 8 modules — from environment setup to Kubernetes production deployment.
- Uses **Anthropic Claude API** (or an intelligent offline fallback engine) to generate novel, scenario-based questions without textbook phrasing — grounded in a realistic enterprise healthcare chatbot domain.
- Dynamically escalates depth, probes edge cases, or pivots topics based on answer quality.
- Enforces a **proctoring integrity system**: 25-second focus-loss grace countdown + browser back-button navigation trap.
- Delivers a structured **final assessment report** with summary, strengths, gaps, next steps, and per-topic depth score visualization.

---

## Live Features

| Feature | Description |
|---|---|
| 🎯 Candidate Selector | Searchable/filterable grid with candidate profile modals |
| 🤖 Adaptive Interview | Role-calibrated multi-turn Claude-powered Q&A |
| 🛡️ Proctoring System | Focus-loss detection + 25s grace countdown + back-trap |
| 📊 Feedback Dashboard | Skill chart, strengths, gaps, and next steps |
| 🌙 Glassmorphic Dark UI | Violet-purple dark theme, mobile-responsive across all devices |
| 🔌 Offline Fallback | Works 100% without an API key via built-in domain scenario engine |

---

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS + Glassmorphism design system
- **AI Engine**: Anthropic Claude 3.5 Sonnet (server-side only via `/api/interview`)
- **Interview Data**: `curriculum.json` (31 days) + `candidates.json` (20 profiles)
- **Icons**: Lucide React
- **Deployment**: Vercel / Any Node.js host

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- (Optional) Anthropic API key for live Claude-powered interviews

### Installation

```bash
git clone https://github.com/your-username/ai-interview-agent.git
cd ai-interview-agent
npm install
```

### Environment Setup

Copy the example env file and optionally add your Anthropic API key:

```bash
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
```

> **Note**: The app works fully without an API key using the built-in offline domain scenario engine.

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
ai-interview-agent/
├── src/
│   ├── app/
│   │   ├── api/interview/route.ts   # POST /api/interview endpoint
│   │   ├── page.tsx                 # Main application orchestrator
│   │   ├── layout.tsx               # Root layout + metadata
│   │   └── globals.css              # Global Tailwind + glassmorphism styles
│   ├── components/
│   │   ├── CandidateSelector.tsx    # Candidate grid, filters, profile modals
│   │   ├── InterviewInterface.tsx   # Live interview chat UI
│   │   ├── FeedbackDashboard.tsx    # End-of-interview results & skill chart
│   │   └── ProctorWarningModal.tsx  # Focus-loss proctoring overlay + back-trap
│   ├── lib/
│   │   └── proctoring.ts            # useProctoring hook (blur/visibility detection)
│   ├── types/
│   │   └── interview.ts             # TypeScript type definitions
│   └── data/
│       ├── curriculum.json          # 31-day curriculum dataset
│       └── candidates.json          # 20 candidate profiles
├── technical-spec.md                # Official API contract specification
├── AI_USAGE_LOG.md                  # AI tooling usage documentation
├── .env.example                     # Environment variable template
└── package.json
```

---

## API Contract

`POST /api/interview`

See [technical-spec.md](./technical-spec.md) for the full API contract, request/response schemas, and session flow.

---

## Privacy & Security

- **Zero personal data**: No creator identity, machine paths, or device information is stored anywhere in this repository.
- **Server-side API key only**: The `ANTHROPIC_API_KEY` is used exclusively in `src/app/api/interview/route.ts` (a server-only Next.js route) — it is never sent to the client browser.
- **No tracking/analytics**: No telemetry, fingerprinting, or user tracking of any kind.
- **Prompt injection safeguards**: System prompts enforce strict domain-grounded behavior and reject jailbreak attempts.

---

## AI Usage Log

See [AI_USAGE_LOG.md](./AI_USAGE_LOG.md) for a full log of AI tools used during this project's construction.
