import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - /api (API routes)
  // - /_next (Next.js internals)
  // - /_vercel (Vercel internals)
  // - /admin (Admin pages)
  // - /auth/callback (Auth callback)
  // - Static files (e.g. /favicon.ico, /manifest.json, /sw.js)
  matcher: ['/((?!api|_next|_vercel|admin|auth/callback|[\\w-]+\\.\\w+).*)', '/']
};
