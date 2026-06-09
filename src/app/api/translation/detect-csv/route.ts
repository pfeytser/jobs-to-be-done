import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth/config'
import { isTranslationOwner } from '@/lib/translation/access'
import { parseCsv, detectColumns } from '@/lib/translation/csv'

export const dynamic = 'force-dynamic'

const Schema = z.object({ text: z.string().min(1) })

// Owner-only: parse a CSV's headers and suggest a column mapping for the setup dialog.
// Does not persist anything.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isTranslationOwner(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const parsed = Schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  try {
    const { headers, eol, rows } = parseCsv(parsed.data.text)
    const suggested = detectColumns(headers, eol)
    return NextResponse.json({ headers, rowCount: rows.length, suggested })
  } catch {
    return NextResponse.json({ error: 'Could not parse the CSV file.' }, { status: 400 })
  }
}
