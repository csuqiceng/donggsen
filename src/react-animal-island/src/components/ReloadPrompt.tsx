import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from 'animal-island-ui';

// 对齐旧版 updateNotice：检测到新版本 SW 后提示「点击刷新」。
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url) {
      // autoUpdate：定期检查新版本
      console.log('SW registered:', url);
    },
  });

  if (!needRefresh && !offlineReady) return null;

  const close = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return (
    <div className="reload-prompt">
      <div className="reload-prompt-body">
        <span>{needRefresh ? '发现新版本，点击刷新。' : '应用已可离线使用。'}</span>
        <div className="reload-prompt-actions">
          {needRefresh && (
            <Button type="primary" onClick={() => updateServiceWorker(true)}>
              刷新
            </Button>
          )}
          <Button onClick={close}>稍后</Button>
        </div>
      </div>
    </div>
  );
}
