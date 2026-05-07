(function () {
    let hoverCaptureActive = false;

    function getCanvas() {
        return document.querySelector('canvas');
    }

    function createSyntheticPointerEvent(type, sourceEvent, buttons) {
        return new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: sourceEvent.pointerId || 1,
            pointerType: sourceEvent.pointerType || 'mouse',
            clientX: sourceEvent.clientX,
            clientY: sourceEvent.clientY,
            screenX: sourceEvent.screenX,
            screenY: sourceEvent.screenY,
            button: buttons ? 0 : -1,
            buttons,
            pressure: buttons ? 0.5 : 0,
            isPrimary: true
        });
    }

    function dispatchSynthetic(type, sourceEvent, buttons = 1) {
        const event = createSyntheticPointerEvent(type, sourceEvent, buttons);
        document.dispatchEvent(event);

        const target = getCanvas();
        if (target) {
            target.dispatchEvent(createSyntheticPointerEvent(type, sourceEvent, buttons));
        }
    }

    function beginHoverCapture(event) {
        if (event.pointerType && event.pointerType !== 'mouse') return;
        if (!hoverCaptureActive) {
            hoverCaptureActive = true;
            dispatchSynthetic('pointerdown', event, 1);
        }
    }

    function endHoverCapture(event) {
        if (!hoverCaptureActive) return;
        hoverCaptureActive = false;
        dispatchSynthetic('pointerup', event, 0);
    }

    document.addEventListener('pointermove', (event) => {
        if (!event.isTrusted) return;
        beginHoverCapture(event);
        if (hoverCaptureActive) {
            dispatchSynthetic('pointermove', event, 1);
        }
    }, { capture: true, passive: true });

    document.addEventListener('pointerleave', (event) => {
        if (!event.isTrusted) return;
        endHoverCapture(event);
    }, { capture: true, passive: true });

    document.addEventListener('pointercancel', (event) => {
        if (!event.isTrusted) return;
        endHoverCapture(event);
    }, { passive: true });

    window.addEventListener('blur', () => {
        hoverCaptureActive = false;
    });
})();
