def noop(config) {
  return {
    stage('apps/web') {
      echo "[apps/web] No changes detected. Skipping build."
    }
  }
}

def main(config) {
  String imageRepo = 'rwang345/project-desk-web'
  String buildNumber = config.buildNumber ?: env.BUILD_NUMBER
  String branchName = config.branch ?: env.BRANCH_NAME ?: 'main'
  String latestBranch = config.latestBranch ?: 'main'

  return {
    stage('apps/web / Validate & Build') {
      container('node') {
        dir('apps/web') {
          echo "[apps/web] Installing dependencies, linting, and building production bundles..."
          sh '''
            npm ci
            npm run lint
            npm run build
          '''
        }
      }
    }

    stage('apps/web / Build & Push Image') {
      withEnv([
        "BUILD_IMAGE_REPO=${imageRepo}",
        "BUILD_IMAGE_TAG=${buildNumber}",
        "BUILD_IMAGE_BRANCH=${branchName}",
        "BUILD_IMAGE_LATEST_BRANCH=${latestBranch}"
      ]) {
        withCredentials([
          string(credentialsId: 'DOCKERHUB_USER', variable: 'DOCKERHUB_USER'),
          string(credentialsId: 'DOCKERHUB_TOKEN', variable: 'DOCKERHUB_TOKEN')
        ]) {
          container('buildkit') {
            sh '''
              set +x
              set -eu

              umask 077

              DOCKER_CONFIG=$(mktemp -d /tmp/web-docker.XXXXXX)
              export DOCKER_CONFIG
              trap 'rm -rf "$DOCKER_CONFIG"' EXIT

              AUTH=$(printf '%s:%s' "$DOCKERHUB_USER" "$DOCKERHUB_TOKEN" | base64 | tr -d '[:space:]')
              printf '{"auths":{"https://index.docker.io/v1/":{"auth":"%s"}}}' "$AUTH" > "$DOCKER_CONFIG/config.json"
              unset AUTH

              IMAGE="docker.io/${BUILD_IMAGE_REPO}"
              IMAGE_TAGS="${IMAGE}:${BUILD_IMAGE_TAG}"

              if [ "${BUILD_IMAGE_BRANCH}" = "${BUILD_IMAGE_LATEST_BRANCH}" ]; then
                IMAGE_TAGS="${IMAGE_TAGS},${IMAGE}:latest"
              fi

              OUTPUT=$(printf 'type=image,"name=%s",push=true' "$IMAGE_TAGS")

              echo "[BuildKit] Building and publishing ${IMAGE_TAGS} from apps/web..."
              buildctl-daemonless.sh build \\
                --progress=plain \\
                --frontend=dockerfile.v0 \\
                --local "context=$WORKSPACE/apps/web" \\
                --local "dockerfile=$WORKSPACE/apps/web" \\
                --output "$OUTPUT"

              echo "[BuildKit] Successfully published ${IMAGE_TAGS}"
            '''
          }
        }
      }
    }
  }
}

return this
