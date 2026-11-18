import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles.css';
import {Workspace} from './components/workspace';
import type {View} from './modules/health-records/model';
function App(){const [path,setPath]=useState(location.pathname);useEffect(()=>{const update=()=>setPath(location.pathname);addEventListener('popstate',update);return()=>removeEventListener('popstate',update);},[]);const section=path==='/'?'overview':path.split('/')[1];if(!['overview','biology','sport','documents','timeline','settings'].includes(section))return <main className="empty-state"><h1>Ce chapitre n’existe pas.</h1><a href="/" className="button primary">Retour à mon espace</a></main>;return <Workspace view={section as View}/>;}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
