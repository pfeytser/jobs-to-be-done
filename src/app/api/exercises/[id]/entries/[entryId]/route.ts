import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { deleteEntry, deleteEntryAdmin } from '@/lib/db/entries'
import { getExerciseById } from '@/lib/db/exercises'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: exerciseId, entryId } = await params

  try {
    const exercise = await getExerciseById(exerciseId)
    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
    }

    const isAdmin = session.user.role === 'admin'

    // Non-admin can only delete their own entries in phase 1
    if (!isAdmin && exercise.currentPhase !== 1) {
      return NextResponse.json(
        { error: 'Deletion is only allowed in phase 1' },
        { status: 400 }
      )
    }

    let deleted: boolean
    if (isAdmin) {
      deleted = await deleteEntryAdmin(entryId)
    } else {
      deleted = await deleteEntry(entryId, session.user.userId)
    }

    if (!deleted) {
      return NextResponse.json(
        { error: 'Entry not found or not authorized' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[entry DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
