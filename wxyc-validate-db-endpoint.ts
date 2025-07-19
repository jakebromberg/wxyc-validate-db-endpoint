import express, { Request, Response } from 'express';
import axios from 'axios';
import { config } from './config';
import { EndpointValidator } from './EndpointValidator';
import { EndpointRecovery } from './EndpointRecovery';

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
    
    try {
      // Attempt validation
      await validator.validate();
      console.log('Endpoint validation successful');
      res.sendStatus(200);
    } catch (validationError) {
      console.log('Validation failed, checking if recovery should be attempted...');
      
      // Check if we should attempt recovery
      if (EndpointRecovery.shouldAttemptRecovery(validationError)) {
        console.log('Attempting endpoint recovery...');
        
        const recovery = new EndpointRecovery();
        await recovery.recover();
        console.log('Recovery completed, re-validating endpoint...');
        
        // CRITICAL: Re-validate after recovery to ensure it actually worked
        try {
          await validator.validate();
          console.log('Post-recovery validation successful');
          res.sendStatus(200);
        } catch (revalidationError) {
          console.log('Post-recovery validation failed - recovery was not effective');
          throw revalidationError;
        }
      } else {
        console.log('Error is not recoverable, failing immediately');
        throw validationError;
      }
    }
  } catch (error: unknown) {
    console.error('Final error occurred:', error);
    
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

// Export the app for testing
export default app;

// Only start the server if this file is run directly (not imported)
if (require.main === module) {
  app.listen(config.PORT, (): void => {
    console.log(`Server is running on port ${config.PORT}`);
  }); 
} 