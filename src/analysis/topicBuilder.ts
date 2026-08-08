import Anthropic from '@anthropic-ai/sdk';

import type { CustomTopic } from '../data/topics';

/**
 * Turns "what do you want to watch?" into a keyword set the feed filter can use.
 *
 * Optional in the strict sense: `manualTopic` below produces a usable topic from
 * the same input with no key and no network. The model's contribution is
 * vocabulary — the synonyms, official names and jargon a headline is likely to
 * use but the person typing the request would not think of.
 */

const MODEL = 'claude-opus-5';

const SYSTEM = `You turn a person's description of what they want to follow into a keyword set for filtering news headlines.

Return terms that would actually appear in a headline or its summary. Include: common synonyms, the formal names of the organisations and programmes involved, the jargon the trade press uses, and obvious alternative spellings (British/American, transliterations).

Do not include: the person's own phrasing if no outlet would print it, terms so generic they match everything ("news", "report", "government", "world"), or single words under three characters.

Aim for 8 to 20 terms. Each term is matched case-insensitively on word boundaries, so multi-word phrases are fine and usually better than single words.

The label is a short noun phrase naming the topic, under 40 characters. The note is one sentence, addressed to the user, saying what you took the request to mean — it is shown to them so they can correct you.`;

const SCHEMA = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    terms: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
  required: ['label', 'terms', 'note'],
  additionalProperties: false,
};

/** Fallback used when there is no API key: the request itself becomes the terms. */
export function manualTopic(request: string): CustomTopic {
  const terms = request
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);

  return {
    id: `custom-${Date.now()}`,
    label: request.trim().slice(0, 40) || 'Custom topic',
    terms: terms.length ? terms : [request.trim()].filter(Boolean),
    origin: 'manual',
  };
}

export async function buildTopic(apiKey: string, request: string): Promise<CustomTopic> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const params = {
    model: MODEL,
    max_tokens: 1000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    // Vocabulary expansion is not a hard reasoning problem; low effort keeps the
    // box responsive enough to type into repeatedly.
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: SCHEMA },
    },
    system: SYSTEM,
    messages: [{ role: 'user', content: request }],
  } as unknown as Parameters<typeof client.beta.messages.create>[0];

  // The cast above widens the return type to include the streaming variant;
  // this call is non-streaming, so narrow it back.
  const message = (await client.beta.messages.create(params)) as Anthropic.Beta.BetaMessage;

  if (message.stop_reason === 'refusal') {
    throw new Error('The model declined to build a filter for that request.');
  }

  const text = message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  let parsed: { label?: string; terms?: string[]; note?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The model returned something that was not a topic definition.');
  }

  const terms = (parsed.terms ?? []).map((term) => term.trim()).filter((term) => term.length >= 3);
  if (!terms.length) throw new Error('No usable terms came back for that request.');

  return {
    id: `custom-${Date.now()}`,
    label: parsed.label?.trim() || request.trim().slice(0, 40),
    terms,
    origin: 'ai',
    note: parsed.note?.trim(),
  };
}
