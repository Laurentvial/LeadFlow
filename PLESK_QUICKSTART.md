# Plesk Deployment Quick Start Guide

## 🚀 Quick Deployment Steps

### 1. Initial Setup (One-time)

1. **In Plesk Panel:**
   - Go to **Git** → Add repository: `https://blissful-spence_81c8zbi6itn@blissful-spence.82-165-44-164.plesk.page/plesk-git/leadflow-blissful-spence.git`
   - Enable **Python** support (Python 3.12)
   - Create **PostgreSQL** database
   - Set application root to `/backend`

2. **Set Environment Variables:**
   - Go to **Python** → **Environment Variables**
   - Copy variables from `plesk-env-template.txt`
   - Replace all placeholder values

3. **SSH into your server and run:**
   ```bash
   cd /var/www/vhosts/your-domain.com/httpdocs
   git pull origin main
   chmod +x plesk-deploy.sh
   ./plesk-deploy.sh
   ```

### 2. Configure Web Server

**For Apache:**
- Copy `plesk.htaccess` content to your `.htaccess` file
- Update paths to match your domain

**For Nginx:**
- Add `plesk-nginx.conf` content to **Nginx Directives** in Plesk
- Update paths to match your domain

### 3. Start Application

**Option A: Using Passenger (Recommended)**
- Plesk will use `passenger_wsgi.py` automatically
- Just ensure Python is enabled in Plesk

**Option B: Using Systemd**
```bash
sudo cp leadflow.service /etc/systemd/system/
sudo nano /etc/systemd/system/leadflow.service  # Edit paths
sudo systemctl daemon-reload
sudo systemctl enable leadflow
sudo systemctl start leadflow
```

### 4. Verify Deployment

- ✅ Visit your domain - frontend should load
- ✅ Check `/api/health/` - API should respond
- ✅ Check `/admin/` - Admin panel should work
- ✅ Check `/static/` - Static files should load

## 📋 Files Created

- `PLESK_DEPLOYMENT.md` - Complete deployment guide
- `plesk-deploy.sh` - Automated deployment script
- `plesk-start.sh` - Application startup script
- `passenger_wsgi.py` - Passenger WSGI entry point
- `plesk.htaccess` - Apache configuration
- `plesk-nginx.conf` - Nginx configuration
- `plesk-env-template.txt` - Environment variables template
- `leadflow.service` - Systemd service file

## 🔧 Common Commands

```bash
# Deploy updates
./plesk-deploy.sh

# View logs (if using systemd)
sudo journalctl -u leadflow -f

# Restart application (if using systemd)
sudo systemctl restart leadflow

# Run migrations manually
cd backend && python manage.py migrate

# Create superuser
cd backend && python manage.py createsuperuser

# Collect static files
cd backend && python manage.py collectstatic --noinput
```

## ⚠️ Important Notes

1. **Replace all placeholders** in configuration files:
   - `your-domain.com` → Your actual domain
   - `your-plesk-user` → Your Plesk username
   - Database credentials → Your actual database details

2. **Generate a new SECRET_KEY:**
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(50))"
   ```

3. **Set DEBUG=False** in production environment variables

4. **Enable HTTPS** in Plesk for security

## 🆘 Troubleshooting

**Application won't start:**
- Check Python logs in Plesk
- Verify environment variables are set
- Check database connection

**Static files not loading:**
- Run `python manage.py collectstatic --noinput`
- Check file permissions: `chmod -R 755 staticfiles/`
- Verify web server configuration

**Frontend not loading:**
- Verify frontend build completed: `ls -la frontend/dist/`
- Check web server configuration for frontend serving

For detailed troubleshooting, see `PLESK_DEPLOYMENT.md`.

