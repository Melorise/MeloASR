const root = document.querySelector<HTMLElement>('.voice-overlay')!;

root.addEventListener('click', () => window.meloOverlay.toggleRecording());
root.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') window.meloOverlay.toggleRecording();
});
window.meloOverlay.onState((state) => { root.dataset.state = state; });
