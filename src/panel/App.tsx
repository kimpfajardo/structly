import { useState } from 'react';
import { PanelInboundMessageSchema } from '../core/schemas/messages';
import styles from './panel.module.css';

// Walking-skeleton phase: no rule/scoring execution and no snapshot-schema validation yet
// (02-data-model.md / 04-rules.md / 05-scoring.md land in later build steps per
// 00-README.md's build order). This renders the raw AUDIT_RESULT snapshot as JSON so the
// panel <-> service worker <-> content script round-trip can be verified end to end.

type PanelState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'result'; snapshot: unknown }
  | { kind: 'error'; message: string };

export default function App() {
  const [state, setState] = useState<PanelState>({ kind: 'idle' });

  async function handleAudit() {
    setState({ kind: 'loading' });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      setState({ kind: 'error', message: 'No active tab found.' });
      return;
    }

    chrome.runtime.sendMessage(
      { type: 'AUDIT_REQUEST', tabId: tab.id, url: tab.url },
      (response: unknown) => {
        const parsed = PanelInboundMessageSchema.safeParse(response);
        if (!parsed.success) {
          setState({ kind: 'error', message: 'Received an invalid message from the extension.' });
          return;
        }
        if (parsed.data.type === 'AUDIT_ERROR') {
          setState({ kind: 'error', message: parsed.data.message });
          return;
        }
        setState({ kind: 'result', snapshot: parsed.data.snapshot });
      },
    );
  }

  return (
    <div className={styles.container}>
      <h1>Page Readiness Auditor</h1>
      <button className={styles.button} onClick={handleAudit} disabled={state.kind === 'loading'}>
        {state.kind === 'loading' ? 'Auditing…' : 'Audit Page'}
      </button>

      {state.kind === 'error' && (
        <div className={styles.error}>
          {state.message}{' '}
          <button className={styles.button} onClick={handleAudit}>
            Retry
          </button>
        </div>
      )}

      {state.kind === 'result' && (
        <pre className={styles.snapshot}>{JSON.stringify(state.snapshot, null, 2)}</pre>
      )}
    </div>
  );
}
