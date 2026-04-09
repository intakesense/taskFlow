# @taskflow/features

Shared feature components for TaskFlow web and desktop apps.

## Overview

This package provides platform-agnostic feature components that work on both Next.js (web) and Tauri/Vite (desktop) apps. It abstracts away platform-specific APIs like routing and image optimization.

## Architecture

```
@taskflow/features
├── providers/          # Platform abstraction contexts
│   ├── navigation-context.tsx   # Routing abstraction
│   ├── services-context.tsx     # Supabase service injection
│   └── features-provider.tsx    # Combined provider
├── hooks/              # React Query hooks
│   ├── use-tasks.ts
│   ├── use-conversations.ts
│   └── use-messages.ts
├── services/           # Supabase data operations
│   ├── tasks.ts
│   ├── messages.ts
│   └── users.ts
└── components/         # Shared UI components
    ├── primitives/     # NavigationLink, OptimizedImage
    ├── layout/         # Sidebar, BottomNav, DashboardLayout
    ├── tasks/          # Task-related components
    └── messages/       # Message-related components
```

## Key Abstractions

| Next.js API | Abstraction | Usage |
|-------------|-------------|-------|
| `Link` | `NavigationLink` | `<NavigationLink href="/tasks">Tasks</NavigationLink>` |
| `useRouter()` | `useNavigation()` | `const { navigate } = useNavigation()` |
| `usePathname()` | `useNavigation()` | `const { currentPath } = useNavigation()` |
| `Image` | `OptimizedImage` | `<OptimizedImage src="..." alt="..." />` |

## Usage

### Web App (Next.js)

```tsx
// app/providers.tsx
import { FeaturesProvider } from '@taskflow/features/providers';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createBrowserClient } from '@/lib/supabase/client';

export function Providers({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createBrowserClient();

  return (
    <FeaturesProvider
      navigation={{
        currentPath: pathname,
        navigate: (path, opts) => opts?.replace ? router.replace(path) : router.push(path),
        goBack: () => router.back(),
        Link,
      }}
      supabase={supabase}
      Image={Image}
    >
      {children}
    </FeaturesProvider>
  );
}
```

### Desktop App (Tauri/Vite)

```tsx
// src/providers.tsx
import { FeaturesProvider } from '@taskflow/features/providers';
import { supabase } from './lib/supabase';
import { useState } from 'react';

export function Providers({ children }) {
  const [currentPage, setCurrentPage] = useState('tasks');

  return (
    <FeaturesProvider
      navigation={{
        currentPath: '/' + currentPage,
        navigate: (path) => setCurrentPage(path.replace(/^\//, '') || 'tasks'),
        goBack: () => {/* history implementation */},
        Link: DesktopLink,
      }}
      supabase={supabase}
    >
      {children}
    </FeaturesProvider>
  );
}

function DesktopLink({ href, children, className, onClick }) {
  const { navigate } = useNavigation();
  return (
    <button className={className} onClick={(e) => { onClick?.(e); navigate(href); }}>
      {children}
    </button>
  );
}
```

## Importing Components

```tsx
// Layout
import { Sidebar, BottomNav, DashboardLayout } from '@taskflow/features/components/layout';

// Tasks
import { TaskCard, TasksView, KanbanView } from '@taskflow/features/components/tasks';

// Messages
import { ConversationList, ChatView } from '@taskflow/features/components/messages';

// Hooks
import { useTasks, useUpdateTask } from '@taskflow/features/hooks';

// Services (for custom implementations)
import { createTasksService } from '@taskflow/features/services';
```

## Dependencies

- `@taskflow/core` - Shared types and schemas
- `@taskflow/ui` - UI primitives (shadcn/ui)
- `@tanstack/react-query` - Data fetching
- `@supabase/supabase-js` - Database client
- `lucide-react` - Icons
