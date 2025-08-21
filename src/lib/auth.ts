// Server-only authentication configuration
import { StackServerApp } from '@stackframe/stack';

export const stackServerApp = new StackServerApp({
  tokenStore: 'nextjs-cookie', // storing auth tokens in cookies
});
