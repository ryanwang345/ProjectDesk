def monorepoWorkspaceStages(Map buildConfig) {
  def helpers = buildConfig.helpers
  def forceBuild = buildConfig.forceBuild
  echo "Building parallel workspace stages with config: ${buildConfig}"

  return buildConfig.workflows.collectEntries { name, workflow ->
    Boolean shouldForceBuild = helpers.shouldForceBuildWithDependencies(forceBuild, name, buildConfig.componentConfig)
    Boolean shouldBuild = shouldForceBuild || (buildConfig.changes && buildConfig.changes[name])

    echo "Workspace evaluation for ${name}: shouldBuild=${shouldBuild} (force=${shouldForceBuild}, changed=${buildConfig.changes ? buildConfig.changes[name] : false})"
    def block = shouldBuild ? workflow.main(buildConfig) : workflow.noop(buildConfig)
    return [(name): block]
  }
}

return this
