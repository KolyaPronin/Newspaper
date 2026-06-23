import React, { useMemo } from 'react';

interface PageNavigationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** When set, prev/next jump only through these page numbers (e.g. review subset). */
  availablePages?: number[];
}

const PageNavigation: React.FC<PageNavigationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  availablePages,
}) => {
  const pages = useMemo(() => {
    if (availablePages?.length) {
      return [...availablePages].sort((a, b) => a - b);
    }
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }, [availablePages, totalPages]);

  const currentIndex = pages.indexOf(currentPage);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onPageChange(pages[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < pages.length - 1) {
      onPageChange(pages[currentIndex + 1]);
    }
  };

  return (
    <>
      <div className="page-navigation">
        <button
          className="page-nav-arrow page-nav-arrow-left"
          onClick={handlePrevious}
          disabled={currentIndex <= 0}
          aria-label="Предыдущая страница"
        >
          ‹
        </button>
        <button
          className="page-nav-arrow page-nav-arrow-right"
          onClick={handleNext}
          disabled={currentIndex < 0 || currentIndex >= pages.length - 1}
          aria-label="Следующая страница"
        >
          ›
        </button>
      </div>
      <div className="page-navigation-info">
        Стр. {currentPage}/{totalPages}
        {currentPage === 1 && <span className="page-type-badge">Обложка</span>}
      </div>
    </>
  );
};

export default PageNavigation;

