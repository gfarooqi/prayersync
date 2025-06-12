#!/usr/bin/env node

// DataForSEO Programmatic SEO Automation for PrayerSync
const https = require('https');
const fs = require('fs');
const path = require('path');

// DataForSEO API Configuration
const DATAFORSEO_LOGIN = 'gulraiz@tritongrowth.com';
const DATAFORSEO_PASSWORD = '1d6059ed4d5feb80';
const API_BASE = 'https://api.dataforseo.com';

// Helper function to make API calls
function makeDataForSEORequest(endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const auth = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');
        
        const options = {
            hostname: 'api.dataforseo.com',
            path: endpoint,
            method: data ? 'POST' : 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve(parsedData);
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// Prayer Time Keywords Strategy
const PRAYER_KEYWORDS = {
    primary: [
        'prayer times',
        'salat times', 
        'namaz times',
        'islamic prayer schedule',
        'mosque prayer times'
    ],
    modifiers: [
        'calendar integration',
        'business professionals', 
        'work schedule',
        'app',
        'export',
        'sync',
        'reminder',
        'notification'
    ],
    cities: [
        'new york', 'london', 'toronto', 'sydney', 'dubai', 'istanbul',
        'kuala lumpur', 'singapore', 'los angeles', 'chicago', 'houston',
        'atlanta', 'boston', 'seattle', 'vancouver', 'manchester', 'birmingham'
    ],
    locations: [
        'airport', 'office', 'workplace', 'business district', 'downtown',
        'university', 'hospital', 'mall', 'conference center'
    ]
};

// Generate keyword combinations
function generateKeywordCombinations() {
    const keywords = [];
    
    // City + Primary Keywords
    PRAYER_KEYWORDS.cities.forEach(city => {
        PRAYER_KEYWORDS.primary.forEach(primary => {
            keywords.push(`${primary} ${city}`);
            keywords.push(`${city} ${primary}`);
        });
    });
    
    // City + Location + Primary
    PRAYER_KEYWORDS.cities.forEach(city => {
        PRAYER_KEYWORDS.locations.forEach(location => {
            PRAYER_KEYWORDS.primary.forEach(primary => {
                keywords.push(`${primary} ${city} ${location}`);
                keywords.push(`${city} ${location} ${primary}`);
            });
        });
    });
    
    // Primary + Modifiers
    PRAYER_KEYWORDS.primary.forEach(primary => {
        PRAYER_KEYWORDS.modifiers.forEach(modifier => {
            keywords.push(`${primary} ${modifier}`);
        });
    });
    
    return [...new Set(keywords)]; // Remove duplicates
}

// Test DataForSEO Connection
async function testConnection() {
    console.log('🔍 Testing DataForSEO API connection...');
    
    try {
        const response = await makeDataForSEORequest('/v3/dataforseo_labs/available_filters');
        
        if (response.status_code === 20000) {
            console.log('✅ DataForSEO API connection successful!');
            console.log(`Credits remaining: ${response.cost}`);
            return true;
        } else {
            console.log('❌ DataForSEO API connection failed:', response.status_message);
            return false;
        }
    } catch (error) {
        console.log('❌ Connection error:', error.message);
        return false;
    }
}

// Get keyword difficulty and search volume
async function getKeywordData(keywords) {
    console.log(`🔍 Analyzing ${keywords.length} keywords for competition and volume...`);
    
    const keywordData = [];
    const batchSize = 100; // DataForSEO batch limit
    
    for (let i = 0; i < keywords.length; i += batchSize) {
        const batch = keywords.slice(i, i + batchSize);
        
        try {
            const postData = [{
                language_name: "English",
                location_name: "United States",
                keywords: batch
            }];
            
            const response = await makeDataForSEORequest('/v3/dataforseo_labs/keyword_suggestions/live', postData);
            
            if (response.status_code === 20000 && response.tasks[0].result) {
                response.tasks[0].result.forEach(item => {
                    keywordData.push({
                        keyword: item.keyword_data.keyword,
                        search_volume: item.keyword_data.keyword_info.search_volume,
                        competition: item.keyword_data.keyword_info.competition,
                        cpc: item.keyword_data.keyword_info.cpc,
                        difficulty: item.keyword_data.keyword_properties?.difficulty || 'N/A'
                    });
                });
                
                console.log(`✅ Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(keywords.length/batchSize)}`);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.log(`❌ Error processing batch: ${error.message}`);
        }
    }
    
    return keywordData;
}

// Find low competition opportunities
function findLowCompetitionKeywords(keywordData, maxDifficulty = 30, minVolume = 100) {
    return keywordData
        .filter(item => 
            item.search_volume >= minVolume && 
            (item.difficulty === 'N/A' || item.difficulty <= maxDifficulty) &&
            item.competition !== 'HIGH'
        )
        .sort((a, b) => b.search_volume - a.search_volume);
}

// Generate content strategy
function generateContentStrategy(lowCompKeywords) {
    const strategy = {
        highPriority: [],
        mediumPriority: [],
        longTail: []
    };
    
    lowCompKeywords.forEach(keyword => {
        if (keyword.search_volume >= 1000) {
            strategy.highPriority.push(keyword);
        } else if (keyword.search_volume >= 300) {
            strategy.mediumPriority.push(keyword);
        } else {
            strategy.longTail.push(keyword);
        }
    });
    
    return strategy;
}

// Save results to files
function saveResults(keywordData, strategy) {
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Save all keyword data
    fs.writeFileSync(
        `keyword-analysis-${timestamp}.json`,
        JSON.stringify(keywordData, null, 2)
    );
    
    // Save content strategy
    fs.writeFileSync(
        `content-strategy-${timestamp}.json`,
        JSON.stringify(strategy, null, 2)
    );
    
    // Generate quick report
    const report = `# PrayerSync SEO Analysis Report - ${timestamp}

## Summary
- Total keywords analyzed: ${keywordData.length}
- High priority opportunities: ${strategy.highPriority.length}
- Medium priority opportunities: ${strategy.mediumPriority.length}
- Long tail opportunities: ${strategy.longTail.length}

## Top 20 High Priority Keywords
${strategy.highPriority.slice(0, 20).map((kw, i) => 
    `${i+1}. "${kw.keyword}" - Volume: ${kw.search_volume}, Difficulty: ${kw.difficulty}, Competition: ${kw.competition}`
).join('\n')}

## Recommended Next Steps
1. Create landing pages for top 50 high priority keywords
2. Build programmatic city pages for medium priority terms
3. Generate blog content for long tail opportunities
4. Set up automated content creation pipeline

## Content Templates Needed
- City-specific prayer times pages
- Airport prayer guide pages  
- Professional Muslim resources
- Calendar integration guides
`;
    
    fs.writeFileSync(`seo-report-${timestamp}.md`, report);
    
    console.log(`\n📊 Results saved:`);
    console.log(`- keyword-analysis-${timestamp}.json`);
    console.log(`- content-strategy-${timestamp}.json`); 
    console.log(`- seo-report-${timestamp}.md`);
}

// Main execution
async function main() {
    console.log('🚀 Starting PrayerSync Programmatic SEO Analysis...\n');
    
    // Test connection
    const connected = await testConnection();
    if (!connected) {
        console.log('❌ Cannot proceed without API connection');
        return;
    }
    
    // Generate keywords to analyze
    const keywords = generateKeywordCombinations();
    console.log(`\n📝 Generated ${keywords.length} keyword combinations`);
    
    // Get keyword data from DataForSEO
    const keywordData = await getKeywordData(keywords.slice(0, 500)); // Limit for initial test
    
    // Find opportunities
    const opportunities = findLowCompetitionKeywords(keywordData);
    console.log(`\n🎯 Found ${opportunities.length} low-competition opportunities`);
    
    // Generate strategy
    const strategy = generateContentStrategy(opportunities);
    
    // Save results
    saveResults(keywordData, strategy);
    
    console.log(`\n✅ SEO analysis complete!`);
    console.log(`📈 Ready to generate ${strategy.highPriority.length + strategy.mediumPriority.length} high-impact pages`);
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    makeDataForSEORequest,
    generateKeywordCombinations,
    testConnection,
    getKeywordData,
    findLowCompetitionKeywords,
    generateContentStrategy
};