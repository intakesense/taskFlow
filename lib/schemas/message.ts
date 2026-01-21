// Message and conversation form schemas using Zod
import { z } from 'zod'

/**
 * Schema for creating a new group conversation
 */
export const createGroupSchema = z.object({
  groupName: z
    .string()
    .min(1, 'Group name is required')
    .min(2, 'Group name must be at least 2 characters')
    .max(100, 'Group name must be less than 100 characters'),
  selectedMembers: z
    .array(z.string())
    .min(1, 'Please select at least one member'),
})

export type CreateGroupFormData = z.infer<typeof createGroupSchema>
