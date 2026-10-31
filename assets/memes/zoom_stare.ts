import { defineMeme } from '../../render/memes/api';

// Format: slow push-in on a deadpan stare (pair with a royalty-free bass hit SFX later).
export default defineMeme({
  name: 'zoom_stare', version: 1, kind: 'camera', slots: [], durationSec: 2.0,
  camera: { zoomTo: 1.7, expression: 'side_eye', mouth: 'closed' },
});
