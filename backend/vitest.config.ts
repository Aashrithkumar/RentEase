import { defineConfig } from 'vitest/config';
export default defineConfig({test:{fileParallelism:false,testTimeout:30000,hookTimeout:120000,env:{NODE_ENV:'test',JWT_SECRET:'test-secret-for-isolated-workflow-verification',EMAIL_MODE:'development'}}});
