import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// DELETE /api/records/[id] — elimina un cerebro del Museo de la Evolución.
// Next.js 16: los params de los route handlers son una Promise.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const existing = await db.evolutionRecord.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Registro no encontrado.' },
        { status: 404 },
      )
    }

    await db.evolutionRecord.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/records/[id]]', error)
    return NextResponse.json(
      { error: 'No se pudo eliminar el registro.' },
      { status: 500 },
    )
  }
}
