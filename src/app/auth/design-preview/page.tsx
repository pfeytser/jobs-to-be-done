'use client'

// TEMPORARY specimen gallery for the design-refresh component library.
// Lives under /auth/* so it's publicly reachable for visual review.
// DELETE before merging design-refresh → main.

import { useState } from 'react'
import {
  Bee,
  Button,
  IconButton,
  Input,
  Textarea,
  Select,
  Checkbox,
  Toggle,
  Badge,
  Spinner,
  Skeleton,
  ProgressBar,
  Banner,
  Card,
  FeatureCard,
  StatCard,
  Tabs,
  Pagination,
  Table,
  Tr,
  Th,
  Td,
  SortHeader,
  Modal,
  ConfirmDialog,
  Tooltip,
  useToast,
} from '@/components/ui'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  )
}

export default function DesignPreview() {
  const [tab, setTab] = useState<'all' | 'open' | 'done'>('all')
  const [check, setCheck] = useState(true)
  const [on, setOn] = useState(true)
  const [page, setPage] = useState(0)
  const [modal, setModal] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const toast = useToast()

  return (
    <main className="mx-auto max-w-content space-y-10 px-6 py-12">
      <header className="flex items-center gap-3">
        <Bee size={36} className="text-ink" />
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink">Design system preview</h1>
          <p className="text-ink-muted">Newsreader display · Hanken body · Industrious tokens</p>
        </div>
      </header>

      <Section title="Buttons">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button shape="pill">Pill</Button>
        <Button loading>Saving…</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <IconButton label="Close" variant="surface">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </IconButton>
      </Section>

      <Section title="Badges">
        <Badge tone="neutral">neutral</Badge>
        <Badge tone="accent">featured</Badge>
        <Badge tone="info">info</Badge>
        <Badge tone="pass">pass</Badge>
        <Badge tone="fail">fail</Badge>
        <Badge tone="blocked">blocked</Badge>
        <Badge tone="skipped">skipped</Badge>
      </Section>

      <Section title="Form controls">
        <div className="w-full max-w-content space-y-3">
          <Input placeholder="Text input" />
          <Input search placeholder="Search…" />
          <Input error defaultValue="With an error" />
          <Select defaultValue="a">
            <option value="a">Option A</option>
            <option value="b">Option B</option>
          </Select>
          <Textarea placeholder="Textarea" rows={2} />
          <div className="flex flex-wrap gap-6">
            <Checkbox checked={check} onChange={setCheck} label="Checkbox" />
            <Toggle checked={on} onChange={setOn} label="Toggle" />
          </div>
        </div>
      </Section>

      <Section title="Tabs / Pagination">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'all', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'done', label: 'Done' },
          ]}
        />
        <Pagination page={page} pageCount={9} onPage={setPage} />
      </Section>

      <Section title="Feedback">
        <Spinner size={20} />
        <div className="w-48"><ProgressBar value={62} /></div>
        <Skeleton className="h-8 w-40" />
        <Button variant="secondary" onClick={() => toast('Saved to the workshop.')}>Fire toast</Button>
        <Button variant="secondary" onClick={() => toast('Something failed.', 'fail')}>Fire error toast</Button>
        <Tooltip label="A helpful hint">
          <Button variant="ghost">Hover me</Button>
        </Tooltip>
      </Section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Banner tone="info" title="Heads up">A neutral info banner.</Banner>
        <Banner tone="pass" title="All clear">Everything matched.</Banner>
        <Banner tone="fail" title="Problem">Two rows need review.</Banner>
      </div>

      <Section title="Cards">
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Active testers" value={4} />
          <StatCard label="Failures" value={2} tone="fail" />
          <StatCard label="Passed" value={31} tone="pass" />
          <StatCard label="Blocked" value={1} tone="blocked" />
        </div>
      </Section>
      <FeatureCard href="#" title="Translation Review" description="Review localizations and export production-safe files" />

      <Section title="Table">
        <Table>
          <thead>
            <Tr>
              <Th>Merchant</Th>
              <SortHeader label="Amount" direction="asc" onSort={() => {}} />
              <Th>Status</Th>
            </Tr>
          </thead>
          <tbody>
            <Tr>
              <Td>United Airlines</Td>
              <Td>$420.00</Td>
              <Td><Badge tone="pass">matched</Badge></Td>
            </Tr>
            <Tr>
              <Td>Hilton</Td>
              <Td>$232.10</Td>
              <Td><Badge tone="blocked">review</Badge></Td>
            </Tr>
          </tbody>
        </Table>
      </Section>

      <Section title="Overlays">
        <Button onClick={() => setModal(true)}>Open modal</Button>
        <Button variant="danger" onClick={() => setConfirm(true)}>Delete…</Button>
      </Section>

      <Card className="p-5 text-sm text-ink-soft">A plain card surface on the almond canvas.</Card>

      <Modal open={modal} onClose={() => setModal(false)} title="A dialog" footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button onClick={() => setModal(false)}>Confirm</Button></>}>
        <p className="text-sm text-ink-soft">Modal body content sits here on a white panel with a teal-tinted backdrop.</p>
      </Modal>
      <ConfirmDialog open={confirm} onCancel={() => setConfirm(false)} onConfirm={() => setConfirm(false)} title="Delete this item?" danger confirmLabel="Delete">
        This can’t be undone.
      </ConfirmDialog>
    </main>
  )
}
