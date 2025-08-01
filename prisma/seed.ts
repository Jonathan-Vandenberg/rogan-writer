const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create a test user
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test Writer',
      theme: 'light',
      defaultBookFormat: '6x9',
      dailyWordGoal: 1000,
    },
  })

  console.log('👤 Created user:', user.name)

  // Create a test book
  const book = await prisma.book.upsert({
    where: { id: 'test-book-id' },
    update: {},
    create: {
      id: 'test-book-id',
      title: 'The Great Novel',
      description: 'A compelling story about a writer building an app for writers',
      genre: 'Fiction',
      targetWords: 80000,
      status: 'IN_PROGRESS',
      userId: user.id,
      pageWidth: 6.0,
      pageHeight: 9.0,
      fontSize: 12,
      fontFamily: 'Times New Roman',
      lineHeight: 1.5,
    },
  })

  console.log('📚 Created book:', book.title)

  // Create sample chapters with content
  const chapter1Content = `The Clockmaker's Apprentice

In the heart of a crooked little town nestled between rolling hills and whispering forests, there lived an old man named Elric, the town's only clockmaker. His shop was a curious place—ticking with hundreds of clocks that lined the walls, hung from rafters, or stood tall in corners. The people of Windmere often joked that if time ever stopped, it would be Elric's doing.

No one really knew how old Elric was. Some said he had built the town's first church bell; others whispered he had once mended a king's watch. Children believed he could talk to time itself. But what everyone agreed on was this: Elric's clocks never failed.

One crisp autumn morning, a boy arrived at Elric's door. Barely fifteen, with messy hair and a satchel slung across his shoulder, the boy introduced himself as Jorin. He had come from the northern valleys, where his parents had passed, leaving him with nothing but a love of gears and springs. Elric, who rarely took on help, squinted at the boy, muttered something about "too young" and "too hopeful," but let him stay.

The days turned into weeks. Jorin proved himself eager and patient. He swept floors, fetched tools, and, more importantly, watched. He was fascinated by the precision of Elric's work—the way he tuned the smallest parts with gentle fingers, how he listened to the beat of a clock's heart like a physician with a stethoscope. Each clock, Elric said, had its own soul, and each tick a memory.

One rainy afternoon, while sorting parts in the attic, Jorin found a door he had never noticed before. It was small, tucked behind a grandfather clock with ivy carved into its wood. The door was locked. Curiosity burned in Jorin's chest, but when he asked Elric about it, the old man grew suddenly quiet.

"That room is not for apprentices," Elric said, voice stern. "Some clocks don't just measure time. They hold it."

Jorin nodded but couldn't forget the look in the clockmaker's eyes—a strange mix of fear and sorrow.

Weeks passed. Jorin's skill grew. Elric began letting him repair simpler mechanisms, even sending him to make house calls. One evening, Elric placed a small pocket watch in Jorin's hand. "This," he said, "was the last gift I gave my wife. It stopped the night she died."

Jorin examined the watch. It was beautiful, with intricate engravings of roses and vines, but the hands were frozen at 11:47. He spent hours trying to repair it, but nothing worked. The gears turned, the spring was tight, yet time refused to move.

Frustrated, Jorin stayed late one night, working by candlelight. As the clock tower struck midnight, he heard something strange—a soft ticking coming from behind the locked door. He followed the sound, pressing his ear to the wood. The ticking grew louder, more insistent, as if calling to him.

Without thinking, Jorin tried the handle. To his surprise, it turned.`

  const chapter2Content = `The room beyond was unlike anything Jorin had ever seen. Clocks of every shape and size filled the space, but these were different from the ones in the shop. They glowed faintly, pulsing with an otherworldly light. Some had hands that moved backward, others had too many faces, and a few seemed to tick in languages Jorin couldn't understand.

At the center of the room stood a massive clock, taller than Elric himself, with a pendulum that swung silently. Its face was covered in symbols rather than numbers, and its hands pointed not to time, but to moments—joy, sorrow, love, loss.

"You shouldn't be here."

Jorin spun around to find Elric standing in the doorway, his face pale. The old clockmaker stepped into the room, closing the door behind him.

"These clocks," Elric said, his voice barely above a whisper, "they don't measure time. They capture it. Every significant moment, every turning point in a person's life—trapped in gears and springs."

Jorin stared at the glowing timepieces. "Why?"

"Because some moments are too precious to lose," Elric replied. "And some are too painful to remember." He walked to a small clock on a shelf, its case made of silver and glass. "This one holds the moment I first saw my wife. And that one," he pointed to a clock with a cracked face, "holds the moment she took her last breath."

The boy's mind raced. "The pocket watch—"

"Is special," Elric finished. "It doesn't just hold a moment. It holds all of them—every second I spent with her, every laugh, every tear. But it's been broken since she died, and I've been too afraid to fix it."

Jorin looked down at the watch in his hands. "What happens if you do?"

Elric's eyes filled with tears. "I don't know. Maybe I'll see her again. Maybe I'll have to say goodbye all over again. Or maybe," he took a shaky breath, "maybe I'll finally be able to let her go."

For a long moment, they stood in silence, surrounded by the gentle glow of captured time. Then Jorin held out the watch.

"Let me help," he said.

Together, they worked through the night, two generations bound by grief and hope, trying to mend not just a broken timepiece, but a broken heart. And as the first light of dawn crept through the window, the pocket watch began to tick once more.`

  const chapter1 = await prisma.chapter.upsert({
    where: { id: 'chapter-1' },
    update: {},
    create: {
      id: 'chapter-1',
      title: 'The Beginning',
      description: 'Where our story starts',
      content: chapter1Content,
      orderIndex: 1,
      wordCount: chapter1Content.split(' ').length,
      bookId: book.id,
    },
  })

  const chapter2 = await prisma.chapter.upsert({
    where: { id: 'chapter-2' },
    update: {},
    create: {
      id: 'chapter-2',
      title: 'The Journey',
      description: 'The adventure unfolds',
      content: chapter2Content,
      orderIndex: 2,
      wordCount: chapter2Content.split(' ').length,
      bookId: book.id,
    },
  })

  console.log('📖 Created chapters:', chapter1.title, 'and', chapter2.title)

  // Create sample pages (metadata only - content is in chapters)
  await prisma.page.upsert({
    where: { id: 'page-1-1' },
    update: {},
    create: {
      id: 'page-1-1',
      pageNumber: 1,
      startPosition: 0,
      endPosition: 0, // Will be calculated dynamically
      wordCount: 0, // Will be calculated dynamically
      chapterId: chapter1.id,
    },
  })

  console.log('📄 Created sample page metadata')

  // Create 7-Point Plot Structure
  const plotPoints = [
    { type: 'HOOK', title: 'Hero in opposite state', subplot: 'main', orderIndex: 1 },
    { type: 'PLOT_TURN_1', title: 'Call to adventure', subplot: 'main', orderIndex: 2 },
    { type: 'PINCH_1', title: 'First obstacle', subplot: 'main', orderIndex: 3 },
    { type: 'MIDPOINT', title: 'Point of no return', subplot: 'main', orderIndex: 4 },
    { type: 'PINCH_2', title: 'Dark moment', subplot: 'main', orderIndex: 5 },
    { type: 'PLOT_TURN_2', title: 'Final revelation', subplot: 'main', orderIndex: 6 },
    { type: 'RESOLUTION', title: 'New equilibrium', subplot: 'main', orderIndex: 7 },
  ]

  for (const point of plotPoints) {
    await prisma.plotPoint.upsert({
      where: { 
        bookId_type_subplot: {
          bookId: book.id,
          type: point.type as any,
          subplot: point.subplot,
        }
      },
      update: {},
      create: {
        type: point.type as any,
        title: point.title,
        description: `Plot point for ${point.title}`,
        orderIndex: point.orderIndex,
        subplot: point.subplot,
        bookId: book.id,
      },
    })
  }

  console.log('📊 Created 7-point plot structure')

  // Create sample characters
  const protagonist = await prisma.character.upsert({
    where: { id: 'protagonist-1' },
    update: {},
    create: {
      id: 'protagonist-1',
      name: 'Alex Writer',
      description: 'A passionate writer determined to create the perfect writing app',
      appearance: 'Medium height, thoughtful eyes, always carries a notebook',
      personality: 'Creative, determined, slightly perfectionist',
      backstory: 'Has been writing for years but struggled with existing tools',
      role: 'PROTAGONIST',
      bookId: book.id,
    },
  })

  const antagonist = await prisma.character.upsert({
    where: { id: 'antagonist-1' },
    update: {},
    create: {
      id: 'antagonist-1',
      name: 'The Inner Critic',
      description: 'The voice of doubt and procrastination',
      personality: 'Pessimistic, discouraging, persistent',
      role: 'ANTAGONIST',
      bookId: book.id,
    },
  })

  console.log('👥 Created characters:', protagonist.name, 'and', antagonist.name)

  // Create sample locations
  await prisma.location.upsert({
    where: { id: 'home-office' },
    update: {},
    create: {
      id: 'home-office',
      name: 'Home Office',
      description: 'A cozy writing space with books and coffee stains',
      geography: 'Small room with a large window',
      culture: 'Quiet, creative atmosphere',
      rules: 'No interruptions during writing time',
      bookId: book.id,
    },
  })

  console.log('🏠 Created sample location')

  // Create brainstorming notes
  await prisma.brainstormingNote.upsert({
    where: { id: 'idea-1' },
    update: {},
    create: {
      id: 'idea-1',
      title: 'Character Development',
      content: 'What if the protagonist has a fear of technology that they must overcome?',
      tags: ['character', 'conflict', 'irony'],
      bookId: book.id,
    },
  })

  await prisma.brainstormingNote.upsert({
    where: { id: 'idea-2' },
    update: {},
    create: {
      id: 'idea-2',
      title: 'Plot Twist',
      content: 'The app becomes sentient and starts writing the story itself',
      tags: ['plot', 'twist', 'technology'],
      bookId: book.id,
    },
  })

  console.log('💡 Created brainstorming notes')

  // Create sample timeline events
  await prisma.timelineEvent.upsert({
    where: { id: 'timeline-1' },
    update: {},
    create: {
      id: 'timeline-1',
      title: 'Story Setup',
      description: 'Establish the world and introduce protagonist',
      eventDate: 'Chapter 1',
      startTime: 1,
      endTime: 2,
      orderIndex: 1,
      bookId: book.id,
      characterId: protagonist.id,
    },
  })

  await prisma.timelineEvent.upsert({
    where: { id: 'timeline-2' },
    update: {},
    create: {
      id: 'timeline-2',
      title: 'Inciting Incident',
      description: 'The event that kicks off the main story',
      eventDate: 'Chapter 1-2',
      startTime: 2,
      endTime: 4,
      orderIndex: 2,
      bookId: book.id,
      characterId: protagonist.id,
    },
  })

  await prisma.timelineEvent.upsert({
    where: { id: 'timeline-3' },
    update: {},
    create: {
      id: 'timeline-3',
      title: 'Character Development',
      description: 'Protagonist grows and learns new skills',
      eventDate: 'Mid-story',
      startTime: 3,
      endTime: 8,
      orderIndex: 3,
      bookId: book.id,
      characterId: protagonist.id,
    },
  })

  await prisma.timelineEvent.upsert({
    where: { id: 'timeline-4' },
    update: {},
    create: {
      id: 'timeline-4',
      title: 'Climax',
      description: 'The final confrontation and resolution',
      eventDate: 'Final chapters',
      startTime: 9,
      endTime: 10,
      orderIndex: 4,
      bookId: book.id,
      characterId: protagonist.id,
    },
  })

  await prisma.timelineEvent.upsert({
    where: { id: 'timeline-5' },
    update: {},
    create: {
      id: 'timeline-5',
      title: 'Antagonist Presence',
      description: 'The inner critic challenges the protagonist',
      eventDate: 'Throughout',
      startTime: 1,
      endTime: 9,
      orderIndex: 5,
      bookId: book.id,
      characterId: antagonist.id,
    },
  })

  console.log('📅 Created timeline events')

  // Create sample scene cards
  await prisma.sceneCard.upsert({
    where: { id: 'scene-1' },
    update: {},
    create: {
      id: 'scene-1',
      title: 'Opening Scene',
      description: 'Introduce the protagonist in their normal world',
      purpose: 'Establish character and setting',
      conflict: 'Internal struggle with current writing process',
      outcome: 'Decision to build a better writing tool',
      status: 'COMPLETE',
      orderIndex: 1,
      wordCount: 500,
      bookId: book.id,
      chapterId: chapter1.id,
    },
  })

  await prisma.sceneCard.upsert({
    where: { id: 'scene-2' },
    update: {},
    create: {
      id: 'scene-2',
      title: 'Call to Adventure',
      description: 'Protagonist discovers the need for change',
      purpose: 'Initiate the main story journey',
      conflict: 'Fear of technical challenges',
      outcome: 'Commitment to the project',
      status: 'DRAFT',
      orderIndex: 2,
      wordCount: 750,
      bookId: book.id,
      chapterId: chapter1.id,
    },
  })

  await prisma.sceneCard.upsert({
    where: { id: 'scene-3' },
    update: {},
    create: {
      id: 'scene-3',
      title: 'First Obstacle',
      description: 'Technical difficulties and self-doubt emerge',
      purpose: 'Test protagonist\'s resolve',
      conflict: 'Code not working, feeling overwhelmed',
      outcome: 'Breakthrough moment with help',
      status: 'PLANNED',
      orderIndex: 3,
      wordCount: 0,
      bookId: book.id,
      chapterId: chapter2.id,
    },
  })

  await prisma.sceneCard.upsert({
    where: { id: 'scene-4' },
    update: {},
    create: {
      id: 'scene-4',
      title: 'Mentor Appears',
      description: 'An experienced developer offers guidance',
      purpose: 'Provide wisdom and tools for success',
      conflict: 'Protagonist\'s pride vs accepting help',
      outcome: 'Learning important lessons',
      status: 'PLANNED',
      orderIndex: 4,
      wordCount: 0,
      bookId: book.id,
      chapterId: chapter2.id,
    },
  })

  console.log('🎬 Created scene cards')

  // Create a writing session
  await prisma.writingSession.upsert({
    where: { id: 'session-1' },
    update: {},
    create: {
      id: 'session-1',
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      endTime: new Date(Date.now() - 1 * 60 * 60 * 1000),   // 1 hour ago
      wordsWritten: 500,
      targetWords: 750,
      notes: 'Good writing session, got into the flow',
      completed: true,
      userId: user.id,
      bookId: book.id,
    },
  })

  console.log('⏱️ Created writing session')

  console.log('✅ Database seeding completed!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e)
    await prisma.$disconnect()
    process.exit(1)
  }) 