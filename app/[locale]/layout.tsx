import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { AuthProvider } from '@/lib/auth-context';
import AppShell from '@/components/AppShell';

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
