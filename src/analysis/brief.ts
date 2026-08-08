import Anthropic from '@anthropic-ai/sdk';

import type { Country } from '../data/countries';
import { fmtAgo } from '../lib/format';
import type { Signal } from '../sources/types';
import type { IndicatorSeries } from '../sources/worldbank';
import type { InstabilityScore } from './instability';

/**
 * Optional analyst brief. Entirely user-key-gated: with no Anthropic key in
 * settings this module is never called and the rest of the app is unaffected.
 * The key is the user's own, stays on their machine, and is sent only to
 * api.anthropic.com.
 */

const MODEL = 'claude-opus-5';

const SYSTEM = `You are an intelligence analyst writing a short country brief for a situational-awareness dashboard.

Ground every claim in the observations supplied by the user message. If the data is thin, say so plainly instead of filling the gap with background knowledge — a two-line brief that reflects the evidence is more useful than a page that does not.

Structure the answer as exactly three short markdown sections:
**Situation** — two or three sentences on what the current picture is.
**Drivers** — up to four bullets, each naming the observation behind it.
**Watch** — up to three bullets on what would change the assessment, and the signal that would show it.

No preamble, no closing summary, no restating the instructions. Keep the whole brief under 250 words.`;

export interface BriefInput {
  apiKey: string;
  country: Country;
  score: InstabilityScore;
  indicators: IndicatorSeries[];
  signals: Signal[];
  onDelta?: (text: string) => void;
}

function buildPrompt({ country, score, indicators, signals }: BriefInput): string {
  const structural = indicators
    .filter((series) => series.latest)
    .map(
      (series) => `- ${series.label}: ${series.latest?.value} ${series.unit} (${series.latest?.year})`,
    )
    .join('\n');

  const components = score.components
    .map(
      (component) =>
        `- ${component.label}: ${Math.round(component.score)}/100 (${component.detail})`,
    )
    .join('\n');

  const observations = signals
    .slice(0, 30)
    .map(
      (signal) =>
        `- [${signal.source}, ${fmtAgo(signal.time)} ago, severity ${Math.round(
          signal.severity * 100,
        )}] ${signal.title}`,
    )
    .join('\n');

  return `Country: ${country.nameLong} (${country.iso3}), ${country.subregion}.

Terrafeed composite stress index: ${score.total}/100. This is a transparent weighted blend, not a forecast — its components are:
${components || '- no components scored'}

World Bank structural indicators:
${structural || '- none available'}

Observations collected in the last 48 hours (${signals.length} total, most severe first):
${observations || '- nothing observed in this window'}

Write the brief.`;
}

export async function generateBrief(input: BriefInput): Promise<string> {
  const client = new Anthropic({
    apiKey: input.apiKey,
    // Desktop app: the request is made from the app's own webview with the
    // user's own key. Nothing is proxied through a third party.
    dangerouslyAllowBrowser: true,
  });

  const params = {
    model: MODEL,
    max_tokens: 1400,
    // Opus 5 can decline a request outright; letting the API pick the fallback
    // means a declined brief still comes back answered.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system: SYSTEM,
    messages: [{ role: 'user', content: buildPrompt(input) }],
  } as unknown as Parameters<typeof client.beta.messages.stream>[0];

  const stream = client.beta.messages.stream(params);
  if (input.onDelta) stream.on('text', (delta) => input.onDelta?.(delta));

  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new Error('The model declined to write this brief.');
  }

  return message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}
