import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        backgroundColor: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <div style={{
          fontSize: '200px', lineHeight: 1,
          color: '#6B21A8',
          fontFamily: 'sans-serif',
          letterSpacing: '-8px',
        }}>
          M
        </div>
      </div>
    ),
    { ...size }
  );
}
