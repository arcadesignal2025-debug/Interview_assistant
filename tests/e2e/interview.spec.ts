import { test, expect } from '@playwright/test';

test.describe('AI Technical Interview', () => {
  test('public coordinator showcase contains no candidate selector and links to sanitized demo', async ({ page }) => {
    await page.goto('/showcase');
    await expect(page.getByText('COMPETITION SUBMISSION • PUBLIC DEMO')).toBeVisible();
    await expect(page.getByText('Sanitized Interactive Demo', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Launch Sanitized Interactive Demo' })).toHaveAttribute('href', '/demo');
    await expect(page.getByText('Sarah Johnson')).toHaveCount(0);
    await expect(page.getByText('Alex Turner')).toHaveCount(0);
  });

  test('sanitized demo can start and complete without private candidate data', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByText('SANITIZED INTERACTIVE DEMO')).toBeVisible();
    await page.getByRole('button', { name: 'Start Interactive Demo' }).click();
    await expect(page.getByTestId('answer-input')).toBeVisible();
    await expect(page.getByText('Competition Demo Candidate')).toBeVisible();

    const answers = [
      'I would validate the plan and member identifiers first, then trace retrieval metadata and source authority.',
      'I would reject ambiguous metadata, use a deterministic fallback, and log the decision for auditability.',
      'I would verify plan type, effective date, and member scope before allowing a policy passage into context.',
      'I would inspect latency by dependency, cache hit rate, queue depth, and downstream saturation before scaling.',
      'I would detect stale eligibility data with freshness checks and communicate uncertainty rather than guessing.',
      'I would validate required tool fields with a strict schema and prevent execution with incomplete data.',
      'I would rank conflicting policy sources by authority and effective date and escalate unresolved conflicts.',
      'I would add tracing, evaluation metrics, alerts, and audit logs so production failures are detectable.',
    ];

    for (const answer of answers) {
      await page.getByTestId('answer-input').fill(answer);
      await page.getByTestId('send-answer').click();
      await expect(page.getByTestId('loading-indicator')).toHaveCount(0, { timeout: 15000 });
    }

    await expect(page.getByText('Domain Technical Depth Breakdown')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Competition Demo Candidate')).toBeVisible();
  });

  test('candidate can start, progress through unique questions, and complete an interview', async ({ page }) => {
    await page.goto('/');

    const startButton = page.locator('[data-testid^="start-interview-"]').first();
    await expect(startButton).toBeVisible();
    await startButton.click();

    await expect(page.getByTestId('proctoring-status')).toBeVisible();
    await expect(page.getByTestId('answer-input')).toBeVisible();
    await expect(page.getByTestId('interviewer-message').first()).toBeVisible();

    const questions = new Set<string>();
    questions.add((await page.getByTestId('interviewer-message').last().innerText()).trim());

    const answers = [
      'I would validate the plan and member identifiers first, then trace retrieval metadata before generating a member response.',
      'I would reject ambiguous metadata, use a deterministic fallback path, and log the decision so it can be audited.',
      'I would verify plan type and effective dates before allowing the retrieved policy into the answer context.',
      'I would inspect latency by dependency, cache hit rate, retrieval timing, and downstream saturation before scaling.',
      'I would detect stale eligibility data with freshness checks and communicate uncertainty rather than guessing.',
      'I would validate required tool fields with a schema, return a safe validation error, and prevent execution with incomplete data.',
      'I would rank conflicting policy sources by effective date and authority and require an explicit conflict state when unresolved.',
      'I would add tracing, retrieval precision metrics, answer evaluations, alerts, and audit logs to catch the production failure.'
    ];

    for (const answer of answers) {
      await page.getByTestId('answer-input').fill(answer);
      await page.getByTestId('send-answer').click();
      await expect(page.getByTestId('loading-indicator')).toHaveCount(0, { timeout: 15000 });
      const latestQuestion = page.getByTestId('interviewer-message').last();
      await expect(latestQuestion).toBeVisible();
      questions.add((await latestQuestion.innerText()).trim());
    }

    expect(questions.size).toBeGreaterThanOrEqual(8);
    await expect(page.getByText('EVALUATION COMPLETE')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Domain Technical Depth Breakdown')).toBeVisible();
  });

  test('short answers produce an insufficient-evidence assessment', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid^="start-interview-"]').first().click();
    const input = page.getByTestId('answer-input');

    for (const answer of ['hi', 'yes', 'dontknow', 'sorry', 'ok', 'no', 'fine', 'sure']) {
      await input.fill(answer);
      await page.getByTestId('send-answer').click();
      await expect(page.getByTestId('loading-indicator')).toHaveCount(0, { timeout: 15000 });
    }

    await expect(page.getByText('Assessment limited by response evidence')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Insufficient technical evidence to make a reliable depth assessment.')).toBeVisible();
  });
});
