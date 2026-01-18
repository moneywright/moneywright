/**
 * Banner and startup info
 */

import boxen from 'boxen'
import chalk from 'chalk'
import type { DatabaseType } from '../db'

/**
 * Get app version
 */
export function getVersion(): string {
  try {
    return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0'
  } catch {
    return '0.1.0'
  }
}

/**
 * Print ASCII banner
 */
export function printBanner(): void {
  const banner = `
  __  __                                    _       _     _
 |  \\/  | ___  _ __   ___ _   ___      __ _(_) __ _| |__ | |_
 | |\\/| |/ _ \\| '_ \\ / _ \\ | | \\ \\ /\\ / / '__| / _\` | '_ \\| __|
 | |  | | (_) | | | |  __/ |_| |\\ V  V /| |  | | (_| | | | | |_
 |_|  |_|\\___/|_| |_|\\___|\\__, | \\_/\\_/ |_|  |_|\\__, |_| |_|\\__|
                          |___/                 |___/

  AI-powered personal finance helper
`

  console.log(chalk.cyan(banner))
}

/**
 * Print startup information
 */
export function printStartupInfo(config: {
  port: number
  isFirstRun: boolean
  dbType: DatabaseType
}): void {
  const { port, isFirstRun, dbType } = config
  const version = getVersion()

  const lines = [
    `${chalk.bold('Version:')} ${version}`,
    `${chalk.bold('Database:')} ${dbType === 'postgres' ? 'PostgreSQL' : 'SQLite'}`,
    '',
    `${chalk.bold('URL:')} ${chalk.green(`http://localhost:${port}`)}`,
  ]

  if (isFirstRun) {
    lines.push('')
    lines.push(chalk.yellow('First run detected!'))
    lines.push(chalk.yellow('Visit /setup to configure Google OAuth'))
  }

  const box = boxen(lines.join('\n'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan',
  })

  console.log(box)
}
