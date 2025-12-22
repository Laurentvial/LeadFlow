# Frontend Deployment Guide for Plesk

This guide will help you build and deploy the frontend to your Plesk server.

## Prerequisites

- Node.js and npm installed on your server (or build locally and upload)
- Backend is already running and accessible
- SSH access to your server

## Step 1: Build the Frontend

### Option A: Build on Server (Recommended if Node.js is available)

**Via SSH:**

```bash
# Navigate to project root
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs

# Navigate to frontend directory
cd frontend

# Check if Node.js is installed
node --version
npm --version

# If Node.js is not installed, you'll need to install it or build locally
```

**If Node.js is installed:**

```bash
# Install dependencies (if not already installed)
npm install

# Create production environment file
cat > .env.production << 'EOF'
VITE_URL=https://blissful-spence.82-165-44-164.plesk.page
EOF

# Build for production
npm run build
```

**Verify build:**

```bash
# Check if dist folder was created
ls -la dist/

# Should see index.html and assets folder
```

### Option B: Build Locally and Upload

**On your local machine:**

```bash
# Navigate to frontend directory
cd frontend

# Create production environment file
echo "VITE_URL=https://blissful-spence.82-165-44-164.plesk.page" > .env.production

# Install dependencies
npm install

# Build for production
npm run build

# The dist folder will be created
```

**Then upload the `dist` folder to your server:**

```bash
# Using SCP (from your local machine)
scp -r dist/* user@your-server:/var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/

# Or use SFTP/FTP client to upload the dist folder contents
```

## Step 2: Configure Plesk to Serve Frontend

### Option A: Set Document Root to Frontend (Easiest)

1. **Plesk Panel** → **Websites & Domains** → Your domain
2. Click **Hosting Settings** (or **Hosting & DNS** → **Hosting Settings**)
3. Find **Document root** field
4. Change it to: `/httpdocs/frontend/dist`
5. Click **OK** or **Apply**

**Note:** This makes the frontend the main site. API calls to `/api/` will still work via nginx proxy.

### Option B: Keep Default Document Root (More Complex)

If you want to keep the default document root, you'll need to configure nginx/apache to serve the frontend.

**For Nginx:**
- The nginx configuration should already handle this if you've set it up
- Make sure document root points to `frontend/dist` OR configure a location block

**For Apache:**
- Use `.htaccess` file (see `docs/deployment/plesk/plesk.htaccess`)

## Step 3: Configure Frontend Environment Variables

The frontend needs to know where the backend API is located.

### Create `.env.production` file:

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Create production environment file
cat > .env.production << 'EOF'
VITE_URL=https://blissful-spence.82-165-44-164.plesk.page
EOF
```

**Important:** 
- Use `https://` if you have SSL enabled
- Use `http://` if SSL is not enabled yet
- Replace `blissful-spence.82-165-44-164.plesk.page` with your actual domain

### Rebuild after changing environment:

```bash
cd frontend
npm run build
```

## Step 4: Verify Frontend Deployment

### Check files exist:

```bash
# Check if dist folder exists and has files
ls -la /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend/dist/

# Should see:
# - index.html
# - assets/ folder
# - images/ folder (if any)
```

### Test in browser:

1. Visit: `https://blissful-spence.82-165-44-164.plesk.page`
2. Frontend should load
3. Check browser console (F12) for any errors
4. Try logging in or accessing features

### Common Issues:

**Frontend shows blank page:**
- Check browser console for errors
- Verify `dist/index.html` exists
- Check if API calls are working (Network tab in browser)

**API calls failing:**
- Verify backend is running: `curl http://127.0.0.1:8000/api/health/`
- Check nginx proxy configuration
- Verify CORS settings in backend

**404 errors for routes:**
- Frontend needs to serve `index.html` for all routes (SPA routing)
- Check nginx/apache configuration for proper rewrite rules

## Step 5: Update Frontend After Changes

Whenever you make changes to the frontend:

```bash
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Pull latest code (if using git)
git pull origin main

# Install any new dependencies
npm install

# Rebuild
npm run build

# Frontend is now updated!
```

## Quick Reference Commands

```bash
# Navigate to frontend
cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/frontend

# Build frontend
npm run build

# Check build output
ls -la dist/

# View frontend logs (if any)
tail -f ~/backend.log

# Check if frontend files are accessible
curl https://blissful-spence.82-165-44-164.plesk.page/
```

## Troubleshooting

### "npm: command not found"

**Solution:** Node.js is not installed on the server.

**Option 1:** Install Node.js on server (requires sudo or hosting provider):
```bash
# On CentOS/RHEL/AlmaLinux
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
dnf install -y nodejs

# On Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
```

**Option 2:** Build locally and upload `dist` folder

### "Build failed" or "Module not found"

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Frontend loads but API calls fail

**Check:**
1. Backend is running: `ps aux | grep daphne`
2. API endpoint works: `curl http://127.0.0.1:8000/api/health/`
3. Nginx proxy is configured correctly
4. CORS is enabled in backend settings

### Frontend shows old version

**Solution:**
1. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
2. Rebuild frontend: `npm run build`
3. Check if new files are in `dist/` folder

### Routes return 404 (React Router)

**Solution:** Configure web server to serve `index.html` for all routes:

**For Nginx:** Already handled if document root is set correctly

**For Apache:** Add to `.htaccess`:
```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_URL` | Backend API URL | `https://your-domain.com` |

**Note:** Variables prefixed with `VITE_` are available in the frontend code.

## File Structure After Deployment

```
httpdocs/
├── backend/
│   ├── manage.py
│   ├── backend/
│   └── ...
├── frontend/
│   ├── dist/              ← Built frontend files (served by web server)
│   │   ├── index.html
│   │   ├── assets/
│   │   └── images/
│   ├── src/               ← Source files (not needed in production)
│   ├── package.json
│   └── .env.production    ← Environment variables
└── ...
```

## Next Steps

After frontend is deployed:

1. ✅ Test all features
2. ✅ Verify API connectivity
3. ✅ Test authentication/login
4. ✅ Check mobile responsiveness
5. ✅ Enable SSL/HTTPS (if not already)
6. ✅ Set up monitoring/logging

## Summary

**Quick deployment steps:**

1. Build frontend: `cd frontend && npm run build`
2. Set document root in Plesk to `/httpdocs/frontend/dist`
3. Verify: Visit your domain in browser
4. Done! 🎉

If you encounter issues, check the troubleshooting section above.

