import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import clsx from 'clsx';
import styles from './index.module.css';

const features = [
  {
    title: 'Contract-First Architecture',
    description:
      'Model goals, context packets, capabilities, and tasks as verifiable artifacts that survive audits and replay.',
  },
  {
    title: 'Deterministic Execution',
    description:
      'Run plans with guard evaluation, policy enforcement, retries, and resumable checkpoints enforced by the runtime.',
  },
  {
    title: 'Composable Tooling',
    description:
      'Blend ACM-native tools with MCP servers, LangGraph or Microsoft Agent Framework while preserving contract guarantees.',
  },
  {
    title: 'Replay & Governance',
    description:
      'Capture ledgers, replay bundles, and policy decisions so regulated teams can ship agents with confidence.',
  },
];

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container text--center">
        <div className="version-badge">Latest Release {siteConfig.customFields?.releaseVersion}</div>
        <Heading as="h1" className="hero__title">
          Build trustworthy agent systems with ACM v0.5.0
        </Heading>
        <p className="hero__subtitle">
          The Agentic Contract Model gives you typed contracts, structured planning, deterministic runtime, and replayable
          decision memory—engineered for high-assurance AI operations.
        </p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/docs/get-started/quickstart">
            Start in 10 minutes
          </Link>
          <Link className="button button--secondary button--lg" to="/docs/specification/overview">
            Read the specification
          </Link>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <div key={feature.title} className="feature-card">
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout
      description="ACM v0.5.0 documentation – contract-first agent frameworks, deterministic runtime, replay bundles, and AI Coder experience."
    >
      <HomepageHeader />
    </Layout>
  );
}
