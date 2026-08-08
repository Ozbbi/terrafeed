import { fmtAgo } from '../lib/format';
import { LAYERS } from '../sources/registry';
import { useStore } from '../state/store';

/**
 * Compact by design: this is a set of switches people flip occasionally, not
 * something to read. The grouped list it replaced took most of the rail and
 * pushed everything worth watching below the fold.
 */
export function LayerPanel() {
  const layerOn = useStore((s) => s.layerOn);
  const layerState = useStore((s) => s.layerState);
  const toggleLayer = useStore((s) => s.toggleLayer);

  const active = LAYERS.filter((layer) => layerOn[layer.id]).length;

  return (
    <section className="panel">
      <h2>
        Layers
        <span className="hint">
          {active}/{LAYERS.length} on
        </span>
      </h2>

      <div className="layer-chips">
        {LAYERS.map((layer) => {
          const state = layerState[layer.id];
          const on = layerOn[layer.id];

          const status =
            !on
              ? 'off'
              : state?.status === 'error'
                ? `failed — ${state.error}`
                : state?.status === 'locked'
                  ? 'needs an API key in Settings'
                  : state?.status === 'loading'
                    ? 'loading…'
                    : state?.updatedAt
                      ? `${state.count} signals · ${fmtAgo(state.updatedAt)} ago`
                      : 'waiting';

          return (
            <button
              key={layer.id}
              type="button"
              className={[
                'layer-chip',
                on ? 'on' : '',
                state?.status === 'error' && on ? 'failed' : '',
                state?.status === 'locked' && on ? 'locked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => toggleLayer(layer.id)}
              title={`${layer.label} — ${status}\n\n${layer.description}\nSource: ${layer.attribution}`}
            >
              <span className="swatch" style={{ background: layer.color }} />
              {layer.label}
              {on && state?.count ? (
                <span className="layer-chip-count">
                  {state.count > 999 ? '999+' : state.count}
                </span>
              ) : null}
              {on && state?.status === 'locked' ? <span className="layer-chip-count">key</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
