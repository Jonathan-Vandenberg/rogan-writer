# DigitalOcean Deployment Guide

This guide covers deploying Rogan Writer to DigitalOcean using either:
1. **DigitalOcean App Platform** (Managed, easiest)
2. **DigitalOcean Droplets** (VPS, more control, better for long-running tasks)

---

## Option 1: DigitalOcean App Platform (Recommended for Quick Setup)

### Prerequisites
- DigitalOcean account
- GitHub repository with your code
- PostgreSQL database (DigitalOcean Managed Database or external)

### Step 1: Create App on DigitalOcean

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click **Create App**
3. Connect your GitHub repository
4. Select the repository and branch

### Step 2: Configure Build Settings

**Build Command:**
```bash
npm run build
```

**Run Command:**
```bash
npm start
```

**Environment Variables:**
Add these in the App Platform dashboard:

```bash
# REQUIRED
DATABASE_URL=postgresql://user:password@host:5432/dbname?schema=public
NEXTAUTH_URL=https://your-app-name.ondigitalocean.app
NEXTAUTH_SECRET=your-secret-key-here
NODE_ENV=production

# Optional (for AI features)
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=...
```

### Step 3: Add Database Component

1. In App Platform, click **Add Component** → **Database**
2. Choose **PostgreSQL** (version 16 recommended)
3. **Important**: Enable **pgvector** extension:
   - After database is created, go to database settings
   - Run: `CREATE EXTENSION IF NOT EXISTS vector;`

### Step 4: Configure Build & Deploy

**Build Settings:**
- **Build Command**: `npm run build`
- **Run Command**: `npm start`
- **Environment**: Node.js 20

**Deploy Settings:**
- **Auto Deploy**: Enable for main branch
- **Health Check**: `/api/health` (if you have one)

### Step 5: Set Up Database Migrations

Add a **Deploy Script** component or update build command:

```bash
npm run db:migrate:deploy && npm run build
```

Or add to `package.json`:
```json
{
  "scripts": {
    "do-build": "prisma migrate deploy && npm run build"
  }
}
```

Then set **Build Command** to: `npm run do-build`

### Step 6: Deploy

1. Click **Create Resources**
2. Wait for build and deployment
3. Your app will be available at `https://your-app-name.ondigitalocean.app`

---

## Option 2: DigitalOcean Droplet (Better for Long-Running Tasks)

This option gives you full control and no timeout limits, perfect for long book generation tasks.

### Prerequisites
- DigitalOcean account
- SSH access to your droplet
- PostgreSQL database (managed or on droplet)

### Step 1: Create Droplet

1. Go to [DigitalOcean Droplets](https://cloud.digitalocean.com/droplets/new)
2. Choose:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: At least 2GB RAM / 1 vCPU (4GB+ recommended)
   - **Region**: Choose closest to your users
   - **Authentication**: SSH keys (recommended) or password

### Step 2: Initial Server Setup

SSH into your droplet:
```bash
ssh root@your-droplet-ip
```

Run the setup script (or manually):
```bash
# Clone your repo or upload files
git clone https://github.com/your-username/rogan-writer.git
cd rogan-writer

# Run setup script
chmod +x scripts/setup-droplet.sh
./scripts/setup-droplet.sh
```

### Step 3: Install PostgreSQL with pgvector

```bash
# Install PostgreSQL 16
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib-16

# Install pgvector extension
sudo apt install -y postgresql-16-pgvector

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER rogan_user WITH PASSWORD 'your-secure-password';
CREATE DATABASE rogan_writer OWNER rogan_user;
\c rogan_writer
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL PRIVILEGES ON DATABASE rogan_writer TO rogan_user;
EOF
```

### Step 4: Set Up Application

```bash
cd /var/www/rogan-writer/current

# Clone or upload your code
git clone https://github.com/your-username/rogan-writer.git .

# Install dependencies
npm install

# Create .env file
nano .env
```

Add to `.env`:
```bash
DATABASE_URL=postgresql://rogan_user:your-secure-password@localhost:5432/rogan_writer?schema=public
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key-here
NODE_ENV=production
OPENAI_API_KEY=sk-...
# ... other env vars
```

### Step 5: Run Migrations

```bash
npx prisma migrate deploy
npx prisma generate
```

### Step 6: Build Application

```bash
npm run build
```

### Step 7: Set Up PM2

```bash
# Install PM2 globally (if not already installed)
sudo npm install -g pm2

# Start application with PM2
pm2 start npm --name "rogan-writer" -- start

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
# Run the command it outputs
```

### Step 8: Set Up Nginx (Reverse Proxy)

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/rogan-writer
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;

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
        
        # Increase timeouts for long-running requests
        proxy_read_timeout 600s;
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/rogan-writer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 9: Set Up SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Step 10: Set Up Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Environment Variables Checklist

### Required
```bash
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NODE_ENV=production
```

### Optional (for full functionality)
```bash
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=...
REDIS_URL=...
```

---

## Database Setup

### For DigitalOcean Managed Database

1. Create PostgreSQL database in DigitalOcean
2. Enable **pgvector** extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Get connection string from database dashboard
4. Use it as `DATABASE_URL`

### For Self-Managed PostgreSQL

See Step 3 in Droplet setup above.

---

## Deployment Updates

### App Platform
- Push to GitHub → Auto-deploys
- Or manually trigger deployment in dashboard

### Droplet
```bash
ssh user@your-droplet-ip
cd /var/www/rogan-writer/current
git pull origin main
npm install
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart rogan-writer
```

---

## Monitoring & Logs

### App Platform
- View logs in App Platform dashboard
- Set up alerts for errors

### Droplet (PM2)
```bash
# View logs
pm2 logs rogan-writer

# Monitor
pm2 monit

# Status
pm2 status
```

---

## Troubleshooting

### Build Failures
- Check environment variables are set correctly
- Verify `DATABASE_URL` is accessible
- Check build logs in App Platform or PM2 logs

### Database Connection Issues
- Verify `DATABASE_URL` format
- Check firewall rules allow database access
- Ensure pgvector extension is installed

### Timeout Issues
- **App Platform**: Upgrade to higher tier or use Droplet
- **Droplet**: Increase Nginx timeouts (already configured above)

### Long-Running Tasks
- **App Platform**: Has timeout limits (60s-300s depending on plan)
- **Droplet**: No timeout limits, perfect for book generation

---

## Advantages of Each Option

### App Platform
✅ Easy setup  
✅ Auto-scaling  
✅ Managed infrastructure  
✅ Auto-deployments  
❌ Timeout limits (60s-300s)  
❌ More expensive  

### Droplet
✅ Full control  
✅ No timeout limits  
✅ More cost-effective  
✅ Better for long-running tasks  
❌ Manual setup required  
❌ Manual scaling  

---

## Recommended Setup

- **For production with long book generation**: Use **Droplet** (no timeout limits)
- **For quick setup/testing**: Use **App Platform**
- **For high traffic**: Use **App Platform** with auto-scaling

---

## Next Steps

1. Set up your database (managed or self-hosted)
2. Configure environment variables
3. Deploy using your chosen method
4. Set up monitoring and alerts
5. Configure backups for database

