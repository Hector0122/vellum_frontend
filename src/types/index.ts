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
  progress_percent: number;
  last_opened_at?: string;
  created_at: string;
}

export interface Highlight {
  id: string;
  user_id: string;
  book_id: string;
  text: string;
  location: string;
  color: string;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  book_id: string;
  highlight_id?: string;
  content: string;
  created_at: string;
}

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Reader: { bookId: string };
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Library: undefined;
  Search: undefined;
  Profile: undefined;
};
