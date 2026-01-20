# Rensider

**SEC Filings Intelligence Platform**

A Next.js application for tracking institutional ownership, beneficial ownership, and insider trading activity from SEC EDGAR filings.

## Overview

Rensider aggregates and visualizes SEC filings data to help investors and researchers:

- Track **institutional holdings** from Form 13F quarterly filings
- Monitor **beneficial ownership** changes via Schedule 13D/13G
- Analyze **insider trading** patterns through Forms 3, 4, and 5

## Features

### Institutional Holdings (Form 13F)

Investment managers with $100M+ AUM must disclose their equity holdings quarterly. Rensider provides:

- Portfolio composition by fund (search by CIK)
- Position changes between quarters
- Top filers ranked by assets under management
- Security holder analysis (who owns a specific stock)
- CUSIP-to-ticker symbol resolution

### Beneficial Ownership (Schedule 13D/13G)

When an investor acquires 5%+ of a public company, they must file disclosure forms:

- **Schedule 13G**: Passive investors with no intent to influence management
- **Schedule 13D**: Active investors who may seek to influence the company

Rensider tracks:

- Current 5%+ holders for any ticker
- Activist investor activity and intent parsing
- 13G → 13D conversions (passive turning activist)
- Position changes and exit events

### Insider Trading (Forms 3/4/5)

Corporate insiders (officers, directors, 10% owners) must report their transactions:

- **Form 3**: Initial statement of beneficial ownership
- **Form 4**: Changes in beneficial ownership (most common)
- **Form 5**: Annual statement of changes

Rensider provides:

- Recent transactions by company or insider
- Purchase vs. sale analysis
- Transaction significance filtering
- Insider profiles across multiple companies

## Recent Changes

### New Features

- **Treemap Visualization**: Stock pages now have a toggle to switch between table and treemap views for institutional holders, with cells sized by position value
- **Mobile Bottom Sheet UI**: Search interface with hydration-safe patterns for mobile devices
- **Dynamic OG Images**: Open Graph images now include chart visualizations with ownership data
- **Instant Filer Names**: Denormalized filer names in 13F submissions for faster display without API lookups
- **Persistent Filer Cache**: Filer names cached to MotherDuck database for better performance
- **Insider Sales Links**: Direct links to insider transaction pages from ownership tables

### Improvements

- **SEO Enhancements**: Comprehensive metadata, canonical URLs, and structured data
- **Rensider Branding**: Updated OG tags and images with consistent branding
- **URL Path Clarity**: Renamed URL paths and backend files for better organization
- **Chart Formatting**: Improved axis formatting and spacing in visualizations

### Bug Fixes

- Fixed data processing order for institutional holders and recent filings tables
- Fixed target stock/CUSIP display in activist activity table
- Resolved SEC API rate limiting issues
- Fixed OG image generation with next/og

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Framework** | Next.js 16, React 19, TypeScript |
| **Styling** | Tailwind CSS 4, CSS Variables |
| **Visualization** | visx (D3-based), Three.js, Framer Motion |
| **Database** | DuckDB via MotherDuck (cloud) |
| **Data Formats** | Parquet, CSV, XML |
| **Authentication** | jose (JWT) |

## Project Structure

```
app/                          # Next.js App Router
├── api/                      # API routes
│   ├── sync/                 # Data synchronization endpoints
│   ├── filers/               # Institutional filer APIs
│   ├── securities/           # Security lookup APIs
│   ├── activists/           # 13D/13G APIs
│   └── filings/              # Filing lookup APIs
├── fund/[cik]/               # Fund holdings pages
├── stock/[ticker]/           # Stock ownership pages
├── insider/[cik]/            # Insider profile pages
├── insiders/                 # Insider trading dashboard
├── activists/                # 13D/13G dashboard
└── alerts/                   # Alert management

components/                   # React components
├── charts/                   # Visualization (hooks, layers, primitives)
├── ownership/                # 13F ownership components
├── activists/                # 13D/13G components
├── insider-sales/            # Form 3/4/5 components
└── twc/                      # Tailwind component library

lib/                          # Core libraries
├── sec/                      # SEC data module
│   ├── client.ts             # SEC EDGAR HTTP client
│   ├── duckdb.ts             # Database wrapper
│   ├── queries.ts            # SQL query functions
│   ├── daily-sync.ts         # Sync orchestration
│   ├── rss-sync.ts           # RSS feed parser
│   └── openfigi.ts           # CUSIP→ticker mapping
├── validators/               # Input validation (CIK, CUSIP, ticker)
└── logger.ts                 # Structured logging

types/                        # TypeScript definitions
├── activists.ts              # 13D/13G types
├── insider-sales.ts          # Form 3/4/5 types
└── ownership.ts              # General ownership types
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- MotherDuck account (for database)

### Installation
For Vercel:
Install Command
npm install --legacy-peer-deps

```bash
# Clone the repository
git clone <repository-url>
cd Rensider-next

# Install dependencies
npm install --legacy-peer-deps

# Copy environment template
cp example.env .env

# Configure environment variables (see Configuration section)

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

## Configuration

Create a `.env` file based on `example.env`:

```bash
# SEC EDGAR API - Required
# Format: "Company Name contact@email.com"
SEC_USER_AGENT="Your Company contact@example.com"

# MotherDuck Database - Required
# Get your token at https://app.motherduck.com/
MOTHERDUCK_TOKEN=your_token_here
MOTHERDUCK_DATABASE=your_database_name

# OpenFIGI API - Optional (for CUSIP→ticker mapping)
OPENFIGI_API_KEY=your_api_key

# Sync Authentication - Required for production
CRON_SECRET=your_secret_here
```

## Database Schema

Rensider uses DuckDB (via MotherDuck) with the following table groups:

### Form 13F Tables
- `submissions_13f` - Filing metadata (CIK, date, period)
- `holdings_13f` - Individual security holdings

### Schedule 13D/13G Tables
- `filings_13dg` - Filing details and ownership percentages
- `reporting_persons_13dg` - Beneficial owner information

### Form 3/4/5 Tables
- `form345_submissions` - Filing metadata
- `form345_reporting_owners` - Insider information
- `form345_nonderiv_trans` - Non-derivative transactions
- `form345_nonderiv_holding` - Non-derivative holdings
- `form345_deriv_trans` - Derivative transactions
- `form345_deriv_holding` - Derivative holdings

### Reference Tables
- `cusip_mappings` - CUSIP to ticker symbol mappings

## Data Sources

### SEC EDGAR

The primary data source is the SEC's EDGAR system:

- **Form 13F**: Quarterly institutional holdings (TSV bulk files)
- **Schedule 13D/13G**: Beneficial ownership (RSS feeds + XML filings)
- **Forms 3/4/5**: Insider transactions (RSS feeds + XML filings)

Data is fetched respecting SEC's rate limits and user-agent requirements.

### OpenFIGI

Used for mapping CUSIP identifiers to ticker symbols, providing:
- Ticker symbol resolution
- FIGI identifiers
- Security metadata

## Deployment

### Vercel (Recommended)

The application is designed for Vercel deployment:

1. Connect your repository to Vercel
2. Configure environment variables (see below)
3. Set the install command to `npm install --legacy-peer-deps`
4. Deploy

#### Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MOTHERDUCK_TOKEN` | **Yes** | Authentication token from [MotherDuck](https://app.motherduck.com/) |
| `MOTHERDUCK_DATABASE` | No | Database name (defaults to `rensider`) |
| `SEC_USER_AGENT` | **Yes** | SEC EDGAR API user agent: `"Company Name contact@email.com"` |
| `CRON_SECRET` | **Yes** | Secret for authenticating sync API endpoints |
| `OPENFIGI_API_KEY` | No | OpenFIGI API key for CUSIP→ticker mapping |

#### Vercel Build Settings

- **Install Command**: `npm install --legacy-peer-deps`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

#### Scheduled Sync (Cron Jobs)

Add to `vercel.json` for automatic data synchronization:

```json
{
  "crons": [
    {
      "path": "/api/sync?forms=13F,13DG",
      "schedule": "0 4 * * *"
    },
    {
      "path": "/api/sync/rss?forms=345",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

### Technical Notes

#### DuckDB/MotherDuck Serverless Configuration

The application includes special handling for DuckDB in Vercel's serverless environment:

- **Home Directory**: DuckDB requires a `HOME` environment variable. On Vercel, this is automatically set to `/tmp`
- **Extension Directory**: DuckDB extensions are stored in `/tmp/.duckdb/extensions`
- **Cache Directory**: Filer name cache uses `/tmp` on Vercel (ephemeral storage)
- **Native Bindings**: Linux x64 DuckDB bindings are included as optional dependencies for Vercel's runtime

#### Dynamic Rendering

Several routes use `export const dynamic = 'force-dynamic'` to ensure server-side rendering with fresh data:
- `/alerts` - Alert management
- `/activists` - 13D/13G dashboard
- `/insiders` - Insider trading dashboard
- `/insider/[cik]` - Insider profiles
- Various API routes

### Requirements

- Serverless-compatible (uses `/tmp` for ephemeral storage)
- MotherDuck for database access
- Environment variables configured

## Architecture

### Why DuckDB/MotherDuck?

- **Analytical queries**: Optimized for aggregations over large datasets
- **Columnar storage**: Efficient for SEC bulk data files
- **Serverless**: MotherDuck enables DuckDB in Vercel's environment
- **SQL**: Familiar query language for complex analysis

### Data Flow

```
SEC EDGAR → RSS/Bulk Files → Parse → DuckDB Tables → API → React UI
     ↓
OpenFIGI → CUSIP Mappings
```

### Sync Strategy

1. **Daily Sync**: Full bulk file processing for historical data
2. **RSS Sync**: Near real-time updates from SEC RSS feeds
3. **Incremental**: Track sync position to avoid reprocessing

## Input Validation

All user inputs are validated:

- **CIK**: 10-digit numeric identifier
- **CUSIP**: 9-character alphanumeric
- **Ticker**: 1-5 character alphabetic
- **Dates**: ISO 8601 format

## Contributing

Please do.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [SEC EDGAR](https://www.sec.gov/edgar) for public filings data
- [OpenFIGI](https://www.openfigi.com/) for security identifier mapping
- [DuckDB](https://duckdb.org/) for analytical database capabilities
- [MotherDuck](https://motherduck.com/) for serverless DuckDB hosting
