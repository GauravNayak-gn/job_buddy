export interface Conversation {
  id: string;
  participant_a: string;
  participant_b: string;
  created_at: string;
  updated_at: string;
  // UI helper fields populated dynamically
  other_user_name?: string;
  other_user_title?: string;
  other_user_company?: string;
  last_message?: {
    id: string;
    sender_id: string;
    body: string;
    created_at: string;
  } | null;
}

export interface Message {
  id: string;
  conversation: string;
  sender_id: string;
  body: string;
  created_at: string;
}
