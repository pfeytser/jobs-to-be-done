import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, route } from '@/lib/auth/guards'
import { isTranslationOwner } from '@/lib/translation/access'
import { parseCsv, detectColumns } from '@/lib/translation/csv'

export const dynamic = 'force-dynamic'

const Schema = z.object({ text: z.string().min(1) })

// Owner-only: parse a CSV's headers and suggest a column mapping for the setup dialog.
// Does not persist anything.
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser()
  if (!isTranslationOwner(user.email)) {
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
})
