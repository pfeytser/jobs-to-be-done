import { z } from 'zod'

// Request validation for initiative create/update. Shared by the collection and
// item routes (route files may only export HTTP handlers, so this lives in lib).
export const InitiativeSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(2000).default(''),
  status: z.enum(['proposed', 'to_do', 'in_flight', 'done']),
  priority: z.enum(['critical', 'high', 'medium', 'low']).nullable().default(null),
  theme: z
    .enum(['revenue', 'member_experience', 'efficiency_ai_adoption', 'data_systems', 'supply_growth'])
    .nullable()
    .default(null),
  year: z.number().int().min(2020).max(2100),
  quarter: z.number().int().min(1).max(4),
  effort_weeks: z.number().min(0).max(520).nullable().default(null),
  impact_value: z.number().min(0).max(1e12).nullable().default(null),
  impact_unit: z.enum(['revenue', 'hrs']).nullable().default(null),
  impact_revenue: z.number().min(0).max(1e12).nullable().default(null),
  impact_hours: z.number().min(0).max(1e9).nullable().default(null),
  impact_kind: z.string().max(40).nullable().default(null),
  owner_name: z.string().max(120).nullable().default(null),
  objective: z.string().max(200).nullable().default(null),
  is_bau: z.union([z.literal(0), z.literal(1)]).default(0),
  is_required: z.union([z.literal(0), z.literal(1)]).default(0),
  committed: z.union([z.literal(0), z.literal(1)]).default(0),
  unscheduled: z.union([z.literal(0), z.literal(1)]).default(0),
  // Accepted on PATCH so drag-and-drop can persist re-ordering; ignored on create
  // (createInitiative assigns its own next sort_order).
  sort_order: z.number().int().min(0).max(100000).optional(),
})
