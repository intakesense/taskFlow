'use client';

import { createContext, useContext, type ReactNode, type ComponentType } from 'react';

export interface ImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

const ImageContext = createContext<ComponentType<ImageProps> | null>(null);

export interface ImageProviderProps {
  children: ReactNode;
  /** Image component to use (Next.js Image or standard img) */
  Image?: ComponentType<ImageProps>;
}

/**
 * Provides optimized image component to feature components.
 *
 * Web apps: Pass Next.js Image for optimization
 * Desktop apps: Pass standard img or custom wrapper
 */
export function ImageProvider({ children, Image }: ImageProviderProps) {
  return (
    <ImageContext.Provider value={Image ?? null}>
      {children}
    </ImageContext.Provider>
  );
}

/**
 * Platform-agnostic image component.
 * Uses Next.js Image on web, standard img on desktop.
 */
export function OptimizedImage({ src, alt, width, height, className, priority }: ImageProps) {
  const ImageComponent = useContext(ImageContext);

  if (ImageComponent) {
    return <ImageComponent src={src} alt={alt} width={width} height={height} className={className} priority={priority} />;
  }

  // Fallback to standard img
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
    />
  );
}
