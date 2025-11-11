import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Article } from '../types/Article';
import { useAuth } from './AuthContexts';

interface ArticleContextType {
  articles: Article[];
  currentArticle: Article | null;
  setCurrentArticle: (article: Article | null) => void;
  saveDraft: (title: string, content: string, articleId?: string) => Article;
  submitForReview: (articleId: string) => void;
  loadArticle: (articleId: string) => Article | null;
  getDraftsByAuthor: (authorId: string) => Article[];
  getArticlesByStatus: (status: Article['status']) => Article[];
  getArticlesByAuthor: (authorId: string) => Article[];
  updateArticleContent: (articleId: string, content: string) => Article;
  approveArticle: (articleId: string) => void;
  requestRevision: (articleId: string) => void;
}

const ArticleContext = createContext<ArticleContextType | undefined>(undefined);

interface ArticleProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'newspaper_articles';

export const ArticleProvider: React.FC<ArticleProviderProps> = ({ children }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const { user } = useAuth();

  // Загружаем статьи из localStorage при монтировании
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log('Loading articles from localStorage:', parsed.length, 'articles');
        // Преобразуем строки дат обратно в Date объекты
        const articlesWithDates = parsed.map((a: any) => ({
          ...a,
          createdAt: new Date(a.createdAt),
          updatedAt: new Date(a.updatedAt),
        }));
        console.log('Loaded articles:', articlesWithDates.map((a: Article) => ({ id: a.id, title: a.title, authorId: a.authorId, status: a.status })));
        setArticles(articlesWithDates);
      } catch (e) {
        console.error('Failed to load articles from storage', e);
      }
    } else {
      console.log('No articles found in localStorage');
    }
  }, []);

  // Сохраняем статьи в localStorage при изменении
  useEffect(() => {
    if (articles.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
      console.log('Articles saved to localStorage:', articles.length, 'articles');
    }
  }, [articles]);

  const saveDraft = (title: string, content: string, articleId?: string): Article => {
    if (!user) {
      throw new Error('User must be logged in to save articles');
    }

    const now = new Date();
    let article: Article;

    if (articleId) {
      // Обновляем существующую статью
      const existing = articles.find(a => a.id === articleId);
      article = {
        ...existing,
        id: articleId,
        title,
        content,
        status: 'draft',
        authorId: existing?.authorId ?? user.id,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      } as Article;
      setArticles(prev => prev.map(a => a.id === articleId ? article : a));
    } else {
      // Создаем новую статью
      article = {
        id: `article_${Date.now()}`,
        title,
        content,
        status: 'draft',
        authorId: user.id,
        createdAt: now,
        updatedAt: now,
      };
      setArticles(prev => [...prev, article]);
    }

    setCurrentArticle(article);
    return article;
  };

  const submitForReview = (articleId: string) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) {
      throw new Error('Article not found');
    }

    if (article.status !== 'draft') {
      throw new Error('Only draft articles can be submitted for review');
    }

    const updated: Article = {
      ...article,
      status: 'under_review',
      updatedAt: new Date(),
    };

    setArticles(prev => prev.map(a => a.id === articleId ? updated : a));
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

  const updateArticleContent = (articleId: string, content: string): Article => {
    const article = articles.find(a => a.id === articleId);
    if (!article) {
      throw new Error('Article not found');
    }

    const updated: Article = {
      ...article,
      content,
      updatedAt: new Date(),
    };

    setArticles(prev => prev.map(a => a.id === articleId ? updated : a));
    setCurrentArticle(updated);
    return updated;
  };

  const approveArticle = (articleId: string) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) {
      throw new Error('Article not found');
    }

    const updated: Article = {
      ...article,
      status: 'approved',
      updatedAt: new Date(),
    };

    setArticles(prev => prev.map(a => a.id === articleId ? updated : a));
    setCurrentArticle(updated);
  };

  const requestRevision = (articleId: string): Article => {
    const article = articles.find(a => a.id === articleId);
    if (!article) {
      throw new Error('Article not found');
    }

    const updated: Article = {
      ...article,
      status: 'needs_revision',
      updatedAt: new Date(),
    };

    console.log('Requesting revision for article:', articleId, 'Author:', updated.authorId, 'Status:', updated.status);
    
    setArticles(prev => {
      const newArticles = prev.map(a => a.id === articleId ? updated : a);
      console.log('Updated articles array:', newArticles.length, 'articles');
      console.log('Articles with needs_revision:', newArticles.filter(a => a.status === 'needs_revision').map(a => ({ id: a.id, authorId: a.authorId, status: a.status })));
      return newArticles;
    });
    
    // Очищаем текущую статью у профридера после возврата
    setCurrentArticle(null);
    return updated;
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

