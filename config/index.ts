interface DatabaseConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  connectTimeout: number;
  acquireTimeout: number;
  timeout: number;
}

interface SshConfig {
  host: string;
  username: string;
  password: string;
  commands: {
    restart: string;
  };
}

interface HttpHeaders {
  'Content-Type': string;
  'Accept-Encoding': string;
}

interface HttpConfig {
  headers: {
    login: HttpHeaders;
    search: HttpHeaders;
  };
}

interface ServerConfig {
  port: number;
}

export interface Config {
  server: ServerConfig;
  database: DatabaseConfig;
  ssh: SshConfig;
  http: HttpConfig;
}

const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10)
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.LIBRARY_USER || '',
    password: process.env.LIBRARY_PASSWORD || '',
    database: 'wxycmusic',
    connectTimeout: 10000,
    acquireTimeout: 10000,
    timeout: 10000
  },
  ssh: {
    host: process.env.SSH_HOST || '',
    username: process.env.SSH_USERNAME || '',
    password: process.env.SSH_PASSWORD || '',
    commands: {
      restart: './stopTomcat.sh; sleep 5; ./startTomcat.sh'
    }
  },
  http: {
    headers: {
      login: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept-Encoding': 'gzip, deflate'
      },
      search: {
        'Content-Type': '',
        'Accept-Encoding': 'gzip, deflate'
      }
    }
  }
};

export default config; 