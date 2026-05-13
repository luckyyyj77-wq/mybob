"use client";

import Image from 'next/image';
import { usePhoto } from '@/lib/use-photo';

interface Props {
  photoUrl: string | undefined;
  alt: string;
  style?: React.CSSProperties;
}

export function MealPhoto({ photoUrl, alt, style }: Props) {
  const src = usePhoto(photoUrl);
  if (!src) return null;

  // Supabase CDN URL → Next.js Image (자동 WebP 변환 + 리사이징)
  // base64(local:) → 일반 img (Next/Image는 data URI 미지원)
  if (src.startsWith('https://')) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        style={{ objectFit: style?.objectFit as any ?? 'cover' }}
      />
    );
  }

  return <img src={src} alt={alt} style={style} />;
}
