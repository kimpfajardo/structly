import React from 'react';
import { createRoot } from 'react-dom/client';
import styles from './sample.module.css';
import logo from '../../public/icons/structly-guiding-light-icon-black.svg';
import glass from './edited-glass.png';
import original from './source-photo.jpg';

function Icon({ kind = 'arrow' }: { kind?: 'arrow' | 'moon' | 'plus' | 'copy' | 'refresh' }) {
  const paths = {
    arrow: 'M4 10h12M11 5l5 5-5 5',
    moon: 'M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9Z',
    plus: 'M10 4v12M4 10h12',
    copy: 'M7 7h10v10H7zM3 13V3h10',
    refresh: 'M16 7a6.5 6.5 0 1 0 0 7M16 3v4h-4',
  };
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

function Header() {
  return <header className={styles.header}>
    <div className={styles.brand}><img src={logo} alt="" /><span>Structly</span></div>
    <button type="button" className={styles.theme} aria-label="Dark mode"><Icon kind="moon" /></button>
  </header>;
}

function Ready() {
  return <section className={`${styles.panel} ${styles.ready}`} aria-label="Before audit sample">
    <Header />
    <div className={styles.pageIdentity}><span>example.com</span><span>/products/example-product</span></div>
    <div className={styles.intro}>
      <h1>See your page<br />more clearly.</h1>
      <p>Inspect its structure.<br />Find what needs attention.</p>
      <button type="button" className={styles.primary}>Audit this page<Icon /></button>
    </div>
    <div className={styles.imageField} aria-hidden="true"><img src={glass} alt="" /></div>
    <div className={styles.photoNote}><span>Initial HTML</span><span className={styles.connector} /><span>Rendered page</span></div>
    <div className={styles.readyBottom}>
      <p className={styles.readyExplanation}>One page.<br />A closer look.</p>
      <p>Metadata, content, structured data,<br />accessibility, rendering, and actions.</p>
      <div className={styles.scope}><span className={styles.scopeDot} />Local page checks<span className={styles.ruleCount}>24 rules</span></div>
      <p className={styles.disclaimer}>Rankings, citations, and completed actions<br />are not verified.</p>
    </div>
    <footer className={styles.footer}><span>Built by Kim Fajardo</span><span>About & support</span></footer>
  </section>;
}

function Result() {
  return <section className={`${styles.panel} ${styles.result}`} aria-label="Audit report sample">
    <Header />
    <div className={styles.resultPage}>
      <div><span>example.com</span><small>Example Product · fixture page</small></div>
      <button type="button" className={styles.recheck}><Icon kind="refresh" />Recheck</button>
    </div>
    <div className={styles.verdict}>
      <img src={glass} className={styles.verdictImage} alt="" />
      <div className={styles.verdictText}><h1>3 things<br />to fix.</h1><p>Start with the findings below.</p></div>
    </div>
    <div className={styles.score}><span>Checklist score</span><span className={styles.scoreValue}>93<span>/100</span></span><span className={styles.band}>Strong readiness</span></div>
    <nav className={styles.tabs} aria-label="Report views"><button type="button" className={styles.selected}>Audit report</button><button type="button">AI readiness</button></nav>
    <div className={styles.reportBody}>
      <div className={styles.findingHeader}><h2>Fix first</h2><span>3 warnings</span></div>
      <details className={styles.finding} open>
        <summary><div><h3>Missing meta description</h3><span>Metadata · Medium severity</span></div><span className={styles.disclosure}><Icon kind="plus" /></span></summary>
        <div className={styles.findingDetail}>
          <p>The page has no meta description. Add a concise summary of what this page offers.</p>
          <div className={styles.evidence}><code>meta[name="description"]</code><span>Not found</span></div>
          <button type="button" className={styles.outline}><Icon kind="copy" />Copy fix prompt</button>
        </div>
      </details>
      <details className={styles.finding}><summary><div><h3>Missing canonical link</h3><span>Metadata · Medium severity</span></div><span className={styles.disclosure}><Icon kind="plus" /></span></summary><p className={styles.findingDetail}>Add the preferred URL for this page using a canonical link.</p></details>
      <details className={styles.finding}><summary><div><h3>No JSON-LD structured data</h3><span>Structured data · Low severity</span></div><span className={styles.disclosure}><Icon kind="plus" /></span></summary><p className={styles.findingDetail}>Review whether structured data is appropriate for this page.</p></details>
      <button type="button" className={`${styles.primary} ${styles.copyAll}`}>Copy AI fix prompt<Icon /></button>
      <p className={styles.limit}>Local page checks. Rankings, citations, and completed actions are not verified.</p>
      <div className={styles.filters}><button type="button">All findings<span>3</span></button><button type="button">Filter<Icon kind="plus" /></button></div>
      <details className={styles.secondary}><summary>Page evidence<Icon kind="plus" /></summary><p>Content delivery and category scores appear here.</p></details>
      <details className={styles.secondary}><summary>Export report<Icon kind="plus" /></summary><p>Copy or download the report, evidence, and fix prompts.</p></details>
    </div>
    <footer className={styles.footer}><span>Built by Kim Fajardo</span><button type="button">Reset audit</button></footer>
  </section>;
}

function App() {
  const screen = new URLSearchParams(window.location.search).get('screen');
  if (screen) return <div className={styles.single}>{screen === 'ready' ? <Ready /> : <Result />}</div>;
  return <main className={styles.board}>
    <div className={styles.boardTitle}><h1>Structly, through a different lens.</h1><p>Visual sample · 420px extension panels · Illustrative data</p></div>
    <div className={styles.comparison}>
      <div><div className={styles.frameLabel}>Before audit<span>Photography leads</span></div><Ready /></div>
      <div><div className={styles.frameLabel}>Audit report<span>Findings lead</span></div><Result /></div>
    </div>
    <div className={styles.provenance}>
      <div className={styles.provenanceImages}><img src={original} alt="Original blue glass bottle photograph" /><Icon /><img src={glass} alt="AI-edited macro refraction treatment" /></div>
      <div><h2>Real photograph. Edited optical treatment.</h2><p>Valentin Ivantsov / Pexels · Macro crop, cobalt toning, optical softening.<br />Source retained; this is an AI edit of a photograph.</p></div>
    </div>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
