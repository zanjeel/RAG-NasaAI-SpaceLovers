# NASA AI - Space Knowledge Assistant

A RAG (Retrieval Augmented Generation) powered AI chatbot that provides information about NASA's space missions, telescopes, and space exploration. Built with Next.js and powered by Google's Gemini AI.

## 🌐 Live Demo
Visit the live application at: [NASA AI Space Lovers](https://rag-nasaai-spacelovers.onrender.com/)

## 🎥 Demo Video
Watch the demo video: [NASA AI Demo](media/NASA-Recording.mp4)

## 🚀 Technologies Used
- **Frontend**: Next.js 14, React, TypeScript
- **AI/ML**: Google Gemini AI (Gemini 1.5 Flash)
- **Database**: Astra DB (Vector Database)
- **Styling**: CSS3 with Custom Variables
- **Deployment**: Render

## 🛠️ Features
- Real-time chat interface with AI
- Vector-based semantic search
- Responsive design for all devices
- Streaming responses
- Pre-defined prompt suggestions
- Beautiful UI with dark theme

## 📋 Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Google API Key
- Astra DB Account and credentials

## 🔧 Environment Variables
Create a `.env` file in the root directory with the following variables:
```env
GOOGLE_API_KEY=your_google_api_key
ASTRA_DB_NAMESPACE=your_namespace
ASTRA_DB_COLLECTION=your_collection
ASTRA_DB_API_ENDPOINT=your_api_endpoint
ASTRA_DB_APPLICATION_TOKEN=your_application_token
```

## 🚀 Getting Started

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd nasa-ai
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Set up environment variables**
- Copy the `.env.example` file to `.env`
- Fill in your environment variables

4. **Run the development server**
```bash
npm run dev
# or
yarn dev
```

5. **Open [http://localhost:3000](http://localhost:3000) in your browser**

## 🗄️ Database Setup
The project uses Astra DB as a vector database. You'll need to:
1. Create an Astra DB account
2. Create a new database
3. Create a collection for storing embeddings
4. Run the database seeding script:
```bash
npm run seed
# or
yarn seed
```

## 🏗️ Build for Production
```bash
npm run build
# or
yarn build
```

## 🚀 Deployment
The application is deployed on Render. To deploy:
1. Push your code to GitHub
2. Connect your repository to Render
3. Set up environment variables in Render dashboard
4. Deploy!

## 📱 Mobile Responsiveness
The application is fully responsive and works on:
- Desktop
- Tablet
- Mobile devices

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
