import express, { Request, Response } from 'express';
import axios, { AxiosResponse } from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'LIBRARY_USER',
  'LIBRARY_PASSWORD', 
  'BASE_URL',
  'LOGIN_ENDPOINT',
  'SEARCH_ENDPOINT',
  'DEFAULT_SEARCH_STRING',
  'PORT',
  'DB_HOST',
  'SSH_HOST',
  'SSH_USERNAME',
  'SSH_PASSWORD'
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Type definitions for API responses
interface LoginResponse {
  headers: {
    'set-cookie'?: string[];
  };
}

interface ApiHeaders {
  'Content-Type'?: string;
  'Accept-Encoding': string;
  'Cookie': string;
}

const app = express();

app.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Perform initial GET to trigger re-authentication
    const initialResponse: AxiosResponse<any, any> = await axios.get(
      `${process.env.BASE_URL!}${process.env.LOGIN_ENDPOINT!}?mode=attemptReAuth`
    );
    
    // Extract the first cookie from the "set-cookie" header
    const setCookieHeader: string[] | undefined = initialResponse.headers['set-cookie'];
    if (!setCookieHeader || setCookieHeader.length === 0) {
      res.status(502).send('Bad Gateway: No cookie found');
      return;
    }
    
    // Assume the first cookie is in the form "key=value; ..."
    const initialCookie: string = setCookieHeader[0]!.split(';')[0]!
    
    // 2. Log in using POST request with URL-encoded form data
    const loginHeaders: ApiHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept-Encoding': 'gzip, deflate',
      'Cookie': initialCookie,
    };
    
    const loginData: string = `loginAction=userpw&user=${process.env.LIBRARY_USER!}&password=${process.env.LIBRARY_PASSWORD!}&returnURL=`;

    await axios.post(
      `${process.env.BASE_URL!}${process.env.LOGIN_ENDPOINT!}`, 
      loginData, 
      { headers: loginHeaders as any }
    );

    // 3. Perform a search request using the same cookie
    const searchHeaders: Omit<ApiHeaders, 'Content-Type'> = {
      'Accept-Encoding': 'gzip, deflate',
      'Cookie': initialCookie,
    };
    
    await axios.get(
      `${process.env.BASE_URL!}${process.env.SEARCH_ENDPOINT!}?searchString=${process.env.DEFAULT_SEARCH_STRING!}`, 
      { headers: searchHeaders as any }
    );

    // Return OK status if everything succeeds
    res.sendStatus(200);
  } catch (error: unknown) {
    console.error('Error occurred:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      // Forward the original error status and data from Axios
      res.status(error.response.status).send(error.response.data);
    } else if (error instanceof Error) {
      res.status(500).send(error.message);
    } else {
      res.status(500).send('An unknown error occurred');
    }
  }
});

const PORT: number = parseInt(process.env.PORT!, 10);

app.listen(PORT, (): void => {
  console.log(`Server is running on port ${PORT}`);
}); 