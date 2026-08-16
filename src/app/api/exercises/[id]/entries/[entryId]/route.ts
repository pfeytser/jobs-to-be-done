import { NextRequest, NextResponse } from 'next/server'
import { requireUser, route } from '@/lib/auth/guards'
import { deleteEntry, deleteEntryAdmin } from '@/lib/db/entries'
import { getExerciseById } from '@/lib/db/exercises'

export const DELETE = route(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) => {
  const user = await requireUser()

  const { id: exerciseId, entryId } = await params

  try {
    const exercise = await getExerciseById(exerciseId)
    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
    }

    const isAdmin = user.role === 'admin'

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
      deleted = await deleteEntry(entryId, user.userId)
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
})
