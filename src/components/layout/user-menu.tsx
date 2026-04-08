'use client';

import { LogOut, Settings, UserCog } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link, useRouter } from '@/i18n/navigation';

interface UserMenuProps {
  /** Current user — mocked until auth is implemented. */
  user: {
    name: string;
    email: string;
    role: 'admin' | 'developer';
  };
}

// User menu rendered at the bottom of the sidebar.
// Avatar + name + role badge as the trigger; popover with profile / settings / sign out.
export function UserMenu({ user }: UserMenuProps) {
  const t = useTranslations('userMenu');
  const router = useRouter();
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const onSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl border border-border/40 bg-card/40 p-2.5 text-left transition-all hover:border-border/60 hover:bg-card/70"
        >
          <Avatar className="size-9">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {t(`role.${user.role}`)}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="min-w-[14rem]">
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <div className="my-1 h-px bg-border/40" />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <UserCog className="size-4" />
            {t('profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" />
            {t('settings')}
          </Link>
        </DropdownMenuItem>
        <div className="my-1 h-px bg-border/40" />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void onSignOut();
          }}
          className="text-red-300 focus:text-red-200"
        >
          <LogOut className="size-4" />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
