import { createRoot } from 'react-dom/client';
import './styles.css';
import { installGuard } from './guard.js';
import App from './App.jsx';

installGuard();
createRoot(document.getElementById('root')).render(<App />);
