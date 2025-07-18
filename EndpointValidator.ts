import axios, { AxiosResponse } from 'axios';
import { config } from './config';

interface ApiHeaders {
  'Content-Type'?: string;
  'Accept-Encoding': string;
  'Cookie': string;
}

export class EndpointValidator {
  /**
   * Validates the endpoint by performing authentication flow and search test
   * @returns Promise<void> - Resolves if validation succeeds, throws if it fails
   */
  async validate(): Promise<void> {
    // 1. Perform initial GET to trigger re-authentication
    const initialResponse: AxiosResponse<any, any> = await axios.get(
      `${config.BASE_URL}${config.LOGIN_ENDPOINT}?mode=attemptReAuth`
    );
    
    // Extract the first cookie from the "set-cookie" header
    const setCookieHeader: string[] | undefined = initialResponse.headers['set-cookie'];
    if (!setCookieHeader || setCookieHeader.length === 0) {
      throw new Error('Bad Gateway: No cookie found');
    }
    
    // Assume the first cookie is in the form "key=value; ..."
    const initialCookie: string = setCookieHeader[0]!.split(';')[0]!;
    
    // 2. Log in using POST request with URL-encoded form data
    await this.performLogin(initialCookie);
    
    // 3. Perform a search request to validate the session
    await this.performSearchValidation(initialCookie);
  }

  /**
   * Performs the login step with the provided cookie
   * @param cookie - The session cookie to use for authentication
   */
  private async performLogin(cookie: string): Promise<void> {
    const loginHeaders: ApiHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept-Encoding': 'gzip, deflate',
      'Cookie': cookie,
    };
    
    const loginData: string = `loginAction=userpw&user=${config.LIBRARY_USER}&password=${config.LIBRARY_PASSWORD}&returnURL=`;

    await axios.post(
      `${config.BASE_URL}${config.LOGIN_ENDPOINT}`, 
      loginData, 
      { headers: loginHeaders as any }
    );
  }

  /**
   * Performs a search request to validate that the session is working
   * @param cookie - The session cookie to use for the search
   */
  private async performSearchValidation(cookie: string): Promise<void> {
    const searchHeaders: Omit<ApiHeaders, 'Content-Type'> = {
      'Accept-Encoding': 'gzip, deflate',
      'Cookie': cookie,
    };
    
    await axios.get(
      `${config.BASE_URL}${config.SEARCH_ENDPOINT}?searchString=${config.DEFAULT_SEARCH_STRING}`, 
      { headers: searchHeaders as any }
    );
  }
} 