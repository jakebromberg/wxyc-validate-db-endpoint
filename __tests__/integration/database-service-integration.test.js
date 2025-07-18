const request = require('supertest');

// Mock mysql2/promise and ssh2 for this test
jest.mock('mysql2/promise');
jest.mock('ssh2');

const mysql = require('mysql2/promise');
const { Client } = require('ssh2');

describe('Database Service Integration', () => {
  let app;
  let server;
  let mockConnection;
  let mockSshClient;
  let mockStream;
  let originalExit;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock process.exit to prevent tests from actually exiting
    originalExit = process.exit;
    process.exit = jest.fn();
    
    // Mock MySQL connection
    mockConnection = {
      execute: jest.fn(),
      end: jest.fn()
    };

    // Mock SSH stream
    mockStream = {
      end: jest.fn(),
      on: jest.fn().mockReturnThis(),
      stderr: { on: jest.fn().mockReturnThis() }
    };

    // Mock SSH client for both DatabaseService and Tomcat restart
    mockSshClient = {
      on: jest.fn().mockReturnThis(),
      connect: jest.fn().mockReturnThis(),
      forwardOut: jest.fn(),
      exec: jest.fn(), // Add exec method for Tomcat restart
      end: jest.fn()
    };

    // Mock SSH Client constructor - will be used for both DatabaseService and restart
    Client.mockImplementation(() => mockSshClient);

    mysql.createConnection = jest.fn().mockResolvedValue(mockConnection);
    
    // Set required environment variables BEFORE requiring the module
    process.env.SSH_PASSWORD = 'test-password';
    process.env.LIBRARY_PASSWORD = 'test-db-password';
    process.env.PORT = '3333'; // Use a specific port instead of 0
    
    // Clear module cache
    delete require.cache[require.resolve('../../wxyc-validate-db-endpoint')];
    delete require.cache[require.resolve('../../config')];
    delete require.cache[require.resolve('../../config/validation')];
    delete require.cache[require.resolve('../../services/DatabaseService')];
    
    // Fresh require to get the app with the test environment
    app = require('../../wxyc-validate-db-endpoint');
  });

  afterEach(() => {
    // Restore original process.exit
    process.exit = originalExit;
    
    delete process.env.SSH_PASSWORD;
    delete process.env.LIBRARY_PASSWORD;
    delete process.env.PORT;
    
    // Clean up any server instances
    if (server && server.listening) {
      server.close();
    }
  });

  describe('GET /', () => {
    it('should return 200 when database connection validation succeeds', async () => {
      // Setup SSH connection success for DatabaseService
      mockSshClient.on.mockImplementation((event, callback) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockSshClient;
      });

      // Setup forwardOut success for DatabaseService
      mockSshClient.forwardOut.mockImplementation((srcAddr, srcPort, dstAddr, dstPort, callback) => {
        setTimeout(() => callback(null, mockStream), 0);
      });

      // Mock successful database connection
      mockConnection.execute.mockResolvedValue([]);
      mockConnection.end.mockResolvedValue();

      const response = await request(app)
        .get('/')
        .timeout(10000);

      expect(response.status).toBe(200);
      expect(mysql.createConnection).toHaveBeenCalledWith({
        stream: mockStream,
        user: 'testuser',
        password: 'test-db-password',
        database: 'wxycmusic',
        connectTimeout: 10000,
        acquireTimeout: 10000,
        timeout: 10000
      });
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT 1 as test');
    });

    it('should handle database connection errors appropriately', async () => {
      // Mock SSH connection failure for DatabaseService
      mockSshClient.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection refused')), 0);
        }
        return mockSshClient;
      });

      const response = await request(app)
        .get('/')
        .timeout(10000);

      // Should get either 503 (if SSH restart works) or 500 (if SSH fails)
      expect([500, 503]).toContain(response.status);
    });

    it('should handle query execution errors appropriately', async () => {
      // Setup SSH connection success for DatabaseService
      let onReadyCallback;
      mockSshClient.on.mockImplementation((event, callback) => {
        if (event === 'ready') {
          onReadyCallback = callback;
          setTimeout(() => callback(), 0);
        }
        return mockSshClient;
      });

      mockSshClient.forwardOut.mockImplementation((srcAddr, srcPort, dstAddr, dstPort, callback) => {
        setTimeout(() => callback(null, mockStream), 0);
      });

      // Mock successful connection but failed query
      mockConnection.execute.mockRejectedValue(new Error('Query timeout'));

      // Setup SSH for Tomcat restart (will be called after DB failure)
      mockSshClient.exec.mockImplementation((command, callback) => {
        mockStream.on.mockImplementation((event, streamCallback) => {
          if (event === 'close') {
            setTimeout(() => streamCallback(0), 0); // Success
          }
          return mockStream;
        });
        setTimeout(() => callback(null, mockStream), 0);
      });

      const response = await request(app)
        .get('/')
        .timeout(10000);

      // Should get 503 because SSH restart succeeds
      expect(response.status).toBe(503);
      expect(mockConnection.end).toHaveBeenCalled();
    });

    it('should handle MySQL authentication errors', async () => {
      // Setup SSH connection success for DatabaseService
      mockSshClient.on.mockImplementation((event, callback) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockSshClient;
      });

      mockSshClient.forwardOut.mockImplementation((srcAddr, srcPort, dstAddr, dstPort, callback) => {
        setTimeout(() => callback(null, mockStream), 0);
      });

      // Mock authentication error
      mysql.createConnection.mockRejectedValue(new Error('Access denied for user'));

      // Setup SSH for Tomcat restart
      mockSshClient.exec.mockImplementation((command, callback) => {
        mockStream.on.mockImplementation((event, streamCallback) => {
          if (event === 'close') {
            setTimeout(() => streamCallback(0), 0);
          }
          return mockStream;
        });
        setTimeout(() => callback(null, mockStream), 0);
      });

      const response = await request(app)
        .get('/')
        .timeout(10000);

      expect(response.status).toBe(503); // Should restart successfully
    });

    it('should handle connection timeout errors', async () => {
      // Setup SSH connection success for DatabaseService
      mockSshClient.on.mockImplementation((event, callback) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockSshClient;
      });

      mockSshClient.forwardOut.mockImplementation((srcAddr, srcPort, dstAddr, dstPort, callback) => {
        setTimeout(() => callback(null, mockStream), 0);
      });

      // Mock timeout error
      mysql.createConnection.mockRejectedValue(new Error('Connection timeout'));

      // Setup SSH for Tomcat restart
      mockSshClient.exec.mockImplementation((command, callback) => {
        mockStream.on.mockImplementation((event, streamCallback) => {
          if (event === 'close') {
            setTimeout(() => streamCallback(0), 0);
          }
          return mockStream;
        });
        setTimeout(() => callback(null, mockStream), 0);
      });

      const response = await request(app)
        .get('/')
        .timeout(10000);

      expect(response.status).toBe(503); // Should restart successfully
    });
  });
}); 