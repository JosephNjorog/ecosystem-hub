import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { getCertificate } from '../../_lib/queries'

// Link preview of a certificate (LinkedIn, X, Slack, ...): same look as the certificate. Fonts come from `_certificate/`
// (traced for /education/** in next.config.ts), the background from public/. A deleted or unknown id gets the plain card.
export const alt = 'team1 course certificate'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const file = (p: string) => readFile(join(process.cwd(), p))
const assets = Promise.all([
  file('src/app/(site)/education/_certificate/Kanit-Medium.ttf'),
  file('src/app/(site)/education/_certificate/Kanit-Bold.ttf'),
  file('public/education/certificate-background.jpg'),
  file('public/logos/Team1_MAIN_WHITE.svg'),
])

export default async function CertificateOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [cert, [medium, bold, background, logo]] = await Promise.all([id.length <= 40 ? getCertificate(id) : null, assets])
  const heading = { fontWeight: 700, color: '#e6e6e6', letterSpacing: -1, lineHeight: 0.95, textTransform: 'uppercase' } as const
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: 'Kanit', color: '#d4d4d4', background: '#0b0a0f', position: 'relative' }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative background, rendered to PNG by satori */}
        <img src={`data:image/jpeg;base64,${background.toString('base64')}`} width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }} />
        <img src={`data:image/svg+xml;base64,${logo.toString('base64')}`} alt="team1" width={142} height={40} />
        <div style={{ ...heading, fontSize: 64, marginTop: 30, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span>Certificate</span>
          <span>of completion</span>
        </div>
        {cert ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 22, marginTop: 34 }}>THIS CERTIFIES THAT</div>
            <div style={{ fontSize: 46, fontWeight: 500, color: '#E6212F', marginTop: 6, transform: 'skewX(-12deg)', maxWidth: 1000 }}>{cert.name}</div>
            <div style={{ fontSize: 22, marginTop: 14 }}>HAS SUCCESSFULLY COMPLETED THE COURSE</div>
            <div style={{ ...heading, fontSize: cert.courseTitle.length > 32 ? 34 : 42, marginTop: 18, maxWidth: 900 }}>{cert.courseTitle}</div>
          </div>
        ) : (
          <div style={{ fontSize: 26, marginTop: 34 }}>team1 Ecosystem Hub</div>
        )}
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Kanit', data: medium, weight: 500, style: 'normal' },
        { name: 'Kanit', data: bold, weight: 700, style: 'normal' },
      ],
    },
  )
}
