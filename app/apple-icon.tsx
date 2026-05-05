import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        backgroundColor: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: '100px', color: '#6B21A8', fontFamily: 'sans-serif' }}>M</div>
      </div>
    ),
    { ...size }
  );
}
