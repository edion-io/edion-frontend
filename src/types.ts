export interface UserSettings {
  username: string;
  fullName: string;
  email: string;
  profilePicture: string;
  darkMode: boolean;
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  date: string;
  lastMessage: string;
}

// Add any other types that might be needed by other components
export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: string;
}

export interface Tab {
  id: string;
  label: string;
}

export interface StudentReport {
  id: string;
  name: string;
  grade: string;
  subjects: {
    name: string;
    score: number;
    comments: string;
  }[];
  overallPerformance: string;
  attendancePercentage: number;
  teacherNotes: string;
}

// Additional types from temp.tsx and other components
export interface ChatMessage {
  id: number;
  text: string;
  isUser: boolean;
  pdfUrl?: string;
}

export interface ChatTab {
  id: string;
  title: string;
  date: string;
  messages: ChatMessage[];
  activePDF: string | null;
}

// TypeScript alias to enable backwards compatibility with existing code
export type ChatHistory = ChatHistoryItem;

export interface Exercise {
  id: string;
  title: string;
  blocks: Block[];
}
