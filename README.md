# Cheer Network

A modern platform for cheerleaders to connect with athletes, coaches, and personal trainers. Built with Node.js, TypeScript, PostgreSQL, and Supabase.

## Features

- **Athlete Networking**: Connect with fellow cheerleaders and build relationships within the community
- **Expert Coaching**: Access to certified coaches who understand the sport
- **Personal Training**: Specialized trainers focused on cheerleading physical demands
- **Dual Authentication**: Separate login/signup flows for athletes and coaches/trainers
- **Modern UI**: Clean, responsive design with black, blue, and gold color scheme

## Tech Stack

- **Backend**: Node.js with TypeScript
- **Database**: PostgreSQL with Supabase
- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **Security**: Helmet.js, CORS, JWT authentication
- **Development**: ts-node-dev for hot reloading

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

### 3. Development
```bash
# Start development server with hot reloading
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### 4. Access the Application
Open your browser and navigate to `http://localhost:3000`

## Project Structure

```
cheer-network/
├── src/
│   └── server.ts          # Express server setup
├── public/
│   ├── index.html         # Main homepage
│   ├── styles.css         # Styling with black/blue/gold theme
│   └── script.js          # Client-side JavaScript
├── dist/                  # Compiled TypeScript output
├── package.json
├── tsconfig.json
└── README.md
```

## Design Philosophy

The UI design is inspired by modern, clean aesthetics similar to Squarespace, featuring:

- **Color Scheme**: Primary black background with blue and gold accents
- **Typography**: Inter font family for clean, modern text
- **Layout**: Grid-based responsive design
- **Interactions**: Smooth animations and transitions
- **Accessibility**: High contrast and keyboard navigation support

## Features Implementation Status

### ✅ Completed
- [x] Homepage with hero section
- [x] Features showcase
- [x] Responsive navigation
- [x] Login/Signup modals with athlete/coach tabs
- [x] Clean, modern UI design
- [x] Mobile responsive layout

### 🔄 In Progress
- [ ] Supabase integration
- [ ] User authentication
- [ ] Database schema setup
- [ ] API endpoints

### 📋 Planned
- [ ] User profiles
- [ ] Messaging system
- [ ] Coach/trainer booking
- [ ] Event scheduling
- [ ] Payment integration
- [ ] Advanced search and filtering

## Development Notes

- The server uses TypeScript for type safety
- Express.js handles routing and middleware
- Helmet.js provides security headers
- CORS is configured for cross-origin requests
- Static files are served from the `public` directory

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details 