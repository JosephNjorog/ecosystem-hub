import 'server-only'
import path from 'node:path'
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { getAcademy, progressLessons } from './content'

// Certificate PDF (A4 landscape). Fonts + logo sit in `_certificate/` (traced into the standalone build via next.config.ts);
// the background is `public/education/certificate-background.jpg`, shared with the certificate page. Kanit covers Latin, Latin-ext and Thai;
// ponytail: names in other scripts (Cyrillic, CJK, Arabic) render blank - add a Noto fallback font when someone hits it.
const ASSETS = path.join(process.cwd(), 'src/app/(site)/education/_certificate')
Font.register({
  family: 'Kanit',
  fonts: [
    { src: path.join(ASSETS, 'Kanit-Light.ttf'), fontWeight: 300 },
    { src: path.join(ASSETS, 'Kanit-Medium.ttf'), fontWeight: 500 },
    { src: path.join(ASSETS, 'Kanit-Bold.ttf'), fontWeight: 700 },
  ],
})
const BACKGROUND = path.join(process.cwd(), 'public/education/certificate-background.jpg')
Font.registerHyphenationCallback((word) => [word]) // never hyphenate names or titles

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hub.team1.network'
export const certificateUrl = (id: string) => `${SITE_URL}/education/certificates/${id}`
export const formatIssued = (d: Date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)

const C = { heading: '#e6e6e6', body: '#d4d4d4', label: '#a3a3a3', value: '#8c8c8c', brand: '#E6212F' }
const W = 841.89
const H = 595.28

const s = StyleSheet.create({
  page: { fontFamily: 'Kanit', fontWeight: 300, color: C.body },
  logo: { position: 'absolute', top: 50, left: (W - 89) / 2, height: 25, width: 89 },
  qrBox: { position: 'absolute', top: 50, right: 46, width: 96, alignItems: 'center' },
  qrText: { fontSize: 6.5, fontWeight: 500, letterSpacing: 0.8, color: C.label, marginTop: 6 },
  main: { position: 'absolute', top: 100, left: 60, right: 60, alignItems: 'center', textAlign: 'center' },
  title: { fontSize: 50, fontWeight: 700, color: C.heading, letterSpacing: -1, lineHeight: 0.78 },
  lead: { fontSize: 18, color: C.body, marginTop: 30 },
  // ponytail: no Kanit italic file, so the name is slanted (same as a browser's synthetic italic); add Kanit-MediumItalic.ttf for a true italic.
  name: { fontWeight: 500, color: C.brand, marginTop: 8, lineHeight: 1.1, transform: 'skewX(-12deg)' },
  course: { fontSize: 34, fontWeight: 700, color: C.heading, letterSpacing: -0.6, lineHeight: 0.78, marginTop: 14, maxWidth: 380 },
  place: { fontSize: 9.5, marginTop: 22 },
  stats: { fontSize: 9.5, marginTop: 26 },
  modules: { fontSize: 9.5, marginTop: 2, lineHeight: 1.2 },
  footer: { position: 'absolute', bottom: 46, left: 176, right: 60, flexDirection: 'row' },
  col: { width: 177 },
  label: { fontSize: 14, fontWeight: 700, color: C.label },
  value: { fontSize: 9.5, color: C.value, marginTop: 6 },
})

type Cert = { id: string; academy: string; course: string; name: string; courseTitle: string; issuedAt: Date }

/** What the PDF and the verify page print under the course title. Read from the current content, not snapshotted:
 *  ponytail: a restructured course changes old certificates' module list; snapshot it on the row if that ever matters. */
export function certificateDetails(cert: Pick<Cert, 'academy' | 'course'>) {
  const academy = getAcademy(cert.academy)
  const index = academy?.courses.findIndex((c) => c.slug === cert.course) ?? -1
  if (!academy || index < 0) return null
  const course = academy.courses[index]
  const lessons = progressLessons(academy).filter((l) => l.key.startsWith(`${course.slug}/`))
  const quizzes = lessons.some((l) => l.quizIds.length > 0)
  return {
    place: `Course ${index + 1} of ${academy.courses.length} - ${academy.title}`,
    stats: `${course.modules.length} modules · ${lessons.length} lessons${quizzes ? ' · all quizzes passed' : ''}`,
    modules: course.modules.map((m) => m.title),
  }
}

function CertificatePdf({ cert, qr, details }: { cert: Cert; qr: string; details: ReturnType<typeof certificateDetails> }) {
  const nameSize = cert.name.length > 34 ? 22 : cert.name.length > 24 ? 26 : 30
  return (
    <Document title={`${cert.courseTitle} - Course certificate`} author="team1" subject={`${cert.name} completed ${cert.courseTitle}`} creator="team1 Ecosystem Hub">
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* eslint-disable jsx-a11y/alt-text -- react-pdf Image, not an <img> */}
        <View style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }}>
          <Image src={BACKGROUND} style={{ width: W, height: H, objectFit: 'cover' }} />
        </View>
        <Image src={path.join(ASSETS, 'Team1_MAIN_WHITE.png')} style={s.logo} />
        <View style={s.qrBox}>
          <Image src={qr} style={{ width: 56, height: 56 }} />
          <Text style={s.qrText}>SCAN TO VERIFY</Text>
        </View>
        {/* eslint-enable jsx-a11y/alt-text */}
        <View style={s.main}>
          <Text style={s.title}>{'CERTIFICATE\nOF COMPLETION'}</Text>
          <Text style={s.lead}>THIS CERTIFIES THAT</Text>
          <Text style={[s.name, { fontSize: nameSize }]}>{cert.name}</Text>
          <Text style={[s.lead, { marginTop: 8 }]}>HAS SUCCESSFULLY COMPLETED THE COURSE</Text>
          <Text style={[s.course, cert.courseTitle.length > 32 ? { fontSize: 26 } : {}]}>{cert.courseTitle.toUpperCase()}</Text>
          {details && (
            <>
              <Text style={s.place}>{details.place.toUpperCase()}</Text>
              <Text style={s.stats}>{details.stats.toUpperCase()}</Text>
              <Text style={s.modules}>{details.modules.join(' · ').toUpperCase()}</Text>
            </>
          )}
        </View>
        <View style={s.footer}>
          <View style={s.col}>
            <Text style={s.label}>ISSUED</Text>
            <Text style={s.value}>{formatIssued(cert.issuedAt).toUpperCase()}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.label}>ISSUED BY</Text>
            <Text style={s.value}>TEAM1 ECOSYSTEM HUB</Text>
          </View>
          <View style={s.col}>
            <Text style={s.label}>CERTIFICATE ID</Text>
            <Text style={s.value}>{cert.id}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

// Rendered PDFs per certificate id + name. Safe to keep: the route checks the DB first (a deleted certificate 404s)
// and the name is the only thing that changes. ponytail: per process, last 100; enough while one web instance serves it.
const rendered = new Map<string, Promise<Buffer>>()

export function certificatePdf(cert: Cert): Promise<Buffer> {
  const key = `${cert.id}:${cert.name}`
  let pdf = rendered.get(key)
  if (!pdf) {
    pdf = renderCertificatePdf(cert)
    pdf.catch(() => rendered.delete(key)) // don't cache a failed render
    rendered.set(key, pdf)
    if (rendered.size > 100) rendered.delete(rendered.keys().next().value!)
  }
  return pdf
}

async function renderCertificatePdf(cert: Cert): Promise<Buffer> {
  const qr = await QRCode.toDataURL(certificateUrl(cert.id), { margin: 0, width: 400, errorCorrectionLevel: 'M', color: { dark: '#ffffffff', light: '#00000000' } })
  return renderToBuffer(<CertificatePdf cert={cert} qr={qr} details={certificateDetails(cert)} />)
}
