// test-document-route.js
const axios = require('axios');

async function testDocumentRoute() {
  try {
    console.log('Testing document route...');
    
    // Test document info endpoint
    const infoResponse = await axios.get('http://localhost:5000/api/documents/3/info');
    console.log('Document Info:', infoResponse.data);
    
    // Test if file endpoint exists (HEAD request)
    try {
      const headResponse = await axios.head('http://localhost:5000/api/documents/3/file');
      console.log('File endpoint status:', headResponse.status);
      console.log('Content-Type:', headResponse.headers['content-type']);
    } catch (headError) {
      console.error('HEAD request failed:', headError.response?.status, headError.response?.statusText);
    }
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testDocumentRoute();