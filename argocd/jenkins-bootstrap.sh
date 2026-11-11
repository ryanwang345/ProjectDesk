#!/usr/bin/env bash
# One-shot setup of Jenkins on Kubernetes (run on the k8s VM).
#
#   curl -fsSL https://raw.githubusercontent.com/ryanwang345/ProjectDesk/main/argocd/jenkins-bootstrap.sh | bash
#   # or, from a clone:  bash argocd/jenkins-bootstrap.sh
#
# 1. creates the jenkins namespace and the jenkins-ci-credentials Secret
# 2. registers the Jenkins ArgoCD Application (argocd/jenkins.yaml)
# 3. waits for Jenkins, prints the URL and admin password
# 4. optionally stops the old systemd Jenkins so the two don't both build
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/ryanwang345/ProjectDesk/main"
NS=jenkins
SECRET=jenkins-ci-credentials

# Read from the terminal even when the script is piped into bash.
ask() { local prompt=$1 var; read -r -p "$prompt" var </dev/tty; printf '%s' "$var"; }
ask_secret() { local prompt=$1 var; read -r -s -p "$prompt" var </dev/tty; echo >&2; printf '%s' "$var"; }

kubectl get ns "$NS" >/dev/null 2>&1 || kubectl create namespace "$NS"

if kubectl get secret "$SECRET" -n "$NS" >/dev/null 2>&1; then
  echo "Secret $NS/$SECRET already exists, keeping it."
else
  echo "Jenkins credentials (stored only in the $NS/$SECRET Secret):"
  DOCKERHUB_USER=$(ask "  Docker Hub username: ")
  DOCKERHUB_TOKEN=$(ask_secret "  Docker Hub access token: ")
  GITHUB_TOKEN=$(ask_secret "  GitHub token (push access to ProjectDesk): ")
  kubectl create secret generic "$SECRET" -n "$NS" \
    --from-literal=dockerhub-user="$DOCKERHUB_USER" \
    --from-literal=dockerhub-token="$DOCKERHUB_TOKEN" \
    --from-literal=github-token="$GITHUB_TOKEN"
fi

echo "Registering the Jenkins ArgoCD Application..."
kubectl apply -f "$REPO_RAW/argocd/jenkins.yaml"

echo "Waiting for ArgoCD to create the Jenkins StatefulSet..."
until kubectl get statefulset jenkins -n "$NS" >/dev/null 2>&1; do sleep 5; done

echo "Waiting for Jenkins to start (first start installs plugins, ~3-5 min)..."
kubectl rollout status statefulset/jenkins -n "$NS" --timeout=15m

PASSWORD=$(kubectl get secret jenkins -n "$NS" -o jsonpath='{.data.jenkins-admin-password}' | base64 -d)
IP=$(hostname -I | awk '{print $1}')

cat <<EOF

Jenkins is running in Kubernetes.
  URL:      http://${IP}:32000
  User:     admin
  Password: ${PASSWORD}
  Job:      ProjectDesk (polls GitHub main every ~2 min)
EOF

if systemctl is-active --quiet jenkins 2>/dev/null; then
  echo
  echo "The old Jenkins (systemd on this VM) is still running. If both poll"
  echo "GitHub, every push is built twice and both push image tags to main."
  if [ "$(ask 'Stop and disable the old Jenkins now? [y/N] ')" = "y" ]; then
    sudo systemctl disable --now jenkins
    echo "Old Jenkins stopped (data kept in /var/lib/jenkins)."
  else
    echo "Left running. Stop it later with: sudo systemctl disable --now jenkins"
  fi
fi
