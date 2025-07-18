const request = require('supertest');

describe('wxyc-validate-db-endpoint', () => {
  let app;
  let mockDatabaseService;
  let mockSshClient;
  let mockStream;
  let mockConfig;
  let mockValidateConfig;
  let mockDatabaseServiceClass;
  let mockMysqlConnection;
  let mockMysql;

  beforeEach(() => {
    // Clear all require cache
    Object.keys(require.cache).forEach(key => {
      if (key.includes('wxyc-validate-db-endpoint')) {
        delete require.cache[key];
      }
    });

    // Mock config
    mockConfig = {
      server: { port: 3000 },
      database: {
        host: 'test-db-host.example.com',
        user: 'testuser',
        password: 'test-password',
        database: 'wxycmusic',
        connectTimeout: 10000,
        acquireTimeout: 10000,
        timeout: 10000
      },
      ssh: {
        host: 'test-host',
        username: 'test-user',
        password: 'test-pass',
        commands: { restart: 'test-restart-command' }
      }
    };

    // Mock successful config validation
    mockValidateConfig = jest.fn(() => ({
      isValid: true,
      errors: []
    }));

    // Mock MySQL connection
    mockMysqlConnection = {
      execute: jest.fn(),
      end: jest.fn()
    };

    mockMysql = {
      createConnection: jest.fn().mockResolvedValue(mockMysqlConnection)
    };

    // Mock DatabaseService
    mockDatabaseService = {
      validateConnection: jest.fn().mockResolvedValue()
    };

    mockDatabaseServiceClass = jest.fn(() => mockDatabaseService);

    // Mock SSH client and stream
    mockStream = {
      on: jest.fn().mockReturnThis(),
      stderr: { on: jest.fn().mockReturnThis() }
    };

    mockSshClient = {
      on: jest.fn().mockReturnThis(),
      connect: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      end: jest.fn()
    };

    // Set up module mocks
    jest.doMock('mysql2/promise', () => mockMysql);
    jest.doMock('ssh2', () => ({
      Client: jest.fn(() => mockSshClient)
    }));
    jest.doMock('../config', () => mockConfig);
    jest.doMock('../config/validation', () => ({
      validateConfig: mockValidateConfig
    }));
    jest.doMock('../services/DatabaseService', () => ({
      DatabaseService: mockDatabaseServiceClass
    }));

    // Require the app after mocks are set up
    app = require('../wxyc-validate-db-endpoint');
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('Application Initialization', () => {
    it('should validate configuration on startup', () => {
      expect(mockValidateConfig).toHaveBeenCalledWith(mockConfig);
    });

    it('should create DatabaseService instance with correct parameters', () => {
      expect(mockDatabaseServiceClass).toHaveBeenCalledWith(null, mockConfig);
    });
  });

  describe('GET / - Health Check Endpoint', () => {
    it('should return 200 when database validation succeeds', async () => {
      mockDatabaseService.validateConnection.mockResolvedValue();

      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(mockDatabaseService.validateConnection).toHaveBeenCalledTimes(1);
    });

    it('should attempt SSH restart when database validation fails', async () => {
      mockDatabaseService.validateConnection.mockRejectedValue(new Error('Database error'));

      // Mock successful SSH restart
      mockSshClient.on.mockImplementation((event, callback) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockSshClient;
      });

      mockSshClient.exec.mockImplementation((command, callback) => {
        callback(null, mockStream);
      });

      mockStream.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 0); // Exit code 0 = success
        }
        return mockStream;
      });

      const response = await request(app).get('/');

      expect(response.status).toBe(503);
      expect(response.text).toBe('Service temporarily unavailable - Tomcat has been restarted');
      expect(mockSshClient.exec).toHaveBeenCalledWith('test-restart-command', expect.any(Function));
    });

    it('should return 500 when both database validation and SSH restart fail', async () => {
      mockDatabaseService.validateConnection.mockRejectedValue(new Error('Database error'));

      // Mock SSH connection failure
      mockSshClient.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('SSH connection failed')), 0);
        }
        return mockSshClient;
      });

      const response = await request(app).get('/');

      expect(response.status).toBe(500);
      expect(response.text).toBe('Database error');
    });

    it('should handle MySQL connection errors properly', async () => {
      const mysqlError = new Error('MySQL connection failed');
      mockDatabaseService.validateConnection.mockRejectedValue(mysqlError);

      // Mock SSH restart failure
      mockSshClient.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('SSH failed')), 0);
        }
        return mockSshClient;
      });

      const response = await request(app).get('/');

      expect(response.status).toBe(500);
      expect(response.text).toBe('MySQL connection failed');
    });

    it('should handle MySQL query timeout errors', async () => {
      const timeoutError = new Error('Query timeout');
      mockDatabaseService.validateConnection.mockRejectedValue(timeoutError);

      // Mock SSH restart failure
      mockSshClient.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('SSH failed')), 0);
        }
        return mockSshClient;
      });

      const response = await request(app).get('/');

      expect(response.status).toBe(500);
      expect(response.text).toBe('Query timeout');
    });
  });

  describe('SSH Restart Functionality', () => {
    it('should establish SSH connection with correct parameters', async () => {
      mockDatabaseService.validateConnection.mockRejectedValue(new Error('Database error'));

      mockSshClient.on.mockImplementation((event, callback) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockSshClient;
      });

      mockSshClient.exec.mockImplementation((command, callback) => {
        callback(null, mockStream);
      });

      mockStream.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 0);
        }
        return mockStream;
      });

      await request(app).get('/');

      expect(mockSshClient.connect).toHaveBeenCalledWith({
        host: 'test-host',
        username: 'test-user',
        password: 'test-pass'
      });
    });

    it('should handle SSH command execution failure', async () => {
      mockDatabaseService.validateConnection.mockRejectedValue(new Error('Database error'));

      mockSshClient.on.mockImplementation((event, callback) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockSshClient;
      });

      mockSshClient.exec.mockImplementation((command, callback) => {
        callback(new Error('Command execution failed'), null);
      });

      const response = await request(app).get('/');

      expect(response.status).toBe(500);
      expect(mockSshClient.end).toHaveBeenCalled();
    });

    it('should handle SSH command with non-zero exit code', async () => {
      mockDatabaseService.validateConnection.mockRejectedValue(new Error('Database error'));

      mockSshClient.on.mockImplementation((event, callback) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockSshClient;
      });

      mockSshClient.exec.mockImplementation((command, callback) => {
        callback(null, mockStream);
      });

      mockStream.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 0); // Exit code 1 = failure
        }
        return mockStream;
      });

      const response = await request(app).get('/');

      expect(response.status).toBe(500);
    });
  });

  describe('Configuration Validation Failure', () => {
    it('should exit with error if configuration is invalid', () => {
      // Mock invalid config validation
      const mockValidateConfigInvalid = jest.fn(() => ({
        isValid: false,
        errors: ['Database host is required', 'LIBRARY_PASSWORD environment variable is required']
      }));

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Clear mocks and set up invalid config
      jest.resetModules();
      jest.doMock('mysql2/promise', () => mockMysql);
      jest.doMock('ssh2', () => ({
        Client: jest.fn(() => mockSshClient)
      }));
      jest.doMock('../config', () => mockConfig);
      jest.doMock('../config/validation', () => ({
        validateConfig: mockValidateConfigInvalid
      }));
      jest.doMock('../services/DatabaseService', () => ({
        DatabaseService: mockDatabaseServiceClass
      }));

      // Require the app with invalid config
      require('../wxyc-validate-db-endpoint');

      expect(mockConsoleError).toHaveBeenCalledWith('Configuration validation failed:');
      expect(mockConsoleError).toHaveBeenCalledWith('  - Database host is required');
      expect(mockConsoleError).toHaveBeenCalledWith('  - LIBRARY_PASSWORD environment variable is required');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should log all errors that occur', async () => {
      const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      const testError = new Error('MySQL connection failed');
      mockDatabaseService.validateConnection.mockRejectedValue(testError);

      // Mock SSH failure
      mockSshClient.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('SSH error')), 0);
        }
        return mockSshClient;
      });

      await request(app).get('/');

      expect(mockConsoleError).toHaveBeenCalledWith('Error occurred:', testError);
      expect(mockConsoleError).toHaveBeenCalledWith('Failed to restart Tomcat via SSH:', expect.any(Error));

      mockConsoleError.mockRestore();
    });
  });
}); 