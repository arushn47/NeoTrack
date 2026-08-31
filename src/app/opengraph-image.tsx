import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'NeoTrack — Campus Placement Command Center';
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
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 800,
            }}
          >
            ⚡
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>
              NeoTrack
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                padding: '4px 10px',
                borderRadius: '9999px',
              }}
            >
              PLACEMENT INTELLIGENCE
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
