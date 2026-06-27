import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';

// 字体注入和导出在 jsdom 下没有意义；统一打桩
const prepareWeddingFontsForExport = vi.fn(() => Promise.resolve('/* mocked font css */'));
vi.mock('./fonts', () => ({
    injectWeddingFonts: vi.fn(),
    prepareWeddingFontsForExport: (...args: unknown[]) =>
        (prepareWeddingFontsForExport as unknown as (...a: unknown[]) => unknown)(...args),
    WEDDING_FONT_FAMILY: 'sans-serif',
}));

const domToCanvas = vi.fn();
vi.mock('modern-screenshot', () => ({
    domToCanvas: (...args: unknown[]) => (domToCanvas as unknown as (...a: unknown[]) => unknown)(...args),
}));

import { WeddingInvitation, WeddingInvitationExportButton, type WeddingInvitationRef } from './WeddingInvitation';

const fakeCtx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
};

const makeFakeCanvas = () => {
    const canvas = {
        width: 800,
        height: 1200,
        getContext: vi.fn(() => fakeCtx),
        toDataURL: vi.fn(() => 'data:image/png;base64,AAA'),
    };
    return canvas;
};

beforeEach(() => {
    prepareWeddingFontsForExport.mockClear();
    domToCanvas.mockReset();
    domToCanvas.mockResolvedValue(makeFakeCanvas());
});

describe('WeddingInvitation', () => {
    it('使用默认字段渲染请柬', () => {
        render(<WeddingInvitation />);
        expect(screen.getByText('小狸')).toBeInTheDocument();
        expect(screen.getByText('小兔')).toBeInTheDocument();
        expect(screen.getByText('Wedding Invitation')).toBeInTheDocument();
        expect(screen.getByText('婚礼时间')).toBeInTheDocument();
    });

    it('渲染自定义字段', () => {
        render(
            <WeddingInvitation
                groomName="A"
                brideName="B"
                date="2030.01.01"
                weekday="星期一"
                time="11:00 AM"
                venue="V"
                address="Addr"
            />
        );
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.getByText('B')).toBeInTheDocument();
        expect(screen.getByText('2030.01.01')).toBeInTheDocument();
        expect(screen.getByText('V')).toBeInTheDocument();
    });

    it('showLotteryNumber=false 时不渲染抽奖区', () => {
        render(<WeddingInvitation showLotteryNumber={false} />);
        expect(screen.queryByText('婚礼抽奖券')).not.toBeInTheDocument();
        expect(screen.queryByText('抽奖码')).not.toBeInTheDocument();
    });

    it('ref 暴露 exportAsImage 与 getElement', () => {
        const ref = createRef<WeddingInvitationRef>();
        render(<WeddingInvitation ref={ref} />);
        expect(typeof ref.current?.exportAsImage).toBe('function');
        expect(ref.current?.getElement()).toBeInstanceOf(HTMLDivElement);
    });

    it('导出按钮：点击调用 ref.exportAsImage', async () => {
        const user = userEvent.setup();
        const ref = createRef<WeddingInvitationRef>();
        render(
            <>
                <WeddingInvitation ref={ref} />
                <WeddingInvitationExportButton targetRef={ref} />
            </>
        );
        const spy = vi.spyOn(ref.current!, 'exportAsImage').mockResolvedValue();
        await user.click(screen.getByRole('button', { name: /保存为图片/ }));
        expect(spy).toHaveBeenCalled();
    });

    it('exportAsImage：成功导出时调用 domToCanvas + 触发 a.click() 下载', async () => {
        const ref = createRef<WeddingInvitationRef>();
        const { container } = render(<WeddingInvitation ref={ref} />);

        // 拦截 a.click + remove
        const clickSpy = vi.fn();
        const origCreate = document.createElement.bind(document);
        const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            const el = origCreate(tag);
            if (tag === 'a') {
                el.click = clickSpy;
            }
            return el;
        });

        await act(async () => {
            await ref.current!.exportAsImage('test-card');
        });

        // 1. 字体准备被调用
        expect(prepareWeddingFontsForExport).toHaveBeenCalled();
        // 2. modern-screenshot 的 domToCanvas 被调用
        expect(domToCanvas).toHaveBeenCalled();
        // 3. canvas 拿 ctx + 打孔两次（左右两个半圆）
        expect(fakeCtx.arc).toHaveBeenCalledTimes(2);
        expect(fakeCtx.save).toHaveBeenCalled();
        expect(fakeCtx.restore).toHaveBeenCalled();
        // 4. 触发下载
        expect(clickSpy).toHaveBeenCalled();

        createSpy.mockRestore();

        // 5. 清理：临时 style 节点被移除
        const style = container.querySelector('style[data-wedding-export-fonts]');
        expect(style).not.toBeInTheDocument();
    });

    it('exportAsImage：默认 filename 不带 .png 时会自动补 .png', async () => {
        const ref = createRef<WeddingInvitationRef>();
        render(<WeddingInvitation ref={ref} />);
        let capturedName = '';
        const origCreate = document.createElement.bind(document);
        const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            const el = origCreate(tag);
            if (tag === 'a') {
                Object.defineProperty(el, 'download', {
                    set(v: string) {
                        capturedName = v;
                    },
                    get() {
                        return capturedName;
                    },
                });
                el.click = vi.fn();
            }
            return el;
        });

        await act(async () => {
            await ref.current!.exportAsImage('my-card');
        });
        expect(capturedName).toBe('my-card.png');

        await act(async () => {
            await ref.current!.exportAsImage('already.png');
        });
        expect(capturedName).toBe('already.png');

        createSpy.mockRestore();
    });

    it('exportAsImage：modern-screenshot 返回空 dataURL 时抛错', async () => {
        const ref = createRef<WeddingInvitationRef>();
        const empty = makeFakeCanvas();
        empty.toDataURL = vi.fn(() => 'data:,');
        domToCanvas.mockResolvedValueOnce(empty);
        render(<WeddingInvitation ref={ref} />);

        await expect(ref.current!.exportAsImage('x')).rejects.toThrow(/modern-screenshot/);
    });

    it('exportAsImage：缺失根节点时静默 no-op', async () => {
        const ref = createRef<WeddingInvitationRef>();
        // 卸载以清空 rootRef
        const { unmount } = render(<WeddingInvitation ref={ref} />);
        // 卸载前捕获 ref，再卸载即可让 ref.current = null
        const oldRef = ref.current!;
        unmount();
        // ref.current 在卸载后会被 React 置 null
        await expect(oldRef.exportAsImage('x')).resolves.toBeUndefined();
    });
});

describe('WeddingInvitationExportButton', () => {
    it('exportAsImage 抛错时弹 alert 并恢复按钮可点', async () => {
        const user = userEvent.setup();
        const fakeRef = {
            current: {
                exportAsImage: vi.fn(() => Promise.reject(new Error('boom'))),
                getElement: () => null,
            },
        } as unknown as React.MutableRefObject<WeddingInvitationRef | null>;
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(<WeddingInvitationExportButton targetRef={fakeRef} />);

        const btn = screen.getByRole('button', { name: /保存为图片/ });
        await user.click(btn);

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
        });
        expect(errorSpy).toHaveBeenCalled();
        expect(btn).not.toBeDisabled();

        alertSpy.mockRestore();
        errorSpy.mockRestore();
    });
});
