import { useEffect, useState } from 'react';
import { illustrationAPI, Illustration } from '../../../utils/api';
import { Article } from '../../../types/Article';

export function useIllustrationsAssets(approvedArticles: Article[]) {
  const [articleIllustrations, setArticleIllustrations] = useState<Record<string, Illustration[]>>({});
  const [allIllustrations, setAllIllustrations] = useState<Illustration[]>([]);
  const [allAds, setAllAds] = useState<Illustration[]>([]);

  useEffect(() => {
    const loadIllustrations = async () => {
      const illustrationsMap: Record<string, Illustration[]> = {};
      const allIlls: Illustration[] = [];

      try {
        const globalIllustrations = await illustrationAPI.getAll({ kind: 'illustration', global: true });
        allIlls.push(...globalIllustrations);
      } catch (error) {
        // ignore
      }

      for (const article of approvedArticles) {
        try {
          const illustrations = await illustrationAPI.getByArticle(article.id);
          illustrationsMap[article.id] = illustrations;
          allIlls.push(...illustrations);
        } catch (error) {
          illustrationsMap[article.id] = [];
        }
      }

      try {
        const ads = await illustrationAPI.getAll({ kind: 'ad', global: true });
        setAllAds(ads);
      } catch (error) {
        setAllAds([]);
      }

      setArticleIllustrations(illustrationsMap);
      setAllIllustrations(allIlls);
    };

    loadIllustrations();
  }, [approvedArticles]);

  return {
    articleIllustrations,
    allIllustrations,
    allAds,
  };
}
