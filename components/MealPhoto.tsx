"use client";

import { usePhoto } from '@/lib/use-photo';

interface Props {
  photoUrl: string | undefined;
  alt: string;
  style?: React.CSSProperties;
}

export function MealPhoto({ photoUrl, alt, style }: Props) {
  const src = usePhoto(photoUrl);
  if (!src) return null;
  return <img src={src} alt={alt} style={style} />;
}
