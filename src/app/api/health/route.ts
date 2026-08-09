import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'interview-assistant',
      buildVersion: 'adaptive-v10-final-audit',
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
