import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { Article } from '../types/Article';
import { useAuth } from './AuthContexts';
import { articleApi } from '../utils/api';

interface ArticleContextType {
  articles: Article[];
  currentArticle: Article | null;
  setCurrentArticle: (article: Article | null) => void;
  saveDraft: (title: string, content: string, articleId?: string) => Promise<Article>;
  submitForReview: (articleId: string) => Promise<void>;
  loadArticle: (articleId: string) => Article | null;
  getDraftsByAuthor: (authorId: string) => Article[];
  getArticlesByStatus: (status: Article['status']) => Article[];
  getArticlesByAuthor: (authorId: string) => Article[];
  updateArticleContent: (articleId: string, content: string) => Promise<Article>;
  approveArticle: (articleId: string) => Promise<void>;
  requestRevision: (articleId: string) => Promise<void>;
}

const ArticleContext = createContext<ArticleContextType | undefined>(undefined);

interface ArticleProviderProps {
  children: ReactNode;
}

export const ArticleProvider: React.FC<ArticleProviderProps> = ({ children }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const { user, token } = useAuth();

  useEffect(() => {
    const fetchArticles = async () => {
      if (!token) {
        setArticles([]);
        return;
      }
      try {
        const remoteArticles = await articleApi.list(token);
        setArticles(remoteArticles);
      } catch (error) {
        console.error('Failed to load articles from API', error);
      }
    };

    fetchArticles();
  }, [token]);

  const upsertArticle = useCallback((updatedArticle: Article) => {
    setArticles(prev => {
      const exists = prev.some(article => article.id === updatedArticle.id);
      if (exists) {
        return prev.map(article => (article.id === updatedArticle.id ? updatedArticle : article));
      }
      return [...prev, updatedArticle];
    });
  }, []);

  const saveDraft = async (title: string, content: string, articleId?: string): Promise<Article> => {
    if (!user || !token) {
      throw new Error('User must be logged in to save articles');
    }

    const payload = { title, content };
    let article: Article;

    if (articleId) {
      article = await articleApi.update(token, articleId, payload);
    } else {
      article = await articleApi.create(token, payload);
    }

    upsertArticle(article);
    setCurrentArticle(article);
    return article;
  };

  const submitForReview = async (articleId: string): Promise<void> => {
    if (!token) {
      throw new Error('User must be logged in to submit articles');
    }

    const updated = await articleApi.submit(token, articleId);
    upsertArticle(updated);
    setCurrentArticle(updated);
  };

  const loadArticle = (articleId: string): Article | null => {
    const article = articles.find(a => a.id === articleId);
    if (article) {
      setCurrentArticle(article);
      return article;
    }
    return null;
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
    if (!token) {
      throw new Error('User must be logged in to update articles');
    }

    const baseArticle = articles.find(article => article.id === articleId) || currentArticle;
    const updated = await articleApi.update(token, articleId, { title: baseArticle?.title || 'Без названия', content });
    upsertArticle(updated);
    setCurrentArticle(updated);
    return updated;
  };

  const approveArticle = async (articleId: string): Promise<void> => {
    if (!token) {
      throw new Error('User must be logged in to approve articles');
    }
    const updated = await articleApi.approve(token, articleId);
    upsertArticle(updated);
    setCurrentArticle(updated);
  };

  const requestRevision = async (articleId: string): Promise<void> => {
    if (!token) {
      throw new Error('User must be logged in to request revisions');
    }

    const updated = await articleApi.requestRevision(token, articleId);
    upsertArticle(updated);
    setCurrentArticle(null);
  };

  return (
    <ArticleContext.Provider
      value={{
        articles,
        currentArticle,
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

