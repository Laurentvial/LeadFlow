# Install Node.js 18+ Without dnf/yum

## Problem

Your system doesn't have `dnf`, `yum`, or `microdnf` package managers. We need alternative methods to install Node.js 18+.

## Step 1: Check What Package Manager You Have

```bash
# Check available package managers
which apt-get
which yum
which dnf
which pacman
which zypper

# Check OS type
cat /etc/os-release
uname -a
```

## Step 2: Alternative Installation Methods

### Method 1: Install from Binary (Works on Any Linux)

This is the most reliable method that works on any Linux system:

```bash
# Create directory for Node.js
mkdir -p /usr/local/lib/nodejs

# Download Node.js 18 LTS binary
cd /tmp
wget https://nodejs.org/dist/v18.20.4/node-v18.20.4-linux-x64.tar.xz

# Extract
tar -xJf node-v18.20.4-linux-x64.tar.xz

# Move to system location
mv node-v18.20.4-linux-x64 /usr/local/lib/nodejs/node-v18.20.4

# Create symlinks
ln -sf /usr/local/lib/nodejs/node-v18.20.4/bin/node /usr/local/bin/node
ln -sf /usr/local/lib/nodejs/node-v18.20.4/bin/npm /usr/local/bin/npm
ln -sf /usr/local/lib/nodejs/node-v18.20.4/bin/npx /usr/local/bin/npx

# Add to PATH (if not already there)
echo 'export PATH=/usr/local/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Verify installation
node --version
npm --version
```

### Method 2: Use NVM (Node Version Manager)

NVM doesn't require a package manager:

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell
source ~/.bashrc

# Install Node.js 18
nvm install 18
nvm use 18
nvm alias default 18

# Verify
node --version
npm --version
```

### Method 3: Check if Plesk Has Node.js Extension

Plesk might have Node.js available through its extension system:

1. **Plesk Panel** → **Tools & Settings** → **Updates and Upgrades**
2. Look for **Node.js** extension
3. Install if available

### Method 4: Use Plesk's Built-in Node.js (if available)

Some Plesk installations include Node.js:

```bash
# Check if Plesk has Node.js
/opt/plesk/nodejs/node --version
/usr/local/psa/bin/node --version

# If found, add to PATH
export PATH=/opt/plesk/nodejs:$PATH
```

## Complete Binary Installation Script

Here's a complete script to install Node.js 18 from binary:

```bash
#!/bin/bash

# Install Node.js 18 LTS from binary
NODE_VERSION="18.20.4"
INSTALL_DIR="/usr/local/lib/nodejs"
NODE_DIR="$INSTALL_DIR/node-v$NODE_VERSION-linux-x64"

# Create install directory
mkdir -p $INSTALL_DIR
cd /tmp

# Download Node.js
echo "Downloading Node.js v$NODE_VERSION..."
wget https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz

# Extract
echo "Extracting..."
tar -xJf node-v$NODE_VERSION-linux-x64.tar.xz

# Move to install location
echo "Installing..."
mv node-v$NODE_VERSION-linux-x64 $INSTALL_DIR/

# Create symlinks
echo "Creating symlinks..."
ln -sf $NODE_DIR/bin/node /usr/local/bin/node
ln -sf $NODE_DIR/bin/npm /usr/local/bin/npm
ln -sf $NODE_DIR/bin/npx /usr/local/bin/npx

# Add to PATH
if ! grep -q "/usr/local/bin" ~/.bashrc; then
    echo 'export PATH=/usr/local/bin:$PATH' >> ~/.bashrc
fi

# Verify
echo ""
echo "Verifying installation..."
/usr/local/bin/node --version
/usr/local/bin/npm --version

echo ""
echo "✓ Node.js installed successfully!"
echo "Run: source ~/.bashrc  (or logout/login) to use it"
```

**Save and run:**
```bash
# Save script
cat > /tmp/install-nodejs.sh << 'SCRIPT'
[paste script above]
SCRIPT

# Make executable
chmod +x /tmp/install-nodejs.sh

# Run it
/tmp/install-nodejs.sh

# Refresh shell
source ~/.bashrc

# Verify
node --version
```

## Quick One-Liner (Binary Install)

```bash
cd /tmp && \
wget https://nodejs.org/dist/v18.20.4/node-v18.20.4-linux-x64.tar.xz && \
tar -xJf node-v18.20.4-linux-x64.tar.xz && \
mv node-v18.20.4-linux-x64 /usr/local/lib/nodejs/ && \
ln -sf /usr/local/lib/nodejs/node-v18.20.4-linux-x64/bin/node /usr/local/bin/node && \
ln -sf /usr/local/lib/nodejs/node-v18.20.4-linux-x64/bin/npm /usr/local/bin/npm && \
echo 'export PATH=/usr/local/bin:$PATH' >> ~/.bashrc && \
source ~/.bashrc && \
node --version && \
npm --version
```

## After Installation

```bash
# Refresh shell
source ~/.bashrc
# OR logout and login again

# Verify
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x

# Build frontend
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Troubleshooting

### "wget: command not found"

```bash
# Try curl instead
curl -O https://nodejs.org/dist/v18.20.4/node-v18.20.4-linux-x64.tar.xz

# Or install wget (if you have a package manager)
# For apt-based systems:
apt-get update && apt-get install -y wget

# For other systems, you might need to ask your hosting provider
```

### "Permission denied"

Make sure you're running as root:
```bash
whoami
# Should be: root

# If not:
su -
```

### Node.js still not found after installation

```bash
# Check if symlinks were created
ls -la /usr/local/bin/node
ls -la /usr/local/bin/npm

# Check PATH
echo $PATH

# Add to PATH manually
export PATH=/usr/local/bin:$PATH

# Verify
which node
node --version
```

## Recommended: Use NVM

NVM is the easiest method if you don't have a package manager:

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell
source ~/.bashrc

# Install and use Node.js 18
nvm install 18
nvm use 18
nvm alias default 18

# Verify
node --version
npm --version
```

## Summary

**Best options:**
1. **NVM** (easiest, no package manager needed)
2. **Binary installation** (works on any Linux)
3. **Plesk extension** (if available)

**After installation:** Refresh shell (`source ~/.bashrc` or logout/login) and verify with `node --version`.

