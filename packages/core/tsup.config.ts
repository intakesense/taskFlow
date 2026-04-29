import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'types/index': 'src/types/index.ts',
    'types/database': 'src/types/database.ts',
    'schemas/index': 'src/schemas/index.ts',
    'utils/index': 'src/utils/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['@supabase/supabase-js', 'zod', 'date-fns'],
})
