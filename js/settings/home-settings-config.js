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
        }
    ]);
})();
