import { useNavigation, type LinkProps } from '../../providers/navigation-context';

/**
 * Platform-agnostic navigation link.
 * Uses Next.js Link on web, custom button-based link on desktop.
 *
 * @example
 * ```tsx
 * <NavigationLink href="/tasks">View Tasks</NavigationLink>
 * <NavigationLink href="/tasks/123" className="text-primary">Task #123</NavigationLink>
 * ```
 */
export function NavigationLink({ href, children, className, onClick }: LinkProps) {
  const { Link } = useNavigation();
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
