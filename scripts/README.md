# Scripts

Utility scripts for development, deployment, and maintenance.

## Structure

### `/deployment/`
Deployment scripts for various platforms:
- `deploy.ps1` - Main deployment script for Heroku/Vercel
- `start-local.ps1` - Start local development server
- `start-internet.ps1` - Start server with internet access
- `plesk-deploy.sh` - Plesk deployment script (moved to docs/deployment/plesk)
- `verify_websocket_setup.sh` - Verify WebSocket configuration

### Root Scripts
- Database migration scripts (`.sql` files)
- Utility Python scripts for testing and maintenance

## Usage

Run scripts from the project root directory:

```powershell
# PowerShell scripts
.\scripts\deployment\deploy.ps1

# Bash scripts (Linux/Mac/Git Bash)
bash scripts/deployment/plesk-deploy.sh
```

