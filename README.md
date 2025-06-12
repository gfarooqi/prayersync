# 🕌 PrayerSync 

**Never miss a prayer as a busy professional.** Automatic calendar sync and smart conflict detection for Muslim professionals.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgfarooqi%2Fprayersync)

## 🎯 Overview

PrayerSync is a Progressive Web App designed specifically for Muslim professionals who need to balance their faith with demanding work schedules. It automatically integrates prayer times into your business calendar and provides smart conflict detection.

### ✨ Key Features

- **📅 Calendar Integration**: Export prayer times to Google Calendar, Outlook, Apple Calendar
- **⚠️ Meeting Conflict Alerts**: Smart detection when meetings overlap with prayer times
- **🌍 Global Prayer Times**: Accurate calculations for 500+ cities worldwide
- **✈️ Travel Mode**: Automatic updates for business travelers
- **📱 PWA**: Install as app, works offline
- **🔄 Real-time Updates**: Live prayer time calculations
- **🧭 Qibla Compass**: Direction to Mecca from anywhere

## 🚀 Live Demo

**Production Site**: [https://prayersync.vercel.app](https://prayersync.vercel.app)

### 📊 SEO Landing Pages (64 pages)
- **City Pages**: Prayer times for major cities ([New York](https://prayersync.vercel.app/prayer-times-new-york), [London](https://prayersync.vercel.app/prayer-times-london), [Dubai](https://prayersync.vercel.app/prayer-times-dubai))
- **Airport Guides**: Prayer facilities for travelers ([JFK Airport](https://prayersync.vercel.app/prayer-room-new-york-airport))
- **Professional Guides**: Workplace prayer solutions ([Meeting Conflicts](https://prayersync.vercel.app/meeting-prayer-conflict))

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Styling**: Custom CSS with CSS Variables
- **PWA**: Service Worker, Web App Manifest
- **Deployment**: Vercel with automatic GitHub integration
- **SEO**: Programmatic page generation, Schema markup
- **APIs**: DataForSEO for keyword research, Prayer times APIs

## 📁 Project Structure

```
prayersync/
├── index.html              # Main application
├── app.js                  # Core JavaScript logic
├── styles.css              # Production styles
├── manifest.json           # PWA manifest
├── service-worker.js       # Offline functionality
├── vercel.json             # Vercel deployment config
├── pages/                  # SEO landing pages (64 pages)
│   ├── prayer-times-*.html # City-specific pages
│   ├── prayer-room-*.html  # Airport guides
│   └── *.html              # Professional guides
├── scripts/                # Automation scripts
│   ├── seo-automation.js   # DataForSEO integration
│   ├── generate-seo-pages.js # Page generation
│   └── local-seo-research.js # Keyword research
├── data/                   # Generated data
│   ├── keywords/           # Keyword analysis
│   └── reports/            # SEO reports
└── docs/                   # Documentation
    └── gtm/                # Go-to-market plans
```

## 🔧 Development

### Prerequisites
- Node.js 16+
- Git

### Local Development
```bash
# Clone repository
git clone https://github.com/gfarooqi/prayersync.git
cd prayersync

# Install dependencies
npm install

# Start development server
npm run dev
# App available at http://localhost:8080

# Generate SEO pages
node scripts/generate-seo-pages.js
```

### Available Scripts
```bash
npm run start       # Start local server (port 8000)
npm run dev         # Development server (port 8080)
npm run build       # Build for production
npm run test        # Run tests
npm run lighthouse  # Performance audit
```

## 📈 SEO & Marketing

### Programmatic SEO Strategy
- **64 SEO-optimized pages** targeting low-competition keywords
- **DataForSEO integration** for real keyword research
- **3-phase rollout**: City pages → Professional guides → Business districts
- **Target**: 10,000+ monthly organic visitors

### Key Target Keywords
- `prayer times [city]` (2,000+ monthly searches)
- `muslim professional prayer schedule` (300+ searches)
- `[city] airport prayer room` (500+ searches)
- `prayer times calendar integration` (200+ searches)

### Growth Projections
- **Week 1**: 500+ organic visitors
- **Week 2**: 2,000+ organic visitors  
- **Week 3**: 5,000+ organic visitors
- **Week 4**: 10,000+ organic visitors

## 🌍 Deployment

### Vercel (Recommended)
1. Fork this repository
2. Connect to Vercel: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgfarooqi%2Fprayersync)
3. Vercel will automatically deploy on every push to main

### Environment Variables
Set these in your Vercel dashboard:
```
DATAFORSEO_LOGIN=your-email@domain.com
DATAFORSEO_PASSWORD=your-api-password
```

### Manual Deployment
```bash
# Build and deploy
npm run build
vercel --prod
```

## 🎯 Target Audience

### Primary Users
- **Muslim Professionals**: Executives, consultants, lawyers, doctors
- **Business Travelers**: Frequent flyers who need prayer times globally
- **Tech Workers**: Muslim developers, designers, product managers
- **Corporate Muslims**: Employees in non-Muslim majority companies

### Use Cases
- Sync prayer times with work calendar
- Avoid scheduling conflicts with meetings
- Find prayer facilities while traveling
- Maintain prayer consistency during business travel
- Professional prayer break planning

## 📊 Features in Detail

### Calendar Integration
- **Universal Format**: .ics files work with all calendar apps
- **Professional Descriptions**: Shows as "Personal Time" to colleagues
- **Automatic Duration**: Configurable prayer duration (15-45 minutes)
- **Smart Reminders**: Customizable reminder times

### Travel Support
- **500+ Cities**: Major business destinations worldwide
- **Airport Guides**: Prayer room locations and facilities
- **Time Zone Handling**: Automatic adjustments for travel
- **Offline Mode**: Works without internet connection

### Professional Features
- **Meeting Conflict Detection**: Warns about prayer/meeting overlaps
- **Discrete Notifications**: Professional-friendly alerts
- **Multiple Calculation Methods**: Various Islamic schools of thought
- **Workplace Integration**: Calendar sync for corporate environments

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md).

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Prayer Time Calculations**: Based on astronomical formulas
- **Islamic Calendar**: Hijri date calculations
- **Community**: Built for the global Muslim professional community
- **Open Source**: Standing on the shoulders of giants

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/gfarooqi/prayersync/issues)
- **Discussions**: [GitHub Discussions](https://github.com/gfarooqi/prayersync/discussions)
- **Email**: support@prayersync.com

---

**Made with ❤️ for the Muslim professional community**

*"And establish prayer and give zakah and bow with those who bow" - Quran 2:43*