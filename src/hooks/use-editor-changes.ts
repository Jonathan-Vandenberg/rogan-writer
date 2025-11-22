import { useState, useCallback, useEffect } from 'react';

export interface EditorChange {
  id: string;
  chapterId: string;
  chapterTitle: string;
  originalContent: string;
  editedContent: string;
  diff: string;
  status: 'pending' | 'accepted' | 'rejected';
  description: string;
}

export interface NewChapter {
  id: string;
  title: string;
  content: string;
  orderIndex: number;
  status: 'pending' | 'accepted' | 'rejected';
  description: string;
}

const STORAGE_KEY_PREFIX = 'editor-changes-';

function getStorageKey(bookId: string): string {
  return `${STORAGE_KEY_PREFIX}${bookId}`;
}

function loadFromStorage(bookId: string): { changes: EditorChange[]; newChapters: NewChapter[]; currentChangeIndex: number } | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(getStorageKey(bookId));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading editor changes from storage:', error);
  }
  return null;
}

function saveToStorage(bookId: string, changes: EditorChange[], newChapters: NewChapter[], currentChangeIndex: number) {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(getStorageKey(bookId), JSON.stringify({
      changes,
      newChapters,
      currentChangeIndex,
    }));
  } catch (error) {
    console.error('Error saving editor changes to storage:', error);
  }
}

export function useEditorChanges(bookId: string) {
  // Load from localStorage on mount
  const stored = loadFromStorage(bookId);
  const [changes, setChanges] = useState<EditorChange[]>(stored?.changes || []);
  const [newChapters, setNewChapters] = useState<NewChapter[]>(stored?.newChapters || []);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(stored?.currentChangeIndex || 0);

  // Save to localStorage whenever changes occur
  useEffect(() => {
    saveToStorage(bookId, changes, newChapters, currentChangeIndex);
  }, [bookId, changes, newChapters, currentChangeIndex]);

  // Add new changes from editor agent
  const addChanges = useCallback((newChanges: Omit<EditorChange, 'status'>[]) => {
    setChanges(prev => [
      ...prev,
      ...newChanges.map(change => ({ ...change, status: 'pending' as const })),
    ]);
  }, []);

  // Add new chapters
  const addNewChapters = useCallback((chapters: Omit<NewChapter, 'status'>[]) => {
    setNewChapters(prev => [
      ...prev,
      ...chapters.map(chapter => ({ ...chapter, status: 'pending' as const })),
    ]);
  }, []);

  // Accept a change
  const acceptChange = useCallback((changeId: string) => {
    setChanges(prev =>
      prev.map(change =>
        change.id === changeId ? { ...change, status: 'accepted' as const } : change
      )
    );
  }, []);

  // Reject a change
  const rejectChange = useCallback((changeId: string) => {
    setChanges(prev =>
      prev.map(change =>
        change.id === changeId ? { ...change, status: 'rejected' as const } : change
      )
    );
  }, []);

  // Accept a new chapter
  const acceptNewChapter = useCallback((chapterId: string) => {
    setNewChapters(prev =>
      prev.map(chapter =>
        chapter.id === chapterId ? { ...chapter, status: 'accepted' as const } : chapter
      )
    );
  }, []);

  // Reject a new chapter
  const rejectNewChapter = useCallback((chapterId: string) => {
    setNewChapters(prev =>
      prev.map(chapter =>
        chapter.id === chapterId ? { ...chapter, status: 'rejected' as const } : chapter
      )
    );
  }, []);

  // Accept all pending changes
  const acceptAll = useCallback(() => {
    setChanges(prev =>
      prev.map(change =>
        change.status === 'pending' ? { ...change, status: 'accepted' as const } : change
      )
    );
    setNewChapters(prev =>
      prev.map(chapter =>
        chapter.status === 'pending' ? { ...chapter, status: 'accepted' as const } : chapter
      )
    );
  }, []);

  // Reject all pending changes
  const rejectAll = useCallback(() => {
    setChanges(prev =>
      prev.map(change =>
        change.status === 'pending' ? { ...change, status: 'rejected' as const } : change
      )
    );
    setNewChapters(prev =>
      prev.map(chapter =>
        chapter.status === 'pending' ? { ...chapter, status: 'rejected' as const } : chapter
      )
    );
  }, []);

  // Navigate to next change
  const goToNextChange = useCallback(() => {
    const pendingChanges = changes.filter(c => c.status === 'pending');
    if (pendingChanges.length === 0) return;
    
    const currentChange = changes[currentChangeIndex];
    const nextPendingIndex = changes.findIndex(
      (c, idx) => idx > currentChangeIndex && c.status === 'pending'
    );
    
    if (nextPendingIndex !== -1) {
      setCurrentChangeIndex(nextPendingIndex);
    } else {
      // Wrap to first pending change
      const firstPendingIndex = changes.findIndex(c => c.status === 'pending');
      if (firstPendingIndex !== -1) {
        setCurrentChangeIndex(firstPendingIndex);
      }
    }
  }, [changes, currentChangeIndex]);

  // Navigate to previous change
  const goToPreviousChange = useCallback(() => {
    const pendingChanges = changes.filter(c => c.status === 'pending');
    if (pendingChanges.length === 0) return;
    
    // Find previous pending change
    let prevPendingIndex = -1;
    for (let i = currentChangeIndex - 1; i >= 0; i--) {
      if (changes[i].status === 'pending') {
        prevPendingIndex = i;
        break;
      }
    }
    
    if (prevPendingIndex !== -1) {
      setCurrentChangeIndex(prevPendingIndex);
    } else {
      // Wrap to last pending change
      for (let i = changes.length - 1; i >= 0; i--) {
        if (changes[i].status === 'pending') {
          setCurrentChangeIndex(i);
          break;
        }
      }
    }
  }, [changes, currentChangeIndex]);

  // Clear all changes
  const clearChanges = useCallback(() => {
    setChanges([]);
    setNewChapters([]);
    setCurrentChangeIndex(0);
    // Clear from localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(getStorageKey(bookId));
      } catch (error) {
        console.error('Error clearing editor changes from storage:', error);
      }
    }
  }, [bookId]);

  // Get accepted changes for applying
  const getAcceptedChanges = useCallback(() => {
    return changes.filter(c => c.status === 'accepted');
  }, [changes]);

  // Get accepted new chapters for creation
  const getAcceptedNewChapters = useCallback(() => {
    return newChapters.filter(c => c.status === 'accepted');
  }, [newChapters]);

  // Get counts
  const pendingCount = changes.filter(c => c.status === 'pending').length;
  const acceptedCount = changes.filter(c => c.status === 'accepted').length;
  const rejectedCount = changes.filter(c => c.status === 'rejected').length;
  const totalCount = changes.length;

  const pendingNewChaptersCount = newChapters.filter(c => c.status === 'pending').length;
  const acceptedNewChaptersCount = newChapters.filter(c => c.status === 'accepted').length;

  return {
    changes,
    newChapters,
    currentChangeIndex,
    setCurrentChangeIndex,
    addChanges,
    addNewChapters,
    acceptChange,
    rejectChange,
    acceptNewChapter,
    rejectNewChapter,
    acceptAll,
    rejectAll,
    goToNextChange,
    goToPreviousChange,
    clearChanges,
    getAcceptedChanges,
    getAcceptedNewChapters,
    pendingCount,
    acceptedCount,
    rejectedCount,
    totalCount,
    pendingNewChaptersCount,
    acceptedNewChaptersCount,
  };
}

