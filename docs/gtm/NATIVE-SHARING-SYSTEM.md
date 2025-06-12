# Native Sharing System for Islamic Community Apps

## 🎯 **Platform-Specific Sharing Strategy**

### **Primary Platforms for Muslim Communities**
1. **WhatsApp** - 95% usage in Muslim communities globally
2. **Facebook** - Family and community groups
3. **Telegram** - Islamic study groups and channels
4. **SMS** - Universal fallback, especially for older family members
5. **Instagram** - Younger Muslims, visual sharing
6. **LinkedIn** - Muslim professional networks

## 📱 **Native Mobile Sharing Integration**

### **iOS Native Share Sheet**
```javascript
// iOS Web Share API implementation
async function shareNatively(shareData) {
    if (navigator.share) {
        try {
            await navigator.share({
                title: shareData.title,
                text: shareData.text,
                url: shareData.url
            });
            
            // Track successful share
            trackShare('native_ios', shareData.type);
        } catch (error) {
            // Fallback to custom sharing modal
            showCustomShareModal(shareData);
        }
    } else {
        showCustomShareModal(shareData);
    }
}
```

### **Android Native Share Intent**
```javascript
// Android Web Share API + Intent fallbacks
function shareToAndroid(shareData) {
    if (navigator.share) {
        navigator.share(shareData);
    } else if (navigator.userAgent.includes('Android')) {
        // Use Android intent URLs as fallback
        const intentUrl = `intent://send?${new URLSearchParams({
            'android.intent.extra.TEXT': `${shareData.text} ${shareData.url}`,
            'type': 'text/plain'
        }).toString()}#Intent;scheme=http;package=com.android.messaging;end`;
        
        window.location.href = intentUrl;
    }
}
```

## 🔗 **Deep Link URL Generation**

### **Smart Link System**
```javascript
class SmartLinkGenerator {
    constructor() {
        this.baseUrl = 'https://prayersync.app';
        this.campaigns = {
            streak_share: 'streak',
            prayer_partner: 'partner',
            community_challenge: 'challenge',
            achievement: 'achievement',
            location_share: 'location'
        };
    }

    generateShareLink(type, userData = {}) {
        const params = new URLSearchParams({
            ref: this.campaigns[type] || 'share',
            uid: userData.userId || 'anonymous',
            city: userData.city || '',
            streak: userData.streak || 0,
            utm_source: 'app_share',
            utm_medium: 'social',
            utm_campaign: type
        });

        return `${this.baseUrl}?${params.toString()}`;
    }

    // Generate platform-specific optimized links
    generatePlatformLink(platform, shareType, userData) {
        const baseLink = this.generateShareLink(shareType, userData);
        
        const platformParams = {
            whatsapp: { utm_source: 'whatsapp' },
            facebook: { utm_source: 'facebook' },
            telegram: { utm_source: 'telegram' },
            sms: { utm_source: 'sms' },
            instagram: { utm_source: 'instagram' },
            linkedin: { utm_source: 'linkedin' }
        };

        const params = new URLSearchParams(baseLink.split('?')[1]);
        Object.entries(platformParams[platform] || {}).forEach(([key, value]) => {
            params.set(key, value);
        });

        return `${this.baseUrl}?${params.toString()}`;
    }
}
```

## 📲 **Platform-Specific Share Functions**

### **WhatsApp Integration**
```javascript
function shareToWhatsApp(shareData) {
    const message = encodeURIComponent(`${shareData.text}\n\n${shareData.url}`);
    
    // Mobile WhatsApp
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        window.open(`whatsapp://send?text=${message}`, '_blank');
    } else {
        // WhatsApp Web
        window.open(`https://web.whatsapp.com/send?text=${message}`, '_blank');
    }
    
    trackShare('whatsapp', shareData.type);
}

// Specific WhatsApp share templates
const whatsappTemplates = {
    streak_share: (streak, days) => 
        `🔥 ${streak}-Day Prayer Streak Alhamdulillah! 🕌\n\nI'm designing my life around prayers, not the other way around.\n\nJoin me on this journey! Both get +3 bonus streak days when you join:`,
    
    prayer_partner: (userName) => 
        `🤝 Be my Prayer Accountability Partner!\n\n${userName} invited you to join PrayerSync and support each other's prayer journey.\n\nLet's help each other stay consistent with our 5 daily prayers:`,
    
    community_challenge: (challengeName, participants) => 
        `🏆 ${challengeName}\n\nJoin ${participants} Muslims in this month's prayer challenge!\n\nLet's design our December around our prayers together:`,
    
    location_share: (city, prayerTime) => 
        `🕌 Prayer times in ${city}\n\n${prayerTime} - Never miss a prayer while traveling!\n\nGet accurate prayer times anywhere in the world:`
};
```

### **Facebook Integration**
```javascript
function shareToFacebook(shareData) {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({
        u: shareData.url,
        quote: shareData.text
    }).toString()}`;
    
    window.open(facebookUrl, 'facebook-share', 'width=580,height=296');
    trackShare('facebook', shareData.type);
}

// Facebook-optimized content
const facebookTemplates = {
    streak_share: (streak) => 
        `🔥 ${streak} days of consistent prayers! Alhamdulillah for PrayerSync helping me design my life around my prayers instead of letting life get in the way of my deen. 🕌✨`,
    
    community_impact: (userCount, city) => 
        `Amazing to see ${userCount} Muslims in ${city} using PrayerSync to prioritize their prayers! 🤲 This app is changing how we balance deen and dunya. #PrayerFirst #MuslimTech`,
    
    professional_muslim: () => 
        `As a Muslim professional, PrayerSync solved my biggest challenge: maintaining prayer consistency with a demanding work schedule. Game changer! 💼🕌 #MuslimProfessionals`
};
```

### **Telegram Integration**
```javascript
function shareToTelegram(shareData) {
    const telegramUrl = `https://t.me/share/url?${new URLSearchParams({
        url: shareData.url,
        text: shareData.text
    }).toString()}`;
    
    window.open(telegramUrl, '_blank');
    trackShare('telegram', shareData.type);
}

// Telegram channel/group optimized content
const telegramTemplates = {
    islamic_study_group: () => 
        `📚 Sharing a beneficial app with the study group: PrayerSync helps maintain prayer consistency while balancing work/studies. Thought it might benefit the community! 🤲`,
    
    community_channel: (city) => 
        `🕌 For our ${city} Muslim community: Found this prayer time app that helps coordinate with work schedules. Multiple calculation methods and travel features. Barakallahu feekum! 🌟`,
    
    professional_group: () => 
        `💼 Fellow Muslim professionals: This app solved the challenge of maintaining prayers during busy work days. Automatic calendar integration and meeting conflict detection. MashaAllah! 🎯`
};
```

### **SMS Integration**
```javascript
function shareViaSMS(shareData) {
    const smsBody = encodeURIComponent(`${shareData.text}\n\n${shareData.url}`);
    
    // iOS and Android SMS
    window.open(`sms:?body=${smsBody}`, '_self');
    trackShare('sms', shareData.type);
}

// SMS-optimized short messages
const smsTemplates = {
    family_invite: (userName) => 
        `Assalamu alaikum! ${userName} recommended PrayerSync app for prayer times & reminders. Helps with consistency MashaAllah!`,
    
    simple_share: () => 
        `Found this helpful Islamic app: PrayerSync. Prayer times, Qibla direction, travel mode. Free download:`,
    
    elder_friendly: () => 
        `Islamic prayer app recommendation: PrayerSync. Simple to use, accurate times, helpful reminders. Download free:`
};
```

### **Instagram Stories Integration**
```javascript
function shareToInstagramStory(shareData) {
    // Generate story-optimized image
    const storyImage = generateStoryImage(shareData);
    
    if (navigator.userAgent.includes('Instagram')) {
        // Instagram in-app browser
        navigator.share({
            files: [storyImage],
            title: shareData.title,
            text: shareData.text
        });
    } else {
        // Download image and provide instructions
        downloadStoryImage(storyImage);
        showInstagramInstructions();
    }
    
    trackShare('instagram_story', shareData.type);
}

// Instagram story templates
function generateStoryImage(shareData) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    
    // Islamic geometric background
    drawIslamicBackground(ctx);
    
    // Streak achievement
    if (shareData.type === 'streak_share') {
        ctx.fillStyle = '#1e3a5f';
        ctx.font = 'bold 72px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`${shareData.streak}-Day Streak!`, 540, 800);
        
        ctx.font = '48px Inter';
        ctx.fillText('🔥 Designing life around prayers 🕌', 540, 900);
        
        ctx.font = '36px Inter';
        ctx.fillStyle = '#666';
        ctx.fillText('Download PrayerSync', 540, 1200);
    }
    
    return canvas.toDataURL('image/png');
}
```

### **LinkedIn Professional Sharing**
```javascript
function shareToLinkedIn(shareData) {
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({
        url: shareData.url,
        title: shareData.title,
        summary: shareData.text
    }).toString()}`;
    
    window.open(linkedinUrl, '_blank');
    trackShare('linkedin', shareData.type);
}

// LinkedIn professional templates
const linkedinTemplates = {
    professional_story: (streak, industry) => 
        `Maintaining prayer consistency as a Muslim ${industry} professional was my biggest challenge.\n\nPrayerSync solved this by:\n✅ Automatic calendar integration\n✅ Meeting conflict detection\n✅ Travel mode for business trips\n\nResult: ${streak}-day streak while growing my career.\n\nIt's not about choosing between deen and dunya - it's about designing life to honor both.\n\n#MuslimProfessionals #WorkLifeBalance #PrayerFirst`,
    
    diversity_inclusion: () => 
        `Workplace diversity isn't just about representation - it's about accommodation.\n\nPrayerSync helps Muslim professionals maintain their religious obligations while excelling in their careers.\n\nFeatures like prayer break scheduling and meeting conflict alerts make it easier for companies to support Muslim employees.\n\n#DiversityAndInclusion #ReligiousAccommodation #MuslimTalent`,
    
    productivity_hack: () => 
        `Productivity hack for Muslim professionals: Design your schedule around your 5 daily prayers.\n\nInstead of squeezing prayers between meetings, block prayer times first, then schedule everything else around them.\n\nPrayerSync automates this process. Game changer for work-life-faith balance.\n\n#ProductivityTips #MuslimProfessionals #TimeManagement`
};
```

## 📊 **Share Analytics & Optimization**

### **Share Tracking System**
```javascript
class ShareAnalytics {
    constructor() {
        this.events = [];
    }

    trackShare(platform, shareType, metadata = {}) {
        const event = {
            timestamp: new Date().toISOString(),
            platform: platform,
            shareType: shareType,
            userId: this.getUserId(),
            city: this.getUserCity(),
            streakDay: this.getUserStreak(),
            ...metadata
        };

        this.events.push(event);
        this.sendToAnalytics(event);
        
        // Store locally for offline tracking
        localStorage.setItem('shareEvents', JSON.stringify(this.events));
    }

    sendToAnalytics(event) {
        // Send to your analytics service
        fetch('/api/analytics/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
    }

    getShareMetrics() {
        return {
            totalShares: this.events.length,
            platformBreakdown: this.groupBy(this.events, 'platform'),
            shareTypeBreakdown: this.groupBy(this.events, 'shareType'),
            conversionRate: this.calculateConversionRate(),
            viralCoefficient: this.calculateViralCoefficient()
        };
    }
}
```

### **A/B Testing Share Messages**
```javascript
const shareMessageTests = {
    streak_achievement: {
        version_a: "🔥 7-day prayer streak! Join me in designing life around prayers:",
        version_b: "Alhamdulillah! 7 days of consistent prayers. PrayerSync helps me never miss:",
        version_c: "Prayer streak day 7! 🕌 Designing my schedule around salah, not the other way around:"
    },
    
    community_invite: {
        version_a: "Join 12,000+ Muslims prioritizing prayers in their daily lives:",
        version_b: "Be part of the movement: Design life around prayers, not against them:",
        version_c: "Found my prayer accountability partner! Join the ummah supporting each other:"
    }
};

function getOptimizedShareMessage(messageType) {
    const userId = getUserId();
    const testGroup = userId % 3; // Simple A/B/C test
    const versions = shareMessageTests[messageType];
    
    return Object.values(versions)[testGroup];
}
```

## 🎯 **Smart Share Triggers**

### **Contextual Share Prompts**
```javascript
const shareContexts = {
    // After completing 7-day streak
    streak_milestone: {
        trigger: 'prayer_streak_7_days',
        delay: 2000, // 2 seconds after celebration
        priority: 'high',
        platforms: ['whatsapp', 'instagram', 'facebook'],
        message: whatsappTemplates.streak_share
    },
    
    // After successful travel prayer
    travel_success: {
        trigger: 'travel_prayer_completed',
        delay: 1000,
        priority: 'medium',
        platforms: ['whatsapp', 'telegram'],
        message: whatsappTemplates.location_share
    },
    
    // During Ramadan
    ramadan_iftar: {
        trigger: 'iftar_time_notification',
        delay: 30000, // 30 seconds after iftar
        priority: 'high',
        platforms: ['whatsapp', 'facebook', 'instagram'],
        message: "🌙 Breaking fast with perfect timing thanks to PrayerSync! Join our Ramadan community:"
    },
    
    // After joining community challenge
    challenge_participation: {
        trigger: 'challenge_joined',
        delay: 5000,
        priority: 'medium',
        platforms: ['whatsapp', 'telegram', 'facebook'],
        message: whatsappTemplates.community_challenge
    }
};
```

### **Platform-Specific Optimization**
```javascript
function optimizeShareForPlatform(platform, content) {
    const optimizations = {
        whatsapp: {
            maxLength: 4096,
            emojiSupport: true,
            linkPreview: true,
            formatting: 'markdown'
        },
        facebook: {
            maxLength: 63206,
            hashtagSupport: true,
            imageOptimal: true,
            linkExpansion: true
        },
        telegram: {
            maxLength: 4096,
            markdownSupport: true,
            emojiSupport: true,
            channelOptimized: true
        },
        sms: {
            maxLength: 160,
            emojiSupport: false,
            linkShortening: true,
            simplified: true
        },
        instagram: {
            visualFocus: true,
            hashtagSupport: true,
            storyOptimized: true,
            maxHashtags: 30
        },
        linkedin: {
            professionalTone: true,
            industryKeywords: true,
            networkingFocus: true,
            careerRelevant: true
        }
    };

    const platform_opts = optimizations[platform];
    
    if (platform_opts.maxLength && content.length > platform_opts.maxLength) {
        content = content.substring(0, platform_opts.maxLength - 3) + '...';
    }
    
    if (platform_opts.simplified) {
        content = content.replace(/🔥|🕌|✨/g, ''); // Remove emojis for SMS
    }
    
    return content;
}
```

This native sharing system transforms PrayerSync into a viral growth machine by leveraging the exact platforms and communication patterns that Muslims use daily in their communities!
