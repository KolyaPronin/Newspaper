import React from 'react';

interface PageNavigationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const PageNavigation: React.FC<PageNavigationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <>
      <div className="page-navigation">
        <button
          className="page-nav-arrow page-nav-arrow-left"
          onClick={handlePrevious}
          disabled={currentPage === 1}
          aria-label="Предыдущая страница"
        >
          ‹
        </button>
        <button
          className="page-nav-arrow page-nav-arrow-right"
          onClick={handleNext}
          disabled={currentPage === totalPages}
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

