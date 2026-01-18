'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { Heading, Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { SearchAutocomplete } from '@/components/ownership/SearchAutocomplete'
import { TypewriterText } from '@/components/common/TypewriterText'
import {
  fadeUp,
  staggerContainer,
  staggerItem,
  transition,
} from '@/lib/animations'

const heroDescription = 'Track institutional holdings from SEC 13F filings. Search by ticker symbol or fund CIK to discover what the smart money is buying.'

const quickLinks = [
  {
    href: '/new',
    title: 'New Filings',
    description: 'Latest 13F submissions from institutional investors',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    ),
  },
  {
    href: '/alerts',
    title: 'Accumulation Alerts',
    description: 'Track significant ownership increase signals',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    ),
  },
]

const popularStocks = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA']
const topFunds = [
  { cik: '1067983', name: 'Berkshire' },
  { cik: '102909', name: 'Vanguard' },
  { cik: '1423053', name: 'Citadel' },
]

const aboutItems = [
  {
    title: '13F Filings',
    description: 'Quarterly reports from institutional investment managers with over $100M in assets.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  },
  {
    title: 'Fund Sentiment',
    description: '0-100 score based on institutional accumulation patterns and buying signals.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  },
  {
    title: 'Accumulation Alerts',
    description: 'Early signals when institutions significantly increase their positions.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
  },
]

export function HomeContent() {
  return (
    <div className="max-w-5xl">
      {/* Hero Section */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="relative"
      >
        <Heading className="text-2xl font-medium tracking-tight text-zinc-800 sm:text-3xl lg:text-2xl">
          Institutional Ownership Tracker
        </Heading>
        <Text className="mt-3 min-h-[3.5rem] max-w-7xl text-base leading-relaxed text-zinc-500 sm:mt-4 sm:min-h-[3.75rem] sm:text-lg">
          <TypewriterText
            text={heroDescription}
            startDelay={500}
            charDelay={35}
            storageKey="home-hero-typewriter"
          />
        </Text>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition.default, delay: 0.15 }}
        className="mt-4 sm:mt-8"
      >
        <SearchAutocomplete className="max-w-xl" />
      </motion.div>

      {/* Quick Links Grid */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:gap-5 md:grid-cols-2"
      >
        {/* Navigation Cards */}
        {quickLinks.map((link) => (
          <motion.div key={link.href} variants={staggerItem} className="h-full">
            <Link
              href={link.href}
              className="group relative block h-full min-h-[100px] rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-zinc-300 hover:shadow-md sm:min-h-[120px] sm:p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-50 transition-colors group-hover:bg-zinc-100">
                  <svg className="h-5 w-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {link.icon}
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <Text className="font-medium text-zinc-800">{link.title}</Text>
                  <Text className="mt-1 text-sm leading-relaxed text-zinc-500">{link.description}</Text>
                </div>
                <div className="mt-0.5 text-zinc-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-zinc-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}

        {/* Popular Stocks */}
        <motion.div variants={staggerItem} className="h-full">
          <div className="h-full min-h-[100px] rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:min-h-[120px] sm:p-6">
            <div className="flex h-full flex-col">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-50">
                  <svg className="h-5 w-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <Text className="font-medium text-zinc-800">Popular Stocks</Text>
                  <Text className="mt-0.5 text-sm text-zinc-500">Most tracked tickers</Text>
                </div>
              </div>
              <motion.div
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
                className="mt-4 flex flex-wrap gap-2"
              >
                {popularStocks.map((ticker, i) => (
                  <motion.div
                    key={ticker}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...transition.default, delay: 0.3 + i * 0.04 }}
                  >
                    <Link
                      href={`/stock/${ticker}`}
                      className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                    >
                      {ticker}
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Top Funds */}
        <motion.div variants={staggerItem} className="h-full">
          <div className="h-full min-h-[100px] rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:min-h-[120px] sm:p-6">
            <div className="flex h-full flex-col">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-50">
                  <svg className="h-5 w-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <Text className="font-medium text-zinc-800">Top Funds</Text>
                  <Text className="mt-0.5 text-sm text-zinc-500">Largest institutions</Text>
                </div>
              </div>
              <motion.div
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
                className="mt-4 flex flex-wrap gap-2"
              >
                {topFunds.map((fund, i) => (
                  <motion.div
                    key={fund.cik}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...transition.default, delay: 0.35 + i * 0.04 }}
                  >
                    <Link
                      href={`/fund/${fund.cik}`}
                      className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                    >
                      {fund.name}
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* About Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition.slow, delay: 0.5 }}
        className="mt-4 sm:mt-8"
      >
        <div className="flex items-center gap-4">
          <Subheading level={2} className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            Features
          </Subheading>
          <div className="h-px flex-1 bg-zinc-200" />
        </div>

        {/* About Cards */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
        >
          {aboutItems.map((item) => (
            <motion.div
              key={item.title}
              variants={staggerItem}
              className="group min-h-[140px] rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-zinc-300 hover:shadow-md sm:min-h-[160px] sm:p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 transition-colors group-hover:bg-zinc-100">
                <svg className="h-5 w-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {item.icon}
                </svg>
              </div>
              <Text className="mt-4 font-medium text-zinc-800">{item.title}</Text>
              <Text className="mt-2 text-sm leading-relaxed text-zinc-500">{item.description}</Text>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
