import { useEffect, useRef, useState } from 'react';

export function useBufferedInput(
  externalValue: string,
  onCommit: (text: string) => void,
) {
  const [displayText, setDisplayText] = useState(externalValue);
  const latestTextRef = useRef(externalValue);

  // Sync display ← external value (stepper buttons, resets, programmatic changes)
  useEffect(() => {
    setDisplayText(externalValue);
    latestTextRef.current = externalValue;
  }, [externalValue]);

  const onChangeText = (text: string) => {
    latestTextRef.current = text;
    setDisplayText(text);
  };

  return {
    value: displayText,
    onChangeText: onChangeText,
    commit: () => onCommit(latestTextRef.current),
  };
}
