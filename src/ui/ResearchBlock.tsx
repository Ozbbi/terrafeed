import { useEffect, useState } from 'react';

import { researchStory, type ResearchResult } from '../analysis/research';
import { openArticle } from '../lib/open';
import type { Signal } from '../sources/types';
import { useStore } from '../state/store';

type Phase = 'idle' | 'running' | 'done' | 'error';

/** AI research for one story: real web searches, then a grounded write-up. */
export function ResearchBlock({ signal }: { signal: Signal }) {
  const apiKey = useStore((s) => s.settings.keys.anthropic);
  const useInApp = useStore((s) => s.settings.useInAppBrowser);

  const [phase, setPhase] = useState<Phase>('idle');
  const [text, setText] = useState('');
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState('');

  // A new story means the old research is no longer about anything.
  useEffect(() => {
    setPhase('idle');
    setText('');
    setResult(null);
    setError('');
  }, [signal.id]);

  if (!apiKey.trim()) {
    return (
      <p className="hint-block">
        Add an Anthropic key under Settings to have this story researched on the live web.
      </p>
    );
  }

  async function run() {
    setPhase('running');
    setText('');
    setResult(null);
    setError('');
    try {
      const research = await researchStory(apiKey.trim(), signal, (delta) =>
        setText((current) => current + delta),
      );
      setResult(research);
      setText(research.text);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }

  return (
    <div className="research">
      <button type="button" className="ghost wide" onClick={() => void run()} disabled={phase === 'running'}>
        {phase === 'running' ? 'Searching the web…' : phase === 'idle' ? 'Research this story' : 'Research again'}
      </button>

      {error && <p className="error">{error}</p>}

      {result?.searches.length ? (
        <div className="research-searches">
          {result.searches.map((query) => (
            <span key={query} className="chip">
              {query}
            </span>
          ))}
        </div>
      ) : null}

      {text && <div className="research-body">{text}</div>}

      {result?.sources.length ? (
        <div className="research-sources">
          <h4>Sources opened</h4>
          {result.sources.slice(0, 8).map((source) => (
            <button
              key={source.url}
              type="button"
              className="research-source"
              onClick={() => void openArticle(source.url, source.title, useInApp ? 'in-app' : 'system')}
              title={source.url}
            >
              {source.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
