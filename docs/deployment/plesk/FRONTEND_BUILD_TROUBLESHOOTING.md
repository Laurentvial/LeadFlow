# Frontend Build Troubleshooting Guide

## Common Build Errors and Solutions

### 1. Check Node.js Version First

```bash
node --version
npm --version
```

**Must be:** Node.js 18+ and npm 9+

If not, upgrade:
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
dnf install -y nodejs
```

---

## Error: "Cannot find module" or "Module not found"

### Solution: Clean install

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Remove old dependencies
rm -rf node_modules package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall
npm install

# Try build again
npm run build
```

---

## Error: TypeScript errors

### Solution: Check TypeScript configuration

```bash
# Check if tsconfig.json exists
ls -la frontend/tsconfig.json

# If missing, create basic one:
cat > frontend/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF
```

---

## Error: "Out of memory" or "JavaScript heap out of memory"

### Solution: Increase Node.js memory

```bash
# Set Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Then build
npm run build
```

**Or add to package.json scripts:**
```json
"build": "NODE_OPTIONS='--max-old-space-size=4096' vite build"
```

---

## Error: "ENOENT: no such file or directory"

### Solution: Check file paths

```bash
# Make sure you're in the right directory
pwd
# Should be: /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Check if required files exist
ls -la package.json
ls -la vite.config.ts
ls -la src/
```

---

## Error: "Permission denied"

### Solution: Fix permissions

```bash
# Check current user
whoami

# Fix ownership (replace USERNAME with your actual username)
chown -R USERNAME:USERNAME /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Fix permissions
chmod -R 755 /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend
```

---

## Error: "SyntaxError" or "Unexpected token"

### Solution: Check Node.js version and dependencies

```bash
# Verify Node.js version (must be 18+)
node --version

# Check if all dependencies are installed
npm list --depth=0

# Reinstall if needed
rm -rf node_modules package-lock.json
npm install
```

---

## Error: Build succeeds but dist folder is empty

### Solution: Check build output

```bash
# Check if dist folder was created
ls -la dist/

# Check build logs for warnings
npm run build 2>&1 | tee build.log

# Check the log file
cat build.log
```

---

## Error: "Failed to resolve import" or "Cannot resolve"

### Solution: Check imports and aliases

```bash
# Verify vite.config.ts exists and is valid
cat vite.config.ts

# Check if path aliases are correct
grep -r "@/" src/ | head -5

# Make sure vite.config.ts has the '@' alias configured
```

---

## Error: Environment variables not working

### Solution: Create .env.production

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Create production environment file
cat > .env.production << 'EOF'
VITE_URL=https://blissful-spence.82-165-44-164.plesk.page
EOF

# Rebuild
npm run build
```

**Note:** Variables must start with `VITE_` to be available in the frontend.

---

## Error: "PostCSS" or "Tailwind" errors

### Solution: Check PostCSS and Tailwind config

```bash
# Check if postcss.config.js exists
ls -la postcss.config.js

# Check if tailwind.config.js exists
ls -la tailwind.config.js

# If missing, they might be in package.json or need to be created
```

---

## Complete Clean Build Process

If nothing else works, try a complete clean build:

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# 1. Remove all generated files
rm -rf node_modules package-lock.json dist build .vite

# 2. Clear npm cache
npm cache clean --force

# 3. Verify Node.js version
node --version  # Must be 18+

# 4. Reinstall dependencies
npm install

# 5. Create environment file
cat > .env.production << 'EOF'
VITE_URL=https://blissful-spence.82-165-44-164.plesk.page
EOF

# 6. Build with verbose output
npm run build -- --debug

# 7. Check output
ls -la dist/
```

---

## Debug Mode: Get More Information

```bash
# Build with verbose output
npm run build -- --debug

# Or check npm logs
npm run build 2>&1 | tee build-error.log
cat build-error.log
```

---

## Check Specific Issues

### Verify all dependencies are compatible:

```bash
# Check for outdated packages
npm outdated

# Check for security vulnerabilities
npm audit

# Fix vulnerabilities (if any)
npm audit fix
```

### Check TypeScript compilation:

```bash
# If you have TypeScript installed globally
tsc --noEmit

# Or check specific files
npx tsc --noEmit src/main.tsx
```

---

## Alternative: Build Locally and Upload

If build keeps failing on server, build locally:

**On your local machine:**

```bash
cd frontend

# Create production env
echo "VITE_URL=https://blissful-spence.82-165-44-164.plesk.page" > .env.production

# Clean install
rm -rf node_modules package-lock.json
npm install

# Build
npm run build

# Verify dist folder
ls -la dist/
```

**Then upload dist folder to server:**

```bash
# Using SCP
scp -r dist/* user@server:/var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/

# Or use SFTP/FTP client
```

---

## Still Having Issues?

Please provide:
1. **Exact error message** (copy/paste the full output)
2. **Node.js version:** `node --version`
3. **npm version:** `npm --version`
4. **OS:** `cat /etc/os-release`
5. **Build command output:** `npm run build 2>&1`

This will help diagnose the specific issue.

---

## Quick Checklist

- [ ] Node.js 18+ installed
- [ ] npm 9+ installed
- [ ] In correct directory (`frontend/`)
- [ ] `node_modules` exists
- [ ] `.env.production` file created
- [ ] No permission errors
- [ ] Sufficient disk space: `df -h`
- [ ] Sufficient memory: `free -h`

