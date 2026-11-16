---
name: deploy-cdk
description: Deploy the AWS CDK infrastructure (API, auth, data, hosting stacks)
disable-model-invocation: true
---

# Action

All commands run from the sibling CDK repo, `../retirement-planner-cdk`, using the `petroapps` AWS
profile (the same profile the `deploy` skill uses).

1. Abort the deployment if the CDK repo has uncommitted changes. Check with:
   ```bash
   cd ../retirement-planner-cdk && git status --short
   ```
   Any output means the tree is dirty: stop, list the changed files, and do not continue. Any
   branch is allowed. Print the current branch and short commit hash so it is clear what will be
   deployed:
   ```bash
   git branch --show-current && git rev-parse --short HEAD
   ```
2. Typecheck and test. Stop on any failure and show the output:
   ```bash
   npm run build && npm test
   ```
3. Preview the infrastructure changes:
   ```bash
   npx cdk diff --profile petroapps
   ```
   `cdk diff` has no `--all` option (it warns and ignores it) and already diffs every stack in the
   app when no stack name is given. `cdk deploy` does accept `--all`.
   Show me the diff output (summarize it only if it is very long, and say so). Then stop and ask me
   for permission to proceed. Do not run the deploy until I answer with a "proceed/ok/go" command.
   If the diff reports no differences, say so and stop.
4. After I approve the diff, deploy all stacks. My approval of the diff in step 3 is the approval
   for any IAM or security changes it showed, so CDK's own confirmation prompt is turned off (it
   cannot be answered in a non-interactive session):
   ```bash
   npx cdk deploy --all --require-approval never --profile petroapps
   ```
   If the deploy output shows changes that were not in the diff I approved, stop and tell me.
5. Report the result: which stacks changed, the stack outputs (API URL, bucket and CloudFront
   names), and any errors. Remind me that the application itself is deployed separately with
   `/deploy`.
