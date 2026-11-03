'use client';

import { useState, useRef, useCallback } from 'react';
import { apiFormPost } from '@/lib/api';
import type { SearchResult } from '@/lib/types';

interface Props {
  disabled: boolean;
  onResult: (result: SearchResult) => void;
}

export default function PdfUpload({ disabled, onResult }: Props) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const doUpload = useCallback(async (file: File) => {
    setFileName(file.name);
    setLoading(true);
    try {
      const res = await apiFormPost<SearchResult>('/pdf-info', { pdf_file: file });
      onResult(res);
    } catch (err: any) {
      console.error('Upload error:', err);
      onResult({ error: 'Could not connect to the server. Please check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  }, [onResult]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.toLowerCase().endsWith('.pdf')) doUpload(file);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
  };

  return (
    <div>
      <div
        className={`upload-area ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".pdf" hidden onChange={handleSelect} disabled={disabled || loading} />
        <div className="upload-icon-wrap">
          <svg className="upload-icon" width="24" height="24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <p className="upload-title">{loading ? 'Reading PDF…' : fileName || 'Drop PDF here or click to browse'}</p>
        <p className="upload-subtitle">
          Supports .pdf files up to 20MB
        </p>
      </div>
    </div>
  );
}
