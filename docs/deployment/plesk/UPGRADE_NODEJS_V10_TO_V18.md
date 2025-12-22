# Upgrade Node.js from v10 to v18 - Step by Step

## Current Problem

Your system is using **Node.js v10.24.0**, which is too old. Vite 6.3.5 requires **Node.js 18+**.

## Complete Upgrade Process

### Step 1: Remove Old Node.js

```bash
# Check current version (should show v10.24.0)
node --version
npm --version

# Remove old Node.js completely
dnf remove -y nodejs npm

# Clean up
dnf clean all
```

### Step 2: Install Node.js 18 LTS

```bash
# Add NodeSource repository for Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -

# Install Node.js 18
dnf install -y nodejs

# Verify installation
/usr/bin/node --version
/usr/bin/npm --version
```

**Expected output:**
- Node.js: `v18.x.x` or higher
- npm: `9.x.x` or higher

### Step 3: Refresh Shell Session

**CRITICAL:** You MUST refresh your shell or the old Node.js will still be used!

```bash
# Option 1: Reload bashrc
source ~/.bashrc

# Option 2: Start new shell
exec bash

# Option 3: Logout and login again (MOST RELIABLE)
# Just close your SSH session and reconnect
```

### Step 4: Verify New Version is Active

```bash
# Check version (should show v18.x.x now)
node --version

# Check which binary is being used
which node
# Should show: /usr/bin/node

# Test ES modules support
node -e "import('node:fs').then(() => console.log('✓ ES modules work!'))"
```

### Step 5: Clean and Rebuild Frontend

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Remove old build artifacts
rm -rf node_modules package-lock.json dist

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install

# Build frontend
npm run build
```

## One-Liner Complete Fix

```bash
dnf remove -y nodejs npm && \
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - && \
dnf install -y nodejs && \
/usr/bin/node --version && \
/usr/bin/npm --version
```

**Then logout and login again**, then:
```bash
node --version  # Should show v18.x.x
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Troubleshooting

### If `node --version` still shows v10 after installation

**Problem:** Shell is still using cached old Node.js

**Solution:**
```bash
# Clear command cache
hash -r

# Or logout and login again (most reliable)
# Close SSH session completely and reconnect

# Then verify
node --version
```

### If installation fails

**Check if curl is installed:**
```bash
which curl
# If not found:
dnf install -y curl
```

**Check if you have root access:**
```bash
whoami
# Should be: root
# If not, use: su -  or sudo
```

### If multiple Node.js versions exist

```bash
# Find all node binaries
which -a node

# Check each one
/usr/bin/node --version
/usr/local/bin/node --version

# Use the one that shows v18.x.x
# Or remove old ones:
dnf remove -y nodejs npm
# Then reinstall
```

## Verification Checklist

After upgrade, verify:

- [ ] `node --version` shows `v18.x.x` or higher
- [ ] `npm --version` shows `9.x.x` or higher
- [ ] `which node` shows `/usr/bin/node`
- [ ] ES modules test passes: `node -e "import('node:fs').then(() => console.log('OK'))"`
- [ ] `npm run build` completes successfully

## Alternative: Build Locally

If upgrading on server is too difficult, build locally and upload:

**On your local machine (with Node.js 18+):**
```bash
cd frontend
echo "VITE_URL=https://blissful-spence.82-165-44-164.plesk.page" > .env.production
npm install
npm run build
```

**Upload dist folder:**
```bash
# Using SCP
scp -r dist/* root@your-server:/var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/

# Or use SFTP/FTP client
```

## Summary

**The issue:** Node.js v10.24.0 is too old for Vite 6.3.5

**The fix:** Upgrade to Node.js 18+

**Critical step:** After installing, **logout and login again** or the old version will still be used!

