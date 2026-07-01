/*
 * common.tsx
 *
 * Copyright (C) 2019-20 by RStudio, PBC
 */

export function getThreadElement(threadId: any) {
  return document.getElementById(createThreadIdAttr(threadId));
}

export function createThreadIdAttr(commentId: string) {
  return `comment-thread-view-${commentId}`;
}

export function createCommentIdAttr(commentId: string) {
  return `comment-item-view-${commentId}`;
}

export function focusComment(threadId: string, commentId: string) {
  const selector = [
    `[id='${createThreadIdAttr(threadId)}'].pm-user-comment-view`,
    `[id='${createCommentIdAttr(commentId)}'].pm-user-comment-item`,
    '.pm-user-comment-content'
  ];

  const el = document.querySelector(selector.join(' ')) as HTMLElement;
  if (el) {
    el.focus();
  }
}
