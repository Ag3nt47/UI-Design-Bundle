# React 19 preview compatibility fix

The original `App.jsx` has six effects that implicitly return the Boolean returned by `writeStorage`. In React 19 development StrictMode, mount cleanup reports `destroy is not a function` and the renderer unmounts. Changing a persisted dependency can also trigger the invalid cleanup. The bundle retains this original source for provenance.

Use a block body, or explicitly discard the result:

```jsx
// Original
useEffect(() => writeStorage('skin', skin), [skin]);

// Corrected
useEffect(() => { writeStorage('skin', skin); }, [skin]);
// Equivalently: useEffect(() => void writeStorage('skin', skin), [skin]);
```

Apply the same change to the `modules`, `advanced`, `angle`, `skin`, `backlight`, and `brightness` storage effects. Their storage behavior and the visual design stay the same. The isolated `PalamedesEffects.jsx` kit does not have this defect.

`prepare-preview.mjs` creates a separate copy and applies only this fix. It refuses to overwrite a populated destination or write inside the original snapshot:

```sh
node reusable/prepare-preview.mjs /path/to/empty-preview
cd /path/to/empty-preview
npm ci
npm run dev
```

The Palamedes screenshots and animation frames use this compatibility fix in a temporary copy, fresh browser storage, and blocked external requests. Motion frames use the original animation definitions sampled through browser Web Animations and a virtual clock. The lazy loader is held by delaying its real workspace module request. No substitute screens or fabricated source visuals are used.
