'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { Button } from '@/components/ui/button'
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  File as FileIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Dynamically import PDF components to avoid SSR issues
const Document = dynamic(
  () => import('react-pdf').then((mod) => mod.Document),
  { ssr: false }
)

const Page = dynamic(
  () => import('react-pdf').then((mod) => mod.Page),
  { ssr: false }
)

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  import('react-pdf').then((pdfjs) => {
    pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.pdfjs.version}/build/pdf.worker.min.mjs`
  })
}

interface FilePreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileUrl: string
  fileName: string
  fileType: string
}

export function FilePreviewModal({
  open,
  onOpenChange,
  fileUrl,
  fileName,
  fileType,
}: FilePreviewModalProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const isImage = fileType.startsWith('image/')
  const isPDF = fileType === 'application/pdf'
  const isVideo = fileType.startsWith('video/')
  const isAudio = fileType.startsWith('audio/')

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = fileName
    link.click()
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoading(false)
    setError(false)
  }

  const onDocumentLoadError = () => {
    setLoading(false)
    setError(true)
  }

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0))
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5))
  const handlePrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1))
  const handleNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages))

  const handleImageLoad = () => {
    setLoading(false)
    setError(false)
  }

  const handleImageError = () => {
    setLoading(false)
    setError(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 flex flex-col" showCloseButton={false} aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>File Preview: {fileName}</DialogTitle>
        </VisuallyHidden>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{fileName}</p>
              <p className="text-xs text-muted-foreground">{fileType}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* PDF Controls */}
            {isPDF && !error && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={scale <= 0.5}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={scale >= 3.0}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-2" />
              </>
            )}

            {/* Image Controls */}
            {isImage && !error && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={scale <= 0.5}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={scale >= 3.0}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-2" />
              </>
            )}

            <Button variant="ghost" size="icon" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-4">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p>Loading preview...</p>
            </div>
          )}

          {error && (
            <div className="text-center">
              <FileIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Unable to preview this file
              </p>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download File
              </Button>
            </div>
          )}

          {/* Image Preview */}
          {isImage && !error && (
            <img
              src={fileUrl}
              alt={fileName}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={cn(
                'max-w-full max-h-full object-contain transition-opacity',
                loading ? 'opacity-0' : 'opacity-100'
              )}
              style={{ transform: `scale(${scale})` }}
            />
          )}

          {/* PDF Preview */}
          {isPDF && !error && (
            <div className="flex flex-col items-center gap-4">
              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={null}
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  loading={null}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </Document>
            </div>
          )}

          {/* Video Preview */}
          {isVideo && !error && (
            <video
              src={fileUrl}
              controls
              className="max-w-full max-h-full"
              onLoadedData={handleImageLoad}
              onError={handleImageError}
            />
          )}

          {/* Audio Preview */}
          {isAudio && !error && (
            <div className="w-full max-w-md">
              <audio
                src={fileUrl}
                controls
                className="w-full"
                onLoadedData={handleImageLoad}
                onError={handleImageError}
              />
            </div>
          )}

          {/* Generic File */}
          {!isImage && !isPDF && !isVideo && !isAudio && (
            <div className="text-center">
              <FileIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">{fileName}</p>
              <p className="text-sm text-muted-foreground mb-4">
                Preview not available for this file type
              </p>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download File
              </Button>
            </div>
          )}
        </div>

        {/* PDF Footer with Pagination */}
        {isPDF && numPages > 0 && !error && (
          <div className="flex items-center justify-center gap-4 p-4 border-t">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevPage}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pageNumber} of {numPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextPage}
              disabled={pageNumber >= numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
