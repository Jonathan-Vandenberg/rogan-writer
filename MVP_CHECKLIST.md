# MVP Checklist - Main Features

Simplified checklist focusing on core functionality for MVP deployment.

---

## 1. Authentication & Security ✅

- [ ] User authentication (NextAuth)
- [ ] Database user with password
- [ ] API keys configured (OpenAI, Google OAuth)
- [ ] HTTPS/SSL certificate
- [ ] Environment variables secured

---

## 2. Database Setup ✅

- [ ] PostgreSQL installed
- [ ] Database `rogan_writer` created
- [ ] User `rogan_user` created with password
- [ ] pgvector extension enabled
- [ ] Migrations run successfully
- [ ] Connection string configured

---

## 3. Core Application Features ✅

- [ ] User can create/login
- [ ] User can create books
- [ ] User can generate chapters (draft agent)
- [ ] User can edit chapters (editor agent)
- [ ] AI analysis works (character, plot, etc.)
- [ ] Research items saved
- [ ] Audio generation (TTS) works

---

## 4. API Endpoints ✅

- [ ] `/api/books` - CRUD operations
- [ ] `/api/books/[id]/generate-draft` - Draft generation
- [ ] `/api/books/[id]/ai-analyze` - AI analysis
- [ ] `/api/books/[id]/chapters/[id]/audio` - Audio generation
- [ ] `/api/user/settings` - User settings
- [ ] Database migrations endpoint

---

## 5. Frontend Pages ✅

- [ ] Home/Dashboard page
- [ ] Book creation/editing
- [ ] Chapter editing
- [ ] Settings page
- [ ] Authentication pages (login/signup)

---

## 6. Deployment ✅

- [ ] Server setup (Node.js, PM2, Nginx)
- [ ] GitHub Actions workflow working
- [ ] Files deployed to `/var/www/rogan-writer`
- [ ] Application starts with PM2
- [ ] Nginx reverse proxy configured
- [ ] SSL certificate active
- [ ] Domain points to server

---

## 7. Configuration ✅

- [ ] Environment variables set
- [ ] Database URL correct
- [ ] NextAuth URL matches domain
- [ ] API keys valid
- [ ] Prisma client generated
- [ ] Build completes successfully

---

## 8. Testing ✅

- [ ] Application loads in browser
- [ ] User can authenticate
- [ ] Can create a book
- [ ] Can generate a chapter
- [ ] Can save edits
- [ ] No console errors
- [ ] API calls succeed

---

## Quick Health Check

Run these commands on server:

```bash
# Check PM2 status
pm2 status

# Check if app is running
curl http://localhost:3000

# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check database
sudo -u postgres psql -d rogan_writer -c "SELECT COUNT(*) FROM books;"

# Check logs
pm2 logs rogan-writer --lines 50
```

---

## Common Issues

- **Port 3000 in use**: `fuser -k 3000/tcp && pm2 restart rogan-writer`
- **Database connection fails**: Check `DATABASE_URL` in `.env`
- **Build files missing**: Check GitHub Actions deployment logs
- **PM2 not starting**: Check `pm2 logs` for errors

---

**Total Items:** ~30 main features  
**Focus:** Core functionality, not detailed acceptance criteria

---

**Last Updated:** 2025-01-27

