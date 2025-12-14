import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useArticles } from '../../contexts/ArticleContext';
import { illustrationAPI } from '../../api/illustrations';
import type { Illustration } from '../../api/illustrations';
import { Article } from '../../types/Article';
import ApprovedArticlesList from '../../components/Illustrator/ApprovedArticlesList';
import IllustrationUploadPanel from '../../components/Illustrator/IllustrationUploadPanel';
import IllustrationsGrid from '../../components/Illustrator/IllustrationsGrid';

const IllustratorWorkspace: React.FC = () => {
  const { articles } = useArticles();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [illustrations, setIllustrations] = useState<Illustration[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const approvedArticles = articles.filter(a => a.status === 'approved');

  const loadIllustrations = useCallback(async (articleId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await illustrationAPI.getByArticle(articleId);
      setIllustrations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить иллюстрации');
      console.error('Failed to load illustrations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadImage = useCallback(async (file: File | Blob) => {
    if (!selectedArticle) return;

    setUploading(true);
    setError(null);
    setSuccessMessage(null);
    
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    
    try {
      const illustration = await illustrationAPI.upload(selectedArticle.id, file);
      setIllustrations(prev => [illustration, ...prev]);
      
      const fileName = file instanceof File ? file.name : 'изображение';
      setSuccessMessage(`✅ Изображение "${fileName}" успешно добавлено к статье "${selectedArticle.title}"`);
      
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить изображение');
      console.error('Failed to upload image:', err);
    } finally {
      setUploading(false);
    }
  }, [selectedArticle]);

  useEffect(() => {
    if (selectedArticle) {
      loadIllustrations(selectedArticle.id);
    } else {
      setIllustrations([]);
    }
  }, [selectedArticle, loadIllustrations]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!selectedArticle) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            await uploadImage(blob);
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [selectedArticle, uploadImage]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedArticle) {
      uploadImage(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить эту иллюстрацию?')) return;

    const illustration = illustrations.find(ill => ill.id === id);
    const illustrationName = illustration?.originalName || 'изображение';

    try {
      await illustrationAPI.delete(id);
      setIllustrations(prev => prev.filter(ill => ill.id !== id));
      
      if (selectedArticle) {
        setSuccessMessage(`✅ Иллюстрация "${illustrationName}" удалена из статьи "${selectedArticle.title}"`);
        
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
        }
        successTimeoutRef.current = setTimeout(() => {
          setSuccessMessage(null);
        }, 4000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить иллюстрацию');
      console.error('Failed to delete illustration:', err);
    }
  };

  const handleCaptionUpdate = async (id: string, caption: string) => {
    try {
      const updated = await illustrationAPI.update(id, { caption });
      setIllustrations(prev => prev.map(ill => ill.id === id ? updated : ill));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить подпись');
      console.error('Failed to update caption:', err);
    }
  };

  return (
    <div className="illustrator-workspace" style={{ maxWidth: 1400, margin: '0 auto', padding: '0 16px' }}>
      <div className="workspace-header">
        <div>
          <h1>Иллюстратор</h1>
          <p>Добавляйте изображения к одобренным статьям</p>
        </div>
      </div>

      {error && (
        <div style={{
          marginBottom: 16,
          padding: '10px 14px',
          background: '#FEE2E2',
          border: '1px solid #FCA5A5',
          borderRadius: 8,
          color: '#991B1B',
          fontSize: 14
        }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div style={{
          marginBottom: 16,
          padding: '10px 14px',
          background: '#D1FAE5',
          border: '1px solid #6EE7B7',
          borderRadius: 8,
          color: '#065F46',
          fontSize: 14
        }}>
          {successMessage}
        </div>
      )}

      <div
                  style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: 24,
          alignItems: 'start',
                  }}
      >
        <ApprovedArticlesList
          approvedArticles={approvedArticles}
          selectedArticle={selectedArticle}
          onSelect={setSelectedArticle}
        />

        <div
          style={{
          background: 'rgba(21, 24, 33, 0.2)',
          border: '1px solid rgba(38, 42, 54, 0.3)',
          borderRadius: 12,
          padding: 20,
          }}
        >
          {!selectedArticle ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--subtext)' }}>
              <p style={{ fontSize: 18, marginBottom: 12 }}>Выберите статью</p>
              <p style={{ fontSize: 14 }}>
                Выберите одобренную статью из списка слева, чтобы добавить иллюстрации
              </p>
            </div>
          ) : (
            <>
              <IllustrationUploadPanel
                selectedArticle={selectedArticle}
                uploading={uploading}
                fileInputRef={fileInputRef}
                onFileSelect={handleFileSelect}
              />

              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
                  Иллюстрации ({illustrations.length})
                </h3>
                <IllustrationsGrid
                  illustrations={illustrations}
                  loading={loading}
                  onCaptionChange={handleCaptionUpdate}
                  onDelete={handleDelete}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default IllustratorWorkspace;

