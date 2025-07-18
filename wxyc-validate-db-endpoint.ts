import express, { Request, Response } from 'express';
import axios from 'axios';
import { config } from './config';
import { EndpointValidator } from './EndpointValidator';

// Type definitions for API responses
interface LoginResponse {
  headers: {
    'set-cookie'?: string[];
  };
}

const app = express();

app.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const validator = new EndpointValidator();
    await validator.validate();

    // Return OK status if validation succeeds
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

app.listen(config.PORT, (): void => {
  console.log(`Server is running on port ${config.PORT}`);
}); 