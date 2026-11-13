def noop(config) {
  return {
    stage('apps/api') {
      echo "[apps/api] No changes detected. Skipping build."
    }
  }
}

def main(config) {
  String imageRepo = 'rwang345/project-desk-api'
  String buildNumber = config.buildNumber ?: env.BUILD_NUMBER
  String branchName = config.branch ?: env.BRANCH_NAME ?: 'main'
  String latestBranch = config.latestBranch ?: 'main'

  return {
    stage('apps/api / Unit Tests') {
      container('golang') {
        dir('apps/api') {
          echo "[apps/api] Running Go tests with vendored dependencies..."
          sh 'go test -v -mod=vendor ./...'
        }
      }
    }

    stage('apps/api / Build & Push Image') {
      withCredentials([
        string(credentialsId: 'DOCKERHUB_USER', variable: 'DOCKERHUB_USER'),
        string(credentialsId: 'DOCKERHUB_TOKEN', variable: 'DOCKERHUB_TOKEN')
      ]) {
        container('buildkit') {
          sh """
            set +x
            set -eu

            DOCKER_CONFIG=\$(mktemp -d /tmp/api-docker.XXXXXX)
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

            EXTRA_ARGS=""
            if [ -s "$WORKSPACE/apps/api/extra-ca.crt" ]; then
              EXTRA_ARGS="--secret id=extra-ca,src=$WORKSPACE/apps/api/extra-ca.crt"
            fi

            echo "[BuildKit] Building and publishing \${IMAGE_TAGS} from apps/api..."
            buildctl-daemonless.sh build \\
              --progress=plain \\
              --frontend=dockerfile.v0 \\
              --local "context=$WORKSPACE/apps/api" \\
              --local "dockerfile=$WORKSPACE/apps/api" \\
              \${EXTRA_ARGS} \\
              --output "\$OUTPUT"

            echo "[BuildKit] Successfully published \${IMAGE_TAGS}"
          """
        }
      }
    }
  }
}

return this
