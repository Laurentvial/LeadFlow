#!/bin/bash
# Automated deployment script for LeadFlow on Plesk
# Run this script after pulling code from Git

set -e  # Exit on error

echo "🚀 Starting LeadFlow deployment on Plesk..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${GREEN}▶ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Step 1: Install/Update Python dependencies
print_step "Installing Python dependencies..."
cd backend
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt --upgrade
    echo "✓ Python dependencies installed"
else
    print_error "requirements.txt not found!"
    exit 1
fi

# Step 2: Run database migrations
print_step "Running database migrations..."
python manage.py migrate --noinput
echo "✓ Database migrations completed"

# Step 3: Collect static files
print_step "Collecting static files..."
python manage.py collectstatic --noinput
echo "✓ Static files collected"

# Step 4: Build frontend
print_step "Building frontend..."
cd ../frontend
if [ -f "package.json" ]; then
    # Check if node_modules exists, if not install
    if [ ! -d "node_modules" ]; then
        print_step "Installing Node.js dependencies..."
        npm install
    fi
    
    # Build frontend
    npm run build
    echo "✓ Frontend built successfully"
else
    print_warning "package.json not found, skipping frontend build"
fi

# Step 5: Set permissions
print_step "Setting file permissions..."
cd ..
chmod -R 755 backend/staticfiles 2>/dev/null || true
chmod -R 755 backend/media 2>/dev/null || true
chmod +x plesk-start.sh 2>/dev/null || true
echo "✓ Permissions set"

# Step 6: Check if superuser exists (optional)
print_step "Checking database setup..."
cd backend
python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    print("⚠ No superuser found. Create one with: python manage.py createsuperuser")
else:
    print("✓ Superuser exists")
EOF

cd ..

echo ""
echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Restart your application (if using systemd: sudo systemctl restart leadflow)"
echo "2. Check application logs for any errors"
echo "3. Verify the application is accessible at your domain"
echo ""
print_warning "Don't forget to set environment variables in Plesk if you haven't already!"

