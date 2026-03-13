export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  labels: string[];
  assignee: string | null;
  claimedBy: string | null;
  dueDate: string | null;
  startTime: string | null;
  completeTime: string | null;
  createdAt: string;
  updatedAt: string;
  comments: any[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  leadAgent: string | null;
  color: string;
  icon: string;
  taskPrefix: string;
  createdAt: string;
  updatedAt: string;
}

export interface Stage {
  name: string;
  week: string;
  tasks: Task[];
}
