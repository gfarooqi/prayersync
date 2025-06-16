// Vercel Serverless Function to proxy AlAdhan API requests
// This solves the CORS issue by making server-to-server API calls

export default async function handler(request, response) {
  // Enable CORS for your frontend
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  // Only allow GET requests
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // Get parameters from the request
  const { latitude, longitude, date, method = 3 } = request.query;

  if (!latitude || !longitude) {
    return response.status(400).json({ 
      error: 'Latitude and longitude are required',
      usage: '/api/getPrayerTimes?latitude=40.7128&longitude=-74.0060&date=2025-01-15&method=3'
    });
  }

  try {
    // Use the date parameter or default to today
    const dateStr = date || new Date().toISOString().split('T')[0];
    
    // Construct the AlAdhan API URL - using HTTPS as we determined earlier
    const aladhanApiUrl = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${method}`;

    console.log(`Fetching prayer times from: ${aladhanApiUrl}`);

    // Fetch data from the AlAdhan API (server-side, no CORS restrictions)
    const apiResponse = await fetch(aladhanApiUrl, {
      headers: {
        'User-Agent': 'PrayerSync/1.0 (prayersync.app)'
      }
    });

    if (!apiResponse.ok) {
      console.error(`AlAdhan API error: ${apiResponse.status} ${apiResponse.statusText}`);
      return response.status(apiResponse.status).json({ 
        error: `Failed to fetch prayer times from AlAdhan API: ${apiResponse.status} ${apiResponse.statusText}`,
        url: aladhanApiUrl
      });
    }

    const data = await apiResponse.json();

    // Validate the response structure
    if (data.code !== 200 || !data.data?.timings) {
      console.error('Invalid response structure from AlAdhan API:', data);
      return response.status(500).json({ 
        error: 'Invalid response format from prayer times API',
        received: data
      });
    }

    // Set cache headers for performance (cache for 6 hours)
    response.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');

    // Add debug info in development
    const responseData = {
      ...data,
      _debug: {
        requestedUrl: aladhanApiUrl,
        serverTime: new Date().toISOString(),
        cacheHeaders: 'Cache for 6 hours'
      }
    };

    // Send the data back to the browser
    return response.status(200).json(responseData);

  } catch (error) {
    console.error('Serverless function error:', error);
    return response.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}