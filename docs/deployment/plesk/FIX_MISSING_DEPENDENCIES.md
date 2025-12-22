# Fix Missing Dependencies Error

## Problem

Build error: `Rollup failed to resolve import "date-fns" from react-day-picker`

**Cause:** `date-fns` is a peer dependency of `react-day-picker` but wasn't installed.

## Quick Fix

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Install missing dependency
npm install date-fns

# Try build again
npm run build
```

## Complete Fix (Install All Missing Dependencies)

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Clean install to ensure all dependencies are installed
rm -rf node_modules package-lock.json

# Reinstall all dependencies
npm install

# Install missing peer dependencies
npm install date-fns

# Build
npm run build
```

## Update package.json (Optional but Recommended)

To prevent this issue in the future, add `date-fns` to `package.json`:

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Install and save to package.json
npm install date-fns --save
```

This will add `date-fns` to your dependencies list.

## Verify Installation

```bash
# Check if date-fns is installed
npm list date-fns

# Should show: date-fns@3.x.x
```

## Common Missing Dependencies

If you encounter similar errors for other packages, install them:

```bash
# Example: if another dependency is missing
npm install <package-name>

# Then rebuild
npm run build
```

## After Fixing

Once `date-fns` is installed:

```bash
# Build should now succeed
npm run build

# Verify dist folder was created
ls -la dist/
```

## Summary

**The issue:** `date-fns` peer dependency missing

**The fix:** `npm install date-fns`

**Prevention:** Add it to `package.json` dependencies

