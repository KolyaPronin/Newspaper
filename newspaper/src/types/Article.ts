export interface Article {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'under_review' | 'needs_revision' | 'approved' | 'published';
  authorId: string;
  issueId?: string;
  createdAt: Date;
  updatedAt: Date;
}

