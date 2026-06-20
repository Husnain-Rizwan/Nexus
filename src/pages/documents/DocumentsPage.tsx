import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Upload, Download, Trash2, Share2, FileSignature, Eye } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

interface DocumentFile {
  id: number;
  name: string;
  type: string;
  size: string;
  lastModified: string;
  shared: boolean;
  status: 'Draft' | 'In Review' | 'Signed';
  previewUrl?: string;
}

const initialDocuments: DocumentFile[] = [
  {
    id: 1,
    name: 'Pitch Deck 2024.pdf',
    type: 'PDF',
    size: '2.4 MB',
    lastModified: '2024-02-15',
    shared: true,
    status: 'Signed',
  },
  {
    id: 2,
    name: 'Financial Projections.xlsx',
    type: 'Spreadsheet',
    size: '1.8 MB',
    lastModified: '2024-02-10',
    shared: false,
    status: 'In Review',
  },
  {
    id: 3,
    name: 'Business Plan.docx',
    type: 'Document',
    size: '3.2 MB',
    lastModified: '2024-02-05',
    shared: true,
    status: 'Draft',
  },
  {
    id: 4,
    name: 'Market Research.pdf',
    type: 'PDF',
    size: '5.1 MB',
    lastModified: '2024-01-28',
    shared: false,
    status: 'Signed',
  },
];

const statusVariant: Record<DocumentFile['status'], string> = {
  Draft: 'warning',
  'In Review': 'secondary',
  Signed: 'success',
};

export const DocumentsPage: React.FC = () => {
  const [documentList, setDocumentList] = useState<DocumentFile[]>(initialDocuments);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number>(initialDocuments[0].id);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeStatus, setActiveStatus] = useState<DocumentFile['status']>('Draft');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const selectedDoc = useMemo(
    () => documentList.find(doc => doc.id === selectedDocumentId) ?? documentList[0],
    [documentList, selectedDocumentId]
  );

  const isPdfPreview = selectedDoc?.previewUrl?.endsWith('.pdf');

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = 180 * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = '180px';
      context.scale(ratio, ratio);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = '#F97316';
      context.lineWidth = 2.5;
    };

    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handleDocumentSelect = (id: number) => {
    setSelectedDocumentId(id);
    setSignatureDataUrl(null);
  };

  const handleStatusUpdate = (status: DocumentFile['status']) => {
    if (!selectedDoc) return;
    setDocumentList(prev =>
      prev.map(doc =>
        doc.id === selectedDoc.id
          ? { ...doc, status }
          : doc
      )
    );
    setActiveStatus(status);
  };

  const handleDeleteDocument = (id: number) => {
    setDocumentList(prev => {
      const nextList = prev.filter(doc => doc.id !== id);
      if (selectedDocumentId === id && nextList.length > 0) {
        setSelectedDocumentId(nextList[0].id);
      }
      return nextList;
    });
    if (selectedDocumentId === id) {
      setSignatureDataUrl(null);
    }
  };

  const clearSignature = () => {
    if (!canvasRef.current) return;
    const context = canvasRef.current.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setSignatureDataUrl(null);
  };

  const saveSignature = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    setSignatureDataUrl(dataUrl);
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    lastPointRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const drawSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    context.beginPath();
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    context.lineTo(x, y);
    context.stroke();

    lastPointRef.current = { x, y };
  };

  const endDrawing = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    objectUrlsRef.current.push(url);

    const newDocument: DocumentFile = {
      id: Date.now(),
      name: file.name,
      type: file.type.includes('pdf') ? 'PDF' : file.name.split('.').pop()?.toUpperCase() ?? 'Document',
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      lastModified: new Date().toLocaleDateString(),
      shared: false,
      status: 'Draft',
      previewUrl: url,
    };

    setDocumentList(prev => [newDocument, ...prev]);
    setSelectedDocumentId(newDocument.id);
    event.target.value = '';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600">Manage your startup's important files</p>
        </div>

        <Button
          leftIcon={<Upload size={18} />}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Document
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium text-gray-900">Storage</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Used</span>
                  <span className="font-medium text-gray-900">12.5 GB</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                  <div className="h-2 bg-primary-600 rounded-full" style={{ width: '65%' }}></div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Available</span>
                  <span className="font-medium text-gray-900">7.5 GB</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Quick Access</h3>
                <div className="space-y-2">
                  <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                    Recent Files
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                    Shared with Me
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                    Starred
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                    Trash
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium text-gray-900">Document Chamber</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-sm text-gray-600">
                Upload a contract or deal document, preview it, and use the signature mockup to mark it ready.
              </p>

              <Button
                variant="outline"
                fullWidth
                leftIcon={<Upload size={18} />}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload & preview
              </Button>

              {selectedDoc && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedDoc.name}</p>
                      <p className="text-xs text-gray-500">{selectedDoc.type} • {selectedDoc.size}</p>
                    </div>
                    <Badge variant={statusVariant[selectedDoc.status]}>
                      {selectedDoc.status}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900">Status</h3>
                    <div className="flex flex-wrap gap-2">
                      {(['Draft', 'In Review', 'Signed'] as DocumentFile['status'][]).map(status => (
                        <Button
                          key={status}
                          variant={status === selectedDoc.status ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => handleStatusUpdate(status)}
                        >
                          {status}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Document Chamber Preview</h2>
                <p className="text-sm text-gray-600">Focus on the selected contract and finish the signature process.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Eye size={16} />}
                  onClick={() => selectedDoc?.previewUrl && window.open(selectedDoc.previewUrl, '_blank')}
                  disabled={!selectedDoc?.previewUrl}
                >
                  Open preview
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid gap-6 xl:grid-cols-[1.75fr_1fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-gray-200 overflow-hidden bg-gray-50 min-h-[280px]">
                    {selectedDoc?.previewUrl && isPdfPreview ? (
                      <iframe
                        title="Document preview"
                        src={selectedDoc.previewUrl}
                        className="w-full h-96"
                      />
                    ) : selectedDoc?.previewUrl ? (
                      <div className="h-96 flex items-center justify-center text-sm text-gray-500">
                        Preview available only for PDFs. Upload a PDF for inline preview.
                      </div>
                    ) : (
                      <div className="h-96 flex flex-col items-center justify-center text-center px-6 text-sm text-gray-500">
                        <FileText size={36} className="mb-3 text-primary-600" />
                        Upload a contract or deal file to preview it here.
                      </div>
                    )}
                  </div>

                  {selectedDoc && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Selected document</p>
                          <p className="text-xs text-gray-500">{selectedDoc.lastModified} • {selectedDoc.type}</p>
                        </div>
                        <Badge variant={statusVariant[selectedDoc.status]}>
                          {selectedDoc.status}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">E-Signature Pad</h3>
                          <p className="text-sm text-gray-500">Sign directly in the chamber and save a mock signature.</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardBody className="space-y-4">
                      <div className="rounded-2xl border border-dashed border-orange-300 bg-orange-50 p-3">
                        <canvas
                          ref={canvasRef}
                          className="w-full h-44 rounded-lg bg-white touch-none"
                          onPointerDown={startDrawing}
                          onPointerMove={drawSignature}
                          onPointerUp={endDrawing}
                          onPointerLeave={endDrawing}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={clearSignature}>
                          Clear pad
                        </Button>
                        <Button variant="primary" size="sm" onClick={saveSignature}>
                          Save signature
                        </Button>
                      </div>
                      {signatureDataUrl && (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                          <p className="text-sm font-medium text-gray-900 mb-2">Signature preview</p>
                          <img src={signatureDataUrl} alt="Saved signature" className="w-full rounded-lg border border-gray-200" />
                        </div>
                      )}
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold text-gray-900">Document Queue</h3>
                    </CardHeader>
                    <CardBody className="space-y-3">
                      {documentList.map(doc => (
                        <button
                          key={doc.id}
                          type="button"
                          className={`w-full text-left p-3 rounded-2xl border ${doc.id === selectedDocumentId ? 'border-primary-600 bg-primary-50' : 'border-gray-200 bg-white'} transition-colors duration-200`}
                          onClick={() => handleDocumentSelect(doc.id)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                              <p className="text-xs text-gray-500">{doc.type} • {doc.size}</p>
                            </div>
                            <Badge variant={statusVariant[doc.status]}>{doc.status}</Badge>
                          </div>
                        </button>
                      ))}
                    </CardBody>
                  </Card>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">All Documents</h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                {documentList.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center p-4 hover:bg-gray-50 rounded-lg transition-colors duration-200"
                  >
                    <div className="p-2 bg-primary-50 rounded-lg mr-4">
                      <FileText size={24} className="text-primary-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {doc.name}
                        </h3>
                        {doc.shared && (
                          <Badge variant="secondary" size="sm">Shared</Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
                        <span>{doc.type}</span>
                        <span>{doc.size}</span>
                        <span>Modified {doc.lastModified}</span>
                        <Badge variant={statusVariant[doc.status]} size="sm">{doc.status}</Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-2"
                        aria-label="Download"
                      >
                        <Download size={18} />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-2"
                        aria-label="Share"
                      >
                        <Share2 size={18} />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-2 text-error-600 hover:text-error-700"
                        aria-label="Delete"
                        onClick={() => handleDeleteDocument(doc.id)}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt"
        onChange={handleFileUpload}
      />
    </div>
  );
};