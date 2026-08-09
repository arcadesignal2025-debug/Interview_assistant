## GitHub Setup & Push Instructions

Follow these steps to push the project to a new GitHub repository with anonymous commit history.

---

### Prerequisites
Install these tools once if not already installed:
- **Node.js v18+**: https://nodejs.org/
- **Git**: https://git-scm.com/downloads/win
- **Anthropic API key** _(optional)_: https://console.anthropic.com/

---

### Step 1 — Install Dependencies

```powershell
cd C:\Users\vikas\.gemini\antigravity\scratch\ai-interview-agent
npm install
```

---

### Step 2 — Set Up Environment Variable (Optional)

```powershell
Copy-Item .env.example .env.local
# Open .env.local and add your ANTHROPIC_API_KEY
```

---

### Step 3 — Run Locally to Verify

```powershell
npm run dev
```

Open: http://localhost:3000

---

### Step 4 — Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repo called `ai-interview-agent`
3. Set it to **Public** or **Private** as required

---

### Step 5 — Initialize Git with Anonymous Credentials & Push

```powershell
cd C:\Users\vikas\.gemini\antigravity\scratch\ai-interview-agent

git init
git config user.name "AI Interview Agent"
git config user.email "ai-interview-agent@dev.internal"

git add .
git commit -m "feat: initial AI technical interview agent implementation

- 31-day AI engineering curriculum dataset
- 20 candidate profiles with complete mission history
- POST /api/interview endpoint with adaptive question generation
- Anthropic Claude integration with offline fallback engine
- Proctoring integrity system with focus-loss detection
- Glassmorphic dark UI with mobile-first responsive design"

git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ai-interview-agent.git
git push -u origin main
```

> ⚠️ Replace `YOUR_USERNAME` with your actual GitHub username.

---

### Step 6 — Deploy to Vercel (One-Click)

1. Go to https://vercel.com/import
2. Import your `ai-interview-agent` GitHub repository
3. Add environment variable in Vercel Dashboard:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `your_api_key_here`
4. Click Deploy

Your app will be live at `https://ai-interview-agent.vercel.app` (or custom domain).

---

### Privacy Checklist Before Pushing

- ✅ `.env.local` is listed in `.gitignore` (API key never committed)
- ✅ No real names, emails, or device paths anywhere in source code
- ✅ Git author is set to `AI Interview Agent <ai-interview-agent@dev.internal>`
- ✅ No logging of user data to any external service
- ✅ Anthropic API called server-side only — key never reaches the browser
