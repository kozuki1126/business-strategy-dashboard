/**
 * Logger utility for development and production
 * Wraps console methods to be ESLint compliant
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.log(...args)
    }
  },
  error: (...args: any[]) => {
    // Always log errors
    // eslint-disable-next-line no-console
    console.error(...args)
  },
  warn: (...args: any[]) => {
    // Always log warnings
    // eslint-disable-next-line no-console
    console.warn(...args)
  },
  info: (...args: any[]) => {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.info(...args)
    }
  },
  debug: (...args: any[]) => {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.debug(...args)
    }
  },
  table: (data: any) => {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.table(data)
    }
  },
  time: (label: string) => {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.time(label)
    }
  },
  timeEnd: (label: string) => {
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.timeEnd(label)
    }
  },
}

export default logger
