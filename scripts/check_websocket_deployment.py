#!/usr/bin/env python
"""
WebSocket Deployment Diagnostic Script

Run this script on Heroku to diagnose WebSocket issues:
    heroku run python backend/check_websocket_deployment.py -a leadflow-backend-eu

Or run locally to check configuration:
    python backend/check_websocket_deployment.py

Note: Make sure to commit and push this file to Heroku first!
"""

import os
import sys
import django

# Setup Django
# Handle both local and Heroku execution paths
script_path = os.path.abspath(__file__)
script_dir = os.path.dirname(script_path)

# Determine project root (where manage.py is located)
# Script is in backend/ directory, so backend/ is the project root
if script_dir.endswith('backend') or os.path.basename(script_dir) == 'backend':
    # Script is in backend/, so backend/ is the project root
    project_root = script_dir
else:
    # Script might be in root, try to find backend/
    project_root = os.path.dirname(script_dir) if 'backend' in script_dir else script_dir

# Add project root to path
sys.path.insert(0, project_root)

# Change to backend directory (where manage.py is)
backend_dir = project_root if os.path.basename(project_root) == 'backend' else os.path.join(project_root, 'backend')
if os.path.exists(backend_dir):
    os.chdir(backend_dir)
else:
    os.chdir(project_root)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.conf import settings
from channels.layers import get_channel_layer

def check_redis_config():
    """Check Redis configuration"""
    print("\n" + "="*60)
    print("1. REDIS CONFIGURATION CHECK")
    print("="*60)
    
    redis_url = os.getenv('REDIS_URL')
    if redis_url:
        print(f"✅ REDIS_URL is set: {redis_url[:20]}...")
        if redis_url.startswith('rediss://'):
            print("✅ Using SSL (rediss://) - correct for Heroku Redis")
        elif redis_url.startswith('redis://'):
            print("⚠️  Using non-SSL (redis://) - may work but SSL is recommended")
        else:
            print(f"❌ Unexpected Redis URL format: {redis_url[:50]}")
    else:
        print("❌ REDIS_URL is NOT set!")
        print("   → Add Redis addon: heroku addons:create heroku-redis:mini -a your-app")
        return False
    
    return True

def check_channel_layers():
    """Check Channel Layers configuration"""
    print("\n" + "="*60)
    print("2. CHANNEL LAYERS CHECK")
    print("="*60)
    
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            print(f"✅ Channel layer is configured: {type(channel_layer).__name__}")
            
            # Try to get channel layer config
            if hasattr(channel_layer, 'hosts'):
                print(f"✅ Channel layer hosts: {channel_layer.hosts}")
            
            # Test channel layer connection
            print("\n   Testing channel layer connection...")
            import asyncio
            async def test_channel_layer():
                try:
                    # Try to get a channel name (this tests the connection)
                    test_channel = channel_layer.new_channel()
                    if test_channel:
                        print("✅ Channel layer connection successful!")
                        return True
                    else:
                        print("⚠️  Channel layer returned None for new_channel()")
                        return False
                except Exception as e:
                    print(f"❌ Channel layer connection failed: {e}")
                    print(f"   Error type: {type(e).__name__}")
                    import traceback
                    print(f"   Traceback: {traceback.format_exc()}")
                    return False
            
            result = asyncio.run(test_channel_layer())
            return result
        else:
            print("❌ Channel layer is NOT configured!")
            print("   → Check settings.py CHANNEL_LAYERS configuration")
            return False
    except Exception as e:
        print(f"❌ Error checking channel layer: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_asgi_config():
    """Check ASGI configuration"""
    print("\n" + "="*60)
    print("3. ASGI CONFIGURATION CHECK")
    print("="*60)
    
    asgi_app = getattr(settings, 'ASGI_APPLICATION', None)
    if asgi_app:
        print(f"✅ ASGI_APPLICATION is set: {asgi_app}")
        
        # Try to import the ASGI application
        try:
            from backend.asgi import application
            print("✅ ASGI application imported successfully")
            
            # Check if it's a ProtocolTypeRouter
            from channels.routing import ProtocolTypeRouter
            if isinstance(application, ProtocolTypeRouter):
                print("✅ ASGI application is ProtocolTypeRouter (correct for WebSockets)")
            else:
                print(f"⚠️  ASGI application is not ProtocolTypeRouter: {type(application)}")
            
            return True
        except Exception as e:
            print(f"❌ Error importing ASGI application: {e}")
            import traceback
            traceback.print_exc()
            return False
    else:
        print("❌ ASGI_APPLICATION is NOT set!")
        print("   → Add to settings.py: ASGI_APPLICATION = 'backend.asgi.application'")
        return False

def check_installed_apps():
    """Check if Channels is installed"""
    print("\n" + "="*60)
    print("4. INSTALLED APPS CHECK")
    print("="*60)
    
    installed_apps = getattr(settings, 'INSTALLED_APPS', [])
    
    if 'channels' in installed_apps:
        print("✅ 'channels' is in INSTALLED_APPS")
    else:
        print("❌ 'channels' is NOT in INSTALLED_APPS!")
        print("   → Add 'channels' to INSTALLED_APPS in settings.py")
        return False
    
    return True

def check_allowed_hosts():
    """Check ALLOWED_HOSTS configuration"""
    print("\n" + "="*60)
    print("5. ALLOWED_HOSTS CHECK")
    print("="*60)
    
    allowed_hosts = getattr(settings, 'ALLOWED_HOSTS', [])
    if allowed_hosts:
        print(f"✅ ALLOWED_HOSTS is set: {allowed_hosts}")
        if '*' in allowed_hosts:
            print("   ⚠️  ALLOWED_HOSTS contains '*' - allows all hosts (less secure)")
        return True
    else:
        print("❌ ALLOWED_HOSTS is empty!")
        print("   → Set ALLOWED_HOSTS on Heroku:")
        print("   → heroku config:set ALLOWED_HOSTS=your-app.herokuapp.com -a your-app")
        return False

def check_procfile():
    """Check Procfile (if accessible)"""
    print("\n" + "="*60)
    print("6. PROCFILE CHECK")
    print("="*60)
    
    # Get current working directory
    cwd = os.getcwd()
    print(f"   Current directory: {cwd}")
    
    procfile_paths = [
        'Procfile',  # Root Procfile (Heroku uses this)
        'backend/Procfile',  # Backend Procfile
        '../Procfile',  # Parent directory
        '../../Procfile',  # Grandparent directory
    ]
    
    for path in procfile_paths:
        full_path = os.path.join(cwd, path) if not os.path.isabs(path) else path
        if os.path.exists(full_path):
            with open(full_path, 'r') as f:
                content = f.read()
                if 'daphne' in content:
                    print(f"✅ Procfile found and uses 'daphne': {path}")
                    print(f"   Content: {content.strip()}")
                    return True
                elif 'gunicorn' in content:
                    print(f"❌ Procfile uses 'gunicorn' instead of 'daphne': {path}")
                    print(f"   Content: {content.strip()}")
                    print("   → WebSockets require 'daphne', not 'gunicorn'")
                    return False
    
    print("⚠️  Procfile not found in expected locations")
    print("   → This is OK if running locally, but Heroku needs Procfile in root")
    return True

def main():
    """Run all checks"""
    print("\n" + "="*60)
    print("WEBSOCKET DEPLOYMENT DIAGNOSTIC")
    print("="*60)
    print(f"Django version: {django.get_version()}")
    print(f"Settings module: {os.getenv('DJANGO_SETTINGS_MODULE', 'Not set')}")
    
    checks = [
        ("Redis Configuration", check_redis_config),
        ("Channel Layers", check_channel_layers),
        ("ASGI Configuration", check_asgi_config),
        ("Installed Apps", check_installed_apps),
        ("Allowed Hosts", check_allowed_hosts),
        ("Procfile", check_procfile),
    ]
    
    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ Error in {name} check: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False))
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\n{passed}/{total} checks passed")
    
    if passed == total:
        print("\n✅ All checks passed! WebSocket configuration looks good.")
        print("\nIf WebSockets still don't work:")
        print("1. Check browser console for WebSocket errors")
        print("2. Check Heroku logs: heroku logs --tail -a your-app")
        print("3. Verify frontend VITE_URL is set correctly")
        print("4. Test WebSocket connection manually in browser console")
    else:
        print("\n❌ Some checks failed. Please fix the issues above.")
        print("\nCommon fixes:")
        print("1. Add Redis addon: heroku addons:create heroku-redis:mini -a your-app")
        print("2. Verify Procfile uses 'daphne' not 'gunicorn'")
        print("3. Set ALLOWED_HOSTS: heroku config:set ALLOWED_HOSTS=your-app.herokuapp.com")
        print("4. Redeploy: git push heroku main")
    
    return passed == total

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)

