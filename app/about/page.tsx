import type { Metadata } from 'next'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { Heading, Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'

export const metadata: Metadata = {
  title: 'About Rensider | How We Track Institutional Investors',
  description: 'Learn how Rensider tracks hedge fund holdings, activist investors, and insider trades. Understand the data behind smart money movements.',
  openGraph: {
    title: 'About Rensider | How We Track Institutional Investors',
    description: 'Learn how Rensider tracks hedge fund holdings, activist investors, and insider trades. Understand the data behind smart money movements.',
    type: 'article',
  },
  twitter: {
    title: 'About Rensider | How We Track Institutional Investors',
    description: 'Learn how Rensider tracks hedge fund holdings, activist investors, and insider trades. Understand the data behind smart money movements.',
  },
}

export default function AboutPage() {
  return (
    <ApplicationLayout>
      <div className="max-w-6xl">
        {/* Header */}
        <div>
          <Heading>SEC Ownership Filings: Theory &amp; Methodology</Heading>
          <Text className="mt-1 text-zinc-600">
            Technical documentation on institutional ownership disclosure (13F), beneficial ownership (13D/13G), and the regulatory framework under the Securities Exchange Act of 1934
          </Text>
        </div>

        {/* Executive Summary for Traders */}
        <section className="mt-8 border-2 border-green-200 bg-green-50 p-6">
          <div className="flex items-center gap-2">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <Text className="text-lg font-semibold text-green-900">Why This Matters for Traders</Text>
          </div>
          <Text className="mt-3 text-green-800">
            SEC ownership filings provide multiple <strong>windows into institutional positioning</strong>. Form 13F reveals quarterly
            holdings of managers with $100M+ in assets. Schedule 13D exposes activist investors building 5%+ stakes with intent to
            influence—often preceding major corporate changes. Schedule 13G tracks passive 5%+ owners. Together, these filings reveal
            where &quot;smart money&quot; is flowing and when significant shareholders are taking action.
          </Text>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="border border-green-300 bg-white p-3">
              <Text className="text-sm font-medium text-green-900">13F: Institutional Flow</Text>
              <Text className="mt-1 text-xs text-green-700">
                Quarterly snapshots of professional investor positioning reveal accumulation and distribution patterns
              </Text>
            </div>
            <div className="border border-green-300 bg-white p-3">
              <Text className="text-sm font-medium text-green-900">13D: Activist Signals</Text>
              <Text className="mt-1 text-xs text-green-700">
                Early warning of activist campaigns, hostile takeovers, and major corporate catalysts with 10-day disclosure
              </Text>
            </div>
            <div className="border border-green-300 bg-white p-3">
              <Text className="text-sm font-medium text-green-900">13G: Passive Stakes</Text>
              <Text className="mt-1 text-xs text-green-700">
                Large passive holders (index funds, long-term investors) provide stability signals and float analysis
              </Text>
            </div>
          </div>
        </section>

        {/* Table of Contents */}
        <nav className="mt-8 border border-zinc-200 p-4">
          <Text className="text-sm font-medium text-zinc-900">Contents</Text>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">Form 13F (Institutional Holdings)</Text>
              <ul className="mt-2 space-y-1 text-sm">
                <li><a href="#trading-applications" className="text-blue-600 hover:underline">1. Trading Applications &amp; Use Cases</a></li>
                <li><a href="#signal-interpretation" className="text-blue-600 hover:underline">2. Signal Interpretation for Traders</a></li>
                <li><a href="#regulatory-framework" className="text-blue-600 hover:underline">3. Regulatory Framework</a></li>
                <li><a href="#filing-requirements" className="text-blue-600 hover:underline">4. Filing Requirements &amp; Thresholds</a></li>
                <li><a href="#section-13f-securities" className="text-blue-600 hover:underline">5. Section 13(f) Securities Classification</a></li>
                <li><a href="#investment-discretion" className="text-blue-600 hover:underline">6. Investment Discretion Taxonomy</a></li>
                <li><a href="#voting-authority" className="text-blue-600 hover:underline">7. Voting Authority Attribution</a></li>
                <li><a href="#data-structure" className="text-blue-600 hover:underline">8. Filing Data Structure</a></li>
                <li><a href="#analytical-methodology" className="text-blue-600 hover:underline">9. Analytical Methodology</a></li>
                <li><a href="#limitations" className="text-blue-600 hover:underline">10. Limitations &amp; Caveats</a></li>
              </ul>
            </div>
            <div>
              <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">Beneficial Ownership (13D/13G)</Text>
              <ul className="mt-2 space-y-1 text-sm">
                <li><a href="#schedule-13d" className="text-blue-600 hover:underline">11. Schedule 13D: Activist Disclosure</a></li>
                <li><a href="#schedule-13g" className="text-blue-600 hover:underline">12. Schedule 13G: Passive Ownership</a></li>
                <li><a href="#form-comparison" className="text-blue-600 hover:underline">13. Comparing 13F, 13D, and 13G</a></li>
                <li><a href="#13d-13g-trading" className="text-blue-600 hover:underline">14. Trading with 13D/13G Data</a></li>
              </ul>
            </div>
          </div>
        </nav>

        {/* Section 1: Trading Applications */}
        <section id="trading-applications" className="mt-10">
          <Subheading level={2}>1. Trading Applications &amp; Use Cases</Subheading>
          <div className="mt-4 space-y-4">
            <Text>
              Institutional ownership data serves as a leading indicator for equity price movements. Academic research consistently
              demonstrates that changes in institutional holdings predict future returns, particularly when aggregated across multiple
              sophisticated investors. The informational advantage stems from several factors:
            </Text>

            <div className="space-y-4">
              <div className="border border-zinc-200 p-4">
                <div className="flex items-center gap-2">
                  <Badge color="blue">Research Edge</Badge>
                  <Text className="font-medium text-zinc-900">Information Asymmetry</Text>
                </div>
                <Text className="mt-2 text-sm text-zinc-600">
                  Institutional investors employ teams of analysts, conduct proprietary research, attend investor conferences, and
                  engage directly with corporate management. Their positioning reflects information not yet fully incorporated into
                  market prices. When multiple unaffiliated institutions simultaneously increase exposure to a security, it suggests
                  convergent analysis reaching similar bullish conclusions.
                </Text>
              </div>

              <div className="border border-zinc-200 p-4">
                <div className="flex items-center gap-2">
                  <Badge color="purple">Capital Flows</Badge>
                  <Text className="font-medium text-zinc-900">Supply/Demand Dynamics</Text>
                </div>
                <Text className="mt-2 text-sm text-zinc-600">
                  Institutions managing billions cannot enter or exit positions quickly without moving prices. Large-scale accumulation
                  programs absorb available supply over weeks or months, creating sustained buying pressure. Conversely, institutional
                  distribution floods the market with supply. Identifying these flows early provides a structural edge—you&apos;re trading
                  alongside forces that will continue pushing prices in your direction.
                </Text>
              </div>

              <div className="border border-zinc-200 p-4">
                <div className="flex items-center gap-2">
                  <Badge color="amber">Risk Management</Badge>
                  <Text className="font-medium text-zinc-900">Crowding &amp; Liquidity Risk</Text>
                </div>
                <Text className="mt-2 text-sm text-zinc-600">
                  Highly concentrated institutional ownership creates fragility. When many funds hold the same position, forced
                  liquidations (redemptions, margin calls, risk-off events) trigger cascading selling. The 2021 Archegos collapse
                  exemplifies this risk. Monitoring ownership concentration helps avoid crowded trades and identify potential
                  short-squeeze candidates where institutional shorts exceed available float.
                </Text>
              </div>

              <div className="border border-zinc-200 p-4">
                <div className="flex items-center gap-2">
                  <Badge color="green">Alpha Generation</Badge>
                  <Text className="font-medium text-zinc-900">Following High-Conviction Managers</Text>
                </div>
                <Text className="mt-2 text-sm text-zinc-600">
                  Not all institutional investors are equal. Certain managers—Berkshire Hathaway, Renaissance Technologies, Pershing
                  Square, Tiger Global—have demonstrated persistent alpha generation. Replicating their highest-conviction positions
                  (largest portfolio weights, new initiations, positions added during drawdowns) allows retail investors to leverage
                  world-class research infrastructure. The 45-day reporting lag means you won&apos;t capture the initial move, but you
                  participate in the thesis playing out over quarters and years.
                </Text>
              </div>
            </div>

            <Subheading level={3} className="mt-6">Practical Trading Strategies</Subheading>
            <div className="mt-4 overflow-hidden border border-zinc-200">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Strategy</th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Signal</th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Implementation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-900">Superinvestor Cloning</td>
                    <td className="px-4 py-3 text-zinc-700">New position initiated by high-alpha manager</td>
                    <td className="px-4 py-3 text-zinc-700">Enter when filing published, size proportionally</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-900">Accumulation Momentum</td>
                    <td className="px-4 py-3 text-zinc-700">3+ consecutive quarters of rising IO</td>
                    <td className="px-4 py-3 text-zinc-700">Long bias while trend persists</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-900">Accumulation Breakout</td>
                    <td className="px-4 py-3 text-zinc-700">Significant IO increase within lookback period</td>
                    <td className="px-4 py-3 text-zinc-700">Research catalyst, consider entry on pullbacks</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-900">Crowding Avoidance</td>
                    <td className="px-4 py-3 text-zinc-700">Top 10 holders &gt;50% of float</td>
                    <td className="px-4 py-3 text-zinc-700">Reduce position size, tighten stops</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-900">Distribution Exit</td>
                    <td className="px-4 py-3 text-zinc-700">Multiple top holders reducing simultaneously</td>
                    <td className="px-4 py-3 text-zinc-700">Exit or hedge existing longs</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-900">Contrarian Value</td>
                    <td className="px-4 py-3 text-zinc-700">IO declining while fundamentals stable</td>
                    <td className="px-4 py-3 text-zinc-700">Accumulate at discounted prices</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Section 2: Signal Interpretation */}
        <section id="signal-interpretation" className="mt-10">
          <Subheading level={2}>2. Signal Interpretation for Traders</Subheading>
          <div className="mt-4 space-y-4">
            <Text>
              Raw 13F data requires interpretation. Not all changes in institutional holdings carry equal significance. The following
              framework helps traders distinguish actionable signals from noise:
            </Text>

            <Subheading level={3}>Bullish Signals (Accumulation)</Subheading>
            <div className="mt-3 space-y-3">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-green-200 bg-green-50 text-green-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </div>
                <div>
                  <Text className="font-medium text-zinc-900">New Position Initiations</Text>
                  <Text className="text-sm text-zinc-600">
                    When a fund with no prior exposure initiates a position, it reflects a deliberate decision after due diligence.
                    Particularly significant when the position represents &gt;1% of the fund&apos;s portfolio or when multiple funds initiate
                    simultaneously.
                  </Text>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-green-200 bg-green-50 text-green-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </div>
                <div>
                  <Text className="font-medium text-zinc-900">Buying Into Weakness</Text>
                  <Text className="text-sm text-zinc-600">
                    Institutions adding to positions during price declines demonstrates conviction. They&apos;re averaging down, believing
                    the market is wrong. This contrarian behavior often marks turning points.
                  </Text>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-green-200 bg-green-50 text-green-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </div>
                <div>
                  <Text className="font-medium text-zinc-900">Increasing Holder Count</Text>
                  <Text className="text-sm text-zinc-600">
                    Broadening institutional sponsorship (more funds owning the stock) provides a more stable shareholder base and
                    signals widening recognition of the investment thesis. The stock is &quot;graduating&quot; to institutional awareness.
                  </Text>
                </div>
              </div>
            </div>

            <Subheading level={3} className="mt-6">Bearish Signals (Distribution)</Subheading>
            <div className="mt-3 space-y-3">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-red-200 bg-red-50 text-red-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div>
                  <Text className="font-medium text-zinc-900">Complete Position Exits</Text>
                  <Text className="text-sm text-zinc-600">
                    Full liquidation by a long-term holder suggests a fundamental change in thesis—not just profit-taking. Investigate
                    what the fund might know, especially if they held through prior volatility.
                  </Text>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-red-200 bg-red-50 text-red-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div>
                  <Text className="font-medium text-zinc-900">Coordinated Selling</Text>
                  <Text className="text-sm text-zinc-600">
                    Multiple unaffiliated institutions reducing exposure in the same quarter indicates shared concerns. Unlike retail
                    sentiment, institutional selling reflects deep research and often precedes negative news by 1-2 quarters.
                  </Text>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-red-200 bg-red-50 text-red-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div>
                  <Text className="font-medium text-zinc-900">Selling Into Strength</Text>
                  <Text className="text-sm text-zinc-600">
                    Institutions reducing into rallies while retail chases momentum is a classic distribution pattern. Smart money
                    is using liquidity provided by retail enthusiasm to exit positions at favorable prices.
                  </Text>
                </div>
              </div>
            </div>

            <Subheading level={3} className="mt-6">Understanding the 45-Day Lag</Subheading>
            <div className="mt-3 border-l-2 border-blue-300 bg-blue-50 p-4">
              <Text className="text-sm text-blue-800">
                <strong>Critical Timing Consideration:</strong> 13F data is always stale. Positions are reported as of quarter-end,
                filed up to 45 days later, and may have changed significantly since. A Q4 filing (deadline Feb 14) reveals December 31
                positions—potentially 6+ weeks old. This lag has implications:
              </Text>
              <ul className="mt-3 space-y-2 text-sm text-blue-700">
                <li className="flex gap-2">
                  <span className="font-bold">•</span>
                  <span><strong>Don&apos;t chase short-term moves.</strong> If a stock spiked 30% since quarter-end, the institutional buying that preceded it is already priced in.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">•</span>
                  <span><strong>Focus on multi-quarter trends.</strong> Sustained accumulation over 2-4 quarters indicates a durable thesis, not a trade.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">•</span>
                  <span><strong>Combine with real-time data.</strong> Use 13F data for strategic positioning and conviction, but pair with technical analysis and news flow for entry timing.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">•</span>
                  <span><strong>The lag is an opportunity.</strong> While fast-money traders ignore stale data, patient investors can identify structural ownership shifts before the crowd.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3: Regulatory Framework */}
        <section id="regulatory-framework" className="mt-10">
          <Subheading level={2}>3. Regulatory Framework</Subheading>
          <div className="mt-4 space-y-4">
            <Text>
              Section 13(f) of the Securities Exchange Act of 1934, codified at 15 U.S.C. § 78m(f) and implemented through
              SEC Rule 13f-1 (17 CFR § 240.13f-1), establishes mandatory disclosure requirements for institutional investment
              managers exercising investment discretion over qualifying equity securities.
            </Text>
            <Text>
              The statutory framework emerged from the 1975 Securities Acts Amendments, which directed the SEC to establish
              a system for collecting, processing, and disseminating information regarding institutional holdings. The legislative
              intent was to enhance market transparency, facilitate academic research on institutional investor behavior, and
              enable regulatory monitoring of concentration risk in equity markets.
            </Text>
            <div className="border-l-2 border-zinc-300 pl-4">
              <Text className="text-sm italic text-zinc-600">
                &quot;Every institutional investment manager which uses the mails, or any means or instrumentality of interstate
                commerce in the course of its business as an institutional investment manager and which exercises investment
                discretion with respect to accounts holding [Section 13(f)] securities... shall file reports with the Commission.&quot;
              </Text>
              <Text className="mt-2 text-xs text-zinc-500">— 17 CFR § 240.13f-1(a)(1)</Text>
            </div>
          </div>
        </section>

        {/* Section 4: Filing Requirements */}
        <section id="filing-requirements" className="mt-10">
          <Subheading level={2}>4. Filing Requirements &amp; Thresholds</Subheading>
          <div className="mt-4 space-y-4">
            <Text>
              An institutional investment manager triggers the reporting obligation when accounts under its investment discretion
              hold Section 13(f) securities with an aggregate fair market value of at least <strong>$100 million</strong> on the
              last trading day of any month during a calendar year. Once triggered, the filing obligation persists for the
              remainder of that calendar year and the entirety of the subsequent calendar year, regardless of subsequent
              fluctuations below the threshold.
            </Text>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="border border-zinc-200 p-4">
                <Text className="text-sm font-medium text-zinc-900">Filing Deadline</Text>
                <Text className="mt-1 text-2xl font-semibold tabular-nums">45 days</Text>
                <Text className="mt-1 text-sm text-zinc-500">After quarter-end</Text>
              </div>
              <div className="border border-zinc-200 p-4">
                <Text className="text-sm font-medium text-zinc-900">AUM Threshold</Text>
                <Text className="mt-1 text-2xl font-semibold tabular-nums">$100M</Text>
                <Text className="mt-1 text-sm text-zinc-500">Section 13(f) securities</Text>
              </div>
            </div>

            <Text>
              The term &quot;institutional investment manager&quot; encompasses any entity or natural person that either: (1) invests in,
              or buys and sells, securities for its own account; or (2) exercises investment discretion over the account of any
              other natural person or entity. This definition captures a heterogeneous population including:
            </Text>

            <div className="flex flex-wrap gap-2">
              <Badge color="zinc">Registered Investment Advisers</Badge>
              <Badge color="zinc">Banks &amp; Trust Companies</Badge>
              <Badge color="zinc">Insurance Companies</Badge>
              <Badge color="zinc">Broker-Dealers</Badge>
              <Badge color="zinc">Pension Funds</Badge>
              <Badge color="zinc">Endowments</Badge>
              <Badge color="zinc">Hedge Funds</Badge>
              <Badge color="zinc">Corporate Treasuries</Badge>
            </div>
          </div>
        </section>

        {/* Section 5: Section 13(f) Securities */}
        <section id="section-13f-securities" className="mt-10">
          <Subheading level={2}>5. Section 13(f) Securities Classification</Subheading>
          <div className="mt-4 space-y-4">
            <Text>
              Section 13(f) securities are defined by reference to Section 13(d)(1) of the Exchange Act, encompassing equity
              securities of classes registered pursuant to Section 12 or required to report under Section 15(d). Critically,
              the security must also be admitted to trading on a national securities exchange or quoted on the automated
              quotation system of a registered securities association (NASDAQ).
            </Text>

            <div className="overflow-hidden border border-zinc-200">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Security Type</th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Included</th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <tr>
                    <td className="px-4 py-2 text-zinc-900">Exchange-traded equities</td>
                    <td className="px-4 py-2"><Badge color="green">Yes</Badge></td>
                    <td className="px-4 py-2 text-zinc-700">NYSE, NASDAQ, etc.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-zinc-900">Listed equity options</td>
                    <td className="px-4 py-2"><Badge color="green">Yes</Badge></td>
                    <td className="px-4 py-2 text-zinc-700">Call and put options</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-zinc-900">Closed-end funds</td>
                    <td className="px-4 py-2"><Badge color="green">Yes</Badge></td>
                    <td className="px-4 py-2 text-zinc-700">Exchange-traded CEFs</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-zinc-900">Convertible debt securities</td>
                    <td className="px-4 py-2"><Badge color="yellow">Conditional</Badge></td>
                    <td className="px-4 py-2 text-zinc-700">If equity-linked and listed</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-zinc-900">Exchange-traded warrants</td>
                    <td className="px-4 py-2"><Badge color="green">Yes</Badge></td>
                    <td className="px-4 py-2 text-zinc-700">Listed warrants only</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-zinc-900">Open-end mutual funds</td>
                    <td className="px-4 py-2"><Badge color="red">No</Badge></td>
                    <td className="px-4 py-2 text-zinc-700">Explicitly excluded</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-zinc-900">Private placements</td>
                    <td className="px-4 py-2"><Badge color="red">No</Badge></td>
                    <td className="px-4 py-2 text-zinc-700">Not exchange-traded</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-zinc-900">Foreign ordinary shares</td>
                    <td className="px-4 py-2"><Badge color="red">No</Badge></td>
                    <td className="px-4 py-2 text-zinc-700">ADRs may qualify</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Text>
              The SEC publishes the <strong>Official List of Section 13(f) Securities</strong> quarterly, which serves as the
              authoritative reference for determining reportable securities. The list is organized by CUSIP number and includes
              approximately 17,000+ securities as of recent publications.
            </Text>
          </div>
        </section>

        {/* Section 6: Investment Discretion */}
        <section id="investment-discretion" className="mt-10">
          <Subheading level={2}>6. Investment Discretion Taxonomy</Subheading>
          <div className="mt-4 space-y-4">
            <Text>
              Investment discretion—the authority to determine which securities to buy or sell—must be categorized according
              to a tripartite classification system. This taxonomy is critical for understanding aggregation rules and
              avoiding double-counting when multiple managers share discretionary authority.
            </Text>

            <div className="space-y-4">
              <div className="border border-zinc-200 p-4">
                <div className="flex items-center gap-2">
                  <Badge color="blue">SOLE</Badge>
                  <Text className="font-medium text-zinc-900">Sole Investment Discretion</Text>
                </div>
                <Text className="mt-2 text-sm text-zinc-600">
                  The manager exercises exclusive investment discretion over the securities position. No other entity
                  participates in the buy/sell decision-making process. This represents the cleanest form of discretionary
                  authority and eliminates aggregation complexity.
                </Text>
              </div>

              <div className="border border-zinc-200 p-4">
                <div className="flex items-center gap-2">
                  <Badge color="purple">DEFINED</Badge>
                  <Text className="font-medium text-zinc-900">Shared-Defined Investment Discretion</Text>
                </div>
                <Text className="mt-2 text-sm text-zinc-600">
                  Investment discretion is shared within a defined corporate structure: (i) between controlling and controlled
                  companies (e.g., bank holding companies and subsidiaries); (ii) between investment advisers and the investment
                  companies they advise; or (iii) between insurance companies and their separate accounts. This category enables
                  proper consolidation while avoiding double-reporting.
                </Text>
              </div>

              <div className="border border-zinc-200 p-4">
                <div className="flex items-center gap-2">
                  <Badge color="amber">OTHER</Badge>
                  <Text className="font-medium text-zinc-900">Shared-Other Investment Discretion</Text>
                </div>
                <Text className="mt-2 text-sm text-zinc-600">
                  Investment discretion is shared in a manner not falling within the DEFINED category. This typically arises
                  in co-investment arrangements, joint ventures, or sub-advisory relationships outside the prescribed corporate
                  structures. Multiple Form 13F filers may report the same position under this designation.
                </Text>
              </div>
            </div>
          </div>
        </section>

        {/* Section 7: Voting Authority */}
        <section id="voting-authority" className="mt-10">
          <Subheading level={2}>7. Voting Authority Attribution</Subheading>
          <div className="mt-4 space-y-4">
            <Text>
              Voting authority is conceptually distinct from investment discretion and must be reported separately. A manager
              may have sole investment discretion but shared (or no) voting authority, or vice versa. The Form 13F requires
              allocation of shares across three voting authority categories:
            </Text>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="border border-zinc-200 p-4">
                <Text className="font-medium text-zinc-900">Sole</Text>
                <Text className="mt-2 text-sm text-zinc-600">
                  Manager has exclusive authority to vote the shares on all matters.
                </Text>
              </div>
              <div className="border border-zinc-200 p-4">
                <Text className="font-medium text-zinc-900">Shared</Text>
                <Text className="mt-2 text-sm text-zinc-600">
                  Voting authority is shared with another person or entity.
                </Text>
              </div>
              <div className="border border-zinc-200 p-4">
                <Text className="font-medium text-zinc-900">None</Text>
                <Text className="mt-2 text-sm text-zinc-600">
                  Manager has no authority to vote the shares.
                </Text>
              </div>
            </div>

            <div className="border-l-2 border-amber-300 bg-amber-50 p-4">
              <Text className="text-sm text-amber-800">
                <strong>Important:</strong> The SEC deems a manager exercising sole voting authority over &quot;routine&quot; matters only,
                and no authority to vote on &quot;non-routine&quot; matters, to have <em>no voting authority</em> for Form 13F purposes.
              </Text>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div>
                  <Text className="text-xs font-medium text-amber-900">Non-Routine Matters:</Text>
                  <ul className="mt-1 list-disc pl-4 text-xs text-amber-700">
                    <li>Contested election of directors</li>
                    <li>Mergers</li>
                    <li>Sale of substantially all assets</li>
                    <li>Charter amendments affecting shareholder rights</li>
                    <li>Changes to fundamental investment policy</li>
                  </ul>
                </div>
                <div>
                  <Text className="text-xs font-medium text-amber-900">Routine Matters:</Text>
                  <ul className="mt-1 list-disc pl-4 text-xs text-amber-700">
                    <li>Selection of accountant</li>
                    <li>Uncontested election of directors</li>
                    <li>Approval of annual report</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 8: Data Structure */}
        <section id="data-structure" className="mt-10">
          <Subheading level={2}>8. Filing Data Structure</Subheading>
          <div className="mt-4 space-y-4">
            <Text>
              Form 13F filings are submitted electronically via EDGAR in XML format. The information table contains one entry
              per unique combination of issuer, security class, investment discretion type, and (if applicable) put/call
              indicator. Key data elements include:
            </Text>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Field</th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Description</th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Format</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-900">nameOfIssuer</td>
                    <td className="px-4 py-2 text-zinc-900">Name of the security issuer</td>
                    <td className="px-4 py-2 text-zinc-700">String (200 char max)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-900">titleOfClass</td>
                    <td className="px-4 py-2 text-zinc-900">Class/type of security</td>
                    <td className="px-4 py-2 text-zinc-700">String</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-900">cusip</td>
                    <td className="px-4 py-2 text-zinc-900">CUSIP identifier</td>
                    <td className="px-4 py-2 text-zinc-700">9-character alphanumeric</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-900">value</td>
                    <td className="px-4 py-2 text-zinc-900">Fair market value</td>
                    <td className="px-4 py-2 text-zinc-700">Integer (thousands USD)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-900">sshPrnamt</td>
                    <td className="px-4 py-2 text-zinc-900">Number of shares/principal amount</td>
                    <td className="px-4 py-2 text-zinc-700">Integer</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-900">sshPrnamtType</td>
                    <td className="px-4 py-2 text-zinc-900">Shares (SH) or Principal (PRN)</td>
                    <td className="px-4 py-2 text-zinc-700">Enum: SH, PRN</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-900">putCall</td>
                    <td className="px-4 py-2 text-zinc-900">Option type if applicable</td>
                    <td className="px-4 py-2 text-zinc-700">Enum: PUT, CALL, null</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-900">investmentDiscretion</td>
                    <td className="px-4 py-2 text-zinc-900">Discretion type</td>
                    <td className="px-4 py-2 text-zinc-700">Enum: SOLE, DFND, OTR</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-900">votingAuthority</td>
                    <td className="px-4 py-2 text-zinc-900">Shares by voting auth type</td>
                    <td className="px-4 py-2 text-zinc-700">Sole, Shared, None (integers)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border-l-2 border-blue-300 bg-blue-50 p-4">
              <Text className="text-sm text-blue-800">
                <strong>Value Reporting Change (January 3, 2023):</strong> Starting January 3, 2023, market value is reported
                rounded to the nearest dollar. Prior to this date, values were reported in thousands of U.S. dollars.
                This platform normalizes historical data accordingly.
              </Text>
            </div>

            <Text>
              Share counts are reported as integers without rounding. For options, entries in Columns 1-5, 7, and 8 must be
              expressed in terms of the underlying securities, not the options themselves. Column 6 (Investment Discretion)
              reflects discretion to exercise the option.
            </Text>
          </div>
        </section>

        {/* Section 9: Analytical Methodology */}
        <section id="analytical-methodology" className="mt-10">
          <Subheading level={2}>9. Analytical Methodology</Subheading>
          <div className="mt-4 space-y-4">
            <Text>
              This platform aggregates and analyzes Form 13F data to derive institutional ownership metrics. The following
              methodologies are employed:
            </Text>

            <div className="space-y-6">
              <div>
                <Text className="font-medium text-zinc-900">Sentiment Score Calculation</Text>
                <Text className="mt-2 text-sm text-zinc-600">
                  The sentiment score (0-100) quantifies the net directional bias of institutional activity. Starting from a
                  neutral baseline of 50, the score is adjusted by four weighted components, each capped at ±12.5 points:
                </Text>
                <div className="mt-3 overflow-hidden border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-zinc-900">Component</th>
                        <th className="px-3 py-2 text-left font-medium text-zinc-900">Weight</th>
                        <th className="px-3 py-2 text-left font-medium text-zinc-900">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      <tr>
                        <td className="px-3 py-2 text-zinc-900">Value Change</td>
                        <td className="px-3 py-2 font-mono text-xs">0.125</td>
                        <td className="px-3 py-2 text-zinc-700">Quarter-over-quarter change in aggregate institutional value</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-zinc-900">Owner Count</td>
                        <td className="px-3 py-2 font-mono text-xs">0.25</td>
                        <td className="px-3 py-2 text-zinc-700">Change in number of institutional holders</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-zinc-900">Concentration (HHI)</td>
                        <td className="px-3 py-2 font-mono text-xs">0.25</td>
                        <td className="px-3 py-2 text-zinc-700">Inverted HHI—lower concentration yields higher score</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-zinc-900">Position Activity</td>
                        <td className="px-3 py-2 font-mono text-xs">0.125</td>
                        <td className="px-3 py-2 text-zinc-700">Ratio of (new + added) vs (closed + reduced) positions</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <Text className="mt-2 text-sm text-zinc-600">
                  Signal classification: scores ≥60 = <Badge color="green">BULLISH</Badge>, ≤40 = <Badge color="red">BEARISH</Badge>, else <Badge color="yellow">NEUTRAL</Badge>.
                </Text>
              </div>

              <div>
                <Text className="font-medium text-zinc-900">Ownership Accumulation Alert Detection</Text>
                <Text className="mt-2 text-sm text-zinc-600">
                  The alert system identifies securities where total institutional ownership value has increased by a
                  configurable threshold (default: 500%) over a configurable lookback period (default: 24 months). Alerts
                  require a minimum initial value of $1M to filter noise from micro-cap positions. Results are sorted by
                  12-month momentum (recent change ratio) to surface the strongest current accumulation signals. Only
                  valid ticker symbols (1-5 uppercase letters) are included.
                </Text>
              </div>

              <div>
                <Text className="font-medium text-zinc-900">CUSIP-to-Ticker Resolution</Text>
                <Text className="mt-2 text-sm text-zinc-600">
                  Form 13F reports securities by CUSIP identifier. This platform resolves CUSIPs to ticker symbols using
                  the OpenFIGI API with fallback to a maintained hardcoded mapping and SEC search. Corporate actions
                  (mergers, spin-offs, ticker changes) may create temporary mapping discontinuities.
                </Text>
              </div>

              <div>
                <Text className="font-medium text-zinc-900">Put/Call Ratio Analysis</Text>
                <Text className="mt-2 text-sm text-zinc-600">
                  For securities with reported options positions, the put/call ratio is computed as the aggregate notional
                  value of put positions divided by call positions for the most recent quarter. Ratios below 0.7 suggest
                  bullish institutional positioning; above 1.0 suggests bearish or hedging activity.
                </Text>
              </div>

              <div>
                <Text className="font-medium text-zinc-900">Concentration Metrics</Text>
                <Text className="mt-2 text-sm text-zinc-600">
                  Ownership concentration is measured using Top-10 share concentration (percentage of total institutional
                  shares held by the 10 largest holders) and the Herfindahl-Hirschman Index (HHI), calculated as the sum
                  of squared market share percentages. Higher HHI values indicate more concentrated ownership, which may
                  signal crowding risk or strong conviction from major holders.
                </Text>
              </div>
            </div>
          </div>
        </section>

        {/* Section 10: Limitations */}
        <section id="limitations" className="mt-10">
          <Subheading level={2}>10. Limitations &amp; Caveats</Subheading>
          <div className="mt-4 space-y-4">
            <Text>
              Form 13F data, while valuable, is subject to significant limitations that must be understood for proper interpretation:
            </Text>

            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-red-200 bg-red-50 text-xs font-medium text-red-600">1</div>
                <div>
                  <Text className="font-medium text-zinc-900">Reporting Lag</Text>
                  <Text className="text-sm text-zinc-600">
                    Filings are due 45 days after quarter-end, meaning reported positions may be up to 135 days stale
                    (90-day quarter + 45-day filing window). Positions may have changed materially since the report date.
                  </Text>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-red-200 bg-red-50 text-xs font-medium text-red-600">2</div>
                <div>
                  <Text className="font-medium text-zinc-900">Long Positions Only</Text>
                  <Text className="text-sm text-zinc-600">
                    Form 13F captures long equity positions only. Short positions, fixed income holdings, derivatives
                    (except listed options), and non-Section 13(f) securities are not reported.
                  </Text>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-red-200 bg-red-50 text-xs font-medium text-red-600">3</div>
                <div>
                  <Text className="font-medium text-zinc-900">Threshold Exclusions</Text>
                  <Text className="text-sm text-zinc-600">
                    Managers below the $100M threshold are not required to file, creating survivorship bias toward
                    larger institutional holders. Small and mid-size institutional activity is underrepresented.
                  </Text>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-red-200 bg-red-50 text-xs font-medium text-red-600">4</div>
                <div>
                  <Text className="font-medium text-zinc-900">De Minimis Omissions</Text>
                  <Text className="text-sm text-zinc-600">
                    Per Special Instruction 9, managers may omit holdings if they hold fewer than 10,000 shares
                    (or &lt;$200,000 principal amount for convertible debt) <em>and</em> less than $200,000 aggregate
                    fair market value. Small positions may be systematically underreported.
                  </Text>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-red-200 bg-red-50 text-xs font-medium text-red-600">5</div>
                <div>
                  <Text className="font-medium text-zinc-900">Confidential Treatment</Text>
                  <Text className="text-sm text-zinc-600">
                    Managers may request confidential treatment for positions if disclosure could reveal proprietary
                    trading strategies. These positions are omitted from public filings and disclosed with delay.
                  </Text>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-red-200 bg-red-50 text-xs font-medium text-red-600">6</div>
                <div>
                  <Text className="font-medium text-zinc-900">Double-Counting Risk</Text>
                  <Text className="text-sm text-zinc-600">
                    Securities held under SHARED-OTHER discretion may appear on multiple Form 13F filings. Naive
                    aggregation without discretion-type filtering will overstate total institutional ownership.
                  </Text>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 11: Schedule 13D */}
        <section id="schedule-13d" className="mt-10 border-t border-zinc-200 pt-10">
          <div className="flex items-center gap-3">
            <Badge color="red">13D</Badge>
            <Subheading level={2}>11. Schedule 13D: Activist Disclosure</Subheading>
          </div>
          <div className="mt-4 space-y-4">
            <Text>
              Schedule 13D is required when a person or group acquires <strong>beneficial ownership of more than 5%</strong> of a
              voting class of a company&apos;s equity securities with the <strong>purpose or effect of changing or influencing
              control</strong> of the issuer. Unlike the quarterly 13F, Schedule 13D must be filed within <strong>10 business days</strong> of
              crossing the 5% threshold, providing near-real-time visibility into activist accumulation.
            </Text>

            <div className="border-2 border-red-200 bg-red-50 p-4">
              <Text className="font-medium text-red-900">Why 13D Filings Matter for Traders</Text>
              <Text className="mt-2 text-sm text-red-800">
                A 13D filing is often the first public signal of an activist campaign. Activists like Carl Icahn, Bill Ackman,
                Elliott Management, and ValueAct Capital use 13D filings to announce their stakes and intentions. These filings
                frequently precede significant corporate actions: board seats, strategic reviews, spinoffs, buybacks, or M&amp;A.
                The 10-day disclosure window means activists may have accumulated well beyond 5% before the market knows.
              </Text>
            </div>

            <Subheading level={3}>Filing Triggers &amp; Requirements</Subheading>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="border border-zinc-200 p-4">
                <Text className="text-sm font-medium text-zinc-900">Ownership Threshold</Text>
                <Text className="mt-1 text-2xl font-semibold tabular-nums">5%</Text>
                <Text className="mt-1 text-sm text-zinc-500">of any voting equity class</Text>
              </div>
              <div className="border border-zinc-200 p-4">
                <Text className="text-sm font-medium text-zinc-900">Filing Deadline</Text>
                <Text className="mt-1 text-2xl font-semibold tabular-nums">10 days</Text>
                <Text className="mt-1 text-sm text-zinc-500">after crossing 5% threshold</Text>
              </div>
            </div>

            <Text>
              The 5% beneficial ownership calculation includes shares held directly, shares over which the person has voting or
              investment power, and shares that may be acquired within 60 days through options, warrants, or convertible securities.
              Group formation (explicit or implicit agreement to act together) triggers aggregation of all group members&apos; holdings.
            </Text>

            <Subheading level={3}>Required Disclosures (Items 1-7)</Subheading>
            <div className="mt-3 space-y-3">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600">1</div>
                <div>
                  <Text className="font-medium text-zinc-900">Security and Issuer</Text>
                  <Text className="text-sm text-zinc-600">
                    Class of securities and company name/address
                  </Text>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600">2</div>
                <div>
                  <Text className="font-medium text-zinc-900">Identity and Background</Text>
                  <Text className="text-sm text-zinc-600">
                    Name, address, citizenship, occupation, and any criminal convictions or SEC proceedings in past 5 years
                  </Text>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600">3</div>
                <div>
                  <Text className="font-medium text-zinc-900">Source and Amount of Funds</Text>
                  <Text className="text-sm text-zinc-600">
                    How the acquisition was financed (cash, margin, debt, etc.)
                  </Text>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-red-200 bg-red-50 text-xs font-medium text-red-600">4</div>
                <div>
                  <Text className="font-medium text-zinc-900">Purpose of Transaction</Text>
                  <Text className="text-sm text-zinc-600">
                    <strong>The most critical disclosure.</strong> Must describe any plans to acquire additional shares, effect
                    extraordinary corporate transactions (merger, reorganization, liquidation), seek board representation, change
                    the board or management, alter dividend policy, change capitalization, delist securities, or make other major
                    changes. Vague language like &quot;evaluate the investment&quot; may signal undisclosed intentions.
                  </Text>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600">5</div>
                <div>
                  <Text className="font-medium text-zinc-900">Interest in Securities of the Issuer</Text>
                  <Text className="text-sm text-zinc-600">
                    Aggregate shares beneficially owned, percentage of class, and breakdown by person if a group
                  </Text>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600">6</div>
                <div>
                  <Text className="font-medium text-zinc-900">Contracts, Arrangements, Understandings</Text>
                  <Text className="text-sm text-zinc-600">
                    Any agreements relating to the securities (voting agreements, joint filing agreements, etc.)
                  </Text>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600">7</div>
                <div>
                  <Text className="font-medium text-zinc-900">Material to be Filed as Exhibits</Text>
                  <Text className="text-sm text-zinc-600">
                    Written agreements, letters to the board, financing documents
                  </Text>
                </div>
              </div>
            </div>

            <Subheading level={3}>Amendment Requirements</Subheading>
            <Text className="mt-3">
              Schedule 13D must be promptly amended (within 2 business days) upon any <strong>material change</strong> in the
              information previously reported. Material changes include:
            </Text>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge color="zinc">1%+ ownership change (up or down)</Badge>
              <Badge color="zinc">Change in purpose or plans</Badge>
              <Badge color="zinc">New group members</Badge>
              <Badge color="zinc">New financing arrangements</Badge>
              <Badge color="zinc">Disposition below 5%</Badge>
            </div>
          </div>
        </section>

        {/* Section 12: Schedule 13G */}
        <section id="schedule-13g" className="mt-10">
          <div className="flex items-center gap-3">
            <Badge color="blue">13G</Badge>
            <Subheading level={2}>12. Schedule 13G: Passive Ownership</Subheading>
          </div>
          <div className="mt-4 space-y-4">
            <Text>
              Schedule 13G is a <strong>shorter, less burdensome alternative</strong> to Schedule 13D available to certain categories
              of beneficial owners who acquire shares <strong>in the ordinary course of business and not with the purpose or effect
              of changing or influencing control</strong>. It requires less detailed disclosure and has more favorable filing deadlines.
            </Text>

            <Subheading level={3}>Eligible Filer Categories</Subheading>
            <div className="mt-3 space-y-4">
              <div className="border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center gap-2">
                  <Badge color="blue">QII</Badge>
                  <Text className="font-medium text-blue-900">Qualified Institutional Investors</Text>
                </div>
                <Text className="mt-2 text-sm text-blue-800">
                  Includes registered investment advisers, investment companies, banks, broker-dealers, insurance companies, pension
                  funds, and employee benefit plans. Must have acquired shares in the ordinary course of business and not with the
                  purpose of changing or influencing control. May hold up to 10% before facing accelerated reporting; above 10%
                  requires amendment within 10 days of month-end.
                </Text>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="border border-blue-300 bg-white p-2">
                    <Text className="text-xs font-medium text-blue-900">Initial Filing</Text>
                    <Text className="text-xs text-blue-700">45 days after calendar year-end</Text>
                  </div>
                  <div className="border border-blue-300 bg-white p-2">
                    <Text className="text-xs font-medium text-blue-900">Annual Amendment</Text>
                    <Text className="text-xs text-blue-700">45 days after calendar year-end</Text>
                  </div>
                </div>
              </div>

              <div className="border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-center gap-2">
                  <Badge color="purple">Passive</Badge>
                  <Text className="font-medium text-purple-900">Passive Investors</Text>
                </div>
                <Text className="mt-2 text-sm text-purple-800">
                  Any person who beneficially owns more than 5% but less than 20% and has not acquired the securities with any
                  purpose or effect of changing or influencing control. This category is available to hedge funds and other investors
                  who can credibly certify passive intent.
                </Text>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="border border-purple-300 bg-white p-2">
                    <Text className="text-xs font-medium text-purple-900">Initial Filing</Text>
                    <Text className="text-xs text-purple-700">10 days after crossing 5%</Text>
                  </div>
                  <div className="border border-purple-300 bg-white p-2">
                    <Text className="text-xs font-medium text-purple-900">20% Threshold</Text>
                    <Text className="text-xs text-purple-700">Must convert to 13D if exceeded</Text>
                  </div>
                </div>
              </div>

              <div className="border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <Badge color="green">Exempt</Badge>
                  <Text className="font-medium text-green-900">Exempt Investors</Text>
                </div>
                <Text className="mt-2 text-sm text-green-800">
                  Persons who beneficially owned more than 5% on the date the issuer registered its securities (pre-registration
                  holders) and have not acquired additional shares except through stock splits, dividends, or other issuer actions.
                </Text>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="border border-green-300 bg-white p-2">
                    <Text className="text-xs font-medium text-green-900">Initial Filing</Text>
                    <Text className="text-xs text-green-700">45 days after calendar year-end</Text>
                  </div>
                  <div className="border border-green-300 bg-white p-2">
                    <Text className="text-xs font-medium text-green-900">Amendment</Text>
                    <Text className="text-xs text-green-700">Upon material change in facts</Text>
                  </div>
                </div>
              </div>
            </div>

            <Subheading level={3}>Converting Between 13G and 13D</Subheading>
            <div className="mt-3 border-l-2 border-amber-300 bg-amber-50 p-4">
              <Text className="text-sm text-amber-800">
                <strong>Critical Conversion Rules:</strong> A 13G filer must convert to Schedule 13D within <strong>10 days</strong> if
                their intent changes from passive to activist. This &quot;conversion&quot; filing often signals an escalation in
                investor engagement and can move stock prices significantly. Watch for:
              </Text>
              <ul className="mt-3 space-y-2 text-sm text-amber-700">
                <li className="flex gap-2">
                  <span className="font-bold">•</span>
                  <span><strong>Passive investor exceeding 20%</strong> — automatic disqualification from 13G</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">•</span>
                  <span><strong>Change in intent</strong> — investor decides to pursue board seats or strategic changes</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">•</span>
                  <span><strong>Group formation</strong> — joining with other shareholders for collective action</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">•</span>
                  <span><strong>Public statements</strong> — criticizing management or calling for changes</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 13: Comparison */}
        <section id="form-comparison" className="mt-10">
          <Subheading level={2}>13. Comparing 13F, 13D, and 13G</Subheading>
          <div className="mt-4 space-y-4">
            <Text>
              Each filing type serves a distinct regulatory purpose and provides different insights for traders. Understanding
              their differences is essential for proper interpretation.
            </Text>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Attribute</th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Form 13F</th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Schedule 13D</th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Schedule 13G</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <tr>
                    <td className="px-4 py-2 font-medium text-zinc-900">Who Files</td>
                    <td className="px-4 py-2 text-zinc-700">Institutional managers with $100M+ AUM</td>
                    <td className="px-4 py-2 text-zinc-700">Anyone with 5%+ and intent to influence</td>
                    <td className="px-4 py-2 text-zinc-700">Passive 5%+ holders, QIIs</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-zinc-900">Threshold</td>
                    <td className="px-4 py-2 text-zinc-700">$100M total AUM</td>
                    <td className="px-4 py-2 text-zinc-700">5% of any voting class</td>
                    <td className="px-4 py-2 text-zinc-700">5% of any voting class</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-zinc-900">Filing Deadline</td>
                    <td className="px-4 py-2 text-zinc-700">45 days after quarter-end</td>
                    <td className="px-4 py-2 text-zinc-700">10 days after crossing 5%</td>
                    <td className="px-4 py-2 text-zinc-700">Varies by category (10-45 days)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-zinc-900">Frequency</td>
                    <td className="px-4 py-2 text-zinc-700">Quarterly</td>
                    <td className="px-4 py-2 text-zinc-700">Event-driven (prompt amendments)</td>
                    <td className="px-4 py-2 text-zinc-700">Annual + event-driven</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-zinc-900">Intent Disclosure</td>
                    <td className="px-4 py-2 text-zinc-700">Not required</td>
                    <td className="px-4 py-2 text-zinc-700"><strong>Required (Item 4)</strong></td>
                    <td className="px-4 py-2 text-zinc-700">Certifies passive intent</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-zinc-900">Position Details</td>
                    <td className="px-4 py-2 text-zinc-700">All 13(f) securities held</td>
                    <td className="px-4 py-2 text-zinc-700">Single issuer only</td>
                    <td className="px-4 py-2 text-zinc-700">Single issuer only</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-zinc-900">Short Positions</td>
                    <td className="px-4 py-2 text-zinc-700">Not reported</td>
                    <td className="px-4 py-2 text-zinc-700">Not reported (but intent may imply)</td>
                    <td className="px-4 py-2 text-zinc-700">Not reported</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-zinc-900">Trading Signal</td>
                    <td className="px-4 py-2 text-zinc-700">Aggregate institutional sentiment</td>
                    <td className="px-4 py-2 text-zinc-700">Activist catalyst potential</td>
                    <td className="px-4 py-2 text-zinc-700">Large passive holder presence</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="border border-zinc-200 p-4">
                <Text className="font-medium text-zinc-900">13F Best For</Text>
                <Text className="mt-2 text-sm text-zinc-600">
                  Tracking broad institutional sentiment, identifying accumulation/distribution trends, following &quot;superinvestor&quot;
                  portfolios, and analyzing ownership concentration across the entire market.
                </Text>
              </div>
              <div className="border border-zinc-200 p-4">
                <Text className="font-medium text-zinc-900">13D Best For</Text>
                <Text className="mt-2 text-sm text-zinc-600">
                  Identifying activist situations, front-running corporate actions, and understanding specific investor intentions
                  for individual companies. High signal-to-noise ratio.
                </Text>
              </div>
              <div className="border border-zinc-200 p-4">
                <Text className="font-medium text-zinc-900">13G Best For</Text>
                <Text className="mt-2 text-sm text-zinc-600">
                  Understanding float composition, identifying index fund ownership, and spotting potential 13D conversions when
                  passive holders become active.
                </Text>
              </div>
            </div>
          </div>
        </section>

        {/* Section 14: Trading with 13D/13G Data */}
        <section id="13d-13g-trading" className="mt-10">
          <Subheading level={2}>14. Trading with 13D/13G Data</Subheading>
          <div className="mt-4 space-y-4">
            <Text>
              Schedule 13D and 13G filings provide distinct trading opportunities compared to 13F data. The faster disclosure
              requirements and intent revelation create actionable signals for informed traders.
            </Text>

            <Subheading level={3}>13D Activist Trading Strategies</Subheading>
            <div className="mt-3 overflow-hidden border border-zinc-200">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Strategy</th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Signal</th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-900">Implementation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-900">Activist Piggybacking</td>
                    <td className="px-4 py-3 text-zinc-700">New 13D filing by known activist with detailed Item 4</td>
                    <td className="px-4 py-3 text-zinc-700">Enter within 1-2 days of filing, target 6-18 month hold</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-900">13G→13D Conversion</td>
                    <td className="px-4 py-3 text-zinc-700">Passive holder converts to 13D with specific demands</td>
                    <td className="px-4 py-3 text-zinc-700">Enter on conversion day, anticipate board fight or M&amp;A</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-900">Accumulation Tracking</td>
                    <td className="px-4 py-3 text-zinc-700">13D/A showing continued buying above 5%</td>
                    <td className="px-4 py-3 text-zinc-700">Add to position as activist increases stake</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-900">Settlement Arbitrage</td>
                    <td className="px-4 py-3 text-zinc-700">13D/A announcing settlement agreement with company</td>
                    <td className="px-4 py-3 text-zinc-700">Evaluate terms; board seats often bullish, standstills mixed</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-900">Exit Signal</td>
                    <td className="px-4 py-3 text-zinc-700">13D/A showing activist reducing below 5%</td>
                    <td className="px-4 py-3 text-zinc-700">Evaluate thesis completion; consider exit</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Subheading level={3}>Key 13D Signals to Watch</Subheading>
            <div className="mt-3 space-y-3">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-green-200 bg-green-50 text-green-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </div>
                <div>
                  <Text className="font-medium text-zinc-900">Board Seat Demands</Text>
                  <Text className="text-sm text-zinc-600">
                    Item 4 requesting board representation signals serious intent. Activists with board seats have greater
                    influence over capital allocation, strategy, and M&amp;A decisions. Historical data shows companies adding
                    activist-nominated directors often outperform.
                  </Text>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-green-200 bg-green-50 text-green-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </div>
                <div>
                  <Text className="font-medium text-zinc-900">Strategic Alternatives Review</Text>
                  <Text className="text-sm text-zinc-600">
                    Language calling for &quot;exploration of strategic alternatives&quot; often precedes sale process announcements.
                    This is one of the highest-conviction activist demands.
                  </Text>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-amber-200 bg-amber-50 text-amber-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <Text className="font-medium text-zinc-900">Vague Purpose Language</Text>
                  <Text className="text-sm text-zinc-600">
                    Boilerplate language like &quot;evaluate the investment&quot; or &quot;may engage in discussions&quot; without specific
                    demands suggests the activist is still accumulating and hasn&apos;t revealed their full hand. More specific
                    Item 4 language to come.
                  </Text>
                </div>
              </div>
            </div>

            <Subheading level={3}>Float Analysis with 13G Data</Subheading>
            <Text className="mt-3">
              Schedule 13G filings from institutional investors help traders understand the true tradeable float:
            </Text>
            <div className="mt-3 border border-zinc-200 p-4">
              <Text className="text-sm text-zinc-600">
                <strong>Effective Float Calculation:</strong><br />
                <code className="mt-1 block bg-zinc-100 p-2 font-mono text-xs">
                  Tradeable Float = Shares Outstanding - Insider Holdings - 13G Holdings (QII + Passive)
                </code>
              </Text>
              <Text className="mt-3 text-sm text-zinc-600">
                Stocks with low effective float relative to institutional interest are more susceptible to sharp price moves.
                When 13F buyers accumulate in a low-float name, supply/demand imbalances accelerate. Conversely, if 13G passive
                holders convert to sellers, the concentrated ownership creates selling pressure with limited buyers.
              </Text>
            </div>

            <div className="mt-4 border-l-2 border-blue-300 bg-blue-50 p-4">
              <Text className="text-sm text-blue-800">
                <strong>Combining 13F + 13D/13G Data:</strong> The most powerful analysis combines all three data sources.
                Use 13F for broad institutional sentiment and position tracking, 13D for activist catalyst identification,
                and 13G for float composition. A stock with rising 13F ownership, a new activist 13D, and low 13G passive
                float represents a compelling setup with multiple tailwinds.
              </Text>
            </div>
          </div>
        </section>

        {/* Sources */}
        <section className="mt-10 border-t border-zinc-200 pt-8">
          <Subheading level={2}>Primary Sources</Subheading>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <a href="https://www.sec.gov/files/form13f.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                SEC Form 13F Instructions (PDF)
              </a>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <a href="https://www.sec.gov/files/form_13f_readme.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Form 13F XML Technical Specification (PDF)
              </a>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <a href="https://www.law.cornell.edu/cfr/text/17/240.13f-1" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                17 CFR § 240.13f-1 (Legal Information Institute)
              </a>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <a href="https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                SEC Form 13F FAQ
              </a>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <a href="https://www.sec.gov/files/sch13d.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                SEC Schedule 13D Instructions (PDF)
              </a>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <a href="https://www.sec.gov/files/sch13g.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                SEC Schedule 13G Instructions (PDF)
              </a>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <a href="https://www.law.cornell.edu/cfr/text/17/240.13d-1" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                17 CFR § 240.13d-1 (Legal Information Institute)
              </a>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <a href="https://www.sec.gov/divisions/corpfin/guidance/reg13d-interp" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                SEC Regulation 13D-G Compliance &amp; Disclosure Interpretations
              </a>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="mt-8 border border-amber-200 bg-amber-50 p-4">
          <Text className="text-sm text-amber-800">
            <strong>Disclaimer:</strong> This platform provides data and analysis for informational and educational purposes only.
            It does not constitute investment advice, and no representation is made regarding the accuracy, completeness, or
            timeliness of the information presented. Users should conduct independent research and consult qualified professionals
            before making investment decisions.
          </Text>
        </section>
      </div>
    </ApplicationLayout>
  )
}
