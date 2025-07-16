export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TodoUpdate {
  todos: TodoItem[];
  timestamp: Date;
}
