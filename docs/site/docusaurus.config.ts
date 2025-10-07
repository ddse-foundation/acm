import type {Config} from '@docusaurus/types';
import {themes as prismThemes} from 'prism-react-renderer';

const config: Config = {
  title: 'Agentic Contract Model',
  tagline: 'Contract-first agent systems with deterministic execution and replayable memory.',
  url: 'https://ddse-foundation.github.io',
  baseUrl: '/acm/',
  favicon: 'img/favicon.svg',
  organizationName: 'ddse-foundation',
  projectName: 'acm',
  deploymentBranch: 'gh-pages',
  onBrokenLinks: 'throw',
  trailingSlash: false,
  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn'
    }
  },
  customFields: {
    releaseVersion: 'v0.5.0'
  },
  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: 'docs',
          sidebarPath: require.resolve('./sidebars.ts'),
          editUrl: 'https://github.com/ddse-foundation/acm/tree/main/docs/site/docs',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
          lastVersion: 'current',
          versions: {
            current: {
              label: 'v0.5.0',
              path: '',
              banner: 'none'
            }
          }
        },
        blog: {
          routeBasePath: 'blog',
          showReadingTime: true,
          blogTitle: 'ACM Updates',
          blogDescription: 'Announcements, blueprints, and integration guides for the Agentic Contract Model.',
          editUrl: 'https://github.com/ddse-foundation/acm/tree/main/docs/site/blog',
          feedOptions: {
            type: 'all',
            title: 'ACM Framework Blog',
            description: 'Latest tutorials and release commentary from the DDSE Foundation.'
          }
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css')
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5
        }
      }
    ]
  ],
  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true
    },
    navbar: {
      title: 'ACM Framework',
      logo: {
        alt: 'ACM Logo',
        src: 'img/logo-light.svg',
        srcDark: 'img/logo-dark.svg'
      },
      items: [
        {to: '/docs/overview', label: 'Overview', position: 'left'},
        {to: '/docs/get-started/quickstart', label: 'Get Started', position: 'left'},
        {to: '/docs/core-concepts/introduction', label: 'Core Concepts', position: 'left'},
        {to: '/docs/packages', label: 'Packages', position: 'left'},
        {to: '/docs/scenarios/examples', label: 'Examples', position: 'left'},
        {to: '/docs/ai-coder/overview', label: 'AI Coder', position: 'left'},
        {to: '/docs/integrations/overview', label: 'Integrations', position: 'left'},
        {to: '/docs/governance/overview', label: 'Governance', position: 'left'},
        {to: '/docs/announcements', label: 'Announcements', position: 'left'},
        {to: '/blog', label: 'Blog', position: 'left'},
        {to: '/docs/specification/overview', label: 'Specification', position: 'left'},
        {to: '/docs/contribute/overview', label: 'Contribute', position: 'left'},
        {href: 'https://github.com/ddse-foundation/acm', label: 'GitHub', position: 'right'}
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Quick Start', to: '/docs/get-started/quickstart'},
            {label: 'Core Concepts', to: '/docs/core-concepts/introduction'},
            {label: 'Governance', to: '/docs/governance/overview'}
          ]
        },
        {
          title: 'Community',
          items: [
            {label: 'Discussions', href: 'https://github.com/ddse-foundation/acm/discussions'},
            {label: 'Issues', href: 'https://github.com/ddse-foundation/acm/issues'}
          ]
        },
        {
          title: 'Resources',
          items: [
            {label: 'Release Notes', to: '/docs/resources/overview'},
            {label: 'Whitepaper', href: 'https://github.com/ddse-foundation/acm/blob/main/WHITEPAPER.md'},
            {label: 'Architecture', to: '/docs/overview/architecture'}
          ]
        }
      ],
      copyright: `© ${new Date().getFullYear()} DDSE Foundation`
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'typescript', 'yaml']
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4
    },
    metadata: [
      {name: 'og:title', content: 'Agentic Contract Model v0.5.0'},
      {name: 'og:description', content: 'ACM documentation for building contract-first agent systems.'}
    ]
  },
  plugins: [
    async function fixDocusaurusGeneratedModules() {
      return {
        name: 'fix-generated-modules-source-type',
        configureWebpack() {
          return {
            module: {
              rules: [
                {
                  test: /\.m?js$/,
                  include: /[\\\/]\.docusaurus[\\\/]/,
                  type: 'javascript/auto'
                }
              ]
            }
          };
        }
      };
    }
  ]
};

export default config;
