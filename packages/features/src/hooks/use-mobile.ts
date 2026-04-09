'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to detect mobile viewport
 *
 * @param breakpoint - Tailwind breakpoint (default: 1024 for 'lg')
 * @returns boolean indicating if viewport is below breakpoint
 *
 * @example
 * const isMobile = useMobile()
 * const isTablet = useMobile(768) // 'md' breakpoint
 */
export function useMobile(breakpoint = 1024): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < breakpoint);

    // Check on mount
    checkMobile();

    // Listen for resize
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

/**
 * Hook for multiple breakpoints
 *
 * @example
 * const { isMobile, isTablet, isDesktop } = useBreakpoints()
 */
export function useBreakpoints() {
  const [breakpoints, setBreakpoints] = useState({
    isMobile: false, // < 640px (sm)
    isTablet: false, // < 768px (md)
    isDesktop: false, // < 1024px (lg)
    isWide: false, // >= 1024px
  });

  useEffect(() => {
    const check = () => {
      const width = window.innerWidth;
      setBreakpoints({
        isMobile: width < 640,
        isTablet: width >= 640 && width < 768,
        isDesktop: width >= 768 && width < 1024,
        isWide: width >= 1024,
      });
    };

    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return breakpoints;
}