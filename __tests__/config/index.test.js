const config = require('../../config');

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('server configuration', () => {
    it('should use PORT environment variable when provided', () => {
      process.env.PORT = '8080';
      const config = require('../../config');
      
      expect(config.server.port).toBe('8080');
    });

    it('should default to port 3000 when PORT not provided', () => {
      delete process.env.PORT;
      const config = require('../../config');
      
      expect(config.server.port).toBe(3000);
    });
  });

  describe('database configuration', () => {
    it('should use DB_HOST environment variable when provided', () => {
      process.env.DB_HOST = 'test-db-host.example.com';
      const config = require('../../config');
      
      expect(config.database.host).toBe('test-db-host.example.com');
    });

    it('should use LIBRARY_USER environment variable when provided', () => {
      process.env.LIBRARY_USER = 'testuser';
      const config = require('../../config');
      
      expect(config.database.user).toBe('testuser');
    });

    it('should have correct database name', () => {
      expect(config.database.database).toBe('wxycmusic');
    });

    it('should use LIBRARY_PASSWORD environment variable when provided', () => {
      process.env.LIBRARY_PASSWORD = 'testpass';
      const config = require('../../config');
      
      expect(config.database.password).toBe('testpass');
    });

    it('should use undefined for password when LIBRARY_PASSWORD not provided', () => {
      delete process.env.LIBRARY_PASSWORD;
      const config = require('../../config');
      
      expect(config.database.password).toBeUndefined();
    });

    it('should have correct timeout configurations', () => {
      expect(config.database.connectTimeout).toBe(10000);
      expect(config.database.acquireTimeout).toBe(10000);
      expect(config.database.timeout).toBe(10000);
    });
  });

  describe('SSH configuration', () => {
    it('should use SSH_HOST and SSH_USERNAME environment variables when provided', () => {
      process.env.SSH_HOST = 'test-ssh-host.example.com';
      process.env.SSH_USERNAME = 'testuser';
      const config = require('../../config');
      
      expect(config.ssh.host).toBe('test-ssh-host.example.com');
      expect(config.ssh.username).toBe('testuser');
    });

    it('should use SSH_PASSWORD environment variable', () => {
      process.env.SSH_PASSWORD = 'secretpass';
      const config = require('../../config');
      
      expect(config.ssh.password).toBe('secretpass');
    });

    it('should have restart command', () => {
      expect(config.ssh.commands.restart).toBe('./stopTomcat.sh; sleep 5; ./startTomcat.sh');
    });
  });
}); 