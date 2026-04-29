// Application constants - eliminates magic strings

export const TaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  ON_HOLD: 'on_hold',
  ARCHIVED: 'archived',
} as const;

export type TaskStatusValue = typeof TaskStatus[keyof typeof TaskStatus];

export const TaskPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type TaskPriorityValue = typeof TaskPriority[keyof typeof TaskPriority];

export const Visibility = {
  PRIVATE: 'private',
  SUPERVISOR: 'supervisor',
  HIERARCHY_SAME: 'hierarchy_same',
  HIERARCHY_ABOVE: 'hierarchy_above',
  ALL: 'all',
} as const;

export type VisibilityValue = typeof Visibility[keyof typeof Visibility];

export const ThemeMode = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;

export type ThemeModeValue = typeof ThemeMode[keyof typeof ThemeMode];

// Status display configuration
export const STATUS_CONFIG = {
  [TaskStatus.PENDING]: {
    label: 'Pending',
    color: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  [TaskStatus.IN_PROGRESS]: {
    label: 'In Progress',
    color: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  [TaskStatus.ON_HOLD]: {
    label: 'On Hold',
    color: 'bg-muted text-muted-foreground border-border',
  },
  [TaskStatus.ARCHIVED]: {
    label: 'Completed',
    color: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
} as const;

// Priority display configuration
export const PRIORITY_CONFIG = {
  [TaskPriority.LOW]: {
    label: 'Low',
    dotColor: 'bg-muted-foreground',
    badgeColor: 'bg-slate-500/20 text-foreground',
  },
  [TaskPriority.MEDIUM]: {
    label: 'Medium',
    dotColor: 'bg-blue-500',
    badgeColor: 'bg-blue-500/20 text-blue-300',
  },
  [TaskPriority.HIGH]: {
    label: 'High',
    dotColor: 'bg-destructive',
    badgeColor: 'bg-red-500/20 text-red-300',
  },
} as const;


// User levels
export const USER_LEVELS = {
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
  L5: 5,
} as const;

export const LEVEL_LABELS = {
  1: 'L1',
  2: 'L2',
  3: 'L3',
  4: 'L4',
  5: 'L5',
} as const;

export const LEVEL_COLORS = {
  1: 'bg-purple-600/20 text-purple-300 border-purple-500/30',
  2: 'bg-blue-600/20 text-blue-300 border-blue-500/30',
  3: 'bg-green-600/20 text-green-300 border-green-500/30',
  4: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30',
  5: 'bg-gray-600/20 text-gray-300 border-gray-500/30',
} as const;

// Level colors for employee cards (solid backgrounds)
export const EMPLOYEE_LEVEL_COLORS: Record<number, string> = {
  1: 'bg-purple-500',
  2: 'bg-blue-500',
  3: 'bg-green-500',
  4: 'bg-yellow-500',
  5: 'bg-orange-500',
};

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  TASKS: '/tasks',
  TASK_DETAIL: (id: string) => `/tasks/${id}`,
  TASK_NEW: '/tasks/new',
  ADMIN_USERS: '/admin/users',
  ADMIN_USER_NEW: '/admin/users/new',
  SETTINGS: '/settings',
} as const;

// API Endpoints (if needed)
export const API = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    SIGNUP: '/api/auth/signup',
  },
} as const;

// Validation limits
export const LIMITS = {
  TASK_TITLE_MIN: 3,
  TASK_TITLE_MAX: 200,
  TASK_DESCRIPTION_MAX: 2000,
  NOTE_CONTENT_MAX: 2000,
  USER_NAME_MIN: 2,
  USER_NAME_MAX: 100,
  PASSWORD_MIN: 6,
  PASSWORD_STRONG_MIN: 8,
  FILE_SIZE_L1: 100 * 1024 * 1024, // 100MB
  FILE_SIZE_L2: 50 * 1024 * 1024,  // 50MB
  FILE_SIZE_L3: 25 * 1024 * 1024,  // 25MB
  FILE_SIZE_L4: 10 * 1024 * 1024,  // 10MB
  FILE_SIZE_L5: 5 * 1024 * 1024,   // 5MB
} as const;

// Cache/Query stale times (in milliseconds)
export const STALE_TIME = {
  TASKS: 30_000,      // 30 seconds
  CONVERSATIONS: 30_000,
  MESSAGES: 10_000,   // 10 seconds
  USERS: 60_000,      // 1 minute
  STATS: 60_000,
} as const;

// Realtime channel names
export const CHANNELS = {
  TASK_MESSAGES: (taskId: string) => `task-messages:${taskId}`,
  TASK_PROGRESS: (taskId: string) => `task-progress:${taskId}`,
  CONVERSATION_MESSAGES: (convId: string) => `messages-${convId}`,
  TYPING: (convId: string) => `typing-${convId}`,
  CONVERSATIONS: 'conversations-changes',
} as const;
