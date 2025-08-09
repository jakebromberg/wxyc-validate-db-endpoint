import express, { Request, Response } from 'express';
import axios, { AxiosResponse } from 'axios';
import dotenv from 'dotenv';
import { NodeSSH } from 'node-ssh';

dotenv.config();

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

app.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Perform initial GET to trigger re-authentication
    const initialResponse: AxiosResponse = await axios.get('http://www.wxyc.info/wxycdb/login?mode=attemptReAuth');
    console.log('Initial re-auth GET succeeded:', initialResponse.status);
    
    // Extract the first cookie from the "set-cookie" header
    const setCookieHeader: string[] | undefined = initialResponse.headers['set-cookie'];
    if (!setCookieHeader || setCookieHeader.length === 0) {
      res.status(502).send('Bad Gateway: No cookie found');
      return;
    }
    // Assume the first cookie is in the form "key=value; ..."
    const initialCookie: string = setCookieHeader[0].split(';')[0];
    
    // 2. Log in using POST request with URL-encoded form data
    const loginHeaders: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept-Encoding': 'gzip, deflate',
      'Cookie': initialCookie,
    };
    const loginData: string = 'loginAction=userpw&user=${user}&password=${pass}&returnURL=';

    const loginResponse = await axios.post('http://www.wxyc.info/wxycdb/login', loginData, {
      headers: loginHeaders,
    });
    console.log('Login POST succeeded:', loginResponse.status);

    // 3. Perform a search request using the same cookie
    const searchHeaders: Record<string, string> = {
      'Accept-Encoding': 'gzip, deflate',
      'Cookie': initialCookie,
    };
    const searchResponse = await axios.get('http://www.wxyc.info/wxycdb/searchCardCatalog?searchString=hello', {
      headers: searchHeaders,
    });
    console.log('Search GET succeeded:', searchResponse.status);

    // Return OK status if everything succeeds
    res.sendStatus(200);
  } catch (error: any) {
    console.error('Error occurred:', error);
    if (error.response) {
      // Invoke the reset route when there's an HTTP error response
      try {
        console.log('HTTP error detected, invoking reset route...');
        const resetResponse = await axios.get(`http://localhost:${PORT}/reset`);
        console.log('Reset route invoked successfully:', resetResponse.status);
        
        // Return success after reset
        res.status(200).json({ 
          message: 'Error detected and reset performed successfully',
          originalError: {
            status: error.response.status,
            data: error.response.data
          },
          resetResult: resetResponse.data
        });
      } catch (resetError: any) {
        console.error('Failed to invoke reset route:', resetError);
        // If reset fails, return the original error
        res.status(error.response.status).send(error.response.data);
      }
    } else {
      res.status(500).send(error.message);
    }
  }
});

// SSH route to execute scripts on remote servers
app.get('/reset', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use environment variables for credentials if not provided in request
    const sshHost = process.env.SSH_HOST;
    const sshUsername = process.env.SSH_USERNAME;
    const sshPassword = process.env.SSH_PASSWORD;

    // Validate required environment variables
    if (!sshHost || !sshUsername || !sshPassword) {
      res.status(400).json({ 
        error: 'Missing required environment variables', 
        message: 'SSH_HOST, SSH_USERNAME, and SSH_PASSWORD must be set' 
      });
      return;
    }

    const ssh = new NodeSSH();

    // Configure connection options
    const connectionConfig: any = {
      host: sshHost,
      username: sshUsername,
      password: sshPassword,
      port: parseInt(process.env.SSH_PORT || '22', 10),
      readyTimeout: parseInt(process.env.SSH_TIMEOUT || '20000', 10)
    };

    console.log(`Attempting SSH connection to ${sshHost} as ${sshUsername}...`);

    // Connect to the server with explicit error handling
    await ssh.connect(connectionConfig);
    
    console.log('SSH connection established successfully');

    // Execute the script with explicit Java environment setup for ksh
    const command = "export JAVA_HOME=/usr/lib/java; export PATH=/usr/local/jdk/bin:$PATH; ./stopTomcat.sh && sleep 5 && ./startTomcat.sh";
    console.log(`Executing command: ${command}`);
    
    const result = await ssh.execCommand(command);
    
    console.log(`Command completed with exit code: ${result.code}`);
    console.log(`Stdout: ${result.stdout}`);
    if (result.stderr) {
      console.log(`Stderr: ${result.stderr}`);
    }

    // Close the connection
    ssh.dispose();
    console.log('SSH connection closed');

    // Determine success based on exit code
    const success = result.code === 0;

    // Return the result with appropriate HTTP status
    const response = {
      success,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.code
    };

    if (success) {
      res.json(response);
    } else {
      res.status(400).json(response);
    }

  } catch (error: any) {
    console.error('SSH execution error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'SSH execution failed', 
      message: error.message,
      details: error.code || 'Unknown error code'
    });
  }
});

const PORT: number = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 