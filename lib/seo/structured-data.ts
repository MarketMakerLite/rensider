/**
 * JSON-LD Structured Data utilities for SEO
 * @see https://schema.org
 */

const baseUrl = 'https://renbot.app'

/**
 * Organization schema for the site
 */
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Rensider',
    url: baseUrl,
    logo: `${baseUrl}/icon-512.png`,
    description: 'Track what hedge funds and institutional investors are buying and selling.',
    sameAs: [],
  }
}

/**
 * WebSite schema with search action
 */
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Rensider',
    url: baseUrl,
    description: 'Track what hedge funds and institutional investors are buying and selling. Monitor insider trades and discover where the smart money is flowing.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/**
 * BreadcrumbList schema for navigation
 */
export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * FinancialProduct schema for stock pages
 */
export function stockPageSchema(ticker: string, companyName: string | null) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${ticker} Institutional Ownership`,
    description: `Track institutional holdings and 13F filings for ${ticker}${companyName ? ` (${companyName})` : ''}. View fund sentiment, ownership concentration, and recent filer activity.`,
    url: `${baseUrl}/stock/${ticker}`,
    breadcrumb: breadcrumbSchema([
      { name: 'Home', url: baseUrl },
      { name: 'Stocks', url: baseUrl },
      { name: ticker, url: `${baseUrl}/stock/${ticker}` },
    ]),
  }
}

/**
 * Organization schema for fund pages
 */
export function fundPageSchema(cik: string, institutionName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${institutionName} Holdings`,
    description: `View portfolio holdings, AUM history, and position changes for ${institutionName}. Track 13F filings and institutional activity.`,
    url: `${baseUrl}/fund/${cik}`,
    breadcrumb: breadcrumbSchema([
      { name: 'Home', url: baseUrl },
      { name: 'Funds', url: baseUrl },
      { name: institutionName, url: `${baseUrl}/fund/${cik}` },
    ]),
  }
}

/**
 * Person schema for insider profile pages
 */
export function insiderProfileSchema(cik: string, name: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${name} | Insider Profile`,
    description: `View insider trading history for ${name}. Track their positions and transactions across public companies.`,
    url: `${baseUrl}/insider/${cik}`,
    breadcrumb: breadcrumbSchema([
      { name: 'Home', url: baseUrl },
      { name: 'Insider Sales', url: `${baseUrl}/insiders` },
      { name: name, url: `${baseUrl}/insider/${cik}` },
    ]),
  }
}

/**
 * FinancialProduct schema for stock pages (rich snippets)
 * @see https://schema.org/FinancialProduct
 */
export function financialProductSchema(
  ticker: string,
  companyName: string | null,
  metrics?: {
    totalHolders?: number
    sentimentScore?: number
    sentimentSignal?: string
  }
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: companyName ? `${companyName} (${ticker})` : ticker,
    description: `Institutional ownership data for ${ticker}${companyName ? ` - ${companyName}` : ''}. Track 13F filings, fund sentiment, and holder activity.`,
    url: `${baseUrl}/stock/${ticker}`,
    category: 'Publicly Traded Security',
    provider: {
      '@type': 'Organization',
      name: 'Rensider',
      url: baseUrl,
    },
    ...(metrics?.totalHolders && {
      additionalProperty: [
        {
          '@type': 'PropertyValue',
          name: 'Institutional Holders',
          value: metrics.totalHolders,
        },
        ...(metrics.sentimentScore !== undefined ? [{
          '@type': 'PropertyValue',
          name: 'Institutional Sentiment Score',
          value: metrics.sentimentScore,
          minValue: 0,
          maxValue: 100,
        }] : []),
        ...(metrics.sentimentSignal ? [{
          '@type': 'PropertyValue',
          name: 'Sentiment Signal',
          value: metrics.sentimentSignal,
        }] : []),
      ],
    }),
  }
}

/**
 * FAQPage schema for pages with Q&A content
 * @see https://schema.org/FAQPage
 */
export function faqPageSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

