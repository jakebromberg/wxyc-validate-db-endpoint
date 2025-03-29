const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();

app.get('/', async (req, res) => {
  try {
    // 1. Perform initial GET to trigger re-authentication
    const initialResponse = await axios.get('http://www.wxyc.info/wxycdb/login?mode=attemptReAuth');
    
    // Extract the first cookie from the "set-cookie" header
    const setCookieHeader = initialResponse.headers['set-cookie'];
    if (!setCookieHeader || setCookieHeader.length === 0) {
      return res.status(502).send('Bad Gateway: No cookie found');
    }
    // Assume the first cookie is in the form "key=value; ..."
    const initialCookie = setCookieHeader[0].split(';')[0];
    
    // 2. Log in using POST request with URL-encoded form data
    const loginHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept-Encoding': 'gzip, deflate',
      'Cookie': initialCookie,
    };
    const loginData = 'loginAction=userpw&user=${user}&password=${pass}&returnURL=';

    await axios.post('http://www.wxyc.info/wxycdb/login', loginData, {
      headers: loginHeaders,
    });

    // 3. Perform a search request using the same cookie
    const searchHeaders = {
      'Accept-Encoding': 'gzip, deflate',
      'Cookie': initialCookie,
    };
    await axios.get('http://www.wxyc.info/wxycdb/searchCardCatalog?searchString=hello', {
      headers: searchHeaders,
    });

    // Return OK status if everything succeeds
    res.sendStatus(200);
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(502).send('Bad Gateway');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
