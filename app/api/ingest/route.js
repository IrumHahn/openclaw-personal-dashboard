import { NextResponse } from 'next/server'
import { addRecord, mutateStore } from '../../../lib/store'

export const runtime = 'nodejs'

export async function POST(request) {
  const token = process.env.DASHBOARD_INGEST_TOKEN
  if (!token || request.headers.get('authorization') !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const input = await request.json()
    if (!['meetings', 'notes'].includes(input.collection)) throw new Error('Only meetings and notes can be ingested')
    if (!input.source || !input.sourceId) throw new Error('source and sourceId are required for deduplication')
    const result = await mutateStore(data => addRecord(data, input.collection, input))
    return NextResponse.json(result, { status: result.created ? 201 : 200 })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
