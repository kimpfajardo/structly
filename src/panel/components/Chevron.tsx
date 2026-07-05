import styles from '../panel.module.css';

// Disclosure chevron shared by issue rows and collapsible AI sections.
// Rotation on open is driven by `details[open]` rules in the stylesheet.
export function Chevron() {
  return (
    <svg className={styles.chevron} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
