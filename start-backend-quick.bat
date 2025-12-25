@echo off
REM Quick batch file to SSH and start backend
REM This will prompt for password interactively

echo ========================================
echo LeadFlow Backend Startup
echo ========================================
echo.
echo Server: 82.165.44.164
echo Username: root
echo.
echo Connecting to server...
echo You will be prompted to enter the password.
echo.

ssh root@82.165.44.164 "cd /var/www/vhosts/blissful-spence.82-165-44-164.plesk.page/httpdocs/backend && pkill -f 'daphne.*backend.asgi' 2>/dev/null; nohup python3 -m daphne -b 0.0.0.0 -p 8000 backend.asgi:application > /tmp/daphne.log 2>&1 & sleep 3 && ps aux | grep daphne | grep -v grep && echo 'Backend started! Logs: /tmp/daphne.log'"

pause

