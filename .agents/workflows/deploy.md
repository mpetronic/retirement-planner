---
description: Deploy application to AWS S3
---

# Action

1. Perform a production build of the application code:
   ```bash
   npm run build
   ```
2. Deploy the application code to the AWS S3 bucket for the SPA:
   ```bash
   aws s3 sync dist/ s3://retirementplanner-web-242065761054-us-east-1 --delete --profile petroapps
   ```
3. Invalidate CloudFront distribution cache:
   ```bash
   aws cloudfront create-invalidation --distribution-id E1I86LT48MQ21M --paths "/*" --profile petroapps
   ```
