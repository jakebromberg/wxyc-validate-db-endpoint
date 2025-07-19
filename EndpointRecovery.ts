import { config } from './config';
import { NodeSSH } from 'node-ssh';

export class EndpointRecovery {
  /**
   * Attempts to recover from endpoint validation failure
   * @returns Promise<void> - Resolves if recovery succeeds, throws if recovery fails
   */
  async recover(): Promise<void> {
    console.log('Starting endpoint recovery process...');
    
    try {
      // Perform recovery steps in sequence
      await this.performDatabaseRecovery();
      await this.performServiceRecovery();
      
      console.log('Endpoint recovery completed successfully');
    } catch (error) {
      console.error('Endpoint recovery failed:', error);
      throw new Error(`Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handles database-related recovery operations via SSH
   */
  private async performDatabaseRecovery(): Promise<void> {
    console.log('Performing database recovery via SSH...');
    
    const ssh = new NodeSSH();
    
    try {
      // Connect to the SSH host
      console.log(`  - Connecting to SSH host: ${config.SSH_HOST}`);
      await ssh.connect({
        host: config.SSH_HOST,
        username: config.SSH_USERNAME,
        password: config.SSH_PASSWORD,
      });
      
      console.log('  - SSH connection established');
      
      // Execute the Tomcat restart command
      console.log('  - Executing Tomcat restart command...');
      const result = await ssh.execCommand('./stopTomcat && sleep 5 && ./startTomcat');
      
      console.log(`  - Command stdout: ${result.stdout}`);
      if (result.stderr) {
        console.log(`  - Command stderr: ${result.stderr}`);
      }
      console.log(`  - Command exit code: ${result.code}`);
      
      // Close SSH connection
      ssh.dispose();
      
      // Check if the command was successful
      if (result.code !== 0) {
        throw new Error(`Tomcat restart command failed with exit code ${result.code}: ${result.stderr || 'Unknown error'}`);
      }
      
      console.log('  - Database recovery completed successfully');
      
    } catch (error) {
      // Ensure SSH connection is closed even if an error occurs
      ssh.dispose();
      
      if (error instanceof Error) {
        throw new Error(`Database recovery failed: ${error.message}`);
      } else {
        throw new Error('Database recovery failed: Unknown error');
      }
    }
  }

  /**
   * Handles service-related recovery operations
   */
  private async performServiceRecovery(): Promise<void> {
    console.log('Performing service recovery...');
    
    // For now, service recovery is minimal - just log that we attempted it
    // In the future, this could include:
    // - Restarting application services
    // - Clearing application cache
    // - Reinitializing connections
    
    console.log('  - Service recovery completed (no additional actions required)');
  }

  /**
   * Simulates an async operation for placeholder recovery steps
   * @param operationName - Name of the operation for logging
   * @param delay - Delay in milliseconds to simulate async work
   */
  private async simulateAsyncOperation(operationName: string, delay: number): Promise<void> {
    console.log(`  - ${operationName} in progress...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    console.log(`  - ${operationName} completed`);
  }

  /**
   * Checks if recovery is needed based on the error type
   * @param error - The error that occurred during validation
   * @returns boolean - Whether recovery should be attempted
   */
  static shouldAttemptRecovery(error: unknown): boolean {
    // Don't attempt recovery for certain types of errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Don't attempt recovery for authentication/credential related errors
      if (message.includes('unauthorized') ||
          message.includes('authentication') ||
          message.includes('login') ||
          message.includes('credential') ||
          message.includes('password') ||
          message.includes('403') ||
          message.includes('401')) {
        console.log('Authentication/credential error detected - recovery not applicable');
        return false;
      }
      
      // Attempt recovery for infrastructure/connectivity issues
      return message.includes('connection') ||
             message.includes('timeout') ||
             message.includes('network') ||
             message.includes('gateway') ||
             message.includes('service unavailable') ||
             message.includes('502') ||
             message.includes('503') ||
             message.includes('504');
    }
    
    return false;
  }
} 