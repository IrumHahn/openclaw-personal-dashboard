import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { NextResponse } from 'next/server'
import { readRegisteredAgents } from '../../../lib/registered-agents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const run = promisify(execFile)

async function command(args) {
  const { stdout } = await run('openclaw', args, { timeout: 12000, maxBuffer: 5 * 1024 * 1024 })
  return JSON.parse(stdout)
}

export async function GET() {
  const registered = await readRegisteredAgents()
  const [statusResult, cronResult] = await Promise.allSettled([
    command(['status', '--json']),
    command(['cron', 'list', '--json']),
  ])
  const status = statusResult.status === 'fulfilled' ? statusResult.value : null
  const cron = cronResult.status === 'fulfilled' ? cronResult.value : null
  const agents = Array.isArray(status?.agents?.agents) ? status.agents.agents.map(agent => ({
    id: agent.id,
    name: agent.name || agent.id,
    sessionsCount: agent.sessionsCount || 0,
    bootstrapPending: Boolean(agent.bootstrapPending),
    lastUpdatedAt: agent.lastUpdatedAt || null,
  })) : []
  const jobs = Array.isArray(cron?.jobs) ? cron.jobs.map(job => ({
    id: job.id,
    name: job.name || job.displayName || '자동화',
    enabled: Boolean(job.enabled),
    lastRunStatus: job.lastRunStatus || job.state?.lastRunStatus || null,
    lastRunAtMs: job.lastRunAtMs || job.state?.lastRunAtMs || null,
    nextRunAtMs: job.nextRunAtMs || job.state?.nextRunAtMs || null,
  })) : []
  return NextResponse.json({
    connected: Boolean(status),
    gatewayReachable: status?.gateway?.reachable === true,
    runtimeVersion: status?.runtimeVersion || null,
    sessionCount: status?.sessions?.count ?? null,
    agents,
    registeredAgents: registered.agents,
    registeredSyncedAt: registered.syncedAt,
    jobs,
    statusError: status ? null : 'OpenClaw status is unavailable',
    cronError: cron ? null : 'OpenClaw automations are unavailable',
    checkedAt: new Date().toISOString(),
  })
}
