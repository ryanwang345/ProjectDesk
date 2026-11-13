def runExternalTests(Map config) {
  def jobs = [:]
  String branchName = config.branchName ?: env.BRANCH_NAME ?: 'main'
  Boolean runE2e = config.runE2e ?: false

  if (runE2e) {
    jobs['Cypress E2E Suite'] = {
      stage('Downstream / Run Cypress E2E') {
        echo "Triggering ProjectDesk-E2E-Tests for branch ${branchName}..."
        build(
          job: 'ProjectDesk-E2E-Tests',
          parameters: [
            string(name: 'TARGET_ENV', value: 'dev'),
            string(name: 'TEST_TAGS', value: '@smoke')
          ],
          wait: false
        )
      }
    }
  }

  return jobs
}

return this
