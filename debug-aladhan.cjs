const fs = require('fs');

async function debugAladhanAPI() {
  try {
    const lat = 40.7128;
    const lon = -74.0060;
    const year = new Date().getFullYear();
    
    console.log(`Testing AlAdhan API for New York (${lat}, ${lon}) for year ${year}...`);
    
    // Test the API response structure
    const response = await fetch(`http://api.aladhan.com/v1/calendar/${year}?latitude=${lat}&longitude=${lon}&method=2`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const apiData = await response.json();
    
    console.log('API Response Structure:');
    console.log('- Code:', apiData.code);
    console.log('- Status:', apiData.status);
    console.log('- Data type:', typeof apiData.data);
    console.log('- Data length:', apiData.data ? apiData.data.length : 'undefined');
    
    if (apiData.data && apiData.data.length > 0) {
      console.log('\nFirst month structure:');
      console.log('- Type:', typeof apiData.data[0]);
      console.log('- Length:', Array.isArray(apiData.data[0]) ? apiData.data[0].length : 'not array');
      
      if (Array.isArray(apiData.data[0]) && apiData.data[0].length > 0) {
        console.log('\nFirst day structure:');
        console.log('- Keys:', Object.keys(apiData.data[0][0]));
        console.log('- Has timings:', !!apiData.data[0][0].timings);
        console.log('- Has date:', !!apiData.data[0][0].date);
        console.log('- Has meta:', !!apiData.data[0][0].meta);
        
        if (apiData.data[0][0].meta) {
          console.log('- Timezone:', apiData.data[0][0].meta.timezone);
        }
        
        if (apiData.data[0][0].timings) {
          console.log('\nSample prayer times:');
          console.log('- Fajr:', apiData.data[0][0].timings.Fajr);
          console.log('- Dhuhr:', apiData.data[0][0].timings.Dhuhr);
        }
      }
    }
    
    // Save full response for inspection
    fs.writeFileSync('aladhan-debug.json', JSON.stringify(apiData, null, 2));
    console.log('\n✅ Full API response saved to aladhan-debug.json');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// For Node.js versions without built-in fetch
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

debugAladhanAPI();