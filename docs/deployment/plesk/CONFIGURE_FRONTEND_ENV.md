# Configure Frontend Environment Variables

## VITE_URL Configuration

The `VITE_URL` environment variable should point to your **base domain**, NOT `/api/`.

### Correct Configuration

```bash
# In frontend/.env.production (for production build)
VITE_URL=https://blissful-spence.82-165-44-164.plesk.page
```

**Important:** 
- ✅ Use the base domain (no trailing slash, no `/api/`)
- ✅ Use `https://` if SSL is enabled
- ✅ Use `http://` if SSL is not enabled yet

### Why?

The frontend code automatically appends `/api/` when making API calls:

```typescript
// In api.ts
const apiUrl = getEnvVar('VITE_URL') || 'http://127.0.0.1:8000';

// API calls use:
fetch(`${apiUrl}/api/token/refresh/`)  // Appends /api/
fetch(`${apiUrl}${endpoint}`)           // endpoint already includes /api/
```

So if `VITE_URL=https://blissful-spence.82-165-44-164.plesk.page`, the API calls will go to:
- `https://blissful-spence.82-165-44-164.plesk.page/api/...`

## Setup Steps

### Step 1: Create/Update .env.production

**On your server:**

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Create production environment file
cat > .env.production << 'EOF'
VITE_URL=https://blissful-spence.82-165-44-164.plesk.page
EOF
```

**Or on your local machine:**

```bash
cd frontend
echo "VITE_URL=https://blissful-spence.82-165-44-164.plesk.page" > .env.production
```

### Step 2: Rebuild Frontend

**Important:** You must rebuild after changing environment variables!

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Rebuild with new environment
npm run build
```

### Step 3: Verify

After rebuilding, check the built files:

```bash
# Check if dist folder was updated
ls -la dist/

# The build should now use the correct API URL
```

## Common Mistakes

### ❌ Wrong: Including /api/

```bash
VITE_URL=https://blissful-spence.82-165-44-164.plesk.page/api/
```

**Problem:** API calls will go to `/api//api/...` (double `/api/`)

### ❌ Wrong: Trailing slash

```bash
VITE_URL=https://blissful-spence.82-165-44-164.plesk.page/
```

**Problem:** Can cause double slashes in URLs

### ❌ Wrong: Using http:// when SSL is enabled

```bash
VITE_URL=http://blissful-spence.82-165-44-164.plesk.page
```

**Problem:** Mixed content warnings, CORS issues

### ✅ Correct

```bash
VITE_URL=https://blissful-spence.82-165-44-164.plesk.page
```

## Environment Files

### .env.production (Production Build)

```bash
VITE_URL=https://blissful-spence.82-165-44-164.plesk.page
```

### .env.local (Local Development)

```bash
VITE_URL=http://127.0.0.1:8000
```

### .env (Default/Development)

```bash
VITE_URL=http://127.0.0.1:8000
```

## Quick Fix

If you already built with wrong `VITE_URL`:

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Update .env.production
echo "VITE_URL=https://blissful-spence.82-165-44-164.plesk.page" > .env.production

# Rebuild
npm run build

# Done!
```

## Verify Configuration

After rebuilding, test in browser:

1. Open browser console (F12)
2. Go to Network tab
3. Use your application
4. Check API calls - they should go to:
   - `https://blissful-spence.82-165-44-164.plesk.page/api/...`

## Summary

**Correct `VITE_URL`:**
```
VITE_URL=https://blissful-spence.82-165-44-164.plesk.page
```

**Remember:**
- ✅ Base domain only (no `/api/`)
- ✅ No trailing slash
- ✅ Use `https://` if SSL enabled
- ✅ Rebuild after changing!

