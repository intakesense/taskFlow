import { type MouseEvent, type ReactNode } from 'react';

interface DesktopLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
}

/**
 * Creates a Desktop Link component factory.
 * Used as the Link component for FeaturesProvider on desktop.
 * Uses a div instead of button to avoid nesting issues when children contain buttons.
 */
export function createDesktopLink(navigate: (path: string) => void) {
  return function DesktopLink({ href, children, className, onClick }: DesktopLinkProps) {
    const handleClick = (e: MouseEvent<HTMLDivElement>) => {
      onClick?.(e);
      if (!e.defaultPrevented) {
        navigate(href);
      }
    };

    return (
      <div
        role="link"
        tabIndex={0}
        className={className}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(href);
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        {children}
      </div>
    );
  };
}
