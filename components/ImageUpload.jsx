'use client';

import { useRef, useState } from 'react';

/**
 * ImageUpload Component
 * Drag & drop image upload with preview
 */
export default function ImageUpload({
  label,
  name,
  onImageSelect,
  previewUrl,
  error,
  accept = 'image/jpeg,image/png,image/webp',
  hint,
  icon = '📸',
  required = false,
}) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = (file) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      onImageSelect(null, 'Only JPG, PNG, and WebP images are allowed.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 3 * 1024 * 1024) {
      onImageSelect(null, 'Image size must be under 1MB.');
      return;
    }

    onImageSelect(file, null);
  };

  const handleInputChange = (e) => {
    const file = e.target.files[0];
    handleFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleRemove = (e) => {
    e.stopPropagation();
    onImageSelect(null, null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label */}
      <label className="flex items-center gap-2 text-sm font-medium" style={{ color: 'rgba(232,245,233,0.7)', fontFamily: 'var(--font-accent)', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '11px' }}>
        <span className="text-base">{icon}</span>
        {label}
        {required && <span style={{ color: '#f59e0b' }}>*</span>}
      </label>

      {/* Upload Zone */}
      <div
        onClick={() => !previewUrl && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative upload-zone rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${isDragOver ? 'drag-over' : ''}`}
        style={{
          border: `2px dashed ${error ? 'rgba(239,68,68,0.5)' : isDragOver ? 'rgba(34,197,94,0.7)' : 'rgba(255,255,255,0.12)'}`,
          background: isDragOver ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.02)',
          minHeight: previewUrl ? 'auto' : '140px',
        }}
      >
        {previewUrl ? (
          /* Image Preview */
          <div className="relative">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full object-cover"
              style={{ maxHeight: '240px', objectFit: 'cover' }}
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: 'rgba(34,197,94,0.9)', color: '#fff' }}
              >
                Change
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}
              >
                Remove
              </button>
            </div>
            {/* Selected badge */}
            <div className="absolute top-2 right-2 px-2 py-1 rounded-lg text-xs flex items-center gap-1" style={{ background: 'rgba(34,197,94,0.9)', color: '#fff', fontFamily: 'var(--font-accent)' }}>
              <span>✓</span> Selected
            </div>
          </div>
        ) : (
          /* Upload Placeholder */
          <div className="flex flex-col items-center justify-center p-8 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
              {icon}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'rgba(232,245,233,0.8)' }}>
                Drop image here or <span style={{ color: 'var(--color-green)' }}>browse</span>
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>
                {hint || 'JPG, PNG, WebP — max 1MB'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Error */}
      {error && (
        <p className="text-xs flex items-center gap-1 animate-fade-in" style={{ color: '#f87171' }}>
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}
