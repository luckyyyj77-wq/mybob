import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { AuthProvider } from '@/lib/auth-context';
import AppShell from '@/components/AppShell';

// 로케일별 정적 프리렌더 — 페이지가 CDN에서 즉시 서빙되고 Link prefetch가 동작한다
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return {
    title: t('title'),
    description: t('description'),
    keywords: t('keywords'),
    alternates: {
      canonical: locale === 'en' ? 'https://mybob.kr' : `https://mybob.kr/${locale}`,
      languages: {
        'ko-KR': 'https://mybob.kr/ko',
        'en-US': 'https://mybob.kr',
      },
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'MyBob',
    },
    openGraph: {
      type: 'website',
      url: 'https://mybob.kr',
      title: t('title'),
      description: t('description'),
      images: ['https://mybob.kr/og.png'],
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
      siteName: 'MyBob',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: ['https://mybob.kr/og.png'],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body style={{ margin: 0, backgroundColor: 'white', overflowX: 'hidden' }}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
