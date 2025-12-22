# GitHub Repository Setup Guide

## Problem
Your local Git repository is pointing to Plesk, not GitHub. GitHub Desktop can't find the repository because there's no GitHub remote configured.

## Solution: Set Up GitHub Remote

### Step 1: Create GitHub Repository (if you don't have one)

1. Go to https://github.com/new
2. Repository name: `LeadFlow` (or your preferred name)
3. Choose **Public** or **Private**
4. **DO NOT** initialize with README, .gitignore, or license (you already have code)
5. Click **Create repository**

### Step 2: Add GitHub Remote to Your Local Repository

**Option A: Using GitHub Desktop**
1. Open GitHub Desktop
2. Go to **Repository** → **Repository Settings** → **Remote**
3. Click **Add** or **Edit** for origin
4. Enter your GitHub repository URL: `https://github.com/yourusername/LeadFlow.git`
5. Click **Save**

**Option B: Using Command Line**
```powershell
# Remove the old Plesk remote (or keep it as a different name)
git remote remove origin

# Add GitHub as origin
git remote add origin https://github.com/yourusername/LeadFlow.git

# Verify it's set correctly
git remote -v
```

### Step 3: Push Your Code to GitHub

**Using GitHub Desktop:**
1. You should see "Publish branch" or "Push origin" button
2. Click it to push your code to GitHub

**Using Command Line:**
```powershell
# Push to GitHub
git push -u origin main

# If your branch is named 'master' instead:
git push -u origin master
```

### Step 4: Update Plesk with GitHub URL

After pushing to GitHub:
1. Go to Plesk → **Git** section
2. Edit your repository settings
3. Change Repository URL to: `https://github.com/yourusername/LeadFlow.git`
4. Click **OK**
5. Click **Pull** to fetch from GitHub

## Keep Both Remotes (Optional)

If you want to keep both Plesk and GitHub remotes:

```powershell
# Keep GitHub as origin
git remote set-url origin https://github.com/yourusername/LeadFlow.git

# Add Plesk as a separate remote
git remote add plesk https://blissful-spence_81c8zbi6itn@blissful-spence.82-165-44-164.plesk.page/plesk-git/leadflow-blissful-spence.git

# Now you can push to both:
git push origin main      # Push to GitHub
git push plesk main       # Push to Plesk (if needed)
```

## Troubleshooting

**"Repository not found" error:**
- Make sure the GitHub repository exists
- Check the URL is correct (case-sensitive)
- Verify you have access to the repository

**"Permission denied" error:**
- Use HTTPS with personal access token
- Or set up SSH keys for GitHub

**"Branch not found" error:**
- Make sure you're on the correct branch: `git branch`
- If using 'master', change to 'main': `git branch -M main`

