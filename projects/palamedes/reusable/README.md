# Isolated React effects

`PalamedesEffects.jsx` and `palamedes-effects.css` are **adaptations**, separate from the exact `../original/` snapshot. React is the only package dependency. Keep the adjacent MIT notice.

```jsx
import { useInstrumentPower, PowerOverlay, InstrumentFrame, WorkspaceLoader } from './PalamedesEffects.jsx';

export default function NewInstrument() {
  const { phase, powerOn, powerOff } = useInstrumentPower();
  return <>
    <PowerOverlay phase={phase} name="MY NEW PROJECT" mark="N" />
    {phase === 'off' ? <button onClick={powerOn}>Power on</button> :
      <InstrumentFrame screenKey="dashboard" backlight="#4cddb1">
        <button onClick={powerOff}>Power off</button>
        <WorkspaceLoader label="Loading your data…" />
      </InstrumentFrame>}
  </>;
}
```

Change `screenKey` when switching screens to replay the 300 ms screen entrance. Render `WorkspaceLoader` only while an actual async operation is pending. Render `ProgressWheel value={percentage}` for measured progress. `ModalBackdrop` supplies the visual fade and backdrop click callback; place your own accessible dialog inside it, with focus trapping, Escape handling and focus restoration.

The original power-state timings (1050 ms opening, 500 ms closing) are retained. The loading strip is decorative; it does not indicate actual saving/loading completion. Connect your own operation completion before reporting successful saving. No method here minimizes or closes an OS window. For Electron, see the original bridge and call native close only after your operation and chosen animation have completed.

The prefixed CSS avoids global application resets. The small adaptation uses a simple inline SVG instead of lucide-react for the orbit, a 200 px minimum frame instead of the original 450 px, and a 300 px minimum loading area instead of 390 px; all motion recipes retain their source values. Names/labels are configurable. Add your product's navigation, data and semantics around these effects.
