import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useArticles } from '../../contexts/ArticleContext';
import { useAuth } from '../../contexts/AuthContexts';
import { illustrationAPI, Illustration } from '../../utils/api';
import { Article } from '../../types/Article';

const IllustratorWorkspace: React.FC = () => {
  const { articles } = useArticles();
  const { user } = useAuth();
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

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
        <div style={{
          position: 'sticky',
          top: 24,
          maxHeight: 'calc(100vh - 100px)',
          overflowY: 'auto',
          background: 'rgba(21, 24, 33, 0.3)',
          border: '1px solid rgba(38, 42, 54, 0.3)',
          borderRadius: 12,
          padding: 16,
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>Одобренные статьи</h3>
          {approvedArticles.length === 0 ? (
            <p style={{ color: 'var(--subtext)', fontSize: 14, margin: '8px 0' }}>
              Нет одобренных статей
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {approvedArticles.map(article => (
                <div
                  key={article.id}
                  onClick={() => setSelectedArticle(article)}
                  style={{
                    background: selectedArticle?.id === article.id
                      ? 'rgba(6, 191, 204, 0.15)'
                      : 'rgba(14, 16, 22, 0.5)',
                    border: `1px solid ${selectedArticle?.id === article.id ? 'var(--accent)' : 'rgba(38, 42, 54, 0.4)'}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedArticle?.id !== article.id) {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.background = 'rgba(14, 16, 22, 0.7)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedArticle?.id !== article.id) {
                      e.currentTarget.style.borderColor = 'rgba(38, 42, 54, 0.4)';
                      e.currentTarget.style.background = 'rgba(14, 16, 22, 0.5)';
                    }
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                    {article.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--subtext)' }}>
                    {new Date(article.updatedAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          background: 'rgba(21, 24, 33, 0.2)',
          border: '1px solid rgba(38, 42, 54, 0.3)',
          borderRadius: 12,
          padding: 20,
        }}>
          {!selectedArticle ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--subtext)' }}>
              <p style={{ fontSize: 18, marginBottom: 12 }}>Выберите статью</p>
              <p style={{ fontSize: 14 }}>Выберите одобренную статью из списка слева, чтобы добавить иллюстрации</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 600 }}>
                  {selectedArticle.title}
                </h2>
                <div style={{ fontSize: 14, color: 'var(--subtext)', marginBottom: 16 }}>
                  {new Date(selectedArticle.updatedAt).toLocaleDateString('ru-RU')}
                </div>

                <div
                  style={{
                    border: '2px dashed var(--border)',
                    borderRadius: 8,
                    padding: '20px',
                    textAlign: 'center',
                    background: uploading ? 'rgba(6, 191, 204, 0.15)' : 'rgba(6, 191, 204, 0.05)',
                    marginBottom: 16,
                    cursor: uploading ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease',
                    borderColor: uploading ? 'var(--accent)' : 'var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    if (!uploading) {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.background = 'rgba(6, 191, 204, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!uploading) {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'rgba(6, 191, 204, 0.05)';
                    }
                  }}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <div style={{ fontSize: 14, color: 'var(--accent)' }}>
                      ⏳ Загрузка изображения...
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 14, color: 'var(--subtext)', marginBottom: 8 }}>
                        📎 Нажмите для выбора файла или вставьте изображение (Ctrl+V)
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--subtext)' }}>
                        JPEG, PNG, GIF, WebP (до 10MB) — загрузка автоматическая
                      </div>
                    </>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </div>

              <div
                style={{
                  background: 'rgba(14, 16, 22, 0.3)',
                  border: '1px solid rgba(38, 42, 54, 0.3)',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 20,
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
                dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
              />

              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
                  Иллюстрации ({illustrations.length})
                </h3>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--subtext)' }}>
                    Загрузка...
                  </div>
                ) : illustrations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--subtext)' }}>
                    Нет иллюстраций. Добавьте первую!
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
                    {illustrations.map(ill => (
                      <div
                        key={ill.id}
                        style={{
                          background: 'rgba(14, 16, 22, 0.5)',
                          border: '1px solid rgba(38, 42, 54, 0.4)',
                          borderRadius: 8,
                          padding: 12,
                          position: 'relative',
                        }}
                      >
                        <img
                          src={ill.url}
                          alt={ill.caption || ill.originalName}
                          style={{
                            width: '100%',
                            height: 'auto',
                            borderRadius: 6,
                            marginBottom: 8,
                            maxHeight: 200,
                            objectFit: 'contain',
                          }}
                        />
                        <input
                          type="text"
                          value={ill.caption}
                          onChange={(e) => handleCaptionUpdate(ill.id, e.target.value)}
                          placeholder="Подпись к изображению"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            background: '#0e1016',
                            color: 'var(--text)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            fontSize: 12,
                            marginBottom: 8,
                          }}
                        />
                        <button
                          onClick={() => handleDelete(ill.id)}
                          style={{
                            width: '100%',
                            padding: '6px',
                            background: '#DC2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default IllustratorWorkspace;

