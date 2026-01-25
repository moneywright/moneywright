import chalk from 'chalk'
import boxen from 'boxen'
import type { DatabaseType } from '../db'

/**
 * Get app version - returns build-time version or 'dev' in development
 */
export function getVersion(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
}

// Tailwind emerald palette
const emerald = {
  50: '#ecfdf5',
  100: '#d1fae5',
  200: '#a7f3d0',
  300: '#6ee7b7',
  400: '#34d399',
  500: '#10b981',
  600: '#059669',
  700: '#047857',
  800: '#065f46',
  900: '#064e3b',
}

interface StartupOptions {
  port: number
  isFirstRun?: boolean
  dbType: DatabaseType
}

export function printBanner() {
  console.clear()
  console.log()

  // ASCII art logo with gradient effect
  const logo = [
    '███╗   ███╗ ██████╗ ███╗   ██╗███████╗██╗   ██╗██╗    ██╗██████╗ ██╗ ██████╗ ██╗  ██╗████████╗',
    '████╗ ████║██╔═══██╗████╗  ██║██╔════╝╚██╗ ██╔╝██║    ██║██╔══██╗██║██╔════╝ ██║  ██║╚══██╔══╝',
    '██╔████╔██║██║   ██║██╔██╗ ██║█████╗   ╚████╔╝ ██║ █╗ ██║██████╔╝██║██║  ███╗███████║   ██║   ',
    '██║╚██╔╝██║██║   ██║██║╚██╗██║██╔══╝    ╚██╔╝  ██║███╗██║██╔══██╗██║██║   ██║██╔══██║   ██║   ',
    '██║ ╚═╝ ██║╚██████╔╝██║ ╚████║███████╗   ██║   ╚███╔███╔╝██║  ██║██║╚██████╔╝██║  ██║   ██║   ',
    '╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝   ╚═╝    ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ',
  ]

  // Gradient colors from emerald-400 to emerald-600
  const gradientColors = [
    emerald[400],
    emerald[400],
    emerald[500],
    emerald[500],
    emerald[600],
    emerald[600],
  ]

  logo.forEach((line, i) => {
    const color = gradientColors[i] || emerald[500]
    console.log(chalk.hex(color)('  ' + line))
  })

  console.log()
  console.log(
    chalk.hex(emerald[300])('  ✦ ') +
      chalk.hex(emerald[200]).italic('AI-powered personal finance helper') +
      chalk.hex(emerald[300])(' ✦')
  )
  console.log()
  console.log(chalk.dim(`  ${getVersion()}`))
  console.log()
}

export function printStartupInfo(options: StartupOptions) {
  const { port, isFirstRun, dbType } = options

  // Status box
  const statusBox = boxen(chalk.green.bold('✓') + chalk.white.bold(' Server is running'), {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 0, bottom: 0, left: 1, right: 0 },
    borderStyle: 'round',
    borderColor: '#34d399',
  })
  console.log(statusBox)
  console.log()

  // URL section
  console.log(chalk.hex(emerald[300]).bold('  🌐 Open in browser'))
  console.log(chalk.hex(emerald[400])(`     http://localhost:${port}`))
  console.log()

  // First run notice
  if (isFirstRun) {
    const firstRunContent = [
      chalk.white('Configure Google OAuth to get started:'),
      chalk.hex(emerald[400])(`→ http://localhost:${port}/setup`),
    ].join('\n')

    const firstRunBox = boxen(firstRunContent, {
      title: chalk.hex(emerald[300])('⚡ First run detected'),
      titleAlignment: 'left',
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 0, left: 1, right: 0 },
      borderStyle: 'round',
      borderColor: '#34d399',
    })
    console.log(firstRunBox)
    console.log()
  }

  // Info footer
  console.log(
    chalk.dim(
      `  📦 Database: ${chalk.hex(emerald[300])(dbType === 'postgres' ? 'PostgreSQL' : 'SQLite')}`
    )
  )
  console.log()
  console.log(chalk.dim('  Press ') + chalk.hex(emerald[400])('Ctrl+C') + chalk.dim(' to stop'))
  console.log()
}

export function printError(message: string) {
  console.log(chalk.red.bold('  ✗ Error: ') + chalk.red(message))
}

export function printWarning(message: string) {
  console.log(chalk.hex('#fbbf24')('  ⚠ ') + chalk.hex('#fbbf24')(message))
}

export function printSuccess(message: string) {
  console.log(chalk.hex(emerald[400])('  ✓ ') + message)
}
