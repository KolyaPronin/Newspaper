import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { Article } from '../types/Article';
import { useAuth } from './AuthContexts';
import { articleAPI, transformArticle } from '../utils/api';

interface ArticleContextType {
  articles: Article[];
  currentArticle: Article | null;
  loading: boolean;
  error: string | null;
  setCurrentArticle: (article: Article | null) => void;
  saveDraft: (title: string, content: string, articleId?: string) => Promise<Article>;
  submitForReview: (articleId: string) => Promise<void>;
  loadArticle: (articleId: string) => Promise<Article | null>;
  getDraftsByAuthor: (authorId: string) => Article[];
  getArticlesByStatus: (status: Article['status']) => Article[];
  getArticlesByAuthor: (authorId: string) => Article[];
  updateArticleContent: (articleId: string, content: string) => Promise<Article>;
  approveArticle: (articleId: string) => Promise<void>;
  requestRevision: (articleId: string) => Promise<void>;
  refreshArticles: () => Promise<void>;
}

const ArticleContext = createContext<ArticleContextType | undefined>(undefined);

interface ArticleProviderProps {
  children: ReactNode;
}

export const ArticleProvider: React.FC<ArticleProviderProps> = ({ children }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const refreshArticles = useCallback(async () => {
    if (!user) {
      setArticles([]);
      setCurrentArticle(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const apiArticles = await articleAPI.getArticles();
      const transformedArticles = apiArticles.map(transformArticle);
      setArticles(transformedArticles);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load articles';
      setError(errorMessage);
      console.error('Failed to load articles:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
    refreshArticles();
    } else {
      setArticles([]);
      setCurrentArticle(null);
      setLoading(false);
      setError(null);
    }
  }, [user, refreshArticles]);

  const saveDraft = async (title: string, content: string, articleId?: string): Promise<Article> => {
    if (!user) {
      throw new Error('User must be logged in to save articles');
    }

    setLoading(true);
    setError(null);
    try {
      let apiArticle;
      if (articleId && articleId.trim() !== '') {
        apiArticle = await articleAPI.updateArticle(articleId, { title, content });
      } else {
        apiArticle = await articleAPI.createArticle({
          title,
          content,
          authorId: user.id,
        });
      }

      const article = transformArticle(apiArticle);
      
      setArticles(prev => {
        const existingIndex = prev.findIndex(a => a.id === article.id);
        if (existingIndex >= 0) {
          return prev.map(a => a.id === article.id ? article : a);
        }
        return [...prev, article];
      });

      setCurrentArticle(article);
      return article;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save article';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitForReview = async (articleId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const apiArticle = await articleAPI.submitForReview(articleId);
      const article = transformArticle(apiArticle);
      
      setArticles(prev => prev.map(a => a.id === articleId ? article : a));
      setCurrentArticle(article);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit article for review';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loadArticle = async (articleId: string): Promise<Article | null> => {
    const cachedArticle = articles.find(a => a.id === articleId);
    if (cachedArticle) {
      setCurrentArticle(cachedArticle);
      return cachedArticle;
    }

    setLoading(true);
    setError(null);
    try {
      const apiArticle = await articleAPI.getArticleById(articleId);
      const article = transformArticle(apiArticle);
      
      setArticles(prev => {
        const existingIndex = prev.findIndex(a => a.id === article.id);
        if (existingIndex >= 0) {
          return prev.map(a => a.id === article.id ? article : a);
        }
        return [...prev, article];
      });

      setCurrentArticle(article);
      return article;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load article';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getDraftsByAuthor = (authorId: string): Article[] => {
    return articles.filter(a => a.authorId === authorId && a.status === 'draft');
  };

  const getArticlesByStatus = (status: Article['status']): Article[] => {
    return articles.filter(a => a.status === status);
  };

  const getArticlesByAuthor = (authorId: string): Article[] => {
    return articles.filter(a => a.authorId === authorId);
  };

  const updateArticleContent = async (articleId: string, content: string): Promise<Article> => {
    setLoading(true);
    setError(null);
    try {
      const apiArticle = await articleAPI.updateArticle(articleId, { content });
      const article = transformArticle(apiArticle);
      
      setArticles(prev => prev.map(a => a.id === articleId ? article : a));
      setCurrentArticle(article);
      return article;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update article';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const approveArticle = async (articleId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const apiArticle = await articleAPI.approveArticle(articleId);
      const article = transformArticle(apiArticle);
      
      setArticles(prev => prev.map(a => a.id === articleId ? article : a));
      setCurrentArticle(article);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve article';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const requestRevision = async (articleId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const apiArticle = await articleAPI.requestRevision(articleId);
      const article = transformArticle(apiArticle);
      
      setArticles(prev => prev.map(a => a.id === articleId ? article : a));
      setCurrentArticle(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request revision';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <ArticleContext.Provider
      value={{
        articles,
        currentArticle,
        loading,
        error,
        setCurrentArticle,
        saveDraft,
        submitForReview,
        loadArticle,
        getDraftsByAuthor,
        getArticlesByStatus,
        getArticlesByAuthor,
        updateArticleContent,
        approveArticle,
        requestRevision,
        refreshArticles,
      }}
    >
      {children}
    </ArticleContext.Provider>
  );
};

export const useArticles = (): ArticleContextType => {
  const context = useContext(ArticleContext);
  if (context === undefined) {
    throw new Error('useArticles must be used within an ArticleProvider');
  }
  return context;
};

