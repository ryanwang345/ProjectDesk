def loadComponents() {
  return readYaml(file: './.jenkins/monorepo-build-pipeline/config/components.yml')
}

return this
