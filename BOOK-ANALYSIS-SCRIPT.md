# Book Content Analysis and Population Script

This document describes the complete implementation of an AI-powered book content analysis system that automatically extracts and creates book entities (characters, locations, timeline events, etc.) from raw book content.

## 🚀 What This Script Does

The book analysis script takes raw book content and:

1. **Analyzes Content with OpenAI**: Uses GPT-4 to intelligently extract entities from the text
2. **Creates Database Entities**: Automatically populates your database with:
   - **Characters** (with roles, descriptions, personalities, backstories)
   - **Locations** (with geography, culture, rules)
   - **Timeline Events** (with character/location relationships)
   - **Plot Points** (following 7-point story structure)
   - **Scene Cards** (with purpose, conflict, outcome)
   - **Research Items** (topics requiring further research)
3. **Maintains Relationships**: Links timeline events to characters and locations
4. **Provides Progress Tracking**: Shows detailed progress and results

## 📁 Files Created

### Core Implementation

1. **`src/app/api/books/[bookId]/analyze-content/route.ts`**
   - OpenAI integration API endpoint
   - Processes book content and returns structured analysis
   - Handles authentication and error management

2. **`scripts/analyze-and-populate-book.ts`**
   - Main script that orchestrates the entire process
   - Makes API calls to create all entities
   - Handles relationships and error recovery
   - CLI interface with flexible options

3. **`scripts/test-analysis.ts`**
   - Simple test script with sample content
   - Quick way to verify functionality

4. **`scripts/example-usage.md`**
   - Comprehensive usage examples
   - Sample book content for testing
   - Troubleshooting guide

## 🛠 Installation & Setup

### Prerequisites

1. **OpenAI API Key**: Set your OpenAI API key in environment variables:
   ```bash
   export OPENAI_API_KEY="your-openai-api-key-here"
   ```

2. **Development Server**: Ensure your Next.js server is running:
   ```bash
   npm run dev
   ```

3. **Book ID**: Create a book in your system and note its ID

### Dependencies

The script uses existing dependencies in your project:
- `openai` - Already installed for OpenAI API integration
- `@prisma/client` - For database operations
- `next-auth` - For authentication

Optional: Install `tsx` for easier TypeScript execution:
```bash
npm install --save-dev tsx
```

## 📖 Usage Examples

### Quick Test (Dry Run)
```bash
# Test the analysis without making database changes
npm run analyze:test your-book-id-here
```

### Basic Usage
```bash
# Analyze content from a string (dry run by default)
npm run analyze:book -- --bookId="abc123" --content="Your book content here..."

# Analyze content from a file
npm run analyze:book -- --bookId="abc123" --file="path/to/book.txt"

# Actually create entities (not dry run)
npm run analyze:book -- --bookId="abc123" --file="book.txt" --no-dry-run
```

### Advanced Options
```bash
# With custom base URL and authentication
npm run analyze:book -- \
  --bookId="abc123" \
  --file="book.txt" \
  --baseUrl="https://your-domain.com" \
  --sessionToken="your-session-token" \
  --no-dry-run
```

## 🔄 How It Works

### Step 1: Content Analysis
- Sends book content to OpenAI GPT-4
- Uses sophisticated prompt engineering to extract structured data
- Returns JSON with all identified entities

### Step 2: Entity Creation
The script creates entities in this order to maintain relationships:

1. **Characters** - Created first so they can be referenced
2. **Locations** - Created second for referencing
3. **Timeline Events** - Can reference characters and locations
4. **Plot Points** - Story structure elements
5. **Scene Cards** - Individual scene breakdowns
6. **Research Items** - Topics for further research

### Step 3: Relationship Linking
- Timeline events are automatically linked to characters and locations
- Character and location names are matched to create proper relationships
- Maintains referential integrity

## 📊 Expected Output

For a typical book chapter, the script will create:

- **Characters**: Protagonist, antagonist, supporting characters with full profiles
- **Locations**: All mentioned places with detailed descriptions
- **Timeline Events**: 5-15 key events with proper sequencing
- **Plot Points**: Major story beats according to 7-point structure
- **Scene Cards**: Individual scenes with conflict and purpose
- **Research Items**: Real-world references that need verification

## 🎯 Sample Analysis Result

```json
{
  "characters": [
    {
      "name": "Sarah Chen",
      "role": "PROTAGONIST",
      "description": "A young archaeologist with curly brown hair",
      "personality": "Curious, determined, brave",
      "backstory": "Grew up fascinated by ancient mysteries"
    }
  ],
  "locations": [
    {
      "name": "Eldermoor Library",
      "description": "Ancient Gothic library with mystical properties",
      "geography": "Stone building covered in ivy",
      "culture": "Reverence for knowledge and written word"
    }
  ],
  "timelineEvents": [
    {
      "title": "Sarah arrives at Eldermoor",
      "startTime": 1,
      "endTime": 5,
      "characterName": "Sarah Chen",
      "locationName": "Eldermoor Library"
    }
  ]
}
```

## 🔧 Configuration

### OpenAI Model Settings

The script uses:
- **Model**: `gpt-4-turbo-preview`
- **Temperature**: `0.3` (for consistent results)
- **Max Tokens**: `4000`

### API Endpoints Used

- `POST /api/books/[bookId]/analyze-content` - Content analysis
- `POST /api/books/[bookId]/characters` - Character creation
- `POST /api/books/[bookId]/locations` - Location creation
- `POST /api/books/[bookId]/timeline-events` - Timeline event creation
- `POST /api/books/[bookId]/plot-points` - Plot point creation
- `POST /api/books/[bookId]/scene-cards` - Scene card creation
- `POST /api/books/[bookId]/research-items` - Research item creation

## 🚨 Error Handling

The script includes comprehensive error handling:

- **OpenAI API errors**: Quota, rate limits, invalid keys
- **Database errors**: Validation, constraint violations
- **Network errors**: Connection issues, timeouts
- **Authentication errors**: Invalid sessions, permissions

Failed entity creation doesn't stop the entire process - it logs errors and continues.

## 🔍 Dry Run Mode

By default, the script runs in "dry run" mode:
- Analyzes content with OpenAI
- Shows what would be created
- Doesn't make actual database changes
- Perfect for testing and validation

Use `--no-dry-run` to actually create entities.

## 📈 Performance Considerations

- **Content Length**: Optimize for 2000-8000 character chunks
- **API Limits**: Respects OpenAI rate limits
- **Batch Processing**: Creates entities efficiently
- **Memory Usage**: Streams large files when possible

## 🔐 Security

- **Authentication**: Supports session token authentication
- **Validation**: Validates all input data
- **Error Sanitization**: Doesn't expose sensitive information
- **Rate Limiting**: Respects API limits

## 🧪 Testing

Test the script with the provided sample content:

```bash
# Quick test with built-in sample
npm run analyze:test your-book-id

# Test with custom content
echo "Your test content here..." > test-book.txt
npm run analyze:book -- --bookId="test-id" --file="test-book.txt"
```

## 🎉 Integration

This script integrates seamlessly with your existing Rogan Writer application:

- Uses existing authentication system
- Follows established API patterns
- Maintains database relationships
- Supports existing UI components

The created entities will appear in your existing:
- Character management pages
- Location views
- Timeline interfaces
- Plot structure tools
- Scene card boards

## 📝 Customization

### Modify Analysis Prompts

Edit the system prompt in `src/app/api/books/[bookId]/analyze-content/route.ts` to:
- Focus on specific literary elements
- Adjust character role classifications
- Modify plot structure frameworks
- Add custom entity types

### Extend Entity Types

Add new entity types by:
1. Creating corresponding API routes
2. Adding service methods
3. Updating the analysis script
4. Modifying the OpenAI prompt

### Custom Processing

The `BookAnalysisPopulator` class can be extended for:
- Custom validation logic
- Additional relationship handling
- Specialized entity processing
- Integration with other AI services

This comprehensive system transforms raw book content into a rich, structured database that powers all the advanced features of your writing application!