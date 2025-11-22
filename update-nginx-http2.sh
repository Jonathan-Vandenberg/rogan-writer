#!/bin/bash
# Script to update Nginx config to enable HTTP/2
# Run this on your Digital Ocean server

# Backup current config
sudo cp /etc/nginx/sites-available/rogan-writer /etc/nginx/sites-available/rogan-writer.backup.$(date +%Y%m%d_%H%M%S)

# Update the listen directive to include http2
sudo sed -i 's/listen 443 ssl;/listen 443 ssl http2;\n    listen [::]:443 ssl http2;/' /etc/nginx/sites-available/rogan-writer

# Add gzip compression and caching (if not already present)
if ! grep -q "gzip on" /etc/nginx/sites-available/rogan-writer; then
    # Add gzip config before location block
    sudo sed -i '/location \/ {/i\    # Gzip compression\n    gzip on;\n    gzip_vary on;\n    gzip_min_length 1024;\n    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript image/svg+xml;\n\n    # Cache static assets\n    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {\n        proxy_pass http://localhost:3000;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        expires 30d;\n        add_header Cache-Control "public, immutable";\n    }\n\n    # Next.js Image Optimization API\n    location /_next/image {\n        proxy_pass http://localhost:3000;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        expires 30d;\n        add_header Cache-Control "public, immutable";\n    }\n' /etc/nginx/sites-available/rogan-writer
fi

echo "Config updated. Testing..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✓ Config test passed. Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✓ Nginx reloaded with HTTP/2 support!"
    echo "Test with: curl -I --http2 https://jonathanvandenberg.com"
else
    echo "✗ Config test failed. Restore backup with:"
    echo "  sudo cp /etc/nginx/sites-available/rogan-writer.backup.* /etc/nginx/sites-available/rogan-writer"
fi

