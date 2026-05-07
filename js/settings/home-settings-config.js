(function () {
    window.HomeSettingsConfig = Object.freeze([
        {
            id: 'theme',
            title: '\u4e3b\u9898',
            items: [
                {
                    type: 'choice',
                    path: 'theme.preference',
                    label: '\u754c\u9762\u4e3b\u9898',
                    options: [
                        { value: 'light', label: '\u6d45\u8272' },
                        { value: 'dark', label: '\u6df1\u8272' },
                        { value: 'auto', label: '\u8ddf\u968f\u7cfb\u7edf' }
                    ]
                }
            ]
        },
        {
            id: 'interaction',
            title: '\u4ea4\u4e92\u7279\u6548',
            items: [
                { type: 'toggle', path: 'effects.particles', label: '\u7c92\u5b50\u7279\u6548' },
                { type: 'toggle', path: 'effects.trail', label: '\u62d6\u5c3e\u7279\u6548' },
                { type: 'toggle', path: 'effects.click', label: '\u70b9\u51fb\u7279\u6548' }
            ]
        },
        {
            id: 'portfolio',
            title: '\u4f5c\u54c1\u89c6\u56fe',
            items: [
                {
                    type: 'choice',
                    path: 'portfolio.layout',
                    label: '\u7cbe\u9009\u4f5c\u54c1\u6392\u5e03',
                    options: [
                        { value: 'grid', label: '\u5e73\u94fa\u5361\u7247' },
                        { value: 'circle', label: '\u5706\u5f62\u753b\u5eca' }
                    ]
                }
            ]
        },
        {
            id: 'background',
            title: '\u80cc\u666f\u6548\u679c',
            items: [
                {
                    type: 'range',
                    path: 'background.blur',
                    label: '\u80cc\u666f\u6a21\u7cca',
                    min: 0,
                    max: 100,
                    step: 1,
                    unit: '%'
                },
                {
                    type: 'choice',
                    path: 'background.effect',
                    label: '\u52a8\u6001\u80cc\u666f',
                    options: [
                        { value: 'none', label: '\u5173\u95ed' },
                        { value: 'jellyfish', label: '\u6c34\u6bcd\u6e38\u52a8' },
                        { value: 'rain', label: '\u96e8\u6ef4\u73bb\u7483' }
                    ]
                }
            ]
        },
        {
            id: 'live2d',
            title: 'Live2D',
            items: [
                {
                    type: 'choice',
                    path: 'live2d.renderer',
                    label: '\u89d2\u8272\u6e32\u67d3',
                    options: [
                        { value: 'widget', label: 'Widget \u8ddf\u968f' },
                        { value: 'sdk', label: '\u5b98\u65b9 SDK' }
                    ]
                }
            ]
        },
        {
            id: 'playground',
            title: '\u8f7b\u677e\u5165\u53e3',
            items: [
                {
                    type: 'action',
                    actionId: 'openTarot',
                    label: '\u7b97\u4e00\u7b97\u4eca\u65e5\u8fd0\u52bf',
                    description: '\u4e00\u4e2a\u4f4e\u8c03\u7684\u5c0f\u6d4b\u8bd5\uff0c\u60f3\u73a9\u7684\u65f6\u5019\u518d\u6253\u5f00'
                }
            ]
        }
    ]);
})();
