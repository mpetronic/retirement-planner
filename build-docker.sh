#!/usr/bin/env bash
# ==============================================================================
# Build script to package retirement-planner into a production Docker image
# ==============================================================================

set -euo pipefail

# Configuration defaults
IMAGE_NAME="${IMAGE_NAME:-retirement-planner}"
RUN_PORT="${PORT:-8080}"
AUTO_RUN=false
CUSTOM_TAG=""

# Display usage helper
show_help() {
  cat << EOF
Usage: $(basename "$0") [OPTIONS]

Builds the Retirement Planner application into an optimized production Docker image.

Options:
  -t, --tag <tag>       Specify a custom Docker tag (e.g. 1.0.0 or prod). Default: git commit or 'latest'
  -n, --name <name>     Specify custom Docker image repository name (default: 'retirement-planner')
  -p, --port <port>     Specify host port when using --run (default: 8080)
  -r, --run             Automatically start a container instance after building
  -h, --help            Show this help message and exit

Examples:
  ./build-docker.sh
  ./build-docker.sh --tag v2.0.0 --run
  ./build-docker.sh --port 3000 --run
EOF
}

# Parse command line flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--tag)
      CUSTOM_TAG="$2"
      shift 2
      ;;
    -n|--name)
      IMAGE_NAME="$2"
      shift 2
      ;;
    -p|--port)
      RUN_PORT="$2"
      shift 2
      ;;
    -r|--run)
      AUTO_RUN=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Ensure we run from the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Determine Git version info for tagging
GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo "dev")"
GIT_TAG="$(git describe --tags --exact-match HEAD 2>/dev/null || echo "")"

if [ -n "$CUSTOM_TAG" ]; then
  PRIMARY_TAG="$CUSTOM_TAG"
elif [ -n "$GIT_TAG" ]; then
  PRIMARY_TAG="$GIT_TAG"
else
  PRIMARY_TAG="$GIT_COMMIT"
fi

echo "============================================================"
echo "  Building Docker Image: ${IMAGE_NAME}:${PRIMARY_TAG}"
echo "============================================================"

# Build Docker image with primary tag and latest tag
docker build \
  -t "${IMAGE_NAME}:${PRIMARY_TAG}" \
  -t "${IMAGE_NAME}:latest" \
  .

echo ""
echo "============================================================"
echo "  Build Complete Successfully!"
echo "  - Image: ${IMAGE_NAME}:${PRIMARY_TAG}"
echo "  - Image: ${IMAGE_NAME}:latest"
echo "============================================================"

if [ "$AUTO_RUN" = true ]; then
  echo ""
  echo "Stopping any existing container named '${IMAGE_NAME}'..."
  docker stop "${IMAGE_NAME}" 2>/dev/null || true
  docker rm "${IMAGE_NAME}" 2>/dev/null || true

  echo "Starting container on http://localhost:${RUN_PORT}..."
  docker run -d \
    --name "${IMAGE_NAME}" \
    -p "${RUN_PORT}:80" \
    --restart unless-stopped \
    "${IMAGE_NAME}:${PRIMARY_TAG}"

  echo "Container is running! Access the app at: http://localhost:${RUN_PORT}"
else
  echo ""
  echo "To run this image manually in production mode, execute:"
  echo "  docker run -d -p ${RUN_PORT}:80 --name ${IMAGE_NAME} ${IMAGE_NAME}:${PRIMARY_TAG}"
  echo ""
  echo "Then open: http://localhost:${RUN_PORT}"
fi
