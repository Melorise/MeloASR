const root = document.querySelector<HTMLElement>('.voice-overlay')!;

window.meloOverlay.onState((state) => { root.dataset.state = state; });
