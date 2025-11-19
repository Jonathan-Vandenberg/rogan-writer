# DigitalOcean Deployment with GitHub Actions

This guide shows how to deploy to DigitalOcean using GitHub Actions workflows, including automatic database setup.

## Prerequisites

1. **DigitalOcean Account** with API token
2. **GitHub Repository** with your code
3. **GitHub Secrets** configured (see below)

## Step 1: Create DigitalOcean API Token

1. Go to [DigitalOcean API Tokens](https://cloud.digitalocean.com/account/api/tokens)
2. Click **Generate New Token**
3. Name it: `github-actions-deploy`
4. Copy the token (you'll only see it once!)

## Step 2: Add GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

| Secret Name | Description | Example |
|------------|-------------|---------|
| `DIGITALOCEAN_ACCESS_TOKEN` | Your DigitalOcean API token | `dop_v1_abc123...` |
| `DATABASE_URL` | PostgreSQL connection string (set after creating DB) | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_SECRET` | Secret for NextAuth (generate with `openssl rand -base64 32`) | `your-secret-here` |
| `OPENAI_API_KEY` | OpenAI API key (optional) | `sk-...` |
| `XAI_API_KEY` | X.AI API key (optional) | `xai-...` |
| `AWS_ACCESS_KEY_ID` | AWS access key (optional) | `...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key (optional) | `...` |
| `AWS_REGION` | AWS region (optional) | `us-east-1` |
| `AWS_S3_BUCKET_NAME` | S3 bucket name (optional) | `...` |

## Step 3: Update App Configuration

Edit `.do/app.yaml` and update:
- `repo: your-username/rogan-writer` → Your actual GitHub username/repo

## Step 4: Create Database (One-Time Setup)

### Option A: Using GitHub Actions Workflow

1. Go to **Actions** tab in GitHub
2. Select **"Setup DigitalOcean Database"** workflow
3. Click **Run workflow**
4. Choose your region (default: nyc1)
5. Click **Run workflow**

This will:
- Create a PostgreSQL 16 database
- Set it up with the name `rogan-writer-db`
- Show you connection details

**After database is created:**
1. Go to DigitalOcean dashboard → **Databases** → **rogan-writer-db**
2. Click **"Users & Databases"** tab
3. Note the connection details
4. **Enable pgvector extension:**
   - Click **"Connection Details"** → **"Connection Pooling"** → **"Connect using connection string"**
   - Or use `doctl`:
     ```bash
     doctl databases connection <DB_ID> --format ConnectionURI
     ```
   - Connect to the database and run:
     ```sql
     CREATE EXTENSION IF NOT EXISTS vector;
     ```

5. Copy the connection string and add it to GitHub Secrets as `DATABASE_URL`

### Option B: Manual Setup

1. Go to [DigitalOcean Databases](https://cloud.digitalocean.com/databases)
2. Click **Create Database**
3. Choose:
   - **Engine**: PostgreSQL 16
   - **Plan**: Dev Database (or higher for production)
   - **Region**: Choose closest to your app
   - **Database Name**: `rogan_writer`
   - **Database User**: `rogan_user`
4. Click **Create Database**
5. After creation, enable pgvector:
   - Connect to database
   - Run: `CREATE EXTENSION IF NOT EXISTS vector;`
6. Get connection string and add to GitHub Secrets as `DATABASE_URL`

## Step 5: Deploy

### Automatic Deployment (on push to main)

Just push to main branch:
```bash
git add .
git commit -m "Deploy to DigitalOcean"
git push origin main
```

The workflow will:
1. Run linting and type checking
2. Check/create database (if needed)
3. Run database migrations
4. Deploy to DigitalOcean App Platform
5. Wait for deployment to complete

### Manual Deployment

1. Go to **Actions** tab
2. Select **"Deploy to DigitalOcean"** workflow
3. Click **Run workflow**
4. Select branch (usually `main`)
5. Click **Run workflow**

## Step 6: Monitor Deployment

### View Logs

1. **GitHub Actions**: Check the workflow run logs
2. **DigitalOcean Dashboard**: Go to Apps → rogan-writer → Deployments

### Check App Status

```bash
# Install doctl locally (optional)
brew install doctl  # macOS
# or download from: https://github.com/digitalocean/doctl

# Login
doctl auth init

# List apps
doctl apps list

# Get app details
doctl apps get <APP_ID>

# View logs
doctl apps logs <APP_ID> --type run
```

## Workflow Files

### `.github/workflows/deploy-digitalocean.yml`
- Main deployment workflow
- Runs on push to main
- Creates/updates database
- Runs migrations
- Deploys to App Platform

### `.github/workflows/setup-database.yml`
- One-time database setup
- Can be run manually via workflow_dispatch
- Creates database with correct settings

## Environment Variables

The `.do/app.yaml` file references these environment variables from GitHub Secrets:

- `DATABASE_URL` - Auto-set from database component
- `NEXTAUTH_SECRET` - From GitHub Secrets
- `OPENAI_API_KEY` - From GitHub Secrets (optional)
- `XAI_API_KEY` - From GitHub Secrets (optional)
- `AWS_*` - From GitHub Secrets (optional)

## Database Migrations

Migrations run automatically during deployment via:
```bash
npx prisma migrate deploy
```

This happens in the `build_command` in `.do/app.yaml`:
```yaml
build_command: npx prisma migrate deploy && npm run build
```

## Troubleshooting

### Database Creation Fails

- Check `DIGITALOCEAN_ACCESS_TOKEN` is set correctly
- Verify you have permissions to create databases
- Check DigitalOcean account limits

### Migration Fails

- Verify `DATABASE_URL` is set correctly in GitHub Secrets
- Check database is accessible from App Platform
- Ensure pgvector extension is enabled
- Check migration files are correct

### Deployment Fails

- Check build logs in GitHub Actions
- Verify all environment variables are set
- Check DigitalOcean App Platform logs
- Ensure `.do/app.yaml` is correct

### App Not Accessible

- Check deployment status in DigitalOcean dashboard
- Verify health check endpoint (if configured)
- Check app logs: `doctl apps logs <APP_ID>`

## Updating the Deployment

### Change Environment Variables

1. Update GitHub Secrets
2. Push to main (auto-deploys)
3. Or manually trigger deployment

### Update Database

Migrations run automatically on each deployment. To run manually:

```bash
# Via doctl
doctl apps create-deployment <APP_ID> --force-rebuild

# Or via GitHub Actions
# Just push to main branch
```

### Scale App

Edit `.do/app.yaml`:
```yaml
instance_size_slug: basic-xs  # Change to basic-s, basic-m, etc.
instance_count: 1  # Increase for multiple instances
```

Then push to main or manually trigger deployment.

## Cost Estimation

- **App Platform**: ~$5-12/month (basic-xs, 1 instance)
- **Database**: ~$15/month (dev database) or ~$60/month (production)
- **Total**: ~$20-72/month depending on plan

## Next Steps

1. Set up custom domain in DigitalOcean App Platform
2. Configure SSL (automatic with custom domain)
3. Set up monitoring and alerts
4. Configure backups for database
5. Set up staging environment (create another app)

