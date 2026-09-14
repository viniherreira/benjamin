import { ImageResponse } from 'next/og';

/**
 * Ícone de tela inicial do iPhone. O iOS não aceita SVG aqui, então a marca é
 * desenhada em PNG. Fundo sólido e cheio: o iOS arredonda o canto sozinho.
 */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0a0a0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32" fill="none">
          <g stroke="#f3f4f8" strokeWidth="2.4" strokeLinecap="round">
            <path d="M9 10.5v11" />
            <path d="M14.5 13v6" />
            <path d="M20 14.75v2.5" />
          </g>
          <circle cx="24.5" cy="16" r="1.6" fill="#f3f4f8" />
        </svg>
      </div>
    ),
    size,
  );
}
