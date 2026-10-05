import React from 'react';
import {createRoot} from 'react-dom/client';
import Practice from './practice';
import Sources from './dictionary-sources/page';
import './globals.css';
createRoot(document.getElementById('root')!).render(location.pathname==='/dictionary-sources'?<Sources/>:<Practice/>);
