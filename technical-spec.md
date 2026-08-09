# Technical Specification
## API Contract & Submission Requirements — AI Interview Agent

This document defines the API contract and submission requirements for the AI Interview Agent.

### HTTP Endpoint
Your agent must expose a single endpoint:
`POST /api/interview`

No authentication is required.
The endpoint must maintain interview state using the provided `sessionId`.

---

### Interview Flow

#### 1. Start Interview
The first request initializes a new interview session.

**POST /api/interview**
```json
{
  "sessionId": "abc-123",
  "candidate": {
    "id": "CAND-001",
    "name": "Sarah Johnson",
    "jobRole": "Senior Data Engineer",
    "yearsExperience": 9,
    "education": "MS Computer Science",
    "status": "COMPLETED",
    "missions": [ ... ],
    "signals": { ... }
  }
}
```

**Expected Response**
```json
{
  "reply": "Welcome. Let's begin your interview.",
  "done": false
}
```

---

#### 2. Conversation Turn
Every subsequent request contains the candidate's latest response.

**POST /api/interview**
```json
{
  "sessionId": "abc-123",
  "message": "We built a hybrid retrieval engine using SQL for claim tables and ChromaDB for clinical policy PDFs..."
}
```

**Expected Response**
```json
{
  "reply": "That's a solid start. Suppose a user asks about deductible limits for a specific PPO plan, but the vector DB retrieves a general policy doc instead. How did your retrieval router handle that edge case?",
  "done": false
}
```

---

#### 3. End Interview
When the interview is complete (after at least 8 questions across at least 4 curriculum days, or upon explicit completion/termination), return:

**Expected Response**
```json
{
  "reply": "Interview completed.",
  "done": true,
  "feedback": {
    "summary": "Demonstrated exceptional depth in hybrid retrieval architecture and RAG vector indexing, though showed slight hesitation on multi-agent graph state persistence.",
    "strengths": [
      "Articulated clear trade-offs between exact SQL query routing and dense vector similarity search",
      "Demonstrated practical understanding of metadata filtering in ChromaDB to prevent cross-plan context leakage",
      "Correctly explained how sliding window memory prevents context window bloat"
    ],
    "gaps": [
      "Could improve clarity on failure recovery mechanisms for asynchronous MCP server stdio disconnects",
      "Did not detail exact token pruning strategies for long multi-turn agent execution loops"
    ],
    "next": [
      "Practice configuring LangGraph state graph checkpoints for resilient multi-agent orchestration",
      "Explore OpenTelemetry correlation IDs to debug distributed MCP tool execution chains"
    ]
  },
  "skillChart": [
    { "topic": "Embeddings & Vector Search", "day": 7, "depthScore": 92 },
    { "topic": "Retrieval Engine", "day": 10, "depthScore": 88 },
    { "topic": "Prompt Engineering & RAG", "day": 12, "depthScore": 85 },
    { "topic": "Multi-Agent Orchestration", "day": 22, "depthScore": 76 },
    { "topic": "Model Context Protocol", "day": 23, "depthScore": 80 }
  ]
}
```

---

### Feedback Format

The final response must include:

| Field | Type | Description |
|---|---|---|
| `summary` | `string` | High-level synthesis of candidate performance |
| `strengths` | `string[]` | Concise, actionable points grounded in candidate answers |
| `gaps` | `string[]` | Specific areas where reasoning or implementation details were missing |
| `next` | `string[]` | Targeted recommendations for growth |

---

### Notes
- Use the supplied `sessionId` throughout the interview.
- The interview should remain conversational across multiple requests.
- The candidate object follows the provided `candidates.json` schema.
- Built with Anthropic Claude API backend and modern Next.js 14 full-stack platform.
