#!/usr/bin/env bash
# ==============================================================================
# Build script to compile frontend assets and package the standalone Go server
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
GO_DIR="$ROOT_DIR/go-retire"

OUTPUT_BINARY="$ROOT_DIR/retirement-planner"
AUTO_RUN=false
RUN_PORT=""
BUILD_ALL=false

show_help() {
  cat << EOF
Usage: $(basename "$0") [OPTIONS]

Builds the minimized frontend bundle and compiles the standalone Go executable
with embedded distribution files.

Options:
  -o, --output <path>    Specify output path for compiled binary (default: ./retirement-planner)
  -r, --run              Automatically launch the server after successful build
  -p, --port <port>      Specify port override when using --run (default: 8999)
  --all                  Build cross-platform binaries (Linux, macOS arm64/x64, Windows x64)
  -h, --help             Show this help message and exit

Examples:
  ./build-go.sh
  ./build-go.sh --run
  ./build-go.sh --run --port 9000
  ./build-go.sh --output ./bin/my-planner
  ./build-go.sh --all
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output)
      OUTPUT_BINARY="$2"
      shift 2
      ;;
    -r|--run)
      AUTO_RUN=true
      shift
      ;;
    -p|--port)
      RUN_PORT="$2"
      shift 2
      ;;
    --all)
      BUILD_ALL=true
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

cd "$ROOT_DIR"

echo "============================================================"
echo "  Step 1: Compiling Frontend (npm run build)"
echo "============================================================"
npm run build

echo ""
echo "============================================================"
echo "  Step 2: Syncing dist/ into go-retire/dist/"
echo "============================================================"
mkdir -p "$GO_DIR/dist"
rm -rf "${GO_DIR:?}/dist"/*
cp -r "$ROOT_DIR/dist/." "$GO_DIR/dist/"
touch "$GO_DIR/dist/.gitkeep"
echo "Assets copied to $GO_DIR/dist successfully."

echo ""
echo "============================================================"
echo "  Step 3: Compiling Standalone Go Binary"
echo "============================================================"

# Resolve Git commit / version info for build stamps if available
GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo "dev")"

if [ "$BUILD_ALL" = true ]; then
  RELEASE_DIR="$ROOT_DIR/dist-bin"
  mkdir -p "$RELEASE_DIR"
  echo "Building cross-platform release binaries into: $RELEASE_DIR"

  TARGETS=(
    "linux/amd64/retirement-planner-linux-amd64"
    "linux/arm64/retirement-planner-linux-arm64"
    "darwin/amd64/retirement-planner-darwin-amd64"
    "darwin/arm64/retirement-planner-darwin-arm64"
    "windows/amd64/retirement-planner-windows-amd64.exe"
  )

  for TARGET in "${TARGETS[@]}"; do
    IFS="/" read -r GOOS GOARCH BIN_NAME <<< "$TARGET"
    echo "  -> Compiling ${GOOS}/${GOARCH} -> ${BIN_NAME}..."
    (
      cd "$GO_DIR"
      CGO_ENABLED=0 GOOS="$GOOS" GOARCH="$GOARCH" go build \
        -ldflags="-s -w -X main.gitCommit=${GIT_COMMIT}" \
        -o "${RELEASE_DIR}/${BIN_NAME}" .
    )
  done
  echo "Cross-platform binaries successfully created in $RELEASE_DIR."
fi

# Build primary native target
echo "Compiling native binary to: $OUTPUT_BINARY..."
mkdir -p "$(dirname "$OUTPUT_BINARY")"
(
  cd "$GO_DIR"
  CGO_ENABLED=0 go build \
    -ldflags="-s -w -X main.gitCommit=${GIT_COMMIT}" \
    -o "$OUTPUT_BINARY" .
)

# Also ensure a copy exists in go-retire/ for local convenience if output wasn't already in go-retire/
if [ "$OUTPUT_BINARY" != "$GO_DIR/retirement-planner" ]; then
  rm -f "$GO_DIR/retirement-planner"
  cp "$OUTPUT_BINARY" "$GO_DIR/retirement-planner"
fi

echo ""
echo "============================================================"
echo "  Build Complete Successfully!"
echo "  Binary: $OUTPUT_BINARY"
echo "============================================================"

if [ "$AUTO_RUN" = true ]; then
  echo ""
  RUN_ARGS=()
  if [ -n "$RUN_PORT" ]; then
    RUN_ARGS+=(--port "$RUN_PORT")
  fi
  echo "Executing: $OUTPUT_BINARY ${RUN_ARGS[*]:-}"
  exec "$OUTPUT_BINARY" "${RUN_ARGS[@]}"
fi
