import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';

export const maxDuration = 60;

type FoodItem = {
  name: string;
  calories: number;
  category?: string;
  amount?: string;
  confidence?: string;
};

type ProviderResult = {
  provider: string;
  model: string;
  success: boolean;
  items?: FoodItem[];
  error?: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
};

const PROMPT_KO = `이 이미지에 있는 음식을 분석하고 유효한 JSON만 반환하세요. "items" 배열 — 음식/음료 하나당 하나의 요소.
{
  "items": [
    {
      "name": "구체적인 한국어 음식명",
      "calories": 숫자 (kcal, 이 품목만),
      "category": "한식/중식/일식/양식/간식/음료",
      "amount": "추정 중량(g) 또는 수량",
      "confidence": "high/medium/low"
    }
  ]
}`;

function extractJson(text: string): any | null {
  const stripped = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(stripped); } catch { /* fallthrough */ }
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fallthrough */ }
  }
  return null;
}

function normalizeItems(parsed: any): FoodItem[] | null {
  if (!parsed) return null;
  if (Array.isArray(parsed.items) && parsed.items.length > 0) return parsed.items;
  if (parsed.name && parsed.calories != null) return [parsed];
  return null;
}

async function callGemini(base64: string, apiKey: string): Promise<ProviderResult> {
  const model = 'gemini-2.5-pro';
  const start = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT_KO }, { inline_data: { mime_type: 'image/jpeg', data: base64 } }] }],
          generationConfig: { response_mime_type: 'application/json', temperature: 0.05 },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );
    const data = await res.json();
    const latencyMs = Date.now() - start;
    if (!res.ok) return { provider: 'gemini', model, success: false, error: data.error?.message || 'API error', latencyMs };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const items = normalizeItems(extractJson(text ?? ''));
    if (!items) return { provider: 'gemini', model, success: false, error: '파싱 실패', latencyMs };
    const tokensIn = data.usageMetadata?.promptTokenCount ?? 0;
    const tokensOut = data.usageMetadata?.candidatesTokenCount ?? 0;
    const costUsd = (tokensIn / 1_000_000) * 1.25 + (tokensOut / 1_000_000) * 10.0;
    return { provider: 'gemini', model, success: true, items, latencyMs, tokensIn, tokensOut, costUsd };
  } catch (e: any) {
    return { provider: 'gemini', model, success: false, error: e?.message || 'timeout', latencyMs: Date.now() - start };
  }
}

async function callOpenAI(base64: string, apiKey: string): Promise<ProviderResult> {
  const model = 'gpt-4o';
  const start = Date.now();
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT_KO },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.05,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    const latencyMs = Date.now() - start;
    if (!res.ok) return { provider: 'openai', model, success: false, error: data.error?.message || 'API error', latencyMs };
    const text = data.choices?.[0]?.message?.content;
    const items = normalizeItems(extractJson(text ?? ''));
    if (!items) return { provider: 'openai', model, success: false, error: '파싱 실패', latencyMs };
    const tokensIn = data.usage?.prompt_tokens ?? 0;
    const tokensOut = data.usage?.completion_tokens ?? 0;
    const costUsd = (tokensIn / 1_000_000) * 2.5 + (tokensOut / 1_000_000) * 10.0;
    return { provider: 'openai', model, success: true, items, latencyMs, tokensIn, tokensOut, costUsd };
  } catch (e: any) {
    return { provider: 'openai', model, success: false, error: e?.message || 'timeout', latencyMs: Date.now() - start };
  }
}

async function callClaude(base64: string, apiKey: string): Promise<ProviderResult> {
  const model = 'claude-sonnet-5';
  const start = Date.now();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
              { type: 'text', text: PROMPT_KO },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    const latencyMs = Date.now() - start;
    if (!res.ok) return { provider: 'claude', model, success: false, error: data.error?.message || 'API error', latencyMs };
    const text = data.content?.[0]?.text;
    const items = normalizeItems(extractJson(text ?? ''));
    if (!items) return { provider: 'claude', model, success: false, error: '파싱 실패', latencyMs };
    const tokensIn = data.usage?.input_tokens ?? 0;
    const tokensOut = data.usage?.output_tokens ?? 0;
    const costUsd = (tokensIn / 1_000_000) * 3.0 + (tokensOut / 1_000_000) * 15.0;
    return { provider: 'claude', model, success: true, items, latencyMs, tokensIn, tokensOut, costUsd };
  } catch (e: any) {
    return { provider: 'claude', model, success: false, error: e?.message || 'timeout', latencyMs: Date.now() - start };
  }
}

export async function POST(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { image } = await request.json();
    if (typeof image !== 'string' || image.length === 0) {
      return NextResponse.json({ error: 'INVALID_IMAGE' }, { status: 400 });
    }
    const MAX_BASE64_BYTES = 10 * 1024 * 1024;
    if (image.length > MAX_BASE64_BYTES) {
      return NextResponse.json({ error: 'IMAGE_TOO_LARGE' }, { status: 413 });
    }
    const base64 = image.includes(',') ? image.split(',')[1] : image;

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const claudeKey = process.env.ANTHROPIC_API_KEY?.trim();

    const [gemini, openai, claude] = await Promise.all([
      geminiKey ? callGemini(base64, geminiKey) : Promise.resolve<ProviderResult>({ provider: 'gemini', model: 'gemini-2.5-pro', success: false, error: 'GEMINI_API_KEY 미설정', latencyMs: 0 }),
      openaiKey ? callOpenAI(base64, openaiKey) : Promise.resolve<ProviderResult>({ provider: 'openai', model: 'gpt-4o', success: false, error: 'OPENAI_API_KEY 미설정', latencyMs: 0 }),
      claudeKey ? callClaude(base64, claudeKey) : Promise.resolve<ProviderResult>({ provider: 'claude', model: 'claude-sonnet-5', success: false, error: 'ANTHROPIC_API_KEY 미설정', latencyMs: 0 }),
    ]);

    return NextResponse.json({ success: true, results: [gemini, openai, claude] });
  } catch (error: any) {
    console.error('[admin/model-test POST]', error?.message);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
