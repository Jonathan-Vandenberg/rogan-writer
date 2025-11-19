# DigitalOcean Droplet Manual Setup Guide

Complete step-by-step guide to manually set up your DigitalOcean droplet for rogan-writer.

---

## Step 1: Create Droplet

1. Go to [DigitalOcean Droplets](https://cloud.digitalocean.com/droplets/new)
2. Choose:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic plan, at least **2GB RAM / 1 vCPU** (4GB+ recommended for production)
   - **Region**: Choose closest to your users
   - **Authentication**: **SSH keys** (recommended) or password
3. Click **Create Droplet**
4. Wait for droplet to be created (1-2 minutes)

---

## Step 2: Add SSH Key to Droplet

### Option A: Add SSH Key During Droplet Creation (Recommended)

1. In droplet creation, go to **Authentication** section
2. Click **New SSH Key**
3. Paste your public SSH key (usually `~/.ssh/id_rsa.pub` or `~/.ssh/id_ed25519.pub`)
4. Give it a name (e.g., "My MacBook")
5. Click **Add SSH Key**
6. The key will be automatically added to the droplet

### Option B: Add SSH Key After Creation

1. Go to [DigitalOcean SSH Keys](https://cloud.digitalocean.com/account/security)
2. Click **Add SSH Key**
3. Paste your public key and give it a name
4. Go to your droplet → **Settings** → **Resize/Add SSH Keys**
5. Select your SSH key and click **Add SSH Key**

### Test SSH Connection

```bash
ssh root@YOUR_DROPLET_IP
# or if you created a user:
ssh YOUR_USERNAME@YOUR_DROPLET_IP
```

---

## Step 3: Initial Server Setup

SSH into your droplet:

```bash
ssh root@YOUR_DROPLET_IP
```

### Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Create Non-Root User (Optional but Recommended)

```bash
# Create user
adduser deploy
# Add to sudo group
usermod -aG sudo deploy
# Switch to new user
su - deploy
```

---

## Step 4: Install Node.js 20

```bash
# Install Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

---

## Step 5: Install PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version

# Set up PM2 to start on boot
pm2 startup
# Run the command it outputs (usually something like: sudo env PATH=... pm2 startup systemd -u deploy --hp /home/deploy)
# Then save PM2 configuration
pm2 save
```

---

## Step 6: Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx

# Test Nginx (should see default page)
curl http://localhost
```

---

## Step 7: Set Up Application Directory Structure

```bash
# Create application directories
sudo mkdir -p /var/www/rogan-writer
sudo mkdir -p /var/www/rogan-writer/logs
sudo mkdir -p /var/www/rogan-writer/current
sudo mkdir -p /var/www/rogan-writer/config

# Set ownership (replace 'deploy' with your username if different)
sudo chown -R $USER:$USER /var/www/rogan-writer

# Set permissions
chmod -R 755 /var/www/rogan-writer
```

---

## Step 8: Install PostgreSQL with pgvector

```bash
# Install PostgreSQL 16
sudo apt install -y postgresql-16 postgresql-contrib-16

# Install pgvector extension
sudo apt install -y postgresql-16-pgvector

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check status
sudo systemctl status postgresql
```

### Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt, run:
CREATE USER rogan_user WITH PASSWORD 'YOUR_SECURE_PASSWORD_HERE';
CREATE DATABASE rogan_writer OWNER rogan_user;
\c rogan_writer
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL PRIVILEGES ON DATABASE rogan_writer TO rogan_user;
\q
```

**Important**: Replace `YOUR_SECURE_PASSWORD_HERE` with a strong password. Save this password!

### Get Database Connection String

Your database connection string will be:
```
postgresql://rogan_user:YOUR_SECURE_PASSWORD_HERE@localhost:5432/rogan_writer?schema=public
```

**Save this for later** - you'll need it for:
- GitHub Secrets (`DATABASE_URL`)
- Application `.env` file

---

## Step 9: Configure Nginx

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/rogan-writer
```

Add this configuration (replace `your-domain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Increase timeouts for long-running requests (book generation)
    proxy_read_timeout 600s;
    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/rogan-writer /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Step 10: Install Certbot (SSL)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow the prompts:
# - Enter your email
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

Certbot will automatically:
- Get SSL certificate from Let's Encrypt
- Configure Nginx to use HTTPS
- Set up auto-renewal

### Test Auto-Renewal

```bash
# Test renewal (dry run)
sudo certbot renew --dry-run
```

---

## Step 11: Configure Firewall

```bash
# Allow SSH
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Step 12: Set Up Application Files

### Create Production Environment File

```bash
cd /var/www/rogan-writer/config
nano .env.production
```

Add your environment variables:

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://rogan_user:YOUR_SECURE_PASSWORD_HERE@localhost:5432/rogan_writer?schema=public
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=YOUR_NEXTAUTH_SECRET_HERE
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=...
```

**Important**: 
- Replace `YOUR_SECURE_PASSWORD_HERE` with your database password
- Generate `NEXTAUTH_SECRET` with: `openssl rand -base64 32`
- Add your actual API keys and secrets

### Set Permissions

```bash
chmod 600 /var/www/rogan-writer/config/.env.production
```

---

## Step 13: Set Up PM2 Configuration

Copy the `ecosystem.config.js` file to your server, or create it:

```bash
cd /var/www/rogan-writer
nano ecosystem.config.js
```

Add:

```javascript
module.exports = {
  apps: [
    {
      name: 'rogan-writer',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/rogan-writer/current',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/www/rogan-writer/logs/err.log',
      out_file: '/var/www/rogan-writer/logs/out.log',
      log_file: '/var/www/rogan-writer/logs/combined.log',
      time: true,
      interpreter: 'node',
      node_args: '--max-old-space-size=1024',
      restart_delay: 4000,
      min_uptime: '10s',
      max_restarts: 10
    }
  ]
};
```

---

## Step 14: Initial Application Deployment

### Option A: Manual First Deployment

```bash
cd /var/www/rogan-writer/current

# Clone your repository
git clone https://github.com/YOUR_USERNAME/rogan-writer.git .

# Install dependencies
npm install --legacy-peer-deps

# Copy production environment file
cp ../config/.env.production .env

# Generate Prisma Client
npm run db:generate

# Run migrations
npx prisma migrate deploy

# Build application
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
```

### Option B: Let GitHub Actions Deploy (After Setup)

Once everything is set up, your GitHub Actions workflow will handle deployments automatically on push to main.

---

## Step 15: Verify Everything Works

### Check Application

```bash
# Check PM2 status
pm2 status

# Check PM2 logs
pm2 logs rogan-writer

# Check if app is running
curl http://localhost:3000
```

### Check Nginx

```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Check Database

```bash
# Connect to database
sudo -u postgres psql -d rogan_writer

# Check if pgvector is enabled
\dx

# Should see: vector | 0.5.1 | ...

# Check tables (after migrations)
\dt

# Exit
\q
```

### Test HTTPS

Visit `https://your-domain.com` in your browser. You should see your application.

---

## Step 16: Add GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

| Secret Name | Value | Notes |
|------------|-------|-------|
| `DIGITALOCEAN_HOST` | Your droplet IP address | e.g., `123.45.67.89` |
| `DIGITALOCEAN_USERNAME` | `root` or `deploy` | Your SSH username |
| `DIGITALOCEAN_SSH_KEY` | Your private SSH key | Contents of `~/.ssh/id_rsa` or `~/.ssh/id_ed25519` |
| `DATABASE_URL` | `postgresql://rogan_user:PASSWORD@localhost:5432/rogan_writer?schema=public` | From Step 8 |
| `NEXTAUTH_URL` | `https://your-domain.com` | Your domain |
| `NEXTAUTH_SECRET` | Generated secret | From Step 12 |
| `OPENAI_API_KEY` | Your OpenAI key | Optional |
| `XAI_API_KEY` | Your X.AI key | Optional |
| `GOOGLE_CLIENT_ID` | Your Google OAuth ID | Optional |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth secret | Optional |
| `AWS_ACCESS_KEY_ID` | Your AWS key | Optional |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret | Optional |
| `AWS_REGION` | `us-east-1` | Optional |
| `AWS_S3_BUCKET_NAME` | Your bucket name | Optional |

---

## Step 17: Test Deployment

After setting up GitHub Secrets, push to main:

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

Watch the GitHub Actions workflow run. It should:
1. Build your app
2. Deploy files to `/var/www/rogan-writer`
3. Run migrations
4. Restart PM2

---

## Summary Checklist

- [ ] Droplet created
- [ ] SSH key added
- [ ] Node.js 20 installed
- [ ] PM2 installed and configured
- [ ] Nginx installed and configured
- [ ] Application directories created (`/var/www/rogan-writer`)
- [ ] PostgreSQL 16 installed with pgvector
- [ ] Database `rogan_writer` created
- [ ] Database user `rogan_user` created
- [ ] pgvector extension enabled
- [ ] Database connection string saved
- [ ] Nginx configured for your domain
- [ ] Certbot installed and SSL certificate obtained
- [ ] Firewall configured
- [ ] Production `.env.production` file created
- [ ] PM2 ecosystem config created
- [ ] GitHub Secrets configured
- [ ] First deployment successful

---

## Useful Commands Reference

### PM2 Commands
```bash
pm2 status                    # Check status
pm2 logs rogan-writer        # View logs
pm2 restart rogan-writer     # Restart app
pm2 stop rogan-writer        # Stop app
pm2 monit                    # Monitor in real-time
pm2 save                     # Save current process list
```

### Nginx Commands
```bash
sudo nginx -t                # Test configuration
sudo systemctl reload nginx  # Reload configuration
sudo systemctl restart nginx # Restart Nginx
sudo tail -f /var/log/nginx/error.log  # View error logs
```

### Database Commands
```bash
sudo -u postgres psql        # Connect to PostgreSQL
sudo systemctl status postgresql  # Check PostgreSQL status
```

### Application Commands
```bash
cd /var/www/rogan-writer/current
npm run build               # Build application
npx prisma migrate deploy   # Run migrations
npx prisma generate         # Generate Prisma Client
pm2 restart rogan-writer    # Restart after changes
```

---

## Troubleshooting

### Application Not Starting

```bash
# Check PM2 logs
pm2 logs rogan-writer --lines 100

# Check if port 3000 is in use
sudo lsof -i :3000

# Check environment variables
cd /var/www/rogan-writer/current
cat .env
```

### Database Connection Issues

```bash
# Test database connection
sudo -u postgres psql -d rogan_writer -U rogan_user

# Check PostgreSQL is running
sudo systemctl status postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

### Nginx Issues

```bash
# Test Nginx config
sudo nginx -t

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check if Nginx is running
sudo systemctl status nginx
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check renewal logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

---

## Next Steps

1. **Set up monitoring** (optional):
   - PM2 monitoring: `pm2 install pm2-logrotate`
   - Set up uptime monitoring (UptimeRobot, etc.)

2. **Set up backups**:
   - Database backups: `pg_dump` scheduled via cron
   - Application backups: Git repository

3. **Set up domain DNS**:
   - Point your domain A record to droplet IP
   - Wait for DNS propagation

4. **Configure GitHub Actions**:
   - Ensure all secrets are set
   - Test deployment workflow

---

You're all set! Your droplet is ready for deployment. 🚀

