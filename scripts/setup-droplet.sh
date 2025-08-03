#!/bin/bash

echo "Setting up DigitalOcean droplet for rogan-writer deployment..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js version
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install PM2 globally
sudo npm install -g pm2

# Create application directories
sudo mkdir -p /var/www/rogan-writer/logs
sudo mkdir -p /var/www/rogan-writer/current
sudo mkdir -p /var/www/rogan-writer/backup

# Set ownership
sudo chown -R $USER:$USER /var/www/rogan-writer

# Setup PM2 to start on boot
pm2 startup
echo "Run the command above if prompted, then run: pm2 save"

echo "Setup complete! Make sure to:"
echo "1. Create your .env file at /var/www/rogan-writer/.env"
echo "2. Set up your PostgreSQL database"
echo "3. Configure your GitHub secrets"
echo "4. Run: pm2 save (after the pm2 startup command if prompted)" 