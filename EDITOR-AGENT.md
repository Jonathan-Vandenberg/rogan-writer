# Editor Agent - AI-Powered Chapter Editing

## Overview

The Editor Agent is an AI-powered chapter editing feature that uses **Grok 4 Fast** (`grok-4-fast-non-reasoning`) with its massive context window to intelligently analyze and edit your book chapters.

## Key Features

### 🤖 Smart Chapter Loading
- The AI automatically determines which chapters to load based on your request
- Broad requests ("improve dialogue throughout") → loads all chapters
- Targeted requests ("edit chapter 3") → loads specific chapters
- Saves tokens and improves response speed

### 💬 Conversational Interface
- Chat-based interaction for natural editing requests
- Context-aware responses based on conversation history
- Real-time feedback on what the AI is doing

### ✅ Change Review System
- Side-by-side diff viewer showing original vs edited content
- Accept/Reject buttons for each individual change
- "Jump to Next Change" and "Jump to Previous Change" navigation
- Navigate seamlessly across multiple chapters
- Accept All / Reject All for batch operations

### 📝 Chapter Creation
- AI can suggest and create new chapters
- Review new chapter content before accepting
- Automatic order index assignment

### 💾 Safe Application
- Changes are not applied until you explicitly accept them
- Review all changes before committing
- Batch apply multiple accepted changes at once
- Automatic embedding regeneration for modified chapters

## How to Access

1. Open the **Write** page
2. Click the **"AI Tools"** dropdown button (with sparkles icon)
3. Select **"Editor Agent"** from the menu

## How to Use

### Basic Workflow

1. **Open the Editor Agent modal**
   - A split-screen interface appears:
     - Left side: Chat with the AI
     - Right side: Review changes

2. **Make editing requests**
   - Type your editing instruction in natural language
   - Examples:
     - "Improve the dialogue in chapter 3"
     - "Make the opening scene more engaging"
     - "Fix pacing issues throughout the book"
     - "Add more descriptive language to chapter 5"
     - "Create a new chapter between chapters 2 and 3 about the character's backstory"

3. **Review the AI's suggestions**
   - The AI analyzes your request and loads appropriate chapters
   - Proposed changes appear in the right panel
   - Each change shows:
     - Chapter title
     - Description of why the change was made
     - Diff view (red = removed, green = added)

4. **Accept or reject changes**
   - Click **"Accept"** on changes you want to keep
   - Click **"Reject"** on changes you want to discard
   - Use **"Accept All"** or **"Reject All"** for batch operations
   - Navigate between changes with **"Next"** and **"Previous"** buttons

5. **Apply accepted changes**
   - Click the **"Apply X Changes"** button at the top right
   - All accepted changes are saved to your chapters
   - The AI confirms the successful application

### Example Conversations

#### Example 1: Targeted Edit
```
You: Improve the dialogue in chapter 3

AI: I'll analyze chapter 3 and enhance the dialogue to make it more natural and engaging. Loading chapter 3...

[AI proposes specific dialogue improvements]

You: [Review changes, accept the ones you like]

You: Apply 3 Changes

AI: ✅ Successfully applied 3 edits. Your changes have been saved!
```

#### Example 2: Broad Improvement
```
You: Make the descriptions more vivid throughout the entire book

AI: I'll load all chapters and enhance descriptive passages to create more vivid imagery and sensory details...

[AI proposes multiple changes across all chapters]

You: [Navigate through changes with Next/Previous, accept/reject individually]

You: Apply 12 Changes

AI: ✅ Successfully applied 12 edits. Your changes have been saved!
```

#### Example 3: Create New Chapter
```
You: Create a new chapter that shows the protagonist's childhood

AI: I'll create a new chapter exploring the protagonist's childhood that fits naturally into your story's timeline...

[AI suggests a new chapter with full content]

You: [Review the new chapter, accept if you like it]

You: Apply 1 Changes

AI: ✅ Successfully created 1 new chapter. Your changes have been saved!
```

## Technical Details

### AI Model
- **Model**: `grok-4-fast-non-reasoning` (Grok 4 Fast)
- **Provider**: X.AI
- **Context Window**: Massive (can handle entire books)
- **Temperature**: 0.7 (balanced creativity and accuracy)

### Smart Features

#### Chapter Selection Logic
The AI uses a two-step process:
1. Analyzes your request to determine scope
2. Loads only the necessary chapters:
   - **All chapters**: for requests like "throughout the book", "all chapters", "entire manuscript"
   - **Specific chapters**: for requests mentioning chapter numbers or specific scenes
   - **None**: for general questions or when more information is needed

#### Diff Generation
- Uses unified diff format
- Color-coded changes:
  - 🔴 Red/strikethrough = removed text
  - 🟢 Green = added text
  - ⚪ White = unchanged text

#### Change Management
- Changes are stored in React state (not database) until applied
- Each change includes:
  - Chapter ID and title
  - Original content
  - Edited content
  - AI's reasoning
  - Diff visualization
  - Status (pending/accepted/rejected)

### Database Integration
- Automatically updates chapter word counts
- Regenerates embeddings for modified chapters
- Updates book `updatedAt` timestamp
- Maintains chapter order indices for new chapters

## Tips for Best Results

### Writing Clear Requests

✅ **Good:**
- "Improve the dialogue in chapter 3 to sound more natural"
- "Add more tension to the confrontation scene in chapter 7"
- "Make the opening paragraph more engaging"
- "Fix grammatical errors throughout the book"

❌ **Avoid:**
- "Make it better" (too vague)
- "Fix everything" (unclear scope)
- One-word requests like "Edit"

### Reviewing Changes

1. **Read carefully**: The AI is powerful but not perfect
2. **Accept selectively**: You don't have to accept all suggestions
3. **Use navigation**: Jump between changes to review efficiently
4. **Batch apply**: Accept multiple changes before applying

### Conversation Flow

- The AI remembers your conversation history
- You can refine requests based on previous responses
- Ask follow-up questions for clarification
- Request alternative suggestions if you don't like the first attempt

## Troubleshooting

### No Chapters Loaded
- **Issue**: AI responds but doesn't load chapters
- **Solution**: Be more specific about which chapters you want to edit

### Changes Not Appearing
- **Issue**: AI seems to process but no changes show up
- **Solution**: Check that the AI's response type is "edit" (not just a message)

### API Errors
- **Issue**: "Failed to process editing request"
- **Solution**: Check that your `XAI_API_KEY` is correctly configured in `.env.local`

### Slow Response
- **Issue**: AI takes a long time to respond
- **Solution**: This is normal for large books. The AI is processing all chapter content.

## API Configuration

Ensure your `.env.local` file contains:

```env
XAI_API_KEY=your_xai_api_key_here
```

Get your API key from: https://x.ai/api

## Keyboard Shortcuts

- **Enter**: Send message
- **Shift + Enter**: New line in input

## Future Enhancements

Potential features for future releases:
- [ ] Streaming responses for real-time feedback
- [ ] Side-by-side comparison view
- [ ] Change history and undo
- [ ] Export changes as a diff file
- [ ] Style-specific editing (formal, casual, poetic, etc.)
- [ ] Character voice consistency checking
- [ ] Batch editing commands

## Support

For issues or feature requests, please refer to the main project documentation or open an issue in the repository.

