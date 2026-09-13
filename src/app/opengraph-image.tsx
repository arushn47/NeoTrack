import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = "Where's My Offer — Campus Placement Radar";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#07070a',
          backgroundImage:
            'radial-gradient(circle at 25% 25%, rgba(99, 102, 241, 0.18) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(168, 85, 247, 0.15) 0%, transparent 50%)',
          padding: '60px 80px',
          fontFamily: 'sans-serif',
          color: '#ffffff',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 512 512"
            style={{ borderRadius: '12px' }}
          >
            <rect width="512" height="512" rx="124" fill="#090e13" />
            <rect width="512" height="512" rx="124" fill="none" stroke="#34d399" strokeWidth="6" />
            <circle cx="256" cy="256" r="192" fill="none" stroke="#10b981" strokeWidth="3" opacity="0.3" />
            <circle cx="256" cy="256" r="132" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.2" />
            <path d="M 124 186 L 168 186 L 218 344 L 182 360 Z" fill="#10b981" />
            <path d="M 182 360 L 218 344 L 256 250 L 242 232 Z" fill="#34d399" />
            <path d="M 270 232 L 256 250 L 294 344 L 330 360 Z" fill="#34d399" />
            <path d="M 388 186 L 344 186 L 294 344 L 330 360 Z" fill="#10b981" />
            <path d="M 184 290 L 208 290 L 256 202 L 304 290 L 328 290 L 256 168 Z" fill="#ffffff" />
            <circle cx="256" cy="128" r="26" fill="none" stroke="#34d399" strokeWidth="2" />
            <path d="M 256 102 C 256 120, 248 128, 230 128 C 248 128, 256 136, 256 154 C 256 136, 264 128, 282 128 C 264 128, 256 120, 256 102 Z" fill="#ffffff" />
            <circle cx="256" cy="128" r="5" fill="#10b981" />
          </svg>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>
              Where&apos;s My Offer
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#6ee7b7',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                padding: '4px 10px',
                borderRadius: '9999px',
              }}
            >
              CAMPUS RADAR
            </span>
          </div>
        </div>

        {/* Center Hero Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '960px' }}>
          <h1
            style={{
              fontSize: '56px',
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: '-1.5px',
              margin: 0,
              color: '#ffffff',
            }}
          >
            Never miss a Shortlist, Test, or Interview again.
          </h1>
          <p
            style={{
              fontSize: '24px',
              lineHeight: 1.4,
              color: '#a1a1aa',
              margin: 0,
            }}
          >
            Automated NeoPAT & CDC email syncing, Excel attachment matching, and smart schedule tracking for campus placements.
          </p>
        </div>

        {/* Feature Pills Footer */}
        <div style={{ display: 'flex', gap: '14px' }}>
          {['Auto-Sync Drives', 'Excel & PDF Shortlist Parser', 'Test & Interview Alerts', 'Live Funnel Analytics'].map(
            (badge) => (
              <div
                key={badge}
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#e4e4e7',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '10px 18px',
                }}
              >
                {badge}
              </div>
            )
          )}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
