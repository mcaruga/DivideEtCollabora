export interface User {
  id: number;
  email: string;
  name: string;
  avatar_color: string;
  currency: string;
  is_premium: boolean;
  is_admin?: boolean;
  created_at: string;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  type: 'trip' | 'home' | 'couple' | 'other';
  cover_color: string;
  created_by: number;
  created_at: string;
  members?: User[];
  my_balance?: number;
  member_count?: number;
}

export interface Expense {
  id: number;
  group_id: number;
  description: string;
  amount: number;
  currency: string;
  paid_by: number;
  paid_by_name?: string;
  split_type: 'equal' | 'exact' | 'percentage' | 'shares';
  category: string;
  date: string;
  notes?: string;
  receipt_url?: string;
  is_recurring: boolean;
  splits: ExpenseSplit[];
  created_at: string;
}

export interface ExpenseSplit {
  user_id: number;
  user_name?: string;
  amount: number;
}

export interface Balance {
  from_user_id: number;
  from_user_name: string;
  to_user_id: number;
  to_user_name: string;
  amount: number;
  currency: string;
}

export interface Payment {
  id: number;
  group_id?: number;
  from_user_id: number;
  from_user_name?: string;
  to_user_id: number;
  to_user_name?: string;
  amount: number;
  currency: string;
  notes?: string;
  created_at: string;
}
