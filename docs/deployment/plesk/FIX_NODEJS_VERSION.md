# Fix Node.js Version Error - Upgrade to Node.js 18+

## Problem

**Error:** `SyntaxError: Unexpected token {` when running `npm run build`

**Cause:** Your Node.js version is too old. Vite 6.3.5 requires Node.js 18+.

## Quick Fix: Install Node.js 18 LTS

### Step 1: Check Current Node.js Version

```bash
node --version
npm --version
```

If you see something like `v12.x.x` or `v14.x.x`, you need to upgrade.

### Step 2: Install Node.js 18 LTS

**For AlmaLinux/CentOS/RHEL (Most Plesk servers):**

```bash
# Remove old Node.js (if needed)
dnf remove -y nodejs npm

# Install Node.js 18 from NodeSource
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
dnf install -y nodejs

# Verify installation
node --version
npm --version
```

**Expected output:**
- Node.js: `v18.x.x` or higher
- npm: `9.x.x` or higher

### Step 3: Rebuild Frontend

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Clean install (optional but recommended)
rm -rf node_modules package-lock.json
npm install

# Build frontend
npm run build
```

## One-Liner Install (Quick)

```bash
dnf remove -y nodejs npm && curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - && dnf install -y nodejs && node --version && npm --version
```

## Alternative: Install Node.js 20 (Latest)

If you want the latest version:

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs
```

## Troubleshooting

### "curl: command not found"

```bash
# Install curl first
dnf install -y curl
```

### "Permission denied"

You need root access. If you're not root:

```bash
# Switch to root
su -

# Or use sudo (if available)
sudo dnf install -y nodejs npm
```

### Node.js still shows old version after installation

```bash
# Refresh your shell
source ~/.bashrc

# Or logout and login again

# Check which node is being used
which node

# Should show: /usr/bin/node
```

### Installation fails

**Try installing from default repositories (may be older):**

```bash
dnf install -y nodejs npm
node --version
```

If it's still too old (less than v18), you must use NodeSource method above.

## Verify It Works

After installing Node.js 18+:

```bash
# Check version
node --version  # Should be v18.x.x or higher

# Test ES modules support
node -e "import('node:fs').then(() => console.log('ES modules work!'))"

# Try building again
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend
npm run build
```

## Version Requirements

| Tool | Minimum Version | Recommended |
|------|----------------|-------------|
| Node.js | 18.0.0 | 18 LTS or 20 LTS |
| npm | 9.0.0 | Latest (comes with Node.js) |
| Vite | 6.3.5 | (already in package.json) |

## After Successful Installation

Once Node.js 18+ is installed:

1. ✅ Frontend build should work: `npm run build`
2. ✅ Deployment script will work: `./plesk-deploy.sh`
3. ✅ All npm commands will work properly

## Alternative: Build Locally

If you can't upgrade Node.js on the server, build locally and upload:

**On your local machine (with Node.js 18+):**

```bash
cd frontend
echo "VITE_URL=https://blissful-spence.82-165-44-164.plesk.page" > .env.production
npm install
npm run build
```

**Then upload `dist` folder to server:**

```bash
# Using SCP
scp -r dist/* user@server:/var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/

# Or use SFTP/FTP client
```

## Summary

**Quick fix:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - && dnf install -y nodejs
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend
npm run build
```

This should resolve the `SyntaxError: Unexpected token {` error!

