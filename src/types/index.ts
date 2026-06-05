export interface User {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author?: string;
  description?: string;
  cover_url?: string;
  file_url: string;
  file_type: 'epub' | 'pdf';
  status: 'unread' | 'reading' | 'read';
  genres: string[];
  progress_percent: number;
  progress_cfi?: string | null;
  last_opened_at?: string;
  created_at: string;
}

export interface BookSuggestion {
  id: string;
  user_id: string;
  title: string;
  author?: string;
  synopsis?: string;
  reason?: string;
  genres: string[];
  source_books: string[];
  status: 'suggested' | 'want_to_read' | 'dismissed';
  expires_at: string;
  created_at: string;
}

export interface Highlight {
  id: string;
  user_id: string;
  book_id: string;
  book_title?: string;
  text: string;
  location: string;
  color: string;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  book_id: string;
  book_title?: string;
  highlight_id?: string | null;
  content: string;
  created_at: string;
}

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Highlights: undefined;
  WidgetConfig: undefined;
  Discover: undefined;
  Wishlist: undefined;
  Reader: { bookId: string };
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};
