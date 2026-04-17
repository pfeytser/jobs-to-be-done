import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getQAProjectById } from '@/lib/db/qa-projects'
import { getTestItemsByProject } from '@/lib/db/qa-test-items'
import { getSessionsWithProgress } from '@/lib/db/qa-sessions'
import { getAllResultsByProject } from '@/lib/db/qa-results'
import JSZip from 'jszip'

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function escapeCSV(val: unknown): string {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCSVRow(cols: unknown[]): string {
  return cols.map(escapeCSV).join(',')
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: projectId } = await params
  try {
    const [project, items, sessions, results] = await Promise.all([
      getQAProjectById(projectId),
      getTestItemsByProject(projectId),
      getSessionsWithProgress(projectId),
      getAllResultsByProject(projectId),
    ])

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Build result lookup: session_id + test_item_id → result
    const resultMap = new Map<string, typeof results[0]>()
    for (const r of results) {
      resultMap.set(`${r.session_id}::${r.test_item_id}`, r)
    }

    // Build CSV
    const headers = [
      'project_id', 'project_name', 'platform', 'viewport',
      'browser_coverage', 'os_coverage',
      'session_id', 'tester_name', 'tester_email', 'tester_id',
      'user_type_tested', 'session_viewport', 'session_os', 'session_browser',
      'session_started_at', 'session_last_active_at', 'session_percent_complete',
      'tc_number', 'part', 'section', 'feature_area', 'platform_item',
      'test_description', 'steps', 'expected_result', 'jira_reference',
      'result_status', 'result_recorded_at',
      'steps_taken', 'expected_behavior', 'actual_behavior',
      'blocked_note', 'test_username_used', 'screenshot_filename',
    ]

    const csvRows: string[] = [toCSVRow(headers)]

    for (const sess of sessions) {
      const pct =
        sess.total > 0 ? Math.round((sess.done / sess.total) * 100) + '%' : '0%'
      for (const item of items) {
        const result = resultMap.get(`${sess.id}::${item.id}`)
        csvRows.push(
          toCSVRow([
            project.id,
            project.name,
            project.platform,
            sess.viewport,
            project.browsers.join(';'),
            project.operating_systems.join(';'),
            sess.id,
            sess.tester_name,
            sess.tester_email,
            sess.tester_id,
            sess.user_type,
            sess.viewport,
            sess.operating_system,
            sess.browser,
            sess.started_at,
            sess.last_active_at,
            pct,
            item.tc_number,
            item.part,
            item.section,
            item.feature_area,
            item.platform,
            item.test_description,
            item.steps,
            item.expected_result,
            item.jira_reference,
            result?.status ?? 'Not Tested',
            result?.recorded_at ?? '',
            result?.steps_taken ?? '',
            result?.expected_behavior ?? '',
            result?.actual_behavior ?? '',
            result?.blocked_note ?? '',
            result?.test_username ?? '',
            result?.screenshot_filename ?? '',
          ])
        )
      }
    }

    const csvContent = csvRows.join('\n')

    // Collect screenshots from Vercel Blob
    const screenshotResults = results.filter((r) => r.screenshot_url && r.screenshot_filename)

    const zip = new JSZip()
    const dateStr = new Date().toISOString().slice(0, 10)
    const projectSlug = slugify(project.name)
    const folderName = `${projectSlug}_export_${dateStr}`

    zip.file(`${folderName}/results.csv`, csvContent)

    // Download and add screenshots
    const screenshotsFolder = zip.folder(`${folderName}/screenshots`)!

    if (screenshotResults.length === 0) {
      screenshotsFolder.file('no_screenshots.txt', 'No screenshots were uploaded for this project.')
    } else {
      await Promise.all(
        screenshotResults.map(async (r) => {
          try {
            const res = await fetch(r.screenshot_url!)
            if (res.ok) {
              const buffer = await res.arrayBuffer()
              screenshotsFolder.file(r.screenshot_filename!, buffer)
            }
          } catch {
            // Skip failed screenshot fetches silently
          }
        })
      )
    }

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })

    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folderName}.zip"`,
      },
    })
  } catch (error) {
    console.error('[qa/export GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const maxDuration = 300
