import { cn } from '@/lib/utils';

interface AuthSplitProps {
  /**
   * Free-form content for the secondary panel.
   * Hidden below the lg breakpoint so the form always stays accessible on mobile.
   * Use this for marketing copy, illustrations, testimonials, video, anything.
   */
  aside: React.ReactNode;
  /** The form (or whatever the page's primary action is). Always visible. */
  children: React.ReactNode;
  /** Which side the aside panel sits on at lg+. Defaults to 'left'. */
  asidePosition?: 'left' | 'right';
  /** Extra classes for the aside <section>, e.g. a different background. */
  asideClassName?: string;
  /** Extra classes for the form <section>. */
  formClassName?: string;
}

// Reusable split-screen shell for any auth page.
// Desktop: two equal columns, aside on chosen side, form on the other.
// Mobile: aside is hidden, form fills the viewport — keeps sign-in usable on phones.
export function AuthSplit({
  aside,
  children,
  asidePosition = 'left',
  asideClassName,
  formClassName,
}: AuthSplitProps) {
  const asideEl = (
    <section
      key="aside"
      className={cn(
        'relative hidden overflow-hidden border-border/40 px-10 py-16 lg:flex lg:flex-col lg:justify-center xl:px-16',
        asidePosition === 'left' ? 'lg:border-r' : 'lg:border-l',
        asideClassName,
      )}
    >
      {aside}
    </section>
  );

  const formEl = (
    <section
      key="form"
      className={cn(
        'flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12 sm:px-8',
        formClassName,
      )}
    >
      {children}
    </section>
  );

  return (
    <div className="grid w-full lg:grid-cols-2">
      {asidePosition === 'left' ? [asideEl, formEl] : [formEl, asideEl]}
    </div>
  );
}
