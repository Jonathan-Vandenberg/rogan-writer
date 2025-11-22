/**
 * Writing Style Prompts
 * 
 * Predefined writing style instructions for different genres and styles.
 * Users can select these in the Draft from Planning modal to guide AI generation.
 */

export interface StylePrompt {
  id: string;
  name: string;
  category: string;
  description: string;
  prompt: string;
}

export const STYLE_PROMPTS: StylePrompt[] = [
  // ===== CHILDREN'S BOOKS =====
  {
    id: 'children-picture-book',
    name: 'Picture Book (Ages 3-6)',
    category: "Children's Books",
    description: 'Simple, rhythmic language with repetition and vivid imagery',
    prompt: `Write in simple, clear language appropriate for ages 3-6. Use short sentences (5-10 words). Include repetition and rhythm to make it fun to read aloud. Focus on vivid, concrete imagery that children can visualize. Use active verbs and avoid abstract concepts. Keep vocabulary age-appropriate. End chapters with satisfying conclusions that feel complete.`
  },
  {
    id: 'children-early-reader',
    name: 'Early Reader (Ages 6-8)',
    category: "Children's Books",
    description: 'Simple sentences, clear plot, age-appropriate vocabulary',
    prompt: `Write for early readers (ages 6-8). Use simple, clear sentences (8-12 words). Keep vocabulary accessible but introduce new words naturally. Focus on action and dialogue. Show character emotions through actions and expressions. Use short paragraphs (2-3 sentences). Include plenty of dialogue to break up text. End chapters with gentle hooks that encourage continued reading.`
  },
  {
    id: 'children-middle-grade',
    name: 'Middle Grade (Ages 8-12)',
    category: "Children's Books",
    description: 'Engaging adventure with relatable characters and clear themes',
    prompt: `Write for middle-grade readers (ages 8-12). Use clear, engaging prose with varied sentence length. Focus on action, adventure, and relatable characters. Show don't tell - use dialogue and action to reveal character. Include sensory details to bring scenes to life. Keep chapters short (1500-2500 words) with clear chapter breaks. End chapters with hooks that create anticipation. Address themes appropriate for this age group.`
  },
  {
    id: 'children-young-adult',
    name: 'Young Adult (Ages 13-17)',
    category: "Children's Books",
    description: 'Complex themes, authentic voice, coming-of-age focus',
    prompt: `Write for young adult readers (ages 13-17). Use authentic, contemporary voice that resonates with teens. Address complex themes honestly but with hope. Include realistic dialogue that sounds like real teenagers. Show character growth and internal conflict. Use varied sentence structure for rhythm and pacing. Include sensory details and emotional depth. End chapters with strong hooks or emotional beats. Chapters can be longer (2500-4000 words).`
  },

  // ===== FICTION - LITERARY =====
  {
    id: 'literary-fiction',
    name: 'Literary Fiction',
    category: 'Fiction - Literary',
    description: 'Rich prose, deep character exploration, thematic depth',
    prompt: `Write literary fiction with rich, evocative prose. Focus on deep character development and internal psychology. Use sophisticated vocabulary and varied sentence structure. Include subtle symbolism and thematic layers. Show character through nuanced actions and thoughts. Use vivid, sensory descriptions that serve the story. End chapters with emotional resonance or thematic significance. Prioritize character arc over plot.`
  },
  {
    id: 'literary-poetic',
    name: 'Literary - Poetic/Lyrical',
    category: 'Fiction - Literary',
    description: 'Lyrical prose with rich metaphors and beautiful imagery',
    prompt: `Write in a lyrical, poetic style with rich metaphors and vivid imagery. Use figurative language (metaphors, similes, personification) throughout. Vary sentence length for rhythm and musicality. Include sensory details that create atmosphere. Show emotion through imagery rather than direct statement. Use alliteration and other sound devices where natural. End chapters with poetic resonance. Prioritize beauty of language alongside story.`
  },
  {
    id: 'literary-minimalist',
    name: 'Literary - Minimalist',
    category: 'Fiction - Literary',
    description: 'Sparse prose, subtext, what is left unsaid',
    prompt: `Write in a minimalist style with sparse, precise prose. Use short, declarative sentences. Show emotion through subtext and what is left unsaid. Avoid unnecessary adjectives and adverbs. Trust the reader to infer meaning. Use dialogue to carry weight. Include white space in the narrative - moments of silence. End chapters with subtle, understated beats. Less is more.`
  },

  // ===== FICTION - GENRE =====
  {
    id: 'mystery-thriller',
    name: 'Mystery/Thriller',
    category: 'Fiction - Genre',
    description: 'Fast-paced, suspenseful, clues and red herrings',
    prompt: `Write a mystery/thriller with fast-paced, suspenseful prose. Use short, punchy sentences for action scenes. Build tension through pacing and unanswered questions. Include clues and red herrings naturally. Show character through action under pressure. Use cliffhangers at chapter ends. Vary pacing - slow for investigation, fast for action. Keep readers guessing. End chapters with reveals, questions, or danger.`
  },
  {
    id: 'sci-fi',
    name: 'Science Fiction',
    category: 'Fiction - Genre',
    description: 'World-building, scientific concepts, exploration of ideas',
    prompt: `Write science fiction that balances world-building with character. Explain scientific concepts clearly but don't info-dump. Show technology through character interaction. Include sensory details of futuristic settings. Use technical language naturally. Focus on how technology affects humanity. End chapters with plot advancement or new questions. Balance action with exploration of ideas.`
  },
  {
    id: 'fantasy',
    name: 'Fantasy',
    category: 'Fiction - Genre',
    description: 'Rich world-building, magic systems, epic scope',
    prompt: `Write fantasy with rich world-building and clear magic systems. Show magic through character experience, not explanation. Include vivid descriptions of fantastical settings. Use language that fits the world (formal for epic fantasy, modern for urban). Balance action with world-building. End chapters with plot advancement or world reveals. Make the impossible feel real through detail.`
  },
  {
    id: 'romance',
    name: 'Romance',
    category: 'Fiction - Genre',
    description: 'Emotional depth, character chemistry, satisfying arcs',
    prompt: `Write romance with emotional depth and authentic character chemistry. Show attraction through body language, dialogue, and internal thought. Include sensory details that enhance romantic tension. Use alternating POV or focus on emotional beats. Build tension through obstacles and misunderstandings. End chapters with emotional moments or romantic tension. Focus on character growth and relationship development.`
  },
  {
    id: 'horror',
    name: 'Horror',
    category: 'Fiction - Genre',
    description: 'Atmosphere, dread, psychological and physical fear',
    prompt: `Write horror that builds atmosphere and dread. Use sensory details to create unease. Show fear through character reactions and body language. Vary pacing - slow build-up, fast scares. Use short sentences for tension, longer for atmosphere. Include psychological horror alongside physical threats. End chapters with scares, reveals, or mounting dread. Let the reader's imagination do some of the work.`
  },
  {
    id: 'historical-fiction',
    name: 'Historical Fiction',
    category: 'Fiction - Genre',
    description: 'Historical accuracy, period-appropriate language, immersive setting',
    prompt: `Write historical fiction with period-appropriate language and authentic details. Weave historical facts naturally into the narrative. Use vocabulary and sentence structure that fits the era. Include sensory details that bring the past to life. Show historical context through character experience. End chapters with period-appropriate conclusions. Balance historical accuracy with engaging storytelling.`
  },
  {
    id: 'western',
    name: 'Western',
    category: 'Fiction - Genre',
    description: 'Sparse dialogue, action, frontier setting',
    prompt: `Write a western with sparse, meaningful dialogue and action-focused prose. Use short, direct sentences. Show character through action and few words. Include vivid descriptions of the frontier landscape. Use period-appropriate language. Focus on conflict and survival. End chapters with action beats or confrontations. Honor the western tradition while making it fresh.`
  },

  // ===== NON-FICTION =====
  {
    id: 'nonfiction-narrative',
    name: 'Narrative Non-Fiction',
    category: 'Non-Fiction',
    description: 'True story told with narrative techniques',
    prompt: `Write narrative non-fiction that reads like a novel but sticks to facts. Use storytelling techniques - scene, dialogue, character development. Include quotes and citations naturally. Show events through scenes rather than summary. Use vivid descriptions of real places and people. End chapters with factual conclusions or transitions. Balance narrative flow with accuracy.`
  },
  {
    id: 'nonfiction-academic',
    name: 'Academic/Educational',
    category: 'Non-Fiction',
    description: 'Clear explanations, structured, evidence-based',
    prompt: `Write academic/educational non-fiction with clear, structured prose. Explain concepts step-by-step. Use examples and analogies to clarify complex ideas. Include evidence and citations naturally. Structure information logically. Use accessible language while maintaining accuracy. End chapters with summaries or transitions to next topic. Focus on clarity and understanding.`
  },
  {
    id: 'nonfiction-self-help',
    name: 'Self-Help/How-To',
    category: 'Non-Fiction',
    description: 'Practical, actionable, encouraging tone',
    prompt: `Write self-help/how-to content with a practical, encouraging tone. Use clear, actionable language. Break down concepts into steps. Include examples and case studies. Use "you" to address the reader directly. End chapters with actionable takeaways. Balance inspiration with practical advice. Make complex concepts accessible.`
  },
  {
    id: 'nonfiction-biography',
    name: 'Biography',
    category: 'Non-Fiction',
    description: 'Life story, historical context, balanced perspective',
    prompt: `Write a biography that brings the subject to life through scenes and details. Include historical context naturally. Show the person's character through their actions and words. Use quotes and primary sources. Balance different perspectives on the subject. End chapters with life milestones or transitions. Make historical figures feel real and relatable.`
  },
  {
    id: 'nonfiction-memoir',
    name: 'Memoir',
    category: 'Non-Fiction',
    description: 'Personal story, reflection, emotional honesty',
    prompt: `Write memoir with emotional honesty and reflection. Use first-person perspective. Show events through scenes with sensory details. Include internal reflection on meaning and impact. Balance showing (scenes) with telling (reflection). End chapters with insights or emotional beats. Be honest about both strengths and weaknesses.`
  },
  {
    id: 'nonfiction-journalism',
    name: 'Journalistic/Investigative',
    category: 'Non-Fiction',
    description: 'Objective reporting, facts first, clear structure',
    prompt: `Write journalistic non-fiction with objective, clear prose. Lead with facts and evidence. Use the inverted pyramid structure (most important first). Include quotes from sources naturally. Show multiple perspectives. End chapters with factual conclusions or new information. Maintain objectivity while telling a compelling story.`
  },

  // ===== COMEDY & HUMOR =====
  {
    id: 'comedy-light',
    name: 'Light Comedy',
    category: 'Comedy & Humor',
    description: 'Witty dialogue, situational humor, lighthearted tone',
    prompt: `Write light comedy with witty dialogue and situational humor. Use wordplay and clever observations. Include moments of humor throughout. Show character through comedic interactions. Use timing and pacing for comedic effect. End chapters with laughs or light moments. Keep tone lighthearted even during conflict.`
  },
  {
    id: 'comedy-dark',
    name: 'Dark Comedy/Satire',
    category: 'Comedy & Humor',
    description: 'Dark humor, satire, social commentary',
    prompt: `Write dark comedy/satire that uses humor to explore serious topics. Use irony and absurdity. Include sharp social commentary. Balance humor with underlying seriousness. Use exaggeration for satirical effect. End chapters with ironic beats or satirical points. Make readers laugh while making them think.`
  },

  // ===== EXPERIMENTAL & SPECIALIZED =====
  {
    id: 'experimental-stream',
    name: 'Stream of Consciousness',
    category: 'Experimental',
    description: 'Interior monologue, flowing thoughts, psychological depth',
    prompt: `Write in stream-of-consciousness style with flowing interior monologue. Show character thoughts as they occur naturally. Use long, flowing sentences. Include associations and tangents. Show the mind's natural flow. End chapters with natural thought transitions. Prioritize psychological realism over plot.`
  },
  {
    id: 'experimental-epistolary',
    name: 'Epistolary (Letters/Diaries)',
    category: 'Experimental',
    description: 'Told through letters, diary entries, documents',
    prompt: `Write in epistolary format (letters, diary entries, documents). Use authentic voice for each document type. Show character through their writing style. Include dates and context naturally. Let gaps between documents create narrative tension. End chapters with natural document conclusions. Make each document feel authentic to its form.`
  },
  {
    id: 'experimental-noir',
    name: 'Noir/Hardboiled',
    category: 'Experimental',
    description: 'Gritty, cynical, urban setting, tough protagonist',
    prompt: `Write noir/hardboiled fiction with gritty, cynical prose. Use tough, terse dialogue. Show urban decay through vivid details. Include moral ambiguity. Use first-person or close third-person. End chapters with cynical observations or plot twists. Honor the noir tradition while making it fresh.`
  }
];

/**
 * Get style prompts grouped by category
 */
export function getStylePromptsByCategory(): Record<string, StylePrompt[]> {
  const grouped: Record<string, StylePrompt[]> = {};
  
  STYLE_PROMPTS.forEach(prompt => {
    if (!grouped[prompt.category]) {
      grouped[prompt.category] = [];
    }
    grouped[prompt.category].push(prompt);
  });
  
  return grouped;
}

/**
 * Get a style prompt by ID
 */
export function getStylePromptById(id: string): StylePrompt | undefined {
  return STYLE_PROMPTS.find(p => p.id === id);
}

