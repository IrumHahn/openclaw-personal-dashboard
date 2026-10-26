import { NextResponse } from 'next/server'
import { addRecord, isCollectionKey, mutateStore, readStore, updateRecord } from '../../../../lib/store'
import { assertSameOrigin } from '../../../../lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function invalid(error) {
  return NextResponse.json({ error: error.message }, { status: error.message === 'Record not found' ? 404 : 400 })
}

export async function GET(_request, { params }) {
  const { collection } = await params
  if (!isCollectionKey(collection)) return NextResponse.json({ error: 'Unknown collection' }, { status: 404 })
  const data = await readStore()
  return NextResponse.json({ records: data[collection] || [] })
}

export async function POST(request, { params }) {
  try {
    assertSameOrigin(request)
    const { collection } = await params
    const input = await request.json()
    const result = await mutateStore(data => addRecord(data, collection, input))
    return NextResponse.json(result, { status: result.created ? 201 : 200 })
  } catch (error) { return invalid(error) }
}

export async function PATCH(request, { params }) {
  try {
    assertSameOrigin(request)
    const { collection } = await params
    const { id, ...input } = await request.json()
    if (typeof id !== 'string') throw new Error('Record ID is required')
    const record = await mutateStore(data => updateRecord(data, collection, id, input))
    return NextResponse.json({ record })
  } catch (error) { return invalid(error) }
}

export async function DELETE(request, { params }) {
  try {
    assertSameOrigin(request)
    const { collection } = await params
    if (!isCollectionKey(collection)) throw new Error('Unknown collection')
    const id = new URL(request.url).searchParams.get('id')
    if (!id) throw new Error('Record ID is required')
    const deleted = await mutateStore(data => {
      const index = (data[collection] || []).findIndex(item => item.id === id)
      if (index < 0) throw new Error('Record not found')
      return data[collection].splice(index, 1)[0]
    })
    return NextResponse.json({ deleted: deleted.id })
  } catch (error) { return invalid(error) }
}
