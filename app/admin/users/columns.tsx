'use client'

import { ColumnDef } from '@tanstack/react-table'
import { User } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MoreVertical, Pencil, Trash2, Eye, Shield, ArrowUpDown } from 'lucide-react'
import { getLevelLabel } from '@/hooks'

interface ColumnActions {
  onEdit: (user: User) => void
  onDelete: (user: User) => void
  onMaskAs: (userId: string) => void
  currentUserId?: string
}

export const createColumns = (actions: ColumnActions): ColumnDef<User>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="hover:bg-transparent px-0"
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'level',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="hover:bg-transparent px-0"
        >
          Level
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      return (
        <Badge variant="secondary" className="text-xs">
          {getLevelLabel(row.original.level)}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'is_admin',
    header: 'Role',
    cell: ({ row }) => {
      return row.original.is_admin ? (
        <Badge variant="outline" className="text-xs">
          <Shield className="h-3 w-3 mr-1" />
          Admin
        </Badge>
      ) : (
        <span className="text-sm text-muted-foreground">User</span>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const user = row.original
      const isCurrentUser = user.id === actions.currentUserId

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => actions.onEdit(user)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit User
            </DropdownMenuItem>
            {!isCurrentUser && (
              <>
                <DropdownMenuItem onClick={() => actions.onMaskAs(user.id)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View as User
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => actions.onDelete(user)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
