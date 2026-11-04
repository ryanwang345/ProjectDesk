import { plugin as cypressGrepPlugin } from '@cypress/grep/plugin'
import { defineConfig } from 'cypress'
import { loadEnv } from './scripts/load-env.mjs'

loadEnv()

const env = process.env
const artifactsDir = env.E2E_ARTIFACTS_DIR ?? 'artifacts/local'

function retries(): number {
  const value = Number(env.E2E_RETRIES ?? 1)
  return Number.isInteger(value) && value >= 0 ? value : 1
}

export default defineConfig({
  e2e: {
    baseUrl: env.E2E_BASE_URL ?? 'http://127.0.0.1:47291',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 800,
    setupNodeEvents(_on, config) {
      cypressGrepPlugin(config)
      return config
    },
  },
  expose: {
    grepTags: env.E2E_TAGS ?? '',
    grepFilterSpecs: true,
    grepOmitFiltered: true,
  },
  retries: { runMode: retries(), openMode: 0 },
  video: env.E2E_VIDEO === 'true',
  screenshotOnRunFailure: true,
  screenshotsFolder: `${artifactsDir}/screenshots`,
  videosFolder: `${artifactsDir}/videos`,
  downloadsFolder: `${artifactsDir}/downloads`,
  trashAssetsBeforeRuns: true,
  reporter: 'junit',
  reporterOptions: {
    mochaFile: `${artifactsDir}/junit/results-[hash].xml`,
    testsuitesTitle: 'Project Desk E2E',
  },
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  pageLoadTimeout: 30000,
})
