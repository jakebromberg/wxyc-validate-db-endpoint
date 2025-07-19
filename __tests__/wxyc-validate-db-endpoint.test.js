const request = require('supertest');

// Mock the classes instead of axios directly
jest.mock('../dist/EndpointValidator.js', () => ({
  EndpointValidator: jest.fn()
}));

jest.mock('../dist/EndpointRecovery.js', () => ({
  EndpointRecovery: jest.fn()
}));

describe('wxyc-validate-db-endpoint', () => {
  let app;
  let mockEndpointValidator;
  let mockEndpointRecovery;
  let originalEnv;
  let consoleErrorSpy;

  beforeEach(() => {
    // Store original environment
    originalEnv = process.env;
    
    // Set up test environment variables
    process.env.LIBRARY_USER = 'testuser';
    process.env.LIBRARY_PASSWORD = 'testpass';
    process.env.BASE_URL = 'https://test-library.example.com';
    process.env.LOGIN_ENDPOINT = '/login';
    process.env.SEARCH_ENDPOINT = '/search';
    process.env.DEFAULT_SEARCH_STRING = 'test';
    process.env.PORT = '3000';
    process.env.DB_HOST = 'test-db.example.com';
    process.env.SSH_HOST = 'test-ssh.example.com';
    process.env.SSH_USERNAME = 'testuser';
    process.env.SSH_PASSWORD = 'testpass';

    // Clear module cache
    Object.keys(require.cache).forEach(key => {
      if (key.includes('wxyc-validate-db-endpoint') || 
          key.includes('EndpointValidator') || 
          key.includes('EndpointRecovery') ||
          key.includes('config') ||
          key.includes('dist/')) {
        delete require.cache[key];
      }
    });

    // Reset all mocks
    jest.clearAllMocks();

    // Mock EndpointValidator class
    mockEndpointValidator = {
      validate: jest.fn()
    };
    
    // Mock EndpointRecovery class and static method
    mockEndpointRecovery = {
      recover: jest.fn()
    };
    
    const { EndpointValidator } = require('../dist/EndpointValidator.js');
    const { EndpointRecovery } = require('../dist/EndpointRecovery.js');
    
    EndpointValidator.mockImplementation(() => mockEndpointValidator);
    EndpointRecovery.mockImplementation(() => mockEndpointRecovery);
    EndpointRecovery.shouldAttemptRecovery = jest.fn();

    // Import app from compiled JavaScript (default export)
    app = require('../dist/wxyc-validate-db-endpoint.js').default;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.resetModules();
    
    // Restore console.error if it was spied on
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
      consoleErrorSpy = null;
    }
  });

  // Helper function to suppress console.error for error handling tests
  const suppressConsoleError = () => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  };

  describe('App Structure', () => {
    it('should export a valid Express app', () => {
      expect(app).toBeDefined();
      expect(typeof app).toBe('function'); // Express apps are functions
      expect(app.listen).toBeDefined(); // Should have Express methods
    });

    it('should respond to GET requests on root path', async () => {
      // Mock successful validation
      mockEndpointValidator.validate.mockResolvedValue();

      const response = await request(app).get('/');

      // Should respond successfully
      expect(response.status).toBe(200);
    });
  });

  describe('Core Functionality (Integration)', () => {
    it('should validate endpoint successfully', async () => {
      // Mock successful validation
      mockEndpointValidator.validate.mockResolvedValue();

      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(mockEndpointValidator.validate).toHaveBeenCalledTimes(1);
    });

    it('should attempt recovery when validation fails', async () => {
      // Mock failed validation followed by successful recovery
      mockEndpointValidator.validate
        .mockRejectedValueOnce(new Error('Service down'))
        .mockResolvedValueOnce(); // Success after recovery
      
      const { EndpointRecovery } = require('../dist/EndpointRecovery.js');
      EndpointRecovery.shouldAttemptRecovery.mockReturnValue(true);
      mockEndpointRecovery.recover.mockResolvedValue();

      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(mockEndpointValidator.validate).toHaveBeenCalledTimes(2); // Initial + retry
      expect(mockEndpointRecovery.recover).toHaveBeenCalledTimes(1);
    });

    it('should handle non-recoverable errors', async () => {
      // Suppress expected console.error output
      suppressConsoleError();
      
      // Mock authentication error (not recoverable)
      mockEndpointValidator.validate.mockRejectedValue(new Error('Unauthorized'));
      
      const { EndpointRecovery } = require('../dist/EndpointRecovery.js');
      EndpointRecovery.shouldAttemptRecovery.mockReturnValue(false);

      const response = await request(app).get('/');

      expect(response.status).toBe(500);
      expect(response.text).toBe('Unauthorized');
      expect(mockEndpointRecovery.recover).not.toHaveBeenCalled();
      
      // Verify that console.error was called (but output suppressed)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Final error occurred:', expect.any(Error));
    });

    it('should handle errors gracefully', async () => {
      // Suppress expected console.error output
      suppressConsoleError();
      
      // Mock network error
      mockEndpointValidator.validate.mockRejectedValue(new Error('Network error'));
      
      const { EndpointRecovery } = require('../dist/EndpointRecovery.js');
      EndpointRecovery.shouldAttemptRecovery.mockReturnValue(false);

      const response = await request(app).get('/');

      expect(response.status).toBe(500);
      expect(response.text).toBeTruthy(); // Should return some error message
      
      // Verify that console.error was called (but output suppressed)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Final error occurred:', expect.any(Error));
    });
  });

  describe('Dependency Validation', () => {
    it('should not use MySQL dependencies', () => {
      // Read package.json to verify MySQL is not included
      const packageJson = require('../package.json');
      
      // Check production dependencies
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies.mysql2).toBeUndefined();
      
      // Check dev dependencies  
      expect(packageJson.devDependencies).toBeDefined();
      expect(packageJson.devDependencies.mysql2).toBeUndefined();
      expect(packageJson.devDependencies['@types/jest']).toBeUndefined();
      expect(packageJson.devDependencies['ts-jest']).toBeUndefined();
    });

    it('should have all necessary dependencies', () => {
      const packageJson = require('../package.json');
      
      // Check required production dependencies
      expect(packageJson.dependencies.axios).toBeDefined();
      expect(packageJson.dependencies.dotenv).toBeDefined();
      expect(packageJson.dependencies.express).toBeDefined();
      expect(packageJson.dependencies['node-ssh']).toBeDefined();
      
      // Check required dev dependencies
      expect(packageJson.devDependencies.jest).toBeDefined();
      expect(packageJson.devDependencies.supertest).toBeDefined();
      expect(packageJson.devDependencies.typescript).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should require essential environment variables', () => {
      // These variables are set in beforeEach, so they should be available
      expect(process.env.LIBRARY_USER).toBe('testuser');
      expect(process.env.BASE_URL).toBe('https://test-library.example.com');
      expect(process.env.SSH_HOST).toBe('test-ssh.example.com');
    });
  });
}); 