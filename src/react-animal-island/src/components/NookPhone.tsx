import React, { useState, useEffect } from 'react';
import { Icon } from 'animal-island-ui';
import type { IconName } from 'animal-island-ui';
import './NookPhone.css';

export interface NookApp {
  id: string;
  iconName: IconName;
  color: string;
  offset?: boolean;
  hasNewMessage?: boolean;
  iconStyle?: React.CSSProperties;
}

export interface NookPhoneProps {
  className?: string;
  /** 全部 APP（按 appsPerPage 自动分页） */
  apps: NookApp[];
  appsPerPage?: number;
  /** 点击某个 APP */
  onAppClick?: (appId: string) => void;
}

/**
 * 本地版动森手机：基于 animal-island-ui Phone 源码移植，
 * 额外支持多页（点底部页码切换）与 APP 点击回调。
 */
export const NookPhone: React.FC<NookPhoneProps> = ({ className, apps, appsPerPage = 9, onAppClick }) => {
  const [time, setTime] = useState(new Date());
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 切分页
  const pages: NookApp[][] = [];
  for (let i = 0; i < apps.length; i += appsPerPage) pages.push(apps.slice(i, i + appsPerPage));
  const safePage = Math.min(page, pages.length - 1);
  const current = pages[safePage] || [];

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');

  return (
    <div className={`np-phoneContainer ${className || ''}`}>
      <div className="np-phone">
        <div className="np-screenContent">
          <div className="np-homeScreen">
            <div className="np-dateDisplay">
              <div className="np-dateDisplayHeader">
                <span className="np-iconWifi" />
                <div>
                  {displayHours}
                  <span className="np-blink">:</span>
                  {displayMinutes}
                  {ampm}
                </div>
                <span className="np-iconLocation" />
              </div>
              <div className="np-dayText">Welcome!</div>
            </div>
            <div className="np-appsGrid">
              {current.map(app => (
                <button
                  key={app.id}
                  type="button"
                  className={`np-appItem ${app.offset ? 'np-appItemOffset' : ''}`}
                  style={{ backgroundColor: app.color }}
                  onClick={() => onAppClick?.(app.id)}
                  aria-label={app.id}
                >
                  {app.hasNewMessage && <span className="np-badge" />}
                  <Icon
                    name={app.iconName}
                    size="100%"
                    className={`np-appIcon ${app.offset ? 'np-appIconOffset' : ''}`}
                    style={{ backgroundSize: '70% auto', ...app.iconStyle }}
                  />
                </button>
              ))}
            </div>
            <div className="np-pageIndicator">
              {pages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`np-pageDot ${i === safePage ? 'active' : ''}`}
                  aria-label={`切换到第 ${i + 1} 页`}
                  onClick={() => setPage(i)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
