export const ATTACHMENT_MAX_SIZE_BYTES = (Number(process.env.NEXT_PUBLIC_ATTACHMENT_MAX_SIZE_MB) || 10) * 1024 * 1024;
export const ATTACHMENT_MAX_SIZE_MB = ATTACHMENT_MAX_SIZE_BYTES / (1024 * 1024);
export const ALLOWED_ATTACHMENT_TYPES = ['text/plain', 'text/markdown', 'application/json', 'text/csv', 'image/png', 'image/jpeg', 'image/webp', 'text/typescript', 'text/javascript', 'text/x-python', 'text/css', 'text/html'];
