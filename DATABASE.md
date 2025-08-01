# Database Setup for Rogan Writer

This application uses PostgreSQL with the pgvector extension for vector operations, which enables AI-powered features like semantic search and context understanding.

## Quick Start

1. **Start the database:**
   ```bash
   nvm use 18 && docker compose up -d
   ```

2. **Generate Prisma client:**
   ```bash
   nvm use 18 && npx prisma generate
   ```

3. **Push schema to database:**
   ```bash
   nvm use 18 && npx prisma db push
   ```

4. **Seed with test data:**
   ```bash
   nvm use 18 && npm run db:seed
   ```

5. **Open database browser:**
   ```bash
   nvm use 18 && npx prisma studio
   ```

## Database Features

### Core Models
- **Users**: Writer accounts with preferences
- **Books**: Multiple books per user with formatting settings
- **Chapters**: Organized book sections
- **Pages**: Individual book pages with content
- **BrainstormingNotes**: Ideas and notes per book

### AI-Enhanced Models
- **Vector Embeddings**: Support for AI semantic search
  - Pages have embeddings for content analysis
  - Characters have embeddings for context
  - Brainstorming notes have embeddings for idea discovery
  - Research items have embeddings for knowledge retrieval

### Writing Structure
- **7-Point Plot Structure**: Based on Dan Wells' system
  - Hook, Plot Turn 1, Pinch 1, Midpoint, Pinch 2, Plot Turn 2, Resolution
  - Supports multiple subplots (main, romance, character, etc.)
- **Characters**: Detailed character database with relationships
- **Locations**: World-building with geography, culture, rules
- **Timeline Events**: Chronological story organization
- **Scene Cards**: Visual story planning

### Collaboration
- **BookCollaborators**: Beta readers, editors, co-authors
- **Comments**: In-line feedback system
- **BookVersions**: Version control with snapshots

### Analytics & Export
- **WritingSessions**: Track writing progress and goals
- **Exports**: Multiple format support (PDF, EPUB, DOCX, TXT, HTML)

## Vector Database Capabilities

The database includes pgvector extension for:
- **Semantic Search**: Find similar content across your book
- **AI Context**: Maintain character and plot consistency
- **Idea Generation**: Discover related concepts in your notes
- **Content Analysis**: AI-powered grammar, pacing, and style analysis

## Environment Configuration

The database connection is configured in `.env`:
```
DATABASE_URL="postgresql://rogan_user:rogan_password@localhost:5432/rogan_writer?schema=public"
```

## Docker Services

- **PostgreSQL 16** with pgvector extension
- **Persistent storage** with Docker volumes
- **Health checks** for reliability
- **Automatic extension setup** via init-db.sql

## Development Commands

```bash
# View database logs
docker compose logs postgres

# Stop database
docker compose down

# Reset database (WARNING: destroys all data)
docker compose down -v
docker compose up -d

# Create migration (for schema changes)
nvm use 18 && npx prisma migrate dev --name "your_migration_name"

# Reset and reseed database
nvm use 18 && npx prisma migrate reset
```

## Production Notes

For production:
1. Change database credentials in docker-compose.yml
2. Use environment variables for sensitive data
3. Enable SSL for database connections
4. Consider using managed PostgreSQL with pgvector support
5. Implement proper backup strategies

## Troubleshooting

### Database Connection Issues
```bash
# Check if database is running
docker compose ps

# Restart database
docker compose restart postgres

# View database logs
docker compose logs postgres
```

### Schema Issues
```bash
# Regenerate Prisma client
nvm use 18 && npx prisma generate

# Reset database to match schema
nvm use 18 && npx prisma db push --force-reset
```

### Seed Data Issues
```bash
# Re-run seed script
nvm use 18 && npm run db:seed
```

The database is now ready for your book writing application with full AI capabilities! 