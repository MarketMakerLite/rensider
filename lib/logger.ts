/**
 * Structured logging utility
 *
 * Features:
 * - JSON output in production, pretty output in development
 * - Scoped loggers for different modules
 * - Error stack trace capture
 * - LOG_LEVEL environment variable support
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  scope: string
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

// Fields to redact from logs
const SENSITIVE_FIELDS = new Set([
  'token',
  'password',
  'secret',
  'api_key',
  'apiKey',
  'authorization',
  'auth',
  'credentials',
  'motherduck_token',
  'cron_secret',
  'openfigi_api_key',
])

// Redact sensitive fields from context objects
function sanitizeContext(ctx?: LogContext): LogContext | undefined {
  if (!ctx) return undefined

  const sanitized: LogContext = {}
  for (const [key, value] of Object.entries(ctx)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_FIELDS.has(lowerKey) || lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('password') || lowerKey.includes('key')) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeContext(value as LogContext)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

// Sanitize error messages that might contain sensitive data
function sanitizeErrorMessage(message: string): string {
  // Redact token-like strings (JWT format, API keys, etc)
  return message
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT_REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/[a-zA-Z0-9]{32,}/g, (match) => {
      // Only redact if it looks like a token (no common words)
      if (/^[a-f0-9]+$/i.test(match) || /[A-Z].*[a-z]|[a-z].*[A-Z]/.test(match)) {
        return '[TOKEN_REDACTED]'
      }
      return match
    })
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const LOG_LEVEL = (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || 'info'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL]
}

function formatError(err?: Error): LogEntry['error'] | undefined {
  if (!err) return undefined
  return {
    name: err.name,
    message: sanitizeErrorMessage(err.message),
    // Only include stack in development
    stack: IS_PRODUCTION ? undefined : err.stack,
  }
}

function formatPretty(entry: LogEntry): string {
  const levelColors: Record<LogLevel, string> = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m', // red
  }
  const reset = '\x1b[0m'
  const dim = '\x1b[2m'

  const color = levelColors[entry.level]
  const time = new Date(entry.timestamp).toLocaleTimeString()
  const prefix = `${dim}${time}${reset} ${color}[${entry.level.toUpperCase()}]${reset} ${dim}[${entry.scope}]${reset}`

  let output = `${prefix} ${entry.message}`

  if (entry.context && Object.keys(entry.context).length > 0) {
    output += ` ${dim}${JSON.stringify(entry.context)}${reset}`
  }

  if (entry.error) {
    output += `\n${color}${entry.error.name}: ${entry.error.message}${reset}`
    if (entry.error.stack) {
      output += `\n${dim}${entry.error.stack}${reset}`
    }
  }

  return output
}

function log(level: LogLevel, scope: string, message: string, context?: LogContext, err?: Error): void {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message: sanitizeErrorMessage(message),
    context: sanitizeContext(context),
    error: formatError(err),
  }

  const output = IS_PRODUCTION ? JSON.stringify(entry) : formatPretty(entry)

  switch (level) {
    case 'debug':
      console.debug(output)
      break
    case 'info':
      console.info(output)
      break
    case 'warn':
      console.warn(output)
      break
    case 'error':
      console.error(output)
      break
  }
}

export interface Logger {
  debug: (msg: string, ctx?: LogContext) => void
  info: (msg: string, ctx?: LogContext) => void
  warn: (msg: string, ctx?: LogContext, err?: Error) => void
  error: (msg: string, ctx?: LogContext, err?: Error) => void
}

export function createLogger(scope: string): Logger {
  return {
    debug: (msg: string, ctx?: LogContext) => log('debug', scope, msg, ctx),
    info: (msg: string, ctx?: LogContext) => log('info', scope, msg, ctx),
    warn: (msg: string, ctx?: LogContext, err?: Error) => log('warn', scope, msg, ctx, err),
    error: (msg: string, ctx?: LogContext, err?: Error) => log('error', scope, msg, ctx, err),
  }
}

// Pre-configured loggers for common modules
export const logger = createLogger('app')
export const dbLogger = createLogger('duckdb')
export const syncLogger = createLogger('sync')
export const apiLogger = createLogger('api')
