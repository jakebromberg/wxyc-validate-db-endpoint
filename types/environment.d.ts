declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Library credentials
      LIBRARY_USER: string;
      LIBRARY_PASSWORD: string;
      
      // Base URLs
      BASE_URL: string;
      LOGIN_ENDPOINT: string;
      SEARCH_ENDPOINT: string;
      
      // Default search parameters
      DEFAULT_SEARCH_STRING: string;
      
      // Server configuration
      PORT: string;
      
      // Database configuration
      DB_HOST: string;
      
      // SSH configuration
      SSH_HOST: string;
      SSH_USERNAME: string;
      SSH_PASSWORD: string;
    }
  }
}

export {}; 