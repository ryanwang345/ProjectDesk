import groovy.transform.Field

def fetchGitTarget(String target) {
  echo "Fetching git target: ${target}"
  sh "git -c safe.directory=\"$WORKSPACE\" fetch --no-tags --progress origin +refs/heads/*:refs/remotes/origin/* || true"
}

def forceBuildItemsOf(String forceBuildList) {
  return (forceBuildList ?: '').split(',').collect { item -> item.trim() }.findAll { it }
}

def shouldForceBuild(String forceBuildList, String packageName) {
  if (!forceBuildList) return false
  return forceBuildItemsOf(forceBuildList).contains(packageName)
}

def shouldForceBuildWithDependencies(String forceBuildList, String packageName, Map componentConfig) {
  if (!forceBuildList) return false
  def items = forceBuildItemsOf(forceBuildList)
  if (items.contains(packageName) || items.contains('all')) {
    return true
  }
  def deps = (componentConfig?.get(packageName)?.dependsOn ?: []).collect { it.toString() }
  for (dep in deps) {
    if (items.contains(dep)) {
      echo "Force building ${packageName} because dependency ${dep} was selected"
      return true
    }
  }
  return false
}

def getVersions(Map componentConfig, String latestBranch, String currentBranch) {
  echo "Extracting versions for components across ${latestBranch} and ${currentBranch}"
  def versions = [:]
  componentConfig.each { name, conf ->
    if (conf.package && conf.package.endsWith('.json')) {
      try {
        if (fileExists(conf.package)) {
          def json = readJSON(file: conf.package)
          versions[name] = json['version'] ?: '0.1.0'
        }
      } catch (e) {
        echo "Unable to read package.json for ${name}: ${e}"
        versions[name] = '0.1.0'
      }
    } else {
      versions[name] = env.BUILD_NUMBER ?: 'latest'
    }
  }
  return versions
}

def getChanges(Map componentConfig, String latestBranch, String currentBranch) {
  echo "Detecting changed components between ${latestBranch} and ${currentBranch}"
  def diffFiles = []
  try {
    def baseCommit = "origin/${latestBranch}"
    if (env.GIT_PREVIOUS_SUCCESSFUL_COMMIT && sh(script: "git rev-parse --verify ${env.GIT_PREVIOUS_SUCCESSFUL_COMMIT}^{commit} 2>/dev/null", returnStatus: true) == 0) {
      baseCommit = env.GIT_PREVIOUS_SUCCESSFUL_COMMIT
    } else if (sh(script: "git rev-parse --verify HEAD~1 2>/dev/null", returnStatus: true) == 0) {
      baseCommit = "HEAD~1"
    }

    def rawDiff = sh(
      script: "git -c safe.directory=\"$WORKSPACE\" diff --name-only ${baseCommit} HEAD || true",
      returnStdout: true
    ).trim()

    // Include all files (source code, markdown, SVG, PNG, assets) under components
    diffFiles = rawDiff.split('\n')
      .collect { it.trim() }
      .findAll { it }
    echo "Total monorepo changed files: ${diffFiles.size()}"
  } catch (e) {
    echo "Warning during git diff: ${e}. Marking all components as changed."
    diffFiles = ['FORCE_ALL']
  }

  def changes = [:]
  def forceAll = diffFiles.contains('FORCE_ALL') || diffFiles.contains('Jenkinsfile')

  componentConfig.each { name, conf ->
    def folder = (conf.folder ?: '').toString()
    def hasFolderChanges = diffFiles.any { file -> file == folder || file.startsWith(folder + '/') }

    changes[name] = forceAll || hasFolderChanges
    echo "Monorepo component git diff evaluation: ${name} -> ${changes[name]} (folder: ${folder})"
  }

  // Propagate dependencies: if dependency changed, mark dependent as changed
  componentConfig.each { name, conf ->
    def deps = (conf.dependsOn ?: []).collect { it.toString() }
    for (dep in deps) {
      if (changes[dep]) {
        changes[name] = true
        echo "Propagated change from ${dep} to ${name}"
      }
    }
  }

  return changes
}

def getWorkflows(Map componentConfig) {
  def workflows = [:]
  componentConfig.each { name, conf ->
    if (conf.workflow) {
      echo "Loading workspace workflow for ${name}: ${conf.workflow}"
      workflows[name] = load(conf.workflow)
    }
  }
  return workflows
}

def pushGitOpsConfigUpdate(Map config) {
  String component = config.component ?: 'web+api'
  String imageTag = config.imageTag ?: env.BUILD_NUMBER
  String gitopsRepo = config.gitopsRepo ?: 'https://github.com/ryanwang345/ProjectDesk-GitOps.git'
  String targetEnv = config.targetEnv ?: 'dev'

  echo "=========================================================="
  echo "[GitOps] Updating ${component} image tag to ${imageTag} in ${gitopsRepo} (${targetEnv})"
  echo "=========================================================="

  build(
    job: 'ProjectDesk-Deploy',
    parameters: [
      string(name: 'COMPONENT', value: component),
      string(name: 'IMAGE_TAG', value: imageTag),
      string(name: 'TARGET_ENV', value: targetEnv)
    ],
    wait: false
  )
}

return this
