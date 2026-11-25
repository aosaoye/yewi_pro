export interface ReviewReplyTarget {
  reviewId: string;
  authorName: string;
  authorAvatar?: string | null;
  comment: string;
  createdAt?: string;
  onReplied?: () => void;
}

let activeReplyTarget: ReviewReplyTarget | null = null;

export function setReviewReplyTarget(target: ReviewReplyTarget) {
  activeReplyTarget = target;
}

export function getReviewReplyTarget(reviewId?: string): ReviewReplyTarget | null {
  if (!activeReplyTarget) return null;
  if (reviewId && activeReplyTarget.reviewId !== reviewId) return null;
  return activeReplyTarget;
}
