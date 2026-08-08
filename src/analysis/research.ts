import Anthropic from '@anthropic-ai/sdk';

import type { Signal } from '../sources/types';

/**
 * Researches a story on the live web.
 *
 * The rest of the app can only tell you that a headline exists. This goes and
 * reads around it: Claude runs real web searches server-side and writes up what
 * it found, with the sources it actually opened. That is the difference between
 * "a wire says X" and knowing whether X is confirmed, contested, or already
 * overtaken.
 *
 * Key-gated and entirely optional — nothing else in Terrafeed depends on it.
 */

const MODEL = 'claude-opus-5';

const SYSTEM = `You are a news researcher. You will be given one headline that a monitoring dashboard has picked up. Search the web and report what is actually known.

Structure the answer as exactly four short markdown sections:

**What happened** — two or three sentences, the confirmed core of the story.
**Confirmed by** — up to four bullets, each naming the outlet and what it independently confirms.
**Disputed or unclear** — up to three bullets. If nothing is genuinely contested, write a single bullet saying so; do not invent controversy.
**What to watch** — up to three bullets on what would change the picture.

Rules:
- Ground everything in search results. If searches turn up nothing beyond the original headline, say that plainly — a two-line answer that admits thin sourcing is worth more than a padded one.
- Note publication dates when recency matters, and flag it when the newest source you found is old.
- Do not repeat the headline back as a finding.
- Under 320 words.`;

export interface ResearchResult {
  text: string;
  /** Distinct pages the model actually opened. */
  sources: { title: string; url: string }[];
  searches: string[];
}

function buildPrompt(signal: Signal): string {
  const when = new Date(signal.time).toISOString();
  return [
    `Headline: ${signal.title}`,
    signal.summary ? `Summary: ${signal.summary}` : '',
    `Reported by: ${signal.source}`,
    `Picked up at: ${when}`,
    signal.url ? `Original link: ${signal.url}` : '',
    '',
    'Research this and report.',
  ]
    .filter(Boolean)
    .join('\n');
}

interface SearchResultBlock {
  type: string;
  title?: string;
  url?: string;
}

export async function researchStory(
  apiKey: string,
  signal: Signal,
  onDelta?: (text: string) => void,
): Promise<ResearchResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: buildPrompt(signal) },
  ];

  const sources: { title: string; url: string }[] = [];
  const searches: string[] = [];
  let text = '';

  // The server-side search loop can hit its own iteration cap and hand back
  // `pause_turn`; the documented way to continue is to replay the assistant turn
  // unchanged and ask again. Bounded so a pathological case cannot spin.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const params = {
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: SYSTEM,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
      messages,
    } as unknown as Parameters<typeof client.beta.messages.stream>[0];

    const stream = client.beta.messages.stream(params);
    if (onDelta) stream.on('text', (delta) => onDelta(delta));

    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      throw new Error('The model declined to research this story.');
    }

    for (const block of message.content) {
      if (block.type === 'text') text += block.text;

      if (block.type === 'server_tool_use' && block.name === 'web_search') {
        const query = (block.input as { query?: string })?.query;
        if (query) searches.push(query);
      }

      if (block.type === 'web_search_tool_result') {
        // On failure `content` is a single error object rather than a list.
        const content = block.content as SearchResultBlock[] | { error_code?: string };
        if (!Array.isArray(content)) continue;
        for (const result of content) {
          if (result.url && !sources.some((s) => s.url === result.url)) {
            sources.push({ title: result.title ?? result.url, url: result.url });
          }
        }
      }
    }

    if (message.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: message.content });
  }

  return { text: text.trim(), sources, searches };
}
