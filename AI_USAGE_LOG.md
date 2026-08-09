# AI Usage Log

## Project: AI Technical Interview Agent Platform

### Overview
This log documents the usage of AI systems, specifically **Google Antigravity** and **Anthropic Claude**, during the architecture, design, and implementation of the AI Interview Agent platform.

---

### AI Tools Utilized

1. **Google Antigravity Agentic IDE**
   - **Role**: Primary Autonomous Coding Assistant & System Architect
   - **Tasks Executed**:
     - System architecture design and component decomposition.
     - Parsing and structuring 31-day curriculum data (`curriculum.json`) and candidate performance metrics (`candidates.json`).
     - Implementation of Next.js 14+ full-stack application, API contracts (`POST /api/interview`), state machine, and proctoring integrity system.
     - Responsive Glassmorphic Dark UI design implementation.

2. **Anthropic Claude (Claude 3.5 Sonnet / Haiku via API)**
   - **Role**: Conversational Reasoning Engine & Scenario Synthesizer
   - **Tasks Executed**:
     - Turn-by-turn interview scenario generation without textbook phrasing.
     - Candidate experience and role-calibrated adaptive questioning (escalate, perturb, probe, pivot).
     - Response evaluation across multi-axis criteria (correctness, specificity, causal reasoning, profile consistency).
     - End-of-interview feedback synthesis (`summary`, `strengths`, `gaps`, `next`, `skillChart`).

---

### Human Oversight & Verification
- Verification of exact API contracts against `technical-spec.md`.
- End-to-end testing of proctoring integrity mechanisms (focus-loss countdown and browser back-button history trap).
- Security auditing to ensure no personal developer metadata, API keys, or machine paths are leaked in source files or git commits.

---

### Compliance & Verification Statement
This project was constructed in full accordance with the competition guidelines and eligibility requirements specified in the Antigravity Build Brief.
