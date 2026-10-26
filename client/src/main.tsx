import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import { RealtimeProvider } from './realtime';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><AuthProvider><RealtimeProvider><App /></RealtimeProvider></AuthProvider></BrowserRouter></React.StrictMode>
);
