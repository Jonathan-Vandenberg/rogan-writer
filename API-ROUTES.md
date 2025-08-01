# API Routes Documentation

This document lists all the implemented API routes for the Rogan Writer application.

## Authentication & User Management

### User Routes
- `GET /api/user` - Get current user profile
- `GET /api/dashboard` - Get dashboard data (books, stats, etc.)

### Authentication Routes (NextAuth.js)
- `GET|POST /api/auth/[...nextauth]` - NextAuth.js authentication endpoints
- `GET /auth/signin` - Sign-in page

## Book Management

### Books
- `GET /api/books` - Get all books for current user
- `POST /api/books` - Create new book

### Chapters
- `GET /api/books/[bookId]/chapters` - Get chapters for a book
- `POST /api/books/[bookId]/chapters` - Create new chapter
- `GET /api/chapters/[chapterId]` - Get specific chapter
- `PUT /api/chapters/[chapterId]` - Update chapter
- `DELETE /api/chapters/[chapterId]` - Delete chapter

### Pages
- `GET /api/chapters/[chapterId]/pages` - Get pages for a chapter
- `POST /api/chapters/[chapterId]/pages` - Create new page
- `GET /api/pages/[pageId]` - Get specific page
- `PUT /api/pages/[pageId]` - Update page content
- `DELETE /api/pages/[pageId]` - Delete page

## World Building & Characters

### Characters
- `GET /api/books/[bookId]/characters` - Get characters for a book
- `POST /api/books/[bookId]/characters` - Create new character
- `GET /api/characters/[characterId]` - Get specific character
- `PUT /api/characters/[characterId]` - Update character
- `DELETE /api/characters/[characterId]` - Delete character

### Locations
- `GET /api/books/[bookId]/locations` - Get locations for a book
- `POST /api/books/[bookId]/locations` - Create new location
- `GET /api/locations/[locationId]` - Get specific location
- `PUT /api/locations/[locationId]` - Update location
- `DELETE /api/locations/[locationId]` - Delete location

## Story Structure & Planning

### Plot Points (7-Point Structure)
- `GET /api/books/[bookId]/plot-points` - Get plot points for a book
- `POST /api/books/[bookId]/plot-points` - Create new plot point

### Timeline Events
- `GET /api/books/[bookId]/timeline-events` - Get timeline events for a book
- `POST /api/books/[bookId]/timeline-events` - Create new timeline event

### Scene Cards
- `GET /api/books/[bookId]/scene-cards` - Get scene cards for a book
- `POST /api/books/[bookId]/scene-cards` - Create new scene card

### Brainstorming Notes
- `GET /api/books/[bookId]/brainstorming` - Get brainstorming notes for a book
- `POST /api/books/[bookId]/brainstorming` - Create new brainstorming note

### Research Items
- `GET /api/books/[bookId]/research-items` - Get research items for a book
- `POST /api/books/[bookId]/research-items` - Create new research item

## Writing & Progress Tracking

### Writing Sessions
- `GET /api/writing-sessions` - Get writing sessions for current user
- `POST /api/writing-sessions` - Create new writing session

## Collaboration & Feedback

### Collaborators
- `GET /api/books/[bookId]/collaborators` - Get collaborators for a book
- `POST /api/books/[bookId]/collaborators` - Invite new collaborator

### Comments
- `GET /api/pages/[pageId]/comments` - Get comments for a page
- `POST /api/pages/[pageId]/comments` - Create new comment on page

## Version Control & Export

### Book Versions
- `GET /api/books/[bookId]/versions` - Get versions for a book
- `POST /api/books/[bookId]/versions` - Create new book snapshot

### Exports
- `GET /api/exports` - Get exports for current user
- `POST /api/exports` - Request new book export

## API Response Format

All API routes follow consistent patterns:

### Success Responses
```json
{
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Responses
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes
- `200` - Success (GET, PUT)
- `201` - Created (POST)
- `204` - No Content (DELETE)
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Authentication

All routes (except `/api/auth/*`) require authentication via NextAuth.js sessions. Unauthenticated requests will receive a `401 Unauthorized` response.

## CRUD Operations Summary

### Implemented Entities with Full CRUD:
✅ **Books** - GET (list), POST (create), GET (single), PUT (update), DELETE (delete)  
✅ **Chapters** - GET (list), POST (create), GET (single), PUT (update), DELETE (delete)  
✅ **Pages** - GET (list), POST (create), GET (single), PUT (update), DELETE (delete)  
✅ **Characters** - GET (list), POST (create), GET (single), PUT (update), DELETE (delete)  
✅ **Locations** - GET (list), POST (create), GET (single), PUT (update), DELETE (delete)  

### Partially Implemented (Collection + Create):
📝 **Plot Points** - GET (list), POST (create)  
📝 **Timeline Events** - GET (list), POST (create)  
📝 **Scene Cards** - GET (list), POST (create)  
📝 **Research Items** - GET (list), POST (create)  
📝 **Brainstorming Notes** - GET (list), POST (create)  
📝 **Writing Sessions** - GET (list), POST (create)  
📝 **Collaborators** - GET (list), POST (create)  
📝 **Comments** - GET (list), POST (create)  
📝 **Book Versions** - GET (list), POST (create)  
📝 **Exports** - GET (list), POST (create)  

### Next Steps
To complete the API, individual routes (GET, PUT, DELETE) need to be added for the partially implemented entities.

## Service Integration

Each API route uses the corresponding service class:
- `UserService` - User operations
- `BookService` - Book operations  
- `ChapterService` - Chapter operations
- `PageService` - Page operations
- `CharacterService` - Character operations
- `LocationService` - Location operations
- `PlotService` - Plot point operations
- `TimelineEventService` - Timeline operations
- `SceneCardService` - Scene card operations
- `ResearchItemService` - Research operations
- `BrainstormingService` - Brainstorming operations
- `WritingSessionService` - Writing session operations
- `BookCollaboratorService` - Collaboration operations
- `CommentService` - Comment operations
- `BookVersionService` - Version control operations
- `ExportService` - Export operations

All services are properly typed and include error handling, authentication checks, and database operations. 