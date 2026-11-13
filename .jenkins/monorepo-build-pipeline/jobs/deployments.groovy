def triggerGitOpsDeployment(Map config) {
  String branchName = config.branch ?: env.BRANCH_NAME ?: 'main'
  String buildNumber = config.buildNumber ?: env.BUILD_NUMBER
  String component = config.component ?: 'web+api'
  String targetEnv = config.targetEnv ?: 'dev'

  return {
    stage("Deploy / GitOps (${targetEnv})") {
      script {
        echo "=========================================================="
        echo "[GitOps Deployment] Triggering ProjectDesk-Deploy"
        echo "  Component:   ${component}"
        echo "  Image Tag:   ${buildNumber}"
        echo "  Environment: ${targetEnv}"
        echo "  Branch:      ${branchName}"
        echo "=========================================================="

        build(
          job: 'ProjectDesk-Deploy',
          parameters: [
            string(name: 'COMPONENT', value: component),
            string(name: 'IMAGE_TAG', value: buildNumber),
            string(name: 'TARGET_ENV', value: targetEnv)
          ],
          wait: false
        )
      }
    }
  }
}

return this
