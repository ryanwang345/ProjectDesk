def noop(config) {
  return {
    stage('apps/e2e') {
      echo "[apps/e2e] No changes detected. Skipping E2E build."
    }
  }
}

def main(config) {
  String imageRepo = 'rwang345/project-desk-e2e'
  String buildNumber = config.buildNumber ?: env.BUILD_NUMBER
  String branchName = config.branch ?: env.BRANCH_NAME ?: 'main'
  String latestBranch = config.latestBranch ?: 'main'
  Boolean skipE2e = (config.skipE2e != null) ? config.skipE2e : true

  return {
    stage('apps/e2e / Validate') {
      parallel {
        stage('Typecheck') {
          container('node') {
            dir('apps/e2e') {
              echo "[apps/e2e] Installing dependencies and verifying TypeScript..."
              sh '''
                CYPRESS_INSTALL_BINARY=0 npm ci
                npm run typecheck
              '''
            }
          }
        }
        stage('Chart Lint') {
          container('helm') {
            dir('apps/e2e') {
              echo "[apps/e2e] Linting E2E Helm charts across environments..."
              sh '''
                for env in dev staging prod; do
                  if [ -f "chart/values-${env}.yaml" ]; then
                    helm lint ./chart \
                      -f "chart/values-${env}.yaml" \
                      --set image.tag="ci-${BUILD_NUMBER}" \
                      --set-file dotenv=.env
                  fi
                done
              '''
            }
          }
        }
      }
    }

    stage('apps/e2e / Build & Push Image') {
      when {
        expression { return !skipE2e }
      }
      steps {
        withCredentials([
          string(credentialsId: 'DOCKERHUB_USER', variable: 'DOCKERHUB_USER'),
          string(credentialsId: 'DOCKERHUB_TOKEN', variable: 'DOCKERHUB_TOKEN')
        ]) {
          container('buildkit') {
            sh """
              set +x
              set -eu

              DOCKER_CONFIG=\$(mktemp -d /tmp/e2e-docker.XXXXXX)
              export DOCKER_CONFIG
              trap 'rm -rf "\$DOCKER_CONFIG"' EXIT

              AUTH=\$(printf '%s:%s' "\$DOCKERHUB_USER" "\$DOCKERHUB_TOKEN" | base64 | tr -d '[:space:]')
              printf '{"auths":{"https://index.docker.io/v1/":{"auth":"%s"}}}' "\$AUTH" > "\$DOCKER_CONFIG/config.json"
              unset AUTH

              IMAGE="docker.io/${imageRepo}"
              IMAGE_TAGS="\${IMAGE}:${buildNumber}"

              if [ "${branchName}" = "${latestBranch}" ]; then
                IMAGE_TAGS="\${IMAGE_TAGS},\${IMAGE}:latest"
              fi

              OUTPUT=\$(printf 'type=image,"name=%s",push=true' "\$IMAGE_TAGS")

              echo "[BuildKit] Building and publishing \${IMAGE_TAGS} from apps/e2e..."
              buildctl-daemonless.sh build \\
                --progress=plain \\
                --frontend=dockerfile.v0 \\
                --local "context=$WORKSPACE/apps/e2e" \\
                --local "dockerfile=$WORKSPACE/apps/e2e" \\
                --output "\$OUTPUT"

              echo "[BuildKit] Successfully published \${IMAGE_TAGS}"
            """
          }
        }
      }
    }
  }
}

return this
