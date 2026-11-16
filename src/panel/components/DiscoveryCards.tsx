import seoImage from '../../../public/images/discovery-seo.svg';
import aeoImage from '../../../public/images/discovery-aeo.svg';
import geoImage from '../../../public/images/discovery-geo.svg';
import styles from '../panel.module.css';

const topics = [
  {
    name: 'SEO',
    expansion: 'Search engine optimization',
    description: 'Help search engines find and understand your pages so people can discover them in search results.',
    image: seoImage,
    alt: 'Original search interface illustration with Structly as the first result for AI readiness checker.',
    href: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide',
    source: 'Google’s SEO guide',
  },
  {
    name: 'AEO',
    expansion: 'Answer engine optimization',
    description: 'Make your content useful for direct answers, including the summaries and source links shown in AI search.',
    image: aeoImage,
    alt: 'Original answer interface illustration explaining how to check a page’s AI readiness, with a Structly source link.',
    href: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide',
    source: 'Google’s AI search guide',
  },
  {
    name: 'GEO',
    expansion: 'Generative engine optimization',
    description: 'Improve how your content is represented and cited in AI-generated answers and recommendations.',
    image: geoImage,
    alt: 'Illustrative AI assistant response to “best tool for SEO AEO and GEO”, showing a recommendation card with the Structly logo and page-audit features.',
    href: 'https://arxiv.org/abs/2311.09735',
    source: 'The GEO research',
  },
];

export function DiscoveryCards() {
  return (
    <>
      <ul className={styles.topicRail} aria-label="Learn about SEO, AEO, and GEO" tabIndex={0}>
        {topics.map((topic) => (
          <li key={topic.name} className={styles.topicCard}>
            <img className={styles.topicImage} src={topic.image} alt={topic.alt} width="640" height="440" loading="lazy" decoding="async" />
            <div className={styles.topicBody}>
              <h3 className={styles.topicTitle}>{topic.name}</h3>
              <p className={styles.topicExpansion}>{topic.expansion}</p>
              <p className={styles.topicDescription}>{topic.description}</p>
              <a className={styles.topicLink} href={topic.href} target="_blank" rel="noreferrer" aria-label={`Learn about ${topic.name}: ${topic.source} (opens in a new tab)`}>
                <span className={styles.controlLabel}>{topic.source}</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 12 12 4M4 4h8v8" />
                </svg>
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className={styles.topicNote}>AEO and GEO overlap. Both build on useful content and sound SEO.</p>
    </>
  );
}
