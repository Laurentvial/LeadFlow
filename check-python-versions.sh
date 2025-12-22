#!/bin/bash
# Check available Python versions on Plesk server

echo "🔍 Checking for Python installations..."
echo ""

# Check system Python
echo "System Python:"
which python3 2>/dev/null && python3 --version || echo "  Not found"
which python3.12 2>/dev/null && python3.12 --version || echo "  python3.12: Not found"
which python3.11 2>/dev/null && python3.11 --version || echo "  python3.11: Not found"
which python3.10 2>/dev/null && python3.10 --version || echo "  python3.10: Not found"
which python3.9 2>/dev/null && python3.9 --version || echo "  python3.9: Not found"
which python3.8 2>/dev/null && python3.8 --version || echo "  python3.8: Not found"
echo ""

# Check Plesk Python installations
echo "Plesk Python installations:"
if [ -d "/opt/plesk/python" ]; then
    ls -la /opt/plesk/python/ | grep -E "^d" | awk '{print $9}' | while read version; do
        if [ -f "/opt/plesk/python/$version/bin/python3" ]; then
            echo "  Python $version: $(/opt/plesk/python/$version/bin/python3 --version 2>&1)"
        fi
    done
else
    echo "  /opt/plesk/python/ directory not found"
fi
echo ""

# Check current Python
echo "Current default Python:"
python3 --version 2>&1
echo ""

# Check pip availability
echo "Pip availability:"
python3 -m pip --version 2>&1 || echo "  pip not available via python3 -m pip"
echo ""

# Recommendation
echo "📋 Recommendation:"
PYTHON_VERSION=$(python3 --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
if [ "$(printf '%s\n' "3.8" "$PYTHON_VERSION" | sort -V | head -n1)" != "3.8" ]; then
    echo "  ❌ Python $PYTHON_VERSION is too old. You need Python 3.12."
    echo "  📞 Contact your hosting provider to install Python 3.12"
    echo "  Or check if Python 3.12 exists at: /opt/plesk/python/3.12/bin/python3"
else
    echo "  ✅ Python $PYTHON_VERSION should work (but Python 3.12 is recommended)"
fi

