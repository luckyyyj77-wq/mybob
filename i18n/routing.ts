import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['en', 'ko'],
  defaultLocale: 'en',
  localePrefix: 'as-needed' // Prefix only when not default locale
});

export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
