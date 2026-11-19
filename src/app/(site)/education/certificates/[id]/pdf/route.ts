import { certificatePdf } from '../../../_lib/certificate'
import { getCertificate } from '../../../_lib/queries'

// Public like the certificate page: the unguessable id is the verification link.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cert = id.length <= 40 ? await getCertificate(id) : null
  if (!cert) return new Response('Not found', { status: 404 })
  const pdf = await certificatePdf(cert)
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="team1-certificate-${cert.course}.pdf"`,
      'Cache-Control': 'private, no-cache',
    },
  })
}
