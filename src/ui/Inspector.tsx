import { multiPolyArea, ringPerimeter } from '@/core/geometry'
import { BAND_META, BAND_ORDER, Band, type BandId } from '@/core/types'
import { formatArea, formatDistance } from '@/core/viewport'
import { getAsset, useAssetStore } from '@/state/assets'
import {
  flipSelection,
  moveSelectionToBand,
  reorderSelection,
  rotateSelection,
  setSelectionLocked,
  setSurfaceMaterial,
  updateSelectedObjects,
} from '@/state/commands'
import { useDocStore } from '@/state/document'
import { useEditorStore } from '@/state/editor'

import { ArrangePanel } from './ArrangePanel'
import {
  BringForwardIcon,
  FlipXIcon,
  FlipYIcon,
  LockIcon,
  RotateIcon,
  SendBackwardIcon,
  UnlockIcon,
} from './icons'
import { Button, EmptyState, Field, NumberInput, Panel, Select, Slider, TextInput, ToolButton } from './primitives'

export function Inspector() {
  const selection = useEditorStore((s) => s.selection)
  const doc = useDocStore((s) => s.doc)
  const materials = useAssetStore((s) => s.materials)

  if (selection.length === 0) {
    return (
      <Panel title="Properties">
        <EmptyState
          title="Nothing selected"
          hint="Click an item on the plan. Click the same spot again to step down through anything underneath it."
        />
      </Panel>
    )
  }

  const surfaceRef = selection.find((r) => r.kind === 'surface')
  const objectRefs = selection.filter((r) => r.kind === 'object')

  if (objectRefs.length === 0 && surfaceRef) {
    const surface = doc.surfaces.find((s) => s.id === surfaceRef.id)
    if (!surface) return null
    const perimeter = surface.geometry.reduce(
      (total, poly) => total + poly.reduce((sum, ring) => sum + ringPerimeter(ring), 0),
      0,
    )
    const rings = surface.geometry.reduce((n, poly) => n + poly.length, 0)

    return (
      <Panel title="Surface">
        <div className="flex flex-col gap-3 px-3 pb-3">
          <Field label="Material">
            <Select
              value={surface.materialId}
              onChange={(id) => setSurfaceMaterial(surface.id, id)}
              options={[...materials.values()].map((m) => ({ value: m.id, label: m.name }))}
            />
          </Field>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-stone-50 p-3 text-[11px] ring-1 ring-stone-200">
            <dt className="text-stone-500">Area</dt>
            <dd className="text-right font-medium text-stone-800 tabular-nums">
              {formatArea(multiPolyArea(surface.geometry))}
            </dd>
            <dt className="text-stone-500">Edge length</dt>
            <dd className="text-right font-medium text-stone-800 tabular-nums">
              {formatDistance(perimeter)}
            </dd>
            <dt className="text-stone-500">Parts</dt>
            <dd className="text-right font-medium text-stone-800 tabular-nums">
              {surface.geometry.length} · {rings} ring{rings === 1 ? '' : 's'}
            </dd>
          </dl>

          <p className="text-[10px] leading-relaxed text-stone-400">
            Drag the round handles to reshape. Surfaces never overlap: drawing one material always
            cuts it out of the others.
          </p>

          <div className="flex gap-1.5">
            <Button size="sm" className="flex-1" onClick={() => reorderSelection('backward')}>
              Send back
            </Button>
            <Button size="sm" className="flex-1" onClick={() => reorderSelection('forward')}>
              Bring forward
            </Button>
          </div>
        </div>
      </Panel>
    )
  }

  const objects = objectRefs.map((r) => doc.objects[r.id]).filter(Boolean)
  if (objects.length === 0) return null
  const first = objects[0]
  const multiple = objects.length > 1
  const asset = getAsset(first.assetId)

  const shared = <T,>(pick: (o: typeof first) => T): T | undefined => {
    const value = pick(first)
    return objects.every((o) => pick(o) === value) ? value : undefined
  }

  const sharedBand = shared((o) => o.band)
  const sharedLocked = shared((o) => o.locked) ?? false
  const sharedOpacity = shared((o) => o.opacity) ?? 1

  return (
    <Panel title={multiple ? `${objects.length} selected` : (asset?.name ?? 'Object')}>
      <div className="flex flex-col gap-3 px-3 pb-3">
        {!multiple && (
          <Field label="Label" hint="Shown in the layers list">
            <TextInput
              value={first.label ?? ''}
              placeholder={asset?.name ?? ''}
              onChange={(e) => {
                const value = e.target.value
                updateSelectedObjects('Rename', (o) => {
                  o.label = value.trim() || undefined
                })
              }}
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field label="X">
            <NumberInput
              value={first.x}
              unit="m"
              onCommit={(v) => {
                const delta = v - first.x
                updateSelectedObjects('Move', (o) => {
                  o.x += delta
                })
              }}
            />
          </Field>
          <Field label="Y">
            <NumberInput
              value={first.y}
              unit="m"
              onCommit={(v) => {
                const delta = v - first.y
                updateSelectedObjects('Move', (o) => {
                  o.y += delta
                })
              }}
            />
          </Field>
          <Field label="Width">
            <NumberInput
              value={first.w}
              unit="m"
              onCommit={(v) => {
                const width = Math.max(0.02, v)
                const keepAspect = asset?.aspectLocked ?? false
                const ratio = width / first.w
                updateSelectedObjects('Resize', (o) => {
                  o.w = keepAspect ? o.w * ratio : width
                  if (keepAspect) o.h *= ratio
                })
              }}
            />
          </Field>
          <Field label="Height">
            <NumberInput
              value={first.h}
              unit="m"
              onCommit={(v) => {
                const height = Math.max(0.02, v)
                const keepAspect = asset?.aspectLocked ?? false
                const ratio = height / first.h
                updateSelectedObjects('Resize', (o) => {
                  o.h = keepAspect ? o.h * ratio : height
                  if (keepAspect) o.w *= ratio
                })
              }}
            />
          </Field>
        </div>

        <Field label="Rotation">
          <div className="flex items-center gap-1.5">
            <NumberInput
              value={((first.rotation % 360) + 360) % 360}
              unit="°"
              precision={1}
              onCommit={(v) => {
                const delta = v - first.rotation
                updateSelectedObjects('Rotate', (o) => {
                  o.rotation += delta
                })
              }}
            />
            <ToolButton label="Rotate 90° left" onClick={() => rotateSelection(-90)}>
              <RotateIcon size={15} />
            </ToolButton>
            <ToolButton label="Rotate 90° right" onClick={() => rotateSelection(90)} className="scale-x-[-1]">
              <RotateIcon size={15} />
            </ToolButton>
          </div>
        </Field>

        <Field label={`Opacity — ${Math.round(sharedOpacity * 100)}%`}>
          <Slider
            value={Math.round(sharedOpacity * 100)}
            min={10}
            max={100}
            onChange={(v) =>
              updateSelectedObjects('Opacity', (o) => {
                o.opacity = v / 100
              })
            }
          />
        </Field>

        <Field label="Layer" hint={sharedBand !== undefined ? BAND_META[sharedBand].hint : 'Mixed layers'}>
          <Select
            value={sharedBand !== undefined ? String(sharedBand) : ''}
            onChange={(v) => moveSelectionToBand(Number(v) as BandId)}
            options={[
              ...(sharedBand === undefined ? [{ value: '', label: 'Mixed…' }] : []),
              ...BAND_ORDER.filter((b) => b !== Band.Terrain).map((b) => ({
                value: String(b),
                label: BAND_META[b].name,
              })),
            ]}
          />
        </Field>

        <div>
          <span className="text-[11px] font-medium text-stone-500">
            Order within {sharedBand !== undefined ? BAND_META[sharedBand].name : 'layer'}
          </span>
          <div className="mt-1 flex gap-1">
            <ToolButton label="Send to back of layer" onClick={() => reorderSelection('back')} className="flex-1">
              <SendBackwardIcon size={15} />
            </ToolButton>
            <ToolButton label="Send backward" onClick={() => reorderSelection('backward')} className="flex-1">
              <SendBackwardIcon size={15} className="opacity-60" />
            </ToolButton>
            <ToolButton label="Bring forward" onClick={() => reorderSelection('forward')} className="flex-1">
              <BringForwardIcon size={15} className="opacity-60" />
            </ToolButton>
            <ToolButton label="Bring to front of layer" onClick={() => reorderSelection('front')} className="flex-1">
              <BringForwardIcon size={15} />
            </ToolButton>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-stone-400">
            Ordering stays inside the layer, so this can never push something above a tree canopy.
          </p>
        </div>

        <div className="flex gap-1">
          <ToolButton label="Flip horizontally" onClick={() => flipSelection('x')} className="flex-1">
            <FlipXIcon size={15} />
          </ToolButton>
          <ToolButton label="Flip vertically" onClick={() => flipSelection('y')} className="flex-1">
            <FlipYIcon size={15} />
          </ToolButton>
          <ToolButton
            label={sharedLocked ? 'Unlock' : 'Lock'}
            active={sharedLocked}
            onClick={() => setSelectionLocked(!sharedLocked)}
            className="flex-1"
          >
            {sharedLocked ? <LockIcon size={15} /> : <UnlockIcon size={15} />}
          </ToolButton>
        </div>
      </div>

      {multiple && <ArrangePanel objects={objects} />}
    </Panel>
  )
}
