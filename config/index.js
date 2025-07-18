const config = {
  server: {
    port: process.env.PORT || 3000
  },
  database: {
    host: process.env.DB_HOST,
    user: process.env.LIBRARY_USER,
    password: process.env.LIBRARY_PASSWORD,
    database: 'wxycmusic',
    connectTimeout: 10000,
    acquireTimeout: 10000,
    timeout: 10000
  },
  ssh: {
    host: process.env.SSH_HOST,
    username: process.env.SSH_USERNAME,
    password: process.env.SSH_PASSWORD,
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
        'Accept-Encoding': 'gzip, deflate'
      }
    }
  }
};

module.exports = config; 