---
name: deploy
description: Deploy application to AWS S3
disable-model-invocation: true
---

# Action

1. Abort the deployment if there are uncommitted changes. Check with:
   ```bash
   git status --short
   ```
   Any output means the tree is dirty: stop, list the changed files, and do not continue.
2. Perform a production build of the application code:
   ```bash
   npm run build
   ```
3. Deploy the application code to the AWS S3 bucket for the SPA:
   ```bash
   aws s3 sync dist/ s3://retirementplanner-web-242065761054-us-east-1 --delete --profile petroapps
   ```
4. Set `Cache-Control: no-cache` on the service worker, manifest, HTML, favicon, and icons so
   browsers and installed PWAs (Android WebAPK) always revalidate them instead of using stale
   cached copies. Hashed files under `assets/` keep the default caching:
   ```bash
   aws s3 cp dist/ s3://retirementplanner-web-242065761054-us-east-1/ --recursive --exclude "*" --include "sw.js" --include "expenser-manifest.json" --include "*.html" --include "favicon.ico" --include "icons/*" --cache-control "no-cache" --metadata-directive REPLACE --profile petroapps
   ```
5. Invalidate CloudFront distribution cache:
   ```bash
   aws cloudfront create-invalidation --distribution-id E1I86LT48MQ21M --paths "/*" --profile petroapps
   ```
