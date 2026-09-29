import { useMemo } from 'react'

import { buildTakeoff } from '@/core/schedule'
import { formatArea, formatDistance } from '@/core/viewport'
import { useAssetStore } from '@/state/assets'
import { useDocStore } from '@/state/document'
import { exportTakeoffCsv } from '@/state/persistence'

import { DownloadIcon } from './icons'
import { Button, EmptyState, Modal } from './primitives'

/**
 * The plan as a list of quantities.
 *
 * Everything shown is derived from the document on open — there is nothing to
 * keep in sync, and nothing that can drift out of date relative to the drawing
 * it came from.
 */
export function ScheduleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useDocStore((s) => s.doc)
  const assets = useAssetStore((s) => s.assets)
  const materials = useAssetStore((s) => s.materials)
  const categories = useAssetStore((s) => s.categories)

  const takeoff = useMemo(
    () => (open ? buildTakeoff(doc, assets, materials) : null),
    [open, doc, assets, materials],
  )

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id
  const empty = takeoff !== null && takeoff.totals.objects === 0 && takeoff.areas.length === 0

  return (
    <Modal
      open={open}
      title={`Take-off — ${doc.name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" disabled={empty} onClick={exportTakeoffCsv}>
            <DownloadIcon size={15} /> Download CSV
          </Button>
        </>
      }
    >
      {!takeoff ? null : empty ? (
        <EmptyState
          title="Nothing to count yet"
          hint="Place some objects or draw a plot, and the quantities will appear here."
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Objects" value={String(takeoff.totals.objects)} />
            <Stat label="Distinct items" value={String(takeoff.totals.distinctAssets)} />
            <Stat label="Ground" value={formatArea(takeoff.totals.groundArea)} />
            <Stat label="Runs" value={formatDistance(takeoff.totals.linearMetres)} />
          </div>

          {takeoff.groups.map((group) => (
            <section key={group.category}>
              <h3 className="flex items-baseline justify-between pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                <span>{categoryName(group.category)}</span>
                <span className="font-medium normal-case tracking-normal text-stone-400">
                  {group.count} item{group.count === 1 ? '' : 's'}
                </span>
              </h3>
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-stone-200 text-[10px] uppercase tracking-wide text-stone-400">
                    <th className="py-1 font-medium">Item</th>
                    <th className="w-14 py-1 text-right font-medium">Qty</th>
                    <th className="w-28 py-1 text-right font-medium">Size</th>
                    <th className="w-24 py-1 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.assetId} className="border-b border-stone-100 last:border-0">
                      <td className="py-1.5 text-stone-700">{row.name}</td>
                      <td className="py-1.5 text-right tabular-nums text-stone-800">{row.count}</td>
                      <td className="py-1.5 text-right tabular-nums text-stone-500">
                        {row.width !== null && row.height !== null
                          ? `${formatDistance(row.width)} × ${formatDistance(row.height)}`
                          : 'varies'}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-stone-500">
                        {/* A fence is bought by the metre; a tree is not. */}
                        {row.linear ? formatDistance(row.length) : formatArea(row.area)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}

          {takeoff.areas.length > 0 && (
            <section>
              <h3 className="pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Ground materials
              </h3>
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-stone-200 text-[10px] uppercase tracking-wide text-stone-400">
                    <th className="py-1 font-medium">Material</th>
                    <th className="w-24 py-1 text-right font-medium">Area</th>
                    <th className="w-24 py-1 text-right font-medium">Edging</th>
                  </tr>
                </thead>
                <tbody>
                  {takeoff.areas.map((row) => (
                    <tr key={row.materialId} className="border-b border-stone-100 last:border-0">
                      <td className="py-1.5 text-stone-700">{row.name}</td>
                      <td className="py-1.5 text-right tabular-nums text-stone-800">
                        {formatArea(row.area)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-stone-500">
                        {formatDistance(row.perimeter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <p className="text-[10px] leading-relaxed text-stone-400">
            Areas are the drawn footprint with no allowance for waste, falls or compaction. Sizes
            read “varies” where instances have been resized apart.
          </p>
        </div>
      )}
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-stone-50 px-3 py-2 ring-1 ring-stone-200">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-400">{label}</p>
      <p className="pt-0.5 text-sm font-semibold tabular-nums text-stone-800">{value}</p>
    </div>
  )
}
