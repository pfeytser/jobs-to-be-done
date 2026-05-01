import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/lib/auth/config'

const CODE_REVIEW_SYSTEM_PROMPT = `You are acting as an L7 engineer at a tier 1 tech company performing a thorough code review. Your standard should reflect what it takes to get an L7 engineer to approve the pull request. Do not lower the bar.

The code is written by Devin (an AI agent). Address all feedback directly to Devin in a format optimized for AI agent interpretation — be precise, actionable, and unambiguous.

## Output Format

Produce a document with exactly two sections:

### FEEDBACK FOR DEVIN:
Technical code review comments addressed directly to Devin. Organized by severity:
- **Critical** — bugs, security vulnerabilities, data loss risk, correctness failures. Must be fixed before merge.
- **Major** — design problems, missing error handling, significant performance issues, missing tests for important paths. Should be fixed before merge.
- **Minor** — code quality, readability, edge cases not covered. Fix before merge if straightforward.
- **Nitpick** — style, naming, optional improvements. Fix at discretion.

For each item: state the file and location, describe the problem precisely, and tell Devin exactly what to do to fix it.

### SUMMARY FOR YOU (the human reviewer):
- Plain English overall verdict (ready to merge / needs work / major rework required)
- Brief explanation of what the PR does and whether it does it correctly
- Any red flags or surprising implementation choices
- Confidence level in the review (e.g., if you couldn't see test coverage or context)

## Review Focus Areas
- Logic correctness and potential bugs
- Security vulnerabilities (injection, auth bypasses, data exposure, insecure defaults)
- Error handling — missing try/catch, unhandled promise rejections, silent failures
- Performance — unnecessary re-renders, N+1 queries, missing indexes, unbounded operations
- Testing — missing coverage for critical paths, tests that don't actually test the behavior
- Code quality — dead code, duplicated logic, overly complex implementations, poor naming
- Documentation — missing or misleading comments

## Code Comments Policy
Devin tends to leave comments that reference Jira tickets or external requirements (e.g., \`// Per TICKET-123\`). These are bad comments. Comments should explain WHY non-obvious code works the way it does. When you find ticket-reference or requirement-reference comments, tell Devin to remove them.

## Multiple PR Policy
When reviewing multiple PRs: do NOT tell Devin about deployment order — he cannot control it. If the PRs must be deployed in a specific order, instruct Devin to flag this to the human reviewer.

## Codebase Context
This is a TypeScript/Node.js codebase. Apply standard best practices for the language and framework in use. Pay special attention to async error handling, type safety, and security boundaries.`

interface PRRef {
  owner: string
  repo: string
  prNum: string
}

async function ghGet(path: string, token: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'code-review-bot',
    },
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`)
  return res.json()
}

async function ghGetRaw(path: string, token: string, accept: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      'User-Agent': 'code-review-bot',
    },
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return res.text()
}

async function ghGetPaginated(path: string, token: string): Promise<unknown[]> {
  let results: unknown[] = []
  let page = 1
  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const res = await fetch(`https://api.github.com${path}${sep}per_page=100&page=${page}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'code-review-bot',
      },
    })
    if (!res.ok) break
    const linkHeader = res.headers.get('link') || ''
    const data = await res.json()
    const arr: unknown[] = Array.isArray(data)
      ? data
      : ((data as Record<string, unknown>).check_runs as unknown[] ||
         (data as Record<string, unknown>).workflow_runs as unknown[] ||
         [])
    if (!arr.length) break
    results = results.concat(arr)
    if (!linkHeader.includes('rel="next"')) break
    page++
  }
  return results
}

async function fetchPRData(
  owner: string,
  repo: string,
  prNum: string,
  token: string,
  writeProgress: (msg: string) => void
): Promise<string> {
  writeProgress(`Fetching PR #${prNum} metadata from ${repo}...`)
  const pr = await ghGet(`/repos/${owner}/${repo}/pulls/${prNum}`, token) as Record<string, unknown>

  writeProgress('Fetching diff...')
  const diff = await ghGetRaw(
    `/repos/${owner}/${repo}/pulls/${prNum}`,
    token,
    'application/vnd.github.v3.diff'
  )

  writeProgress('Fetching changed files list...')
  const files = await ghGetPaginated(`/repos/${owner}/${repo}/pulls/${prNum}/files`, token) as Array<Record<string, unknown>>

  const head = pr.head as Record<string, unknown>
  const branch = head.ref as string
  const sha = head.sha as string

  writeProgress(`Fetching full content of ${files.length} changed file(s)...`)
  const fileContents = await Promise.all(
    files.map(async (f) => {
      if (f.status === 'removed') return { filename: f.filename as string, content: '[FILE DELETED]' }
      try {
        const encodedPath = (f.filename as string).split('/').map(encodeURIComponent).join('/')
        const data = await ghGet(
          `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
          token
        ) as Record<string, unknown>
        if (data.encoding === 'base64') {
          return {
            filename: f.filename as string,
            content: Buffer.from((data.content as string).replace(/\n/g, ''), 'base64').toString('utf8'),
          }
        }
        return { filename: f.filename as string, content: (data.content as string) || '[Binary or empty file]' }
      } catch (e) {
        return { filename: f.filename as string, content: `[Could not fetch: ${(e as Error).message}]` }
      }
    })
  )

  writeProgress('Fetching commits, comments, reviews, and CI status...')
  const [commits, reviewComments, reviews, issueComments] = await Promise.all([
    ghGetPaginated(`/repos/${owner}/${repo}/pulls/${prNum}/commits`, token),
    ghGetPaginated(`/repos/${owner}/${repo}/pulls/${prNum}/comments`, token),
    ghGetPaginated(`/repos/${owner}/${repo}/pulls/${prNum}/reviews`, token),
    ghGetPaginated(`/repos/${owner}/${repo}/issues/${prNum}/comments`, token),
  ]) as [
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
  ]

  let checksText = ''
  try {
    const checks = await ghGet(`/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=100`, token) as Record<string, unknown>
    const checkRuns = (checks.check_runs as Array<Record<string, unknown>>) || []
    checksText = checkRuns.length
      ? checkRuns.map((c) => `${c.name}: ${c.status} / ${c.conclusion || 'pending'}`).join('\n')
      : '(no checks found)'
  } catch (e) {
    checksText = `[Could not fetch checks: ${(e as Error).message}]`
  }

  const prBase = pr.base as Record<string, unknown>
  const prUser = pr.user as Record<string, unknown>

  let text = ''
  text += `================================\nPR #${prNum} - ${repo}\nURL: https://github.com/${owner}/${repo}/pull/${prNum}\n================================\n\n`
  text += `Title: ${pr.title}\nState: ${pr.state}\nAuthor: ${prUser.login}\nBase: ${(prBase.ref as string)}  ←  Head: ${branch}\nCreated: ${pr.created_at}\nUpdated: ${pr.updated_at}\n`
  if (pr.body) text += `\nDescription:\n${pr.body}\n`
  text += `\n--- DIFF ---\n\n${diff}\n`
  text += `\n--- FULL FILE CONTENTS ---\n\n`
  for (const f of fileContents) text += `=== FILE: ${f.filename} ===\n\n${f.content}\n\n\n`
  text += `\n--- COMMITS ---\n\n`
  for (const c of commits) {
    const commit = c.commit as Record<string, unknown>
    const author = commit.author as Record<string, unknown>
    text += `Commit: ${(c.sha as string).slice(0, 7)}\nAuthor: ${author.name}\nDate: ${author.date}\nMessage: ${commit.message}\n---\n`
  }
  text += `\n--- REVIEW COMMENTS (INLINE) ---\n\n`
  if (reviewComments.length) {
    for (const c of reviewComments) {
      const user = c.user as Record<string, unknown>
      text += `Author: ${user.login}\nFile: ${c.path}\nLine: ${c.line || 'N/A'}\n\n${c.body}\n\n---\n`
    }
  } else text += '(none)\n'
  text += `\n--- PR REVIEWS ---\n\n`
  if (reviews.length) {
    for (const r of reviews) {
      const user = r.user as Record<string, unknown>
      text += `Reviewer: ${user.login}\nState: ${r.state}\nDate: ${r.submitted_at}\n\n${r.body || ''}\n\n---\n`
    }
  } else text += '(none)\n'
  text += `\n--- GENERAL PR COMMENTS ---\n\n`
  if (issueComments.length) {
    for (const c of issueComments) {
      const user = c.user as Record<string, unknown>
      text += `Author: ${user.login}\nDate: ${c.created_at}\n\n${c.body}\n\n---\n`
    }
  } else text += '(none)\n'
  text += `\n--- CHECKS ---\n\n${checksText}\n`
  return text
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

  if (!GITHUB_TOKEN) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), { status: 500 })
  }
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500 })
  }

  let body: { urls?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const rawUrls = (body.urls || '').trim().split('\n').map((s) => s.trim()).filter(Boolean)
  if (!rawUrls.length) {
    return new Response(JSON.stringify({ error: 'No URLs provided' }), { status: 400 })
  }

  const prs: PRRef[] = []
  for (const u of rawUrls) {
    const m = u.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
    if (!m) {
      return new Response(JSON.stringify({ error: `Invalid PR URL: ${u}` }), { status: 400 })
    }
    prs.push({ owner: m[1], repo: m[2], prNum: m[3] })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const write = (text: string) => controller.enqueue(encoder.encode(text))
      const writeProgress = (msg: string) => write(`__PROGRESS__:${msg}\n`)

      try {
        const allPRData: string[] = []
        for (const { owner, repo, prNum } of prs) {
          const data = await fetchPRData(owner, repo, prNum, GITHUB_TOKEN, writeProgress)
          allPRData.push(data)
        }

        const fullData = allPRData.join('\n\n' + '='.repeat(80) + '\n\n')
        writeProgress('Sending to Claude for review...')
        write('__REVIEW_START__\n')

        const prLabel =
          prs.length === 1
            ? `PR #${prs[0].prNum} from ${prs[0].repo}`
            : `${prs.length} pull requests`

        const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
        const claudeStream = client.messages.stream({
          model: 'claude-opus-4-7',
          max_tokens: 16000,
          system: CODE_REVIEW_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Please review ${prLabel}:\n\n${fullData}` }],
        })

        for await (const event of claudeStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            write(event.delta.text)
          }
        }
      } catch (err) {
        write(`\n__ERROR__:${(err as Error).message}`)
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
