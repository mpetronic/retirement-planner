#!/usr/bin/env bash
# Pre-commit secret/PII scan. Exit 0 = clean, non-zero = do NOT commit.
# Never prints secret values (--redact).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# 1. Filename blocklist: catches sensitive files regardless of content.
#    Template files (.env.example etc.) are exempt.
blocked_re='(^|/)(\.env(\..*)?|id_rsa.*|.*\.pem|.*\.p12|.*\.tfstate(\.backup)?|kubeconfig|credentials)$'
exempt_re='\.(example|sample|template)$'

staged="$(git diff --cached --name-only --diff-filter=ACMR)"
hits="$(printf '%s\n' "$staged" | grep -E "$blocked_re" | grep -Ev "$exempt_re" || true)"

if [ -n "$hits" ]; then
  echo "BLOCKED: staged files match a sensitive filename pattern:" >&2
  printf '%s\n' "$hits" >&2
  exit 1
fi

# 2. Content scan of staged changes only.
command -v gitleaks >/dev/null 2>&1 || {
  echo "BLOCKED: gitleaks is not installed or not on PATH" >&2
  exit 2
}

args=(git --pre-commit --staged --redact --no-banner --verbose)
[ -f .gitleaks.toml ]          && args+=(--config .gitleaks.toml)
[ -f .gitleaks-baseline.json ] && args+=(--baseline-path .gitleaks-baseline.json)

gitleaks "${args[@]}"
