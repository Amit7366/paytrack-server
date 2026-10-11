export const ok = <T>(message: string, data?: T) => ({
  success: true as const,
  message,
  data,
});
