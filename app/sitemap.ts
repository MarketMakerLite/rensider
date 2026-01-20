import { MetadataRoute } from 'next'
import { query } from '@/lib/sec/duckdb'

const baseUrl = 'https://renbot.app'

/**
 * Get popular stock tickers for sitemap
 * Returns tickers with most institutional holders in the latest quarter
 */
async function getPopularTickers(): Promise<string[]> {
  try {
    const result = await query<{ ticker: string }>(`
      SELECT DISTINCT cm.ticker
      FROM rensider.cusip_mappings cm
      WHERE cm.ticker IS NOT NULL
        AND LENGTH(cm.ticker) BETWEEN 1 AND 5
        AND cm.ticker ~ '^[A-Z]+$'
      ORDER BY cm.ticker
      LIMIT 1000
    `)
    return result.map(r => r.ticker)
  } catch (error) {
    console.error('Error fetching tickers for sitemap:', error)
    return []
  }
}

/**
 * Get top institutional filers by CIK for sitemap
 * Returns CIKs of filers with the largest portfolios
 */
async function getTopFilers(): Promise<string[]> {
  try {
    const result = await query<{ cik: string }>(`
      SELECT DISTINCT LTRIM(s.CIK, '0') as cik
      FROM submissions_13f s
      WHERE s.CIK IS NOT NULL
      ORDER BY s.FILING_DATE DESC
      LIMIT 500
    `)
    return result.map(r => r.cik)
  } catch (error) {
    console.error('Error fetching filers for sitemap:', error)
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/insiders`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/activists`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/alerts`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
  ]

  // Fetch dynamic data in parallel
  const [tickers, filers] = await Promise.all([
    getPopularTickers(),
    getTopFilers(),
  ])

  // Stock pages
  const stockPages: MetadataRoute.Sitemap = tickers.map(ticker => ({
    url: `${baseUrl}/stock/${ticker}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  // Fund pages
  const fundPages: MetadataRoute.Sitemap = filers.map(cik => ({
    url: `${baseUrl}/fund/${cik}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...stockPages, ...fundPages]
}
