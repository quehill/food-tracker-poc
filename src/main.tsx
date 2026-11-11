import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { requestPersistentStorage } from './ui/storage';
import './ui/styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

void requestPersistentStorage();

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
