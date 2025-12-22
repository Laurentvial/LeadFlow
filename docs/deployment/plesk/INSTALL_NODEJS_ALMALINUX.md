# Install Node.js and npm on AlmaLinux

## Quick Install

### Method 1: From Default Repositories (Easiest)

```bash
# Install Node.js and npm
dnf install -y nodejs npm

# Verify installation
node --version
npm --version
```

### Method 2: Install Node.js 18+ from NodeSource (Recommended)

```bash
# Install Node.js 18 LTS
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
dnf install -y nodejs

# Verify installation
node --version
npm --version
```

### Method 3: Install Node.js 20+ (Latest)

```bash
# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs

# Verify installation
node --version
npm --version
```

## One-Liner Install (Node.js 18)

```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - && dnf install -y nodejs && node --version && npm --version
```

## After Installation

Once Node.js is installed, run the deployment script again:

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs
./plesk-deploy.sh
```

## Troubleshooting

**If curl is not found:**
```bash
dnf install -y curl
```

**If you get permission errors:**
```bash
# Run as root
su -
# Or use sudo
sudo dnf install -y nodejs npm
```

**Check if Node.js is already installed:**
```bash
which node
which npm
node --version
npm --version
```

**Uninstall old version (if needed):**
```bash
dnf remove -y nodejs npm
# Then install new version using methods above
```

## Recommended Version

For this project, Node.js 18+ is recommended. The frontend build should work with Node.js 16+, but 18+ is preferred.

