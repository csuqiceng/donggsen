import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ReloadPrompt } from './components/ReloadPrompt.tsx'

// ReloadPrompt 挂在根节点：每次加载（含登录屏）都立即注册 SW，离线缓存与新版本提示才生效
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ReloadPrompt />
  </StrictMode>,
)
