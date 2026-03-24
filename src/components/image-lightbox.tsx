'use client'

import { useState, useRef } from 'react'
import { ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

function ImageViewer({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const posStart = useRef({ x: 0, y: 0 })

  function resetView() {
    setZoom(1)
    setRotation(0)
    setPosition({ x: 0, y: 0 })
  }

  function handleZoomIn() {
    setZoom((z) => Math.min(z + 0.5, 5))
  }

  function handleZoomOut() {
    setZoom((z) => {
      const next = Math.max(z - 0.5, 0.5)
      if (next <= 1) setPosition({ x: 0, y: 0 })
      return next
    })
  }

  function handleRotate() {
    setRotation((r) => (r + 90) % 360)
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    if (e.deltaY < 0) handleZoomIn()
    else handleZoomOut()
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (zoom <= 1) return
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY }
    posStart.current = { ...position }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return
    setPosition({
      x: posStart.current.x + (e.clientX - dragStart.current.x),
      y: posStart.current.y + (e.clientY - dragStart.current.y),
    })
  }

  function handlePointerUp() {
    setDragging(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoom <= 0.5} className="h-8 w-8 p-0">
            <ZoomOut className="size-3.5" />
          </Button>
          <span className="w-14 text-center text-xs tabular-nums font-medium text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoom >= 5} className="h-8 w-8 p-0">
            <ZoomIn className="size-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={handleRotate} className="h-8 w-8 p-0">
            <RotateCw className="size-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={resetView} className="h-8 gap-1.5 text-xs">
            Reset
          </Button>
        </div>
      </div>

      <div
        className="relative overflow-hidden rounded-lg border bg-muted/30"
        style={{ height: 'min(70vh, 700px)' }}
        onWheel={handleWheel}
      >
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="max-h-full max-w-full select-none transition-transform duration-150"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

export function ImageLightbox({
  src,
  alt,
  title,
  children,
}: {
  src: string
  alt: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger
        className="group relative block w-full cursor-pointer overflow-hidden rounded-lg border bg-muted transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/20">
          <div className="flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100">
            <Maximize2 className="size-3" />
            View full size
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-sm">{title ?? 'Medical Record'}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <ImageViewer src={src} alt={alt} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
