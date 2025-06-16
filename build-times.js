#!/usr/bin/env node
// build-times.js
// A Node.js script to pre-fetch a year of prayer times for all static pages.
// Run this as part of your build process: `node build-times.js`

import { promises as fs } from 'fs';
import path from 'path';

// For Node.js versions without built-in fetch
let fetch;
try {
    fetch = globalThis.fetch;
} catch (e) {
    // Fallback for older Node.js versions
    fetch = (await import('node-fetch')).default;
}

// --- CONFIGURATION ---
const LOCATIONS = [
    { name: 'London, UK', slug: 'london', latitude: 51.5074, longitude: -0.1278 },
    { name: 'New York, USA', slug: 'new-york', latitude: 40.7128, longitude: -74.0060 },
    { name: 'Dubai, UAE', slug: 'dubai', latitude: 25.2048, longitude: 55.2708 },
    { name: 'Singapore', slug: 'singapore', latitude: 1.3521, longitude: 103.8198 },
    { name: 'Sydney, Australia', slug: 'sydney', latitude: -33.8688, longitude: 151.2093 },
    { name: 'Toronto, Canada', slug: 'toronto', latitude: 43.6532, longitude: -79.3832 },
    { name: 'Los Angeles, USA', slug: 'los-angeles', latitude: 34.0522, longitude: -118.2437 },
    { name: 'Chicago, USA', slug: 'chicago', latitude: 41.8781, longitude: -87.6298 },
    { name: 'Istanbul, Turkey', slug: 'istanbul', latitude: 41.0082, longitude: 28.9784 },
    { name: 'Kuala Lumpur, Malaysia', slug: 'kuala-lumpur', latitude: 3.1390, longitude: 101.6869 },
    // Add more locations as needed for your 64 SEO pages
];

const CALCULATION_METHOD = 3; // 3 = Muslim World League
const OUTPUT_DIR = path.join(process.cwd(), 'api', 'times');
// --- END CONFIGURATION ---

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchYearForLocation(location, year) {
    console.log(`📍 Fetching data for ${location.name} for ${year}...`);
    const yearlyData = {};
    let totalDays = 0;

    for (let month = 1; month <= 12; month++) {
        try {
            const url = `http://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${location.latitude}&longitude=${location.longitude}&method=${CALCULATION_METHOD}`;
            console.log(`   📅 Fetching month ${month}/12...`);
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API error for month ${month}: ${response.status}`);
            
            const data = await response.json();
            if (data.code !== 200) throw new Error(`Invalid API data for month ${month}`);
            
            // Process each day in the month
            data.data.forEach(day => {
                const dateStr = day.date.gregorian.date.split('-').reverse().join('-'); // Convert DD-MM-YYYY to YYYY-MM-DD
                yearlyData[dateStr] = {
                    fajr: day.timings.Fajr.split(' ')[0],
                    sunrise: day.timings.Sunrise.split(' ')[0],
                    dhuhr: day.timings.Dhuhr.split(' ')[0],
                    asr: day.timings.Asr.split(' ')[0],
                    maghrib: day.timings.Maghrib.split(' ')[0],
                    isha: day.timings.Isha.split(' ')[0],
                    timezone: day.meta?.timezone || 'UTC',
                    method: 'MWL'
                };
                totalDays++;
            });
            
            console.log(`   ✅ Month ${month}/12 complete (${data.data.length} days)`);
            await sleep(300); // Be polite to the API server - 300ms between requests

        } catch (error) {
            console.error(`   ❌ ERROR for ${location.name} month ${month}: ${error.message}`);
            throw error; // Fail fast if we can't get complete data
        }
    }
    
    console.log(`✅ ${location.name}: Fetched ${totalDays} days of prayer times\n`);
    return yearlyData;
}

async function main() {
    console.log('🚀 Starting prayer times build process...');
    console.log(`📦 Output directory: ${OUTPUT_DIR}`);
    
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    const currentYear = new Date().getFullYear();
    console.log(`📅 Generating data for year: ${currentYear}\n`);

    let successCount = 0;
    let failCount = 0;

    for (const location of LOCATIONS) {
        try {
            const yearlyData = await fetchYearForLocation(location, currentYear);
            
            // Sanity check for a full year's data (should be ~365 days)
            const dayCount = Object.keys(yearlyData).length;
            if (dayCount < 350) {
                throw new Error(`Insufficient data: only ${dayCount} days (expected ~365)`);
            }
            
            // Add metadata to the JSON file
            const outputData = {
                location: {
                    name: location.name,
                    slug: location.slug,
                    latitude: location.latitude,
                    longitude: location.longitude
                },
                year: currentYear,
                method: 'MWL',
                generatedAt: new Date().toISOString(),
                totalDays: dayCount,
                times: yearlyData
            };
            
            const outputPath = path.join(OUTPUT_DIR, `${location.slug}.json`);
            await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2));
            
            console.log(`✅ Successfully wrote ${dayCount} days for ${location.name} to ${outputPath}`);
            successCount++;
            
        } catch (error) {
            console.error(`❌ Failed to generate data for ${location.name}: ${error.message}`);
            failCount++;
        }
        
        // Brief pause between locations to be respectful to the API
        if (LOCATIONS.indexOf(location) < LOCATIONS.length - 1) {
            console.log('⏱️  Pausing briefly between locations...\n');
            await sleep(1000);
        }
    }
    
    console.log('\n🏁 Build process finished!');
    console.log(`✅ Success: ${successCount} locations`);
    console.log(`❌ Failed: ${failCount} locations`);
    
    if (failCount > 0) {
        console.log('\n⚠️  Some locations failed. Check the errors above.');
        process.exit(1);
    } else {
        console.log('\n🎉 All locations processed successfully!');
        console.log('💡 You can now deploy your static JSON files along with your app.');
    }
}

main().catch(error => {
    console.error('💥 Build process failed:', error);
    process.exit(1);
});