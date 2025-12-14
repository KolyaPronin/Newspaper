// Thin barrel file: re-exports concrete API modules from src/api/*

export { setAuthToken } from '../api/client';

export type { ArticleFromAPI } from '../api/articles';
export { articleAPI, transformArticle } from '../api/articles';

export type { AuthSuccessResponse } from '../api/auth';
export { authAPI } from '../api/auth';

export type { TemplateFromAPI, LayoutFromAPI } from '../api/layouts';
export { templateAPI, layoutAPI } from '../api/layouts';

export { userAPI } from '../api/users';

export type { Illustration, IllustrationFromAPI } from '../api/illustrations';
export { illustrationAPI, transformIllustration } from '../api/illustrations';


