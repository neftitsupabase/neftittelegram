import { createRoot } from 'react-dom/client'
import './polyfills'
import App from './App'
import './styles/font-reset.css'
import './styles/fonts.css'
import './styles/globals.css'
import './styles/docs.css'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
