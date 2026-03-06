# Deployment Guide

SENTINEL runs entirely on GitHub infrastructure: GitHub Actions for the pipeline, GitHub Pages for the dashboard. This guide walks through setting up a new deployment from a fork.

---

## Prerequisites

- A GitHub account
- An [Anthropic API key](https://console.anthropic.com/) (for LLM analysis; optional but recommended)
- Optionally, a [Mapbox access token](https://account.mapbox.com/) (for the interactive map view)

---

## Step 1: Fork the Repository

1. Navigate to the SENTINEL repository on GitHub
2. Click **Fork** (top right)
3. Keep the default settings and click **Create fork**

You now have your own copy at `github.com/YOUR_USERNAME/sentinel`.

---

## Step 2: Set Up GitHub Secrets

The pipeline needs an Anthropic API key to perform LLM analysis. Without it, the pipeline still runs but events will only have rule-engine scores (no LLM narratives).

1. Go to your fork's **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret**
3. Add the following secrets:

| Secret Name | Value | Required |
|-------------|-------|----------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (`sk-ant-...`) | Recommended |
| `WHO_EIOS_API_KEY` | WHO EIOS API key (if your organization has access) | Optional |
| `MAPBOX_TOKEN` | Your Mapbox public access token | Optional |

The pipeline workflow references the secret as `${{ secrets.ANTHROPIC_API_KEY }}` and passes it to the Python process as the `SENTINEL_ANTHROPIC_API_KEY` environment variable.

---

## Step 3: Enable GitHub Actions

GitHub may disable Actions on forked repositories by default.

1. Go to your fork's **Actions** tab
2. If you see a banner saying "Workflows aren't being run on this forked repository," click **I understand my workflows, go ahead and enable them**
3. You should now see three workflows:
   - **CI** -- runs on pushes and PRs to `main`
   - **Daily Pipeline** -- runs daily at 06:00 UTC
   - **Deploy Dashboard** -- runs when `data/` or `frontend/` changes on `main`

---

## Step 4: Enable GitHub Pages

1. Go to your fork's **Settings** > **Pages**
2. Under **Source**, select **GitHub Actions**
3. No further configuration is needed -- the `deploy-dashboard.yml` workflow handles the build and deploy

---

## Step 5: Run the Pipeline for the First Time

To populate the dashboard with initial data:

1. Go to **Actions** > **Daily Pipeline**
2. Click **Run workflow** > **Run workflow** (on the `main` branch)
3. Wait for the workflow to complete (typically 2--5 minutes)
4. The workflow will:
   - Collect events from all five sources
   - Normalize, deduplicate, and score events
   - Run LLM analysis on qualifying events (if API key is configured)
   - Commit new data to `data/` directory
   - This commit triggers the Deploy Dashboard workflow

---

## Step 6: Verify the Dashboard

After both workflows complete:

1. Go to **Settings** > **Pages**
2. You should see "Your site is live at `https://YOUR_USERNAME.github.io/sentinel/`"
3. Click the URL to open the dashboard
4. Verify that the Command Center shows event data

If the dashboard shows no data, check:
- The Daily Pipeline workflow completed successfully
- The `data/events/` directory contains JSON files
- The Deploy Dashboard workflow completed successfully

---

## Step 7: Configure Custom Domain (Optional)

To serve the dashboard on a custom domain:

1. Go to **Settings** > **Pages**
2. Under **Custom domain**, enter your domain (e.g., `sentinel.example.com`)
3. Follow GitHub's instructions to configure DNS:
   - For an apex domain: add `A` records pointing to GitHub's IP addresses
   - For a subdomain: add a `CNAME` record pointing to `YOUR_USERNAME.github.io`
4. Check **Enforce HTTPS**

You may also need to update the `NEXT_PUBLIC_BASE_PATH` environment variable in `.github/workflows/deploy-dashboard.yml` if your deployment path changes.

---

## Daily Operations

Once deployed, the system runs automatically:

- **06:00 UTC daily**: The pipeline collects and analyzes new events
- **On data commit**: The dashboard rebuilds and deploys with fresh data
- **On code changes**: CI runs tests and lint checks

### Monitoring

- Check the **Actions** tab for workflow run status
- Failed pipeline runs will show as red in the workflow history
- Individual collector failures are logged but do not fail the pipeline

### Manual Pipeline Trigger

To run the pipeline outside the daily schedule:

1. Go to **Actions** > **Daily Pipeline**
2. Click **Run workflow** and select the `main` branch

---

## Troubleshooting

### Pipeline fails with "No module named 'sentinel'"

Ensure the `uv sync` step completed successfully. Check that `backend/pyproject.toml` is present and valid.

### Pipeline completes but no events are collected

- Check individual collector logs in the workflow output
- Source websites may be temporarily unavailable
- EIOS requires credentials (expected to return empty without them)
- Verify network access from GitHub Actions (rarely an issue)

### LLM analysis is skipped

- Verify the `ANTHROPIC_API_KEY` secret is set correctly
- Check for "No Anthropic API key configured" warnings in the pipeline logs
- Ensure the API key has sufficient credits

### Dashboard shows "No data"

- Verify `data/events/` contains JSON files in the repository
- Check that the Deploy Dashboard workflow ran after the pipeline committed data
- The frontend reads from `public/data/` which is copied from the root `data/` directory during build

### Dashboard build fails

- Check Node.js version (requires 20+)
- Verify `frontend/package-lock.json` is committed
- Check the build logs in the Deploy Dashboard workflow

### GitHub Pages shows 404

- Ensure Pages is enabled with **GitHub Actions** as the source
- Verify the Deploy Dashboard workflow completed successfully
- Check that `frontend/out/` was generated during the build

---

## Environment Variables Reference

All backend settings use the `SENTINEL_` prefix:

| Variable | Default | Set Via |
|----------|---------|---------|
| `SENTINEL_ANTHROPIC_API_KEY` | `""` | GitHub Secret `ANTHROPIC_API_KEY` |
| `SENTINEL_WHO_EIOS_API_KEY` | `""` | EIOS credential secret (if available) |
| `SENTINEL_DATA_DIR` | `data` | Workflow env (set to `../data`) |
| `SENTINEL_LOG_LEVEL` | `INFO` | Workflow env |
| `SENTINEL_MAPBOX_TOKEN` | `""` | GitHub Secret `MAPBOX_TOKEN` |
| `SENTINEL_API_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Backend env / deployment config |
| `SENTINEL_API_WRITE_KEY` | `""` | Backend env / secret manager (protects mutating API routes via `X-API-Key`) |
| `SENTINEL_ENABLE_WHO_DON` | `true` | Workflow env |
| `SENTINEL_ENABLE_WHO_EIOS` | `true` | Workflow env |
| `SENTINEL_ENABLE_PROMED` | `true` | Workflow env |
| `SENTINEL_ENABLE_ECDC` | `true` | Workflow env |
| `SENTINEL_ENABLE_WOAH` | `true` | Workflow env |

To disable a specific source, add an environment variable to the pipeline workflow:

```yaml
env:
  SENTINEL_ENABLE_WHO_EIOS: "false"
```

---

## Updating

To pull updates from the upstream repository:

```bash
git remote add upstream https://github.com/ORIGINAL_OWNER/sentinel.git
git fetch upstream
git merge upstream/main
git push
```

This preserves your `data/` directory (pipeline output) while incorporating code changes.
