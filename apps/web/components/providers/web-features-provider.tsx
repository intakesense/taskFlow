'use client'

import { type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import NextLink from 'next/link'
import NextImage from 'next/image'
import { FeaturesProvider, VoiceChannelProvider, type ImageProps, type LinkProps } from '@taskflow/features'
import { createClient } from '@/lib/supabase/client'
import { useAuth as useWebAuth } from '@/lib/auth-context'

// Disable Next.js prefetch to prevent client-only <link rel="prefetch"> tags
// that cause server/client hydration mismatches in the document head
function WebLink({ href, children, className, onClick }: LinkProps) {
  return (
    <NextLink href={href} className={className} onClick={onClick} prefetch={false}>
      {children}
    </NextLink>
  )
}

function WebImage({ src, alt, width, height, className, priority }: ImageProps) {
  if (width && height) {
    return (
      <NextImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        priority={priority}
      />
    )
  }
  // No explicit dimensions — use fill mode inside a relatively-positioned container
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: '100%', height: '100%' }}>
      <NextImage
        src={src}
        alt={alt}
        fill
        className={className}
        priority={priority}
        style={{ objectFit: 'cover' }}
      />
    </span>
  )
}

interface WebFeaturesProviderProps {
  children: ReactNode
}

export function WebFeaturesProvider({ children }: WebFeaturesProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const auth = useWebAuth()

  return (
    <FeaturesProvider
      navigation={{
        currentPath: pathname,
        navigate: (path, options) =>
          options?.replace ? router.replace(path) : router.push(path),
        goBack: () => router.back(),
        Link: WebLink,
      }}
      supabase={supabase}
      auth={auth}
      Image={WebImage}
      config={{
        apiBaseUrl: '',
        googleApiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? '',
        logoSrc: '/logo.png',
      }}
    >
      <VoiceChannelProvider>
        {children}
      </VoiceChannelProvider>
    </FeaturesProvider>
  )
}
