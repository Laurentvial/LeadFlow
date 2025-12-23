# GitHub Actions Deployment Setup

This guide explains how to set up automated Heroku deployments using GitHub Actions.

## Prerequisites

1. GitHub repository: https://github.com/Laurentvial/LeadFlow
2. Heroku app: `leadflow-backend-eu`
3. Heroku API key

## Setup Steps

### Step 1: Get Your Heroku API Key

1. Go to: https://dashboard.heroku.com/account
2. Scroll down to "API Key" section
3. Click "Reveal" to show your API key
4. Copy the API key (you'll need it in the next step)

### Step 2: Add GitHub Secrets

1. Go to your GitHub repository: https://github.com/Laurentvial/LeadFlow
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

   **Secret 1: HEROKU_API_KEY**
   - Name: `HEROKU_API_KEY`
   - Value: (paste your Heroku API key from Step 1)
   - Click **Add secret**

   **Secret 2: HEROKU_EMAIL**
   - Name: `HEROKU_EMAIL`
   - Value: (your Heroku account email address)
   - Click **Add secret**

### Step 3: Verify Workflow File

The workflow file is located at: `.github/workflows/deploy-heroku.yml`

It will automatically:
- Deploy when you push to `main` branch
- Deploy when backend files change
- Run database migrations
- Collect static files
- Restart Heroku dynos

### Step 4: Test the Deployment

1. Make a small change to any file in the `backend/` directory
2. Commit and push to GitHub:
   ```powershell
   git add backend/
   git commit -m "Test GitHub Actions deployment"
   git push origin main
   ```
3. Go to: https://github.com/Laurentvial/LeadFlow/actions
4. You should see a workflow run called "Deploy to Heroku"
5. Click on it to see the deployment progress

### Step 5: Manual Deployment (Optional)

You can also trigger deployments manually:

1. Go to: https://github.com/Laurentvial/LeadFlow/actions
2. Click on "Deploy to Heroku" workflow
3. Click "Run workflow" button
4. Select branch: `main`
5. Click "Run workflow"

## How It Works

The GitHub Actions workflow:

1. **Checks out your code** from GitHub
2. **Installs Heroku CLI** in the GitHub Actions runner
3. **Logs in to Heroku** using your API key
4. **Deploys your backend** to Heroku using the `heroku-deploy` action
5. **Runs migrations** automatically
6. **Collects static files** automatically
7. **Restarts dynos** to apply changes

## Troubleshooting

### Workflow Fails with "Invalid credentials"

- Verify `HEROKU_API_KEY` secret is set correctly
- Verify `HEROKU_EMAIL` secret matches your Heroku account email
- Regenerate your Heroku API key if needed

### Workflow Fails with "App not found"

- Verify the app name in `.github/workflows/deploy-heroku.yml` matches your Heroku app name
- Current app name: `leadflow-backend-eu`

### Migrations Fail

- Check Heroku logs: `heroku logs --tail --app leadflow-backend-eu`
- Verify database addon is attached to your Heroku app

### View Workflow Logs

1. Go to: https://github.com/Laurentvial/LeadFlow/actions
2. Click on the failed workflow run
3. Click on the "deploy" job
4. Expand each step to see detailed logs

## Benefits of GitHub Actions

✅ **Automated deployments** - No need to run commands manually  
✅ **Consistent process** - Same deployment steps every time  
✅ **History tracking** - See all deployments in GitHub Actions  
✅ **Easy rollback** - Can re-run previous deployments  
✅ **Team collaboration** - Anyone with push access can deploy  

## Alternative: Heroku GitHub Integration

If you prefer Heroku's built-in GitHub integration instead:

1. Go to: https://dashboard.heroku.com/apps/leadflow-backend-eu/deploy/github
2. Connect your GitHub repository
3. Enable automatic deploys from `main` branch

This method doesn't require GitHub Actions or secrets setup.

