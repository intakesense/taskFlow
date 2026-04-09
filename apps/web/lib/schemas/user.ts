// User form schemas using Zod
import { z } from 'zod'

export const updateUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  level: z
    .number()
    .int('Level must be an integer')
    .min(1, 'Level must be at least 1')
    .max(10, 'Level must be at most 10'),
  is_admin: z.boolean().default(false),
  reports_to: z.string().nullable().optional(),
})

export type UpdateUserFormData = z.infer<typeof updateUserSchema>

export const createUserSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
  level: z
    .number()
    .int('Level must be an integer')
    .min(1, 'Level must be at least 1')
    .max(10, 'Level must be at most 10')
    .default(4),
  is_admin: z.boolean().default(false),
  reports_to: z.string().nullable().optional(),
})

export type CreateUserFormData = z.infer<typeof createUserSchema>
