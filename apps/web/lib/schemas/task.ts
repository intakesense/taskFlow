// Task form schemas using Zod
import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be less than 200 characters'),
  description: z
    .string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional(),
  priority: z.enum(['low', 'medium', 'high'], {
    message: 'Please select a priority',
  }).default('medium'),
  status: z.enum(['pending', 'in_progress', 'on_hold', 'archived']).default('pending'),
  assigned_to: z
    .array(z.string())
    .min(1, 'Please select at least one user to assign this task to'),
  deadline: z
    .string()
    .optional()
    .refine(
      (date) => !date || new Date(date) > new Date(),
      'Deadline must be in the future'
    ),
  visibility: z.enum(['private', 'supervisor', 'hierarchy_same', 'hierarchy_above', 'all'], {
    message: 'Please select visibility',
  }).default('hierarchy_same'),
})

export type CreateTaskFormData = z.infer<typeof createTaskSchema>

export const updateTaskSchema = createTaskSchema.partial().extend({
  on_hold_reason: z.string().optional(),
})

export type UpdateTaskFormData = z.infer<typeof updateTaskSchema>

export const addNoteSchema = z.object({
  content: z
    .string()
    .min(1, 'Note content is required')
    .max(2000, 'Note must be less than 2000 characters'),
  visibility: z.enum(['private', 'supervisor', 'hierarchy_same', 'hierarchy_above', 'all'], {
    message: 'Please select visibility',
  }).default('private'),
})

export type AddNoteFormData = z.infer<typeof addNoteSchema>
