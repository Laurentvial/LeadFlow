# Plesk Deployment Guide for LeadFlow

This guide will help you deploy LeadFlow (Django backend + React frontend) on Plesk.

## Prerequisites

- Plesk hosting with Python support
- PostgreSQL database (can be created in Plesk)
- Redis (optional, for WebSocket support)
- Git access configured in Plesk
- Node.js installed (for building frontend)

## Step 1: Initial Setup in Plesk

### 1.1 Create Domain/Subdomain
1. Log into Plesk
2. Create a new domain or subdomain for your application
3. Enable Git deployment:
   - Go to **Git** section
   - Add your repository: `https://blissful-spence_81c8zbi6itn@blissful-spence.82-165-44-164.plesk.page/plesk-git/leadflow-blissful-spence.git`
   - Set deployment path to your domain's document root

### 1.2 Configure Python Application
1. Go to **Python** section in Plesk
2. Enable Python support
3. Set Python version to **3.12** (or match `runtime.txt`)
4. Set application root to: `/backend`
5. Set application startup file to: `passenger_wsgi.py` (we'll create this)

### 1.3 Create PostgreSQL Database
1. Go to **Databases** → **PostgreSQL**
2. Create a new database (e.g., `leadflow_db`)
3. Create a database user
4. Note down: Database name, username, password, host, port

### 1.4 (Optional) Setup Redis
If you need WebSocket support:
1. Install Redis extension in Plesk or use a Redis service
2. Note the Redis connection details

## Step 2: Configure Environment Variables

In Plesk, go to **Python** → **Environment Variables** and add:

```bash
# Django Settings
SECRET_KEY=your-secret-key-here-generate-a-new-one
DEBUG=False
ALLOWED_HOSTS=your-domain.com,www.your-domain.com

# Database Configuration
DB_HOST=localhost
DB_NAME=leadflow_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_PORT=5432

# Redis (Optional - for WebSocket support)
REDIS_URL=redis://localhost:6379/0
# OR if using external Redis:
# REDIS_URL=redis://username:password@host:port/0
USE_REDIS=True

# CORS & CSRF
CSRF_TRUSTED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Static Files
STATIC_ROOT=/var/www/vhosts/your-domain.com/httpdocs/staticfiles
MEDIA_ROOT=/var/www/vhosts/your-domain.com/httpdocs/media

# Email Configuration (if needed)
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@example.com
EMAIL_HOST_PASSWORD=your-email-password

# AWS S3 (if using for media files)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_STORAGE_BUCKET_NAME=your-bucket-name
AWS_S3_REGION_NAME=your-region
```

**Important:** Replace all placeholder values with your actual configuration.

## Step 3: Deploy Code

### 3.1 Initial Deployment
1. In Plesk Git section, click **Pull** to fetch the latest code
2. Or manually SSH and run:
   ```bash
   cd /var/www/vhosts/your-domain.com/httpdocs
   git pull origin main
   ```

### 3.2 Build Frontend
SSH into your server and run:
```bash
cd /var/www/vhosts/your-domain.com/httpdocs/frontend
npm install
npm run build
```

The built files will be in `frontend/dist/`

### 3.3 Install Python Dependencies
```bash
cd /var/www/vhosts/your-domain.com/httpdocs/backend
pip install -r requirements.txt
```

### 3.4 Run Django Migrations
```bash
cd /var/www/vhosts/your-domain.com/httpdocs/backend
python manage.py migrate
```

### 3.5 Collect Static Files
```bash
cd /var/www/vhosts/your-domain.com/httpdocs/backend
python manage.py collectstatic --noinput
```

### 3.6 Create Superuser (First Time Only)
```bash
cd /var/www/vhosts/your-domain.com/httpdocs/backend
python manage.py createsuperuser
```

## Step 4: Configure Web Server

### 4.1 Static Files Configuration

Create or update `.htaccess` in your document root (see `plesk.htaccess` file):

```apache
# Serve static files
Alias /static /var/www/vhosts/your-domain.com/httpdocs/backend/staticfiles
Alias /media /var/www/vhosts/your-domain.com/httpdocs/backend/media

<Directory /var/www/vhosts/your-domain.com/httpdocs/backend/staticfiles>
    Require all granted
</Directory>

<Directory /var/www/vhosts/your-domain.com/httpdocs/backend/media>
    Require all granted
</Directory>

# Serve frontend files
Alias / /var/www/vhosts/your-domain.com/httpdocs/frontend/dist/

<Directory /var/www/vhosts/your-domain.com/httpdocs/frontend/dist>
    Options -Indexes
    Require all granted
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</Directory>

# Proxy API requests to Django
ProxyPreserveHost On
ProxyPass /api http://127.0.0.1:8000/api
ProxyPassReverse /api http://127.0.0.1:8000/api
```

### 4.2 Nginx Configuration (if using Nginx)

If your Plesk uses Nginx, add to **Nginx Directives**:

```nginx
# Serve static files
location /static/ {
    alias /var/www/vhosts/your-domain.com/httpdocs/backend/staticfiles/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}

location /media/ {
    alias /var/www/vhosts/your-domain.com/httpdocs/backend/media/;
    expires 7d;
    add_header Cache-Control "public";
}

# Serve frontend
location / {
    root /var/www/vhosts/your-domain.com/httpdocs/frontend/dist;
    try_files $uri $uri/ /index.html;
    index index.html;
}

# Proxy API requests to Django
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# WebSocket support
location /ws/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## Step 5: Start Application

### 5.1 Using Passenger (Recommended)
Plesk uses Passenger WSGI by default. The `passenger_wsgi.py` file will handle this.

### 5.2 Using Systemd Service (Alternative)
Create a systemd service file `/etc/systemd/system/leadflow.service`:

```ini
[Unit]
Description=LeadFlow Django Application
After=network.target

[Service]
Type=simple
User=your-plesk-user
WorkingDirectory=/var/www/vhosts/your-domain.com/httpdocs/backend
Environment="PATH=/opt/plesk/python/3.12/bin"
ExecStart=/opt/plesk/python/3.12/bin/daphne -b 127.0.0.1 -p 8000 backend.asgi:application
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable leadflow
sudo systemctl start leadflow
sudo systemctl status leadflow
```

## Step 6: Post-Deployment Checklist

- [ ] Application is accessible at your domain
- [ ] Static files are being served correctly (`/static/`)
- [ ] Media files are being served correctly (`/media/`)
- [ ] API endpoints work (`/api/`)
- [ ] Frontend loads and displays correctly
- [ ] Database migrations completed
- [ ] Admin panel accessible (`/admin/`)
- [ ] WebSocket connections work (if enabled)
- [ ] Environment variables are set correctly
- [ ] Logs show no errors

## Step 7: Automated Deployment Script

Use the `plesk-deploy.sh` script for automated deployments:

```bash
chmod +x plesk-deploy.sh
./plesk-deploy.sh
```

Or manually run the steps in `plesk-deploy.sh`.

## Troubleshooting

### Application Not Starting
1. Check Python logs in Plesk: **Python** → **Logs**
2. Check system logs: `journalctl -u leadflow -n 50`
3. Verify environment variables are set correctly
4. Check database connection

### Static Files Not Loading
1. Verify `STATIC_ROOT` path is correct
2. Run `python manage.py collectstatic --noinput`
3. Check file permissions: `chmod -R 755 staticfiles/`
4. Verify `.htaccess` or Nginx configuration

### Database Connection Errors
1. Verify database credentials in environment variables
2. Check PostgreSQL is running: `systemctl status postgresql`
3. Verify database exists and user has permissions
4. Check firewall rules allow localhost connections

### Frontend Not Loading
1. Verify frontend build completed: `ls -la frontend/dist/`
2. Check Nginx/Apache configuration for frontend serving
3. Verify base path in `vite.config.ts` matches deployment
4. Check browser console for errors

### CORS Errors
1. Verify `ALLOWED_HOSTS` includes your domain
2. Check `CSRF_TRUSTED_ORIGINS` includes your domain
3. Verify CORS middleware is enabled in settings
4. Check backend logs for CORS-related errors

## Maintenance

### Updating the Application
```bash
cd /var/www/vhosts/your-domain.com/httpdocs
git pull origin main
cd frontend && npm install && npm run build
cd ../backend
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
# Restart application (if using systemd)
sudo systemctl restart leadflow
```

### Viewing Logs
- Django logs: Check Plesk Python logs or `/var/log/plesk-python/`
- Application logs: `journalctl -u leadflow -f`
- Nginx logs: `/var/www/vhosts/your-domain.com/logs/error_log`
- Apache logs: `/var/www/vhosts/your-domain.com/logs/error_log`

## Security Considerations

1. **Never commit `.env` files** - Use Plesk environment variables
2. **Set `DEBUG=False`** in production
3. **Use strong `SECRET_KEY`** - Generate with: `python -c "import secrets; print(secrets.token_urlsafe(50))"`
4. **Enable HTTPS** - Configure SSL certificate in Plesk
5. **Restrict database access** - Use strong passwords
6. **Keep dependencies updated** - Regularly update `requirements.txt`
7. **Set proper file permissions** - Don't use 777

## Support

For issues specific to:
- **Plesk**: Check Plesk documentation
- **Django**: Check Django deployment documentation
- **Project-specific**: Check project README files

