# Verify Node.js Installation - Fix PATH Issues

## Problem

Even after installing Node.js 18+, you still get `SyntaxError: Unexpected token {`. This usually means:
1. Node.js wasn't actually upgraded
2. You're using a different Node.js binary (old version)
3. PATH isn't updated to use the new Node.js

## Step 1: Check What Node.js is Actually Being Used

```bash
# Check Node.js version
node --version

# Check which Node.js binary is being used
which node

# Check all Node.js installations
whereis node

# Check npm version
npm --version
which npm
```

## Step 2: Check if Node.js 18+ is Installed

```bash
# Check if Node.js 18+ exists
/usr/bin/node --version
/usr/local/bin/node --version

# List all node binaries
find /usr -name node 2>/dev/null
find /usr/local -name node 2>/dev/null
```

## Step 3: Verify Installation

```bash
# Check if NodeSource repository was added
cat /etc/yum.repos.d/nodesource*.repo

# Check installed Node.js packages
rpm -qa | grep nodejs
dnf list installed | grep nodejs
```

## Step 4: Fix PATH Issues

If Node.js 18+ is installed but not being used:

```bash
# Check current PATH
echo $PATH

# Check which node is first in PATH
which -a node

# Add Node.js to PATH (if needed)
export PATH=/usr/bin:$PATH

# Or if Node.js is in /usr/local/bin
export PATH=/usr/local/bin:$PATH

# Verify it works
node --version
```

## Step 5: Reinstall Node.js 18+ Properly

```bash
# Remove ALL Node.js installations
dnf remove -y nodejs npm

# Clean up
dnf clean all

# Install Node.js 18 from NodeSource
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -

# Install Node.js
dnf install -y nodejs

# Verify installation
/usr/bin/node --version
/usr/bin/npm --version

# Should show v18.x.x or higher
```

## Step 6: Make Sure You're Using the Right Node.js

```bash
# Check current node version
node --version

# If it's still old, explicitly use the new one
/usr/bin/node --version

# Create an alias or update PATH permanently
echo 'export PATH=/usr/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Or create a symlink (if needed)
# ln -sf /usr/bin/node /usr/local/bin/node
```

## Step 7: Test ES Modules Support

```bash
# Test if Node.js supports modern syntax
node -e "import('node:fs').then(() => console.log('ES modules work!'))"

# If this fails, Node.js is still too old
```

## Step 8: Rebuild Frontend

Once Node.js 18+ is confirmed:

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Clean everything
rm -rf node_modules package-lock.json dist

# Clear npm cache
npm cache clean --force

# Reinstall
npm install

# Build
npm run build
```

## Common Issues and Solutions

### Issue: "node --version" shows old version after installation

**Solution:**
```bash
# Refresh shell
source ~/.bashrc
# Or logout and login again

# Or explicitly use full path
/usr/bin/node --version
```

### Issue: Multiple Node.js installations

**Solution:**
```bash
# Find all node binaries
which -a node

# Remove old ones
dnf remove -y nodejs npm

# Keep only the new one
which node
# Should point to /usr/bin/node
```

### Issue: Node.js installed but not in PATH

**Solution:**
```bash
# Check where Node.js is installed
find /usr -name node 2>/dev/null | grep bin

# Add to PATH
export PATH=/usr/bin:$PATH

# Make permanent
echo 'export PATH=/usr/bin:$PATH' >> ~/.bashrc
```

### Issue: Installation succeeded but still old version

**Solution:**
```bash
# Check if old Node.js is cached
hash -r

# Or restart shell session
exec bash

# Verify again
node --version
```

## Complete Verification Script

Run this to check everything:

```bash
echo "=== Node.js Version Check ==="
node --version
npm --version

echo ""
echo "=== Node.js Binary Location ==="
which node
which npm

echo ""
echo "=== All Node.js Binaries ==="
which -a node

echo ""
echo "=== Installed Node.js Packages ==="
rpm -qa | grep nodejs

echo ""
echo "=== Test ES Modules ==="
node -e "import('node:fs').then(() => console.log('✓ ES modules work!')).catch(e => console.log('✗ ES modules failed:', e.message))"
```

## Expected Output After Fix

```
=== Node.js Version Check ===
v18.20.4
10.8.2

=== Node.js Binary Location ===
/usr/bin/node
/usr/bin/npm

=== Test ES Modules ===
✓ ES modules work!
```

## If Still Not Working

### Option 1: Use Full Path Explicitly

```bash
# Use full path to Node.js
/usr/bin/node --version

# Update npm to use full path
alias node='/usr/bin/node'
alias npm='/usr/bin/npm'

# Then try build
npm run build
```

### Option 2: Install via NVM (Node Version Manager)

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell
source ~/.bashrc

# Install Node.js 18
nvm install 18
nvm use 18

# Verify
node --version

# Build
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend
npm run build
```

### Option 3: Build Locally and Upload

If server Node.js upgrade is too difficult:

**On your local machine (with Node.js 18+):**
```bash
cd frontend
echo "VITE_URL=https://blissful-spence.82-165-44-164.plesk.page" > .env.production
npm install
npm run build
```

**Upload dist folder to server:**
```bash
scp -r dist/* user@server:/var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/
```

## Quick Fix Command

Try this complete fix:

```bash
# Remove old Node.js
dnf remove -y nodejs npm

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
dnf install -y nodejs

# Refresh shell
hash -r
source ~/.bashrc

# Verify
node --version
npm --version

# Should show v18.x.x and 9.x.x or higher
```

If `node --version` still shows old version, logout and login again, or restart your SSH session.

