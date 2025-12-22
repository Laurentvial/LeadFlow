# Upgrade Node.js on AlmaLinux

## Problem
Your Node.js version is too old. Vite requires Node.js 14.18+ (preferably 18+).

**Error:** `SyntaxError: Unexpected token {` - This means Node.js doesn't support ES modules.

## Solution: Install Node.js 18 LTS

### Step 1: Remove Old Node.js (if needed)

```bash
# Check current version
node --version

# Remove old version
dnf remove -y nodejs npm

# Clean up
dnf clean all
```

### Step 2: Install Node.js 18 LTS

```bash
# Install Node.js 18 from NodeSource
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
dnf install -y nodejs

# Verify installation
node --version
npm --version
```

**Expected output:**
- Node.js: v18.x.x or higher
- npm: 9.x.x or higher

### Step 3: Verify Installation

```bash
# Check versions
node --version
npm --version

# Test ES modules support
node -e "console.log('ES modules work!')"
```

### Step 4: Run Deployment Again

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs
./plesk-deploy.sh
```

## One-Liner Install

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

**If curl is not found:**
```bash
dnf install -y curl
```

**If you get "command not found" after installation:**
```bash
# Refresh PATH
source ~/.bashrc
# Or logout and login again
```

**Check Node.js installation path:**
```bash
which node
which npm
```

**If installation fails:**
```bash
# Try installing from default repos (may be older version)
dnf install -y nodejs npm
# Then check version
node --version
```

## Version Requirements

- **Minimum:** Node.js 14.18+ (for Vite)
- **Recommended:** Node.js 18 LTS (long-term support)
- **Latest:** Node.js 20+ (current stable)

## After Installation

The deployment script will automatically detect the new Node.js version and proceed with the frontend build.

