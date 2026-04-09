'use client';

import { useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  VisuallyHidden,
  Button,
  cn,
} from '@taskflow/ui';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  File as FileIcon,
} from 'lucide-react';
import { OptimizedImage } from '../../providers/image-context';

export interface PDFViewerProps {
  fileUrl: string;
  pageNumber: number;
  scale: number;
  onLoadSuccess: (data: { numPages: number }) => void;
  onLoadError: () => void;
}

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName: string;
  fileType: string;
  /** Optional render prop for PDF viewer - allows consumers to provide react-pdf implementation */
  renderPDFViewer?: (props: PDFViewerProps) => ReactNode;
}

export function FilePreviewModal({
  open,
  onOpenChange,
  fileUrl,
  fileName,
  fileType,
  renderPDFViewer,
}: FilePreviewModalProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isImage = fileType.startsWith('image/');
  const isPDF = fileType === 'application/pdf';
  const isVideo = fileType.startsWith('video/');
  const isAudio = fileType.startsWith('audio/');

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.click();
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(false);
  };

  const onDocumentLoadError = () => {
    setLoading(false);
    setError(true);
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3.0));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));
  const handlePrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () => setPageNumber((prev) => Math.min(prev + 1, numPages));

  const handleMediaLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleMediaError = () => {
    setLoading(false);
    setError(true);
  };

  // Show PDF fallback when no viewer provided
  const showPDFFallback = isPDF && !renderPDFViewer;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl h-[90vh] p-0 flex flex-col"
        showCloseButton={false}
        aria-describedby={undefined}
      >
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
            {isPDF && renderPDFViewer && !error && (
              <>
                <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={scale <= 0.5}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={scale >= 3.0}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-2" />
              </>
            )}

            {/* Image Controls */}
            {isImage && !error && (
              <>
                <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={scale <= 0.5}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={scale >= 3.0}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-2" />
              </>
            )}

            <Button variant="ghost" size="icon" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-4">
          {loading && !showPDFFallback && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p>Loading preview...</p>
            </div>
          )}

          {error && (
            <div className="text-center">
              <FileIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Unable to preview this file</p>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download File
              </Button>
            </div>
          )}

          {/* Image Preview */}
          {isImage && !error && (
            <div
              className={cn(
                'relative max-w-full max-h-full transition-opacity',
                loading ? 'opacity-0' : 'opacity-100'
              )}
              style={{ transform: `scale(${scale})`, width: '100%', height: '100%' }}
            >
              <OptimizedImage
                src={fileUrl}
                alt={fileName}
                className="object-contain w-full h-full"
              />
              {/* Hidden img for load detection */}
              <img
                src={fileUrl}
                alt=""
                className="hidden"
                onLoad={handleMediaLoad}
                onError={handleMediaError}
              />
            </div>
          )}

          {/* PDF Preview - with render prop */}
          {isPDF && renderPDFViewer && !error && (
            <div className="flex flex-col items-center gap-4">
              {renderPDFViewer({
                fileUrl,
                pageNumber,
                scale,
                onLoadSuccess: onDocumentLoadSuccess,
                onLoadError: onDocumentLoadError,
              })}
            </div>
          )}

          {/* PDF Fallback - no viewer provided */}
          {showPDFFallback && (
            <div className="text-center">
              <FileIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">{fileName}</p>
              <p className="text-sm text-muted-foreground mb-4">
                PDF preview not available
              </p>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          )}

          {/* Video Preview */}
          {isVideo && !error && (
            <video
              src={fileUrl}
              controls
              className="max-w-full max-h-full"
              onLoadedData={handleMediaLoad}
              onError={handleMediaError}
            />
          )}

          {/* Audio Preview */}
          {isAudio && !error && (
            <div className="w-full max-w-md">
              <audio
                src={fileUrl}
                controls
                className="w-full"
                onLoadedData={handleMediaLoad}
                onError={handleMediaError}
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
        {isPDF && renderPDFViewer && numPages > 0 && !error && (
          <div className="flex items-center justify-center gap-4 p-4 border-t">
            <Button variant="ghost" size="icon" onClick={handlePrevPage} disabled={pageNumber <= 1}>
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
  );
}
